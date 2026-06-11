# GroomPace — Leaderboard Security and Privacy Design

*This document describes the concrete design for leaderboard anonymity and anti-cheat.
Implementation must match what is described here. Departures require updating this document
first, not after.*

---

## Design principles

Two properties are non-negotiable (from PRODUCT.md):

1. **No real identity on the leaderboard.** A user's auth identity — their email address,
   their Supabase `auth.uid` — must be unreachable from leaderboard data, even to an attacker
   who has read access to the entire `leaderboard_entries` table.

2. **Scores are never trusted from the client.** The timer runs on-device. We cannot
   independently verify a claimed duration. The server applies plausibility checks; implausible
   submissions are rejected before touching the leaderboard table.

---

## Schema sketch

These are logical definitions, not production DDL. Real migrations will be written
slice-by-slice with full SQL, constraints, and indexes. The reasoning for each design choice
is annotated inline.

```sql
-- Managed by Supabase Auth — application code cannot SELECT directly.
-- Contains: id (uuid), email, created_at, last_sign_in_at.
-- Referenced by other tables via foreign key but never exposed to queries.
-- auth.users  (Supabase-managed, not shown)


-- One row per signed-in user.
-- The only table that links an auth identity to a user-chosen handle.
CREATE TABLE profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle            text UNIQUE NOT NULL,    -- public display name, no PII
  region            text,                    -- state/region only ("WA", "CA") — optional
  handle_changed_at timestamptz,             -- rate-limit: one change per 30 days
  created_at        timestamptz DEFAULT now()
);


-- Private groom sessions. The user's personal training data.
-- Never exposed in the leaderboard path.
CREATE TABLE groom_sessions (
  id           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dog_name     text,                         -- nullable — user may omit
  breed        text      NOT NULL,
  duration_min integer   NOT NULL CHECK (duration_min >= 1),
  difficulty   smallint  CHECK (difficulty BETWEEN 1 AND 3),
  splits       jsonb,
  groomed_at   timestamptz NOT NULL,
  created_at   timestamptz DEFAULT now(),    -- set by server: proves session existed before submit
  updated_at   timestamptz DEFAULT now(),    -- client-set at moment of edit for LWW sync
  deleted_at   timestamptz                   -- soft delete: propagates across devices
);


-- Leaderboard entries. Written ONLY by the server-side validation function.
-- This table intentionally has NO user_id column.
CREATE TABLE leaderboard_entries (
  id           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  handle       text      NOT NULL,    -- SNAPSHOT of profiles.handle at submit time
  region       text,                  -- SNAPSHOT of profiles.region at submit time
  breed        text      NOT NULL,
  difficulty   smallint  NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  duration_min integer   NOT NULL CHECK (duration_min >= 1),
  session_id   uuid      NOT NULL,    -- audit reference to groom_sessions; NOT a FK (see below)
  submitted_at timestamptz DEFAULT now()
  -- Deliberately NO user_id column.
);
```

### Why `session_id` is stored but not a foreign key

If `session_id` were a real `REFERENCES groom_sessions(id)` constraint, any client who held
their own session rows could traverse: `leaderboard_entries.session_id → groom_sessions.id →
groom_sessions.user_id → auth.users`. The join path would exist at the schema level.

Storing `session_id` as a plain `uuid` column (no FK) breaks that join path structurally. The
server can still use it for audit lookups (via a service-role key that bypasses RLS), but no
client query can follow the reference. This is intentional: the schema itself enforces the
anonymity guarantee, not just the application code.

### Why `handle` is a snapshot

When a user changes their handle, old leaderboard entries retain the handle under which they
were earned. This is the correct competitive behavior (you can't retroactively rename a record).
It also means the `leaderboard_entries` table has no foreign key to `profiles` — there is no
join path from a leaderboard entry to a profile row, and therefore no path to `auth.users.id`
or an email address.

### Why there is no `user_id` column in `leaderboard_entries`

This is the core anonymity guarantee. A `SELECT *` on `leaderboard_entries` returns handles
and times — nothing linkable to a real person. If the Supabase project were fully compromised
and the database dumped, `leaderboard_entries` would reveal only competitive rankings under
pseudonyms. Auth identity lives in `auth.users`; it does not propagate into the leaderboard
schema at all.

---

## Row-level security policies

RLS must be enabled on all three tables. **Policies that are not listed here are implicitly
denied** — Postgres's default is to reject all access when RLS is enabled and no policy
matches.

```sql
-- ── profiles ──────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read any profile.
-- Rationale: the leaderboard UI needs to display handles; handles are by definition
-- semi-public (the whole point is that other users see them).
CREATE POLICY "profiles readable by authenticated users"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- A user can create their own profile row on first sign-in.
CREATE POLICY "users insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A user can update their own profile only.
CREATE POLICY "users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- No DELETE policy — profiles are not deleted; the auth.users ON DELETE CASCADE handles
-- account deletion, which cascades to profiles automatically.


-- ── groom_sessions ────────────────────────────────────────────────────────────

ALTER TABLE groom_sessions ENABLE ROW LEVEL SECURITY;

-- Users have full access to their own rows only.
-- The USING clause filters reads; WITH CHECK guards writes.
-- Both use auth.uid() = user_id, so a user cannot read, write, or delete anyone else's rows.
CREATE POLICY "users access own sessions"
  ON groom_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── leaderboard_entries ───────────────────────────────────────────────────────

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the leaderboard.
-- Unauthenticated (anon) users cannot — they must sign in to participate or view.
CREATE POLICY "leaderboard readable by authenticated users"
  ON leaderboard_entries FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT, UPDATE, or DELETE policy for any client role.
-- The absence of a policy means Postgres denies the operation.
-- Only the service-role key (held exclusively by the Edge Function) can write here.
```

### What RLS cannot protect against

A caller with the Supabase `service_role` key bypasses RLS entirely. This key must never be
shipped to the client. It must exist only in Edge Function environment variables (configured
via the Supabase dashboard or CLI secrets — never checked into source code).

The Supabase `anon` key (the only key the client app holds) is subject to all RLS policies
above. Even if the anon key is exposed (e.g., via browser DevTools), an attacker cannot read
other users' sessions, write to the leaderboard, or link leaderboard entries to auth identities.

---

## Server-side validation (Edge Function: `submit-leaderboard`)

The client cannot directly INSERT into `leaderboard_entries`. It calls the
`submit-leaderboard` Edge Function with a session UUID. The function:

1. **Verifies the caller's JWT.** Supabase Auth validates the Authorization header
   automatically. An unauthenticated call is rejected before any application logic runs.
2. **Reads the session from `groom_sessions`** using the authenticated user's `auth.uid()`.
   The RLS policy on `groom_sessions` means this query only succeeds if the session belongs
   to the caller — the function cannot be tricked into validating someone else's session.
3. **Applies plausibility rules** (see table below).
4. **Reads the caller's handle and region from `profiles`.**
5. **Inserts into `leaderboard_entries`** using the service-role key if all checks pass,
   writing the handle and region as snapshots (not foreign keys).

The client never touches the service-role key. The Edge Function is the only code that holds
it.

### Plausibility rules

| Rule | Implementation | Rationale |
|---|---|---|
| `duration_min >= 1` | `CHECK` constraint on table + validation in function | Catches accidental zero-time saves (already enforced locally; server is the double-check) |
| `duration_min <= 480` | Validation in function | An 8-hour session is an abandoned or forgotten timer, not a competitive record |
| Breed × difficulty minimum time floor | Lookup table of `(breed, difficulty) → min_minutes` | A Standard Poodle full groom in under 10 minutes is physically impossible. This is the primary anti-cheat check. The floor times must be set conservatively (realistic fast times, not world-record times) |
| `groom_sessions.groomed_at <= now() - INTERVAL '60 seconds'` | Checked in function against server's clock | Prevents submitting a session that hasn't finished yet (edge case: race condition where the review screen is submitted before the session record is old) |
| `groom_sessions.created_at <= now()` | Implicit — `created_at` is a server-set default | Confirms the session existed in the database before the submission attempt. Does not verify duration, but proves the record wasn't fabricated post-hoc |
| Rate limit: 10 leaderboard submissions per user per 24-hour window | Checked against `COUNT` of recent entries by `session_id` path in function | Limits blast radius of automated submission attacks |
| Session not already submitted | Check for existing entry with same `session_id` | Prevents double-submission of the same groom |

### What we cannot verify (and why — be honest about this)

The timer runs on-device. We cannot independently confirm the clock wasn't manipulated, that
the device time was accurate, or that the app code wasn't modified. This is a fundamental
limitation of any client-side timer in a competitive context.

Mitigations in order of strength:

- **Breed × difficulty floor** catches obviously impossible results. A bot that submits 30
  seconds for a Standard Poodle is rejected; a bot that submits 8 minutes (the floor) is
  technically accepted — but 8 minutes for a poodle is still competitive, not a corrupted
  board.
- **Rate limiting** bounds damage: 10 manipulated entries per day per account is not a board-
  destroying attack.
- **`created_at` is server-set**, so we can prove when the session record was created relative
  to the submission. We can't verify the duration, but we can verify the session was in the
  database before the submission was attempted.
- **Statistical flagging (future feature):** Track each user's average by breed × difficulty.
  Flag entries more than 2 standard deviations below their own historical average for human
  review. Don't auto-reject — groomers do have genuinely exceptional days.
- **Community reporting (future feature):** Authenticated users can flag an entry. Flags are
  stored in a `leaderboard_flags` table visible only to the server (service-role) and a
  future admin role.

**The honest answer:** GroomPace's leaderboard is a motivational tool for professional
groomers, not an esports competition with prize money. The anti-cheat design is proportionate
to the threat: it blocks accidental corruption and low-effort manipulation, not a sophisticated
adversary. If the leaderboard ever carries real stakes, the validation design will need to grow
with it.

---

## Handle anonymity guarantees

| Guarantee | How it's enforced |
|---|---|
| No real names on the leaderboard | `profiles.handle` is user-chosen; no real-name field exists in the schema |
| No email addresses reachable from leaderboard data | `leaderboard_entries` has no `user_id`; no join path to `auth.users.email` exists |
| No location below state/region level | `profiles.region` accepts only state/region codes ("WA", "CA"); no city, postal code, or GPS |
| User can wipe leaderboard presence | "Remove my entries" Edge Function deletes all `leaderboard_entries` rows where `session_id IN (SELECT id FROM groom_sessions WHERE user_id = auth.uid())` — the only way to identify a user's entries without a `user_id` column |
| Handle changes don't retroactively rename old entries | `leaderboard_entries.handle` is a snapshot — old entries keep the handle under which they were earned |

### The "Remove my entries" operation in detail

Because `leaderboard_entries` has no `user_id` column, the client cannot DELETE its own rows
with a simple `WHERE user_id = auth.uid()`. The operation requires:

1. The client calls a `wipe-leaderboard-entries` Edge Function (authenticated).
2. The function queries `groom_sessions` for all session IDs belonging to `auth.uid()` (RLS
   ensures this only returns the caller's rows).
3. The function uses the service-role key to DELETE from `leaderboard_entries` where
   `session_id = ANY(user_session_ids)`.
4. The function returns a count of deleted entries to confirm to the user.

This two-step path (through `groom_sessions` as a lookup, then DELETE via service role) is
the intended design. It works precisely because `session_id` is stored in both tables — the
server can perform the lookup; the client cannot.

---

## Threat model summary

| Threat | Mitigation | Residual risk |
|---|---|---|
| User reads another user's groom data | RLS on `groom_sessions`: query denied at database layer | None — structural |
| Client inserts fabricated leaderboard score | No INSERT policy on `leaderboard_entries` for client key | Edge Function validates before inserting; floor times block impossible scores |
| Database dump reveals user identities | `leaderboard_entries` has no `user_id` or email; handle is the only identifier | Handles are semi-public by design |
| Compromised `anon` key | RLS is enforced regardless of which key is used | Attacker can read public leaderboard (intended) and their own sessions only |
| Handle enumeration | Handles are readable by authenticated users (intended — the leaderboard is semi-public) | Handles should be treated as semi-public identifiers, not secrets; document this to users |
| Automated submission bot | JWT requirement (must be a real auth session) + 10/day rate limit | Sophisticated bot with real accounts submitting 10 entries/day is tolerable and flaggable |
| Service-role key leaked | Key must never be in client code or source control | Developer must store it only in Supabase Edge Function secrets |
