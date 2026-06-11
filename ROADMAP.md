# GroomPace Roadmap

*Last updated: 2026-06-11. Reflects v0.6.4 shipped state.*

## How to read this document

PLAN.md covered the local-only app through file extraction and polish. Most of that is shipped;
some slices remain. PRODUCT.md defines the next horizon: optional accounts, cloud backup, and
anonymized leaderboards via Supabase. This document merges both into one ordered sequence
where every milestone ships to production as a complete, working feature — no partial rollouts
visible to users, no breaks for the one real production user.

**The "never break main" rule applies to every slice, every time.** A slice is done when:
- The app fully works offline with no account (baseline never regresses)
- CACHE_NAME is bumped if any deployed file changed (invariant #3)
- APP_VERSION matches CACHE_NAME (invariant #5)
- A manual test on the deployed Vercel URL has passed
- Export/import still works (invariant #4)

---

## Local-first sync architecture

Read this before writing any backend code. Getting this model right prevents a class of
subtle bugs that are very hard to diagnose after the fact.

### Source of truth

**The local device is always the source of truth for writes.** No network call is required
before a user can log a groom, edit a record, or update a PB. The app is "local-first," which
means offline is the baseline — not a fallback mode that gets reduced features.

Think of Supabase's role the way `git push` relates to `git commit`: the commit is real and
complete locally the moment it happens; the push is a separate operation that broadcasts it to
a shared location. A failed push does not undo the commit. Similarly, a failed sync does not
undo the local write.

### Conflict resolution

**Free tier (single device, cloud backup only):** There is only ever one writer. Sync is
effectively unidirectional: upload sessions the server doesn't have yet, download sessions
when signing into a new device. True conflicts cannot happen — the user has one device.

**PRO tier (multi-device sync):** Two devices can edit the same record offline, then both
sync. The resolution strategy is **last-write-wins (LWW) on `updated_at` timestamps.**

Why LWW is the right choice here:
- Groom sessions are personal performance records, not collaborative documents. Two devices
  editing the same session simultaneously is an extreme edge case in a solo-user app.
- Losing one edit to a concurrent write is tolerable; implementing a vector clock or CRDT
  library in vanilla JS is not.
- LWW is auditable: you can always explain why a value is what it is.

**One critical rule:** The `updated_at` timestamp must be set by the **client at the moment
of the user's action**, not by the server at the moment of upload. If the server sets it, the
device that syncs last always wins — which means an offline device editing old data could
silently overwrite a newer edit the moment it reconnects. Client-set timestamps with LWW are
correct; server-set timestamps with LWW are a data-loss bug.

**Deletes must be soft deletes.** A hard `DELETE` row cannot propagate across devices — when
device B syncs, the row is simply missing and looks like it was never there. Soft deletes
(`deleted_at` timestamp) let every device learn "this record was deleted at time T." Hard
deletes are banned from the sync path.

### What happens offline

| Feature | Offline behavior |
|---|---|
| Timer, splits, pause/resume, save | Fully local — works offline |
| Log, edit, delete | Fully local — works offline |
| Photos | IndexedDB — works offline |
| PBs, achievements, ghost pacing | Derived from local data — works offline |
| Export / import | localStorage — works offline |
| Sync | Writes queue to localStorage; flush on reconnect |
| Leaderboard submit | Requires network — button disabled with clear label |
| Leaderboard view | Last-fetched copy cached locally; stale watermark shown |

The **pending sync queue** is a simple ordered array in localStorage (key: `groompace-sync-queue`).
Each entry is an operation: `{ type: 'upsert' | 'delete', table: string, payload: object }`.
On reconnect, flush in order to preserve causality (an edit must arrive after the create),
then pull remote changes and merge.

---

## Phase 0 — Local hardening (v0.7.x)

*All work is local-only. No backend involved.*

Slices 1–2 (file extraction) and most of slice 3 (SW fixes) shipped in v0.6.4. Two sw.js bugs
survived and are documented in the Hardening Backlog below; they are Phase 0 slices 0.1–0.2.
Slices 4–14 from PLAN.md are listed here as 0.3–0.14.

| # | Description | Commit hint |
|---|---|---|
| 0.1 | Fix `isCoreAsset` pathname matching (see Hardening Backlog §a) | `fix(sw): use URL pathname comparison in isCoreAsset` |
| 0.2 | Fix core-asset offline fallback to nav-only (see Hardening Backlog §b) | `fix(sw): serve index.html fallback for navigation requests only` |
| 0.3 | Fix `dk()` to use local time (PLAN.md slice 4) | `fix: use local date for day keys` |
| 0.4 | Fix `esc()` to escape `"` and `'` (PLAN.md slice 5) | `fix: escape quotes in esc()` |
| 0.5 | Restore running timer on reload; import confirm; min≥1 guard; blank-breed fallback (PLAN.md slices 6–7) | `fix: guard destructive import and degenerate timer saves` |
| 0.6 | Extract `.sec-lbl`, `.tag`, `.btn-primary` (PLAN.md slice 8) | `refactor: extract repeated inline styles into shared classes` |
| 0.7 | Dark mode variable fixes (PLAN.md slice 9) | `fix: use design-system variables in dark-mode blind spots` |
| 0.8 | Spacing normalization + consistent difficulty labels (PLAN.md slice 10) | `style: normalize spacing rhythm and difficulty buttons` |
| 0.9 | Empty states with CTAs (PLAN.md slice 11) | `feat: actionable empty states` |
| 0.10 | Touch targets + pressed states (PLAN.md slice 12) | `style: enlarge touch targets, add pressed feedback` |
| 0.11 | Tab-only animation + independent toast layer (PLAN.md slice 13) | `fix: calmer transitions and independent toast layer` |
| 0.12 | Photo placeholder while IDB hydrates (PLAN.md slice 14) | `fix: placeholder while photos hydrate from IndexedDB` |

---

## Milestone 1 — Auth foundation (v0.8.x)

*Goal: users can create an account. Nothing changes for users who don't.*

Auth is a dependency for both backup and leaderboards, so it ships first in isolation. That
makes the next two milestones testable in terms of "auth works, now add sync" and "auth works,
now add leaderboard" rather than debugging three systems at once.

**The key design constraint:** zero visible surface for anonymous users. The Account tab and
any auth-related UI must not render unless a Supabase URL env var is configured. On the current
Vercel deploy, it is hidden until explicitly enabled.

**Deliverables:**
- Supabase JS client loaded via CDN (no npm, no bundler — consistent with project rules). The
  import only runs when auth features are enabled; the base app path never touches Supabase.
- Email magic-link / OTP auth flow
- Profile creation: choose a handle (unique, length-validated, profanity check server-side)
- Auth state persisted locally so the user isn't forced to re-auth every app open
- Sign-out clears auth tokens but **never** clears local groom data — data always belongs to
  the device, not the account

**No sync in this milestone.** Accounts exist; nothing is uploaded yet.

**Ship gate:** An existing user who never taps the Account tab sees and experiences zero
change — verified by walking every existing feature after the milestone deploys.

---

## Milestone 2 — Cloud backup (v0.9.x, free tier)

*Goal: signed-in users can back up data to the cloud and restore on a new device.*

Source of truth stays local. Supabase is the backup target. This milestone introduces the sync
architecture described above; getting it right here means multi-device (PRO) is an incremental
extension, not a rewrite.

**Deliverables:**
- Each groom session gets a `uuid` field in the local data structure. This ships as a migration
  under `groompace-v6` (the next localStorage schema version). The migration assigns random
  UUIDs to all existing sessions on first load — no data is lost or reordered.
- "Backup now" button + automatic background sync on app-open when signed in
- Sync status indicator: "Last backed up: 4 minutes ago" / "Offline — changes saved locally"
- Download-and-merge on sign-in from a new device (union of sessions by UUID, LWW on
  `updated_at` for any collisions)
- Pending sync queue (localStorage) for writes made while offline
- Export/import (the manual backup path) still works exactly as before — verified in test gate

**Conflict handling at this tier:** Because free-tier users have one device, the conflict
resolution is trivial: the device has all the writes; the server has none until first backup.
On subsequent backups, anything newer locally goes up, anything newer remotely comes down.

**Test gate (critical for data safety):** Go airplane mode. Log three grooms. Come back online.
Confirm all three appear in Supabase `groom_sessions`. Confirm existing export JSON still
imports correctly on a fresh device. Confirm a user with no account sees no UI change.

---

## Milestone 3 — Leaderboard v1.0 (v1.0.0, free tier)

*Goal: anonymized opt-in competition by breed × difficulty.*

This is the feature that makes GroomPace a community tool. It is also the highest-stakes
milestone from a security and privacy perspective — full design in [docs/SECURITY.md](docs/SECURITY.md).

**Deliverables:**
- Leaderboard tab: top N per breed × difficulty, showing handle + time + region
- "Submit to leaderboard" action on the groom review screen (opt-in, per groom)
- Server-side validation Edge Function rejects implausible times (see SECURITY.md)
- Handle changes: rate-limited to once per 30 days to prevent gaming the board by resetting
  a poor ranking
- "Remove my leaderboard entries" — wipes all of the user's entries immediately; the deletion
  is performed server-side because `leaderboard_entries` has no `user_id` column in the schema
- Read-only when offline (last-fetched copy with stale indicator)

**Ship gate:** Submit a 3-minute Standard Poodle full groom → rejected by validation. Inspect
any leaderboard API response and confirm no email address, Supabase `auth.uid`, or other PII
appears. Opt-out removes entries from the board within one sync cycle.

---

## Milestone 4 — PRO tier ($9/mo) (v1.1.x)

*Goal: multi-device sync, photo backup, full analytics, advanced features.*

This milestone introduces billing. No PRO feature is enforced client-side — the client renders
the UI; the server validates the subscription tier before honoring any PRO-only operation.

**Deliverables:**
- Stripe Checkout + webhook → subscription status stored in `profiles` table
- Multi-device sync: LWW conflict resolution for session edits, soft-delete propagation
- Photo sync: photos uploaded to Supabase Storage, linked by `storage_path` in
  `groom_sessions`; local IDB refs remain valid for offline use
- Full analytics history (currently constrained by localStorage size)
- Advanced ghost/competition features (to be defined with the user)

**Downgrade behavior:** Cancelling PRO stops sync and hides PRO UI. Local data is never
deleted — the user's grooms, photos, and history remain on-device. This is the "data stays on
your phone" promise from PRODUCT.md, honoured even after billing ends.

**Ship gate:** Two devices, both offline, both edit the same session, both sync. Verify the
later `updated_at` wins. Verify downgrading to free tier does not delete any local data.

---

## SW Hardening Backlog

Two known bugs in [sw.js](sw.js) that survived the v0.6.4 refactor. Both are Phase 0 priority.
Fix these before any further changes touch sw.js.

### (a) `isCoreAsset` uses substring matching — will false-match future files

**Location:** [sw.js:14-16](sw.js#L14)

```javascript
// Current — BUGGY
function isCoreAsset(url) {
  return CORE_ASSETS.some(p => url.includes(p.replace('./', '')));
}
```

`url.includes('app.js')` returns `true` for any URL that contains the string `app.js` —
including a future CDN dependency like `https://cdn.example.com/whatsapp.js`. That URL would
be routed through the network-first branch intended only for the app shell, adding unnecessary
latency.

More insidiously, `url.includes('index.html')` matches
`https://attacker.com/redirect?target=index.html`. Any third-party URL containing the right
substring gets treated as a core app file.

**Why URL pathname comparison is the right fix:** The URL API parses a full URL string into its
components. `new URL('https://groom-pace.vercel.app/app.js').pathname` is `'/app.js'` — an
exact, unambiguous component. Two URLs with different origins or query strings cannot collide
on pathname comparison the way they can on substring matching.

```javascript
// Fixed
const CORE_ASSET_PATHS = new Set(CORE_ASSETS.map(p => '/' + p.replace('./', '')));
function isCoreAsset(url) {
  try { return CORE_ASSET_PATHS.has(new URL(url).pathname); }
  catch { return false; }
}
```

The `try/catch` handles the edge case where `url` is a relative string (which the URL
constructor rejects without a base). In practice, `event.request.url` in a service worker is
always absolute, but the guard makes the function safe to call in any context.

### (b) Core-asset offline fallback serves `index.html` in place of `style.css` / `app.js`

**Location:** [sw.js:57](sw.js#L57)

```javascript
// Current — BUGGY
.catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
```

This `.catch` fires when the network fetch fails for **any** core asset, including `style.css`
and `app.js`. If those assets are not in the cache (fresh install with cache cleared, or first
load before precache completes), the fallback returns the HTML of `index.html` as the response.
The browser attempts to parse HTML as CSS and as JavaScript; both fail silently. The result is
a broken, unstyled, non-functional page — worse than a clean error.

The `index.html` fallback is only correct for **navigation requests**, where the browser needs
*some* HTML to display. For sub-resources (stylesheets, scripts), the correct fallback is
`Response.error()`, which triggers the browser's own resource-load error handling rather than
feeding it garbage content.

```javascript
// Fixed
.catch(() => caches.match(event.request).then(r => {
  if (r) return r;
  if (event.request.mode === 'navigate') return caches.match('./index.html');
  return Response.error();
}))
```

`event.request.mode === 'navigate'` is true only for top-level page navigations. CSS and JS
fetches use mode `'no-cors'` or `'cors'`, so they correctly fall through to `Response.error()`.

---

## First Three Slices — Fully Specified

These are ready to execute immediately, in order. Each is independent of the next and can be
verified in isolation. All three are Phase 0 (local-only, no backend).

---

### Slice 1: Fix `isCoreAsset` pathname matching

**File:** [sw.js](sw.js)
**Type:** Bug fix. No behavior change for correct-origin URLs; closes false-match risk for any
future file whose name happens to contain a substring of a core asset name.

**Exact change** — replace the current `isCoreAsset` function (lines 14–16) and add the
`CORE_ASSET_PATHS` constant on the line after `CORE_ASSETS`:

```javascript
// Before
const CORE_ASSETS = ['./index.html', './style.css', './app.js'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function isCoreAsset(url) {
  return CORE_ASSETS.some(p => url.includes(p.replace('./', '')));
}
```

```javascript
// After
const CORE_ASSETS = ['./index.html', './style.css', './app.js'];
const CORE_ASSET_PATHS = new Set(CORE_ASSETS.map(p => '/' + p.replace('./', '')));
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function isCoreAsset(url) {
  try { return CORE_ASSET_PATHS.has(new URL(url).pathname); }
  catch { return false; }
}
```

**Also required:**
- Bump `CACHE_NAME` in sw.js to `groompace-v0.7.0` (any sw.js change needs a new cache name
  so returning users activate the new service worker — invariant #3)
- Bump `APP_VERSION` in app.js to `'0.7.0'` (must match CACHE_NAME — invariant #5)

**Test before committing:**
1. Deploy to Vercel (or `npx serve .` locally with a ServiceWorker-capable browser).
2. DevTools → Application → Service Workers: confirm the new SW installs and activates.
3. Hard-refresh — all three core files load from network (visible in the Network tab).
4. Airplane mode → reload → app loads from cache, fonts load from cache.
5. Optional confidence check: temporarily add `console.log(isCoreAsset('https://evil.com/whatsapp.js'))`
   in the SW, confirm it logs `false`, then remove it before committing.

**Suggested commit:**
```
fix(sw): use URL pathname comparison in isCoreAsset (v0.7.0)

url.includes('app.js') false-matches any URL containing that substring,
including future CDN dependencies like whatsapp.js. Set lookup on parsed
URL pathname is exact and immune to substring collisions.
Bump CACHE_NAME and APP_VERSION to 0.7.0.
```

---

### Slice 2: Fix core-asset offline fallback (navigation only)

**File:** [sw.js](sw.js)
**Type:** Bug fix. Prevents the browser receiving HTML content in place of CSS/JS when the
network is unavailable and the cache is cold.

**Exact change** — replace the `.catch` on line 57 (inside the network-first branch):

```javascript
// Before
.catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
```

```javascript
// After
.catch(() => caches.match(event.request).then(r => {
  if (r) return r;
  if (event.request.mode === 'navigate') return caches.match('./index.html');
  return Response.error();
}))
```

**Why this is a separate slice from Slice 1:** Both touch the same file, but they fix distinct
bugs with different reasoning. Keeping them separate means if this change introduces a
regression, you know exactly which change caused it and can revert it without losing Slice 1's
fix. (If you prefer, they can be bundled — just document both changes clearly in the commit
message and test both scenarios.)

**Also required:**
- Bump `CACHE_NAME` to `groompace-v0.7.1`
- Bump `APP_VERSION` in app.js to `'0.7.1'`

**Test before committing:**
1. Normal load (online, cache warm): app loads without any change.
2. Airplane mode, cache warm (normal offline use): app loads as before.
3. Airplane mode, cache cleared (DevTools → Application → Clear site data): the browser shows
   its own error page, not a broken unstyled page. This is the correct degraded behavior — the
   user knows something is wrong and can reconnect.

**Suggested commit:**
```
fix(sw): serve index.html fallback for navigation requests only (v0.7.1)

Core-asset failure was returning index.html as the response for style.css
and app.js, causing the browser to parse HTML as CSS/JS — a broken,
unstyled page. Only navigation requests (mode === 'navigate') should fall
back to index.html; sub-resources get Response.error() so the browser's
own error handling runs.
Bump CACHE_NAME and APP_VERSION to 0.7.1.
```

---

### Slice 3: Fix `dk()` to use local time

**File:** [app.js](app.js)
**Type:** Bug fix. The daily checklist resets mid-afternoon and the manual log defaults to
tomorrow for users in UTC-negative timezones.

**Background:** `dk()` builds the key used to track today's checklist completion and the
default date on the manual log form. It currently calls
`new Date().toISOString().slice(0, 10)`, which returns the date in **UTC**. For a user in
Tacoma, WA (UTC-7 in summer, UTC-8 in winter), UTC midnight arrives at 5 PM or 4 PM local
time. From that moment until the real end of the day, the checklist shows as blank and the
log form defaults to tomorrow. The production user is a working groomer — she hits this
window every single workday during business hours.

Note that `renderEditForm` already uses `getFullYear/getMonth/getDate` (local time) for its
date default. This fix makes `dk()` consistent with that existing, correct code.

**Find `dk()` in app.js** (search for `toISOString`) and replace it:

```javascript
// Before
function dk() { return new Date().toISOString().slice(0, 10); }
```

```javascript
// After
function dk() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

`getFullYear`, `getMonth`, and `getDate` read from **local time**. `padStart(2,'0')` produces
the same `YYYY-MM-DD` format the rest of the code expects, so existing `S.chk` keys are
unaffected — the format doesn't change, only the timezone the date is derived from.

**Also required:**
- Bump `CACHE_NAME` to `groompace-v0.7.2`
- Bump `APP_VERSION` in app.js to `'0.7.2'`

**Test before committing:**
1. After 5 PM PT (if possible): checklist key should match today's local date, not tomorrow.
2. Manual log "Date" field defaults to today's local date.
3. Export the data, reset, import it back — the `S.chk` keys are still valid (format unchanged).

**Suggested commit:**
```
fix: use local date in dk() — checklist and log form defaulted to wrong day (v0.7.2)

new Date().toISOString() returns UTC, rolling over to the next calendar day
at 4–5 PM Pacific. Use getFullYear/getMonth/getDate (local time) — consistent
with what renderEditForm already does.
Bump CACHE_NAME and APP_VERSION to 0.7.2.
```

---

*Planning complete — stop here and wait for review before writing any code.*
