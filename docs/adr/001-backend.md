# ADR 001: Backend platform selection

**Date:** 2026-06-11
**Status:** Accepted
**Decider:** Solo developer (CS student, one production user)

---

## Context

GroomPace needs a backend to support three features defined in PRODUCT.md:

1. **Cloud backup** — a user's groom history is stored durably and can be restored on a new
   device after a phone loss or upgrade
2. **Anonymized leaderboard** — opt-in competitive rankings by breed × difficulty with zero
   PII leakage (see PRODUCT.md: "Auth identity and leaderboard handle are separated in the
   schema")
3. **PRO multi-device sync** — groom history synchronized across two or more devices with
   conflict resolution

These features have hard non-negotiable constraints. From PRODUCT.md:

- Auth identity and leaderboard handle **must be separated** in the schema — a compromised
  leaderboard table must not reveal who a user is
- **Row-level security is required** — a user must never be able to query another user's
  private groom data, even by constructing a direct API request
- **Server-side score validation is required** — the client timer is untrusted for leaderboard
  submissions
- **The local app must keep working offline** — the backend is an enhancement, not a
  dependency for core functionality

Additional constraints that shape the decision:

- **Solo student developer.** There is no team. Infrastructure operations eat directly into
  feature time, so low operational overhead matters a lot.
- **Free-tier budget.** The app earns zero revenue until PRO tier ships. The backend must cost
  $0 until there are paying users.
- **No build step, no bundler.** The project rule is vanilla JS loaded via `<script src>`.
  Any client SDK must be loadable from a CDN without a build pipeline.
- **Vercel frontend already deployed.** The static site is on Vercel. Serverless functions
  that integrate with that deployment are preferable to managing a separate server.
- **User data is sacred.** One real person uses this app daily. Schema changes require
  migrations; data must be safe at rest.

---

## Options considered

### Option A: Supabase

Supabase is an open-source Firebase alternative built on PostgreSQL. It provides managed
auth, a real Postgres database with row-level security, object storage, and Edge Functions
(Deno runtime). The entire stack is open-source and can be self-hosted.

**Strengths for this use case:**

**RLS is a first-class Postgres feature enforced at the database layer.** The constraint
"user A must not see user B's rows" maps exactly to:

```sql
CREATE POLICY "users access own sessions" ON groom_sessions
  FOR ALL USING (auth.uid() = user_id);
```

This policy is enforced by the database itself, not by application code. A bug in an Edge
Function cannot accidentally expose another user's data, because the database engine will
refuse the query regardless of what the function tries to do. This is the only option in this
list where that guarantee is structurally true.

**Auth identity / leaderboard handle separation is the natural design.** Supabase manages
`auth.users` as a protected table that application code cannot `SELECT` directly. Our
`profiles` table stores only the columns we choose to expose. The leaderboard table can store
a `handle` snapshot and no `user_id` column at all — making it impossible to join back to an
email address from the leaderboard data.

**Free tier is generous for our scale.** 500 MB database, 1 GB object storage, unlimited
API requests. GroomPace will have single-digit to low-tens of users for the foreseeable
future. The free tier is not a short runway — it's effectively unlimited at this scale.

**CDN-loadable client.** The Supabase JS UMD build loads via a standard `<script>` tag. No
bundler, no npm, consistent with project rules. The import only runs when auth features are
active; the base app path never touches Supabase.

**Edge Functions** (Deno) run server-side validation for leaderboard submissions. They deploy
from the Supabase CLI without requiring a separate serverless platform.

**Self-hostable escape hatch.** If Supabase the company were to pause or become unacceptable,
the entire stack — Postgres, Auth, Storage, Functions — can be deployed on a $5/month VPS
using the open-source Supabase Docker stack. This is meaningful data-ownership insurance for
a project where the developer's spouse's data lives in the system.

**Weaknesses / risks:**

**Free tier project pausing.** Supabase pauses free-tier projects after 7 days of inactivity.
If the app goes unused for a week (e.g., the user is on vacation), the next request gets a
cold-wake delay of several seconds. Mitigation: a daily ping from a lightweight scheduled task
(a Vercel Cron Function hitting a harmless Supabase endpoint) keeps the project awake. This
is a known and well-documented operational quirk — annoying, but manageable.

**Vendor lock-in at the client SDK level.** The Supabase JS client uses Supabase-specific auth
patterns and query builders. Migrating to a different backend later would mean rewriting the
sync and auth client code — roughly the same effort as writing it the first time (~2 days at
current app scale). This is real but not catastrophic.

**Postgres is more powerful than necessary initially.** A simple SQLite database would handle
this data model fine. The operational cost of managed Postgres, however, is borne by Supabase.
Having Postgres available is strictly a superset — it doesn't hurt, and it makes the leaderboard
queries (GROUP BY breed × difficulty, ORDER BY duration, pagination) straightforward.

**Edge Function cold starts.** Deno Edge Functions have non-trivial cold-start latency on the
first request after a period of inactivity. Leaderboard submission is an infrequent action (a
user submits one groom to the leaderboard at a time, not in bulk). A 1–2 second wait on cold
start is acceptable for this path.

---

### Option B: Appwrite

Appwrite is an open-source BaaS with auth, a document-oriented database, storage, and
functions. It is best known for its self-hosted story — you run it on your own server via
Docker Compose.

**Strengths:**
- Strong data ownership when self-hosted — you control the hardware
- No project pausing on self-hosted deployment
- Similar feature surface to Supabase (auth, database, storage, functions)

**Weaknesses for this use case:**

**Appwrite's database is not Postgres, and it does not have row-level security.** Access
control is done via Collection-level roles and Permission objects. These are coarser-grained
than Postgres RLS: you can say "authenticated users can read this collection," but you cannot
say "a user can only read rows where `user_id = auth.uid()`" at the database level. That
check lives in application code — which means a bug in application code *can* leak rows.

For our constraints, this is a genuine gap. The non-negotiable requirement is that private
groom data is protected at the storage layer, not the application layer. Appwrite doesn't
provide that.

**Handling auth/leaderboard separation is possible but requires more discipline.** Without
RLS, keeping auth identity out of leaderboard queries is an application-layer responsibility.
Every query that touches leaderboard data must be carefully audited to ensure it doesn't
accidentally join back to user identity. With Postgres RLS, the database rejects unauthorized
joins automatically.

**Self-hosting overhead for a solo student.** Running Appwrite requires ~6 Docker containers
(Appwrite itself, MariaDB, Redis, InfluxDB, a worker, and a proxy). Managing this stack —
updates, backups, TLS certificate renewal, monitoring — is non-trivial operational load with
no direct product benefit. The "stronger data ownership" story is real, but not valuable enough
to pay for with a student's limited time.

**Smaller community.** Fewer examples, fewer Stack Overflow answers, less mature ecosystem.
When debugging an unfamiliar integration at 11 PM, Supabase's extensive documentation and
active community are a meaningful advantage.

**Assessment:** Appwrite is a reasonable choice for a team with ops capacity and a strong
data-sovereignty requirement. It is the wrong tool here: its absence of row-level security
is a structural gap against our exact constraints, and its self-hosting story asks more of the
developer than the project can afford.

---

### Option C: Custom backend (Node.js/Fastify + PostgreSQL)

Writing a custom REST or GraphQL API using Node.js, a Postgres instance (e.g., Neon or
Supabase Postgres only), and a session/auth library (e.g., Lucia, better-auth).

**Strengths:**
- Total control over every architectural decision
- No vendor lock-in
- Useful as a learning exercise in production backend engineering

**Weaknesses for this use case:**

**The scope is enormous relative to the value.** Auth alone — secure password hashing, session
token management, magic-link email delivery, CSRF protection, token rotation, rate limiting —
is weeks of implementation work before any application feature can be built. Supabase provides
this for free, with years of security hardening already applied.

**Ops overhead with no return.** A custom API server needs hosting (a VPS or serverless
platform), deployment automation, security patching, and monitoring. None of this ships product
features. For a solo student on a zero-budget timeline, this is a poor trade.

**Free-tier budget.** Combining a custom Node.js server with a managed Postgres instance means
paying for at least the compute tier of the hosting platform. The Supabase free tier bundles
both at zero cost.

**Re-implementing what Supabase gives for free is a trap.** "We have more control" is true but
moot when the application layer is simple CRUD with standard access-control requirements.
Control is valuable when you have unusual requirements; here, Supabase's design fits the
requirements precisely.

**Assessment:** The right choice for a team with a dedicated backend engineer, an unusual
system design, or a strong learning goal in backend infrastructure. Not appropriate here —
the time is better invested in product features.

---

## Decision

**Use Supabase.**

Three factors drive this conclusion:

1. **Postgres RLS is the best available mechanism for our exact security constraints.** The
   non-negotiable requirements — user-data isolation and auth/leaderboard identity separation —
   map directly onto what RLS was designed to do. It is enforced at the database layer, not the
   application layer, which is the strongest available guarantee.

2. **Auth and managed database at zero marginal cost for our user count.** The free tier
   handles single-digit to low-tens of users indefinitely. The same platform scales to PRO
   tier without a migration.

3. **DX and documentation appropriate for a solo student on a zero-budget timeline.** No
   Docker stack to manage, no server to provision, CDN-loadable client, excellent docs. The
   time saved on infrastructure goes directly into the product.

The project-pausing weakness is real and requires a keep-alive job (low-cost, one-time
setup). The vendor lock-in is real but the self-hosting escape hatch makes it tolerable —
the open-source core means data is never truly trapped.

---

## Consequences

**Positive:**
- Row-level security handles user-data isolation automatically and structurally
- Auth (magic link, session management, token refresh) is provided, not built
- Zero infrastructure cost until real users exist
- Open-source stack means data portability is always possible

**Negative:**
- Free-tier project must be kept active via a daily keep-alive ping, or queries during
  inactivity periods will have a multi-second cold-wake delay
- Supabase JS client, loaded via CDN, adds a transient network dependency for auth features
  (the base app path — timer, logging, photos — never imports it and remains fully offline)
- A future migration off Supabase requires rewriting sync/auth client code — estimated ~2 days
  at current app scale

**Monitoring:**
- If free-tier project pauses become user-visible, add a Vercel Cron Function pinging a
  lightweight Supabase health endpoint once daily
- Revisit platform choice if monthly active users exceed ~1,000, at which point Supabase Pro
  pricing ($25/mo) should be evaluated against self-hosted cost
