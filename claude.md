# GroomPace — project map

"Strava for dog groomers": a vanilla HTML/CSS/JS PWA that times grooms, races
your own PB pace, tracks returning dogs with before/after photos, and awards
milestones. Being wrapped with Capacitor for the App Store and Google Play.

**Prime directive:** `main` auto-deploys to groom-pace.vercel.app, where a
working groomer uses this daily. Never break production, never lose her data.

## Catching up (a fresh session should already have this)

A SessionStart hook runs `node scripts/status.mjs` and prints the current
version, branch state, recent commits/tags, and the latest session-log entries.
If you did not see that digest, run it yourself before starting work.

- **`docs/SESSION-LOG.md`** — what recent sessions did and what's next. Start here.
- **`HANDOFF.md`** — full onboarding: architecture, current state, roadmap, gotchas.
- **`.cursor/rules/groompace.mdc`** — binding rules. **`PRODUCT.md`** — what/why/business model.
- **`ROADMAP.md`** + **`docs/adr/001-backend.md`** — the unbuilt Supabase backend.
- **`docs/STORE_LISTING.md`** — everything for store submission.

Read HANDOFF.md before your first code change. For a one-off question, the
digest plus this file is usually enough.

## Non-negotiables

1. `localStorage` key `groompace-v5` + `SCHEMA_VERSION`/`MIGRATIONS` must keep
   loading existing data. Change the data shape only by bumping the schema and
   adding an *additive* migration (migration 5 is the template).
2. IndexedDB `groompace-photos` and the `idb:` photo-ref format need a migration
   to change.
3. **Every release bumps `APP_VERSION` (app.js) and `CACHE_NAME` (sw.js)
   together**, matching the git tag. `scripts/status.mjs` warns if they drift.
4. Export/Import (backup/restore) must stay lossless in every change.
5. `load()`, `save()`, `MIGRATIONS`, and the photo IDB functions are
   load-bearing — flag loudly and re-test backup/restore if you touch them.

## House style

- No framework, no build step for the web app. Capacitor is a wrapper only.
- One global state object `S`; `R()` re-renders everything; interactivity is
  `data-action` + the `ACTIONS` map (never inline `onclick`).
- **`R()` restores `input`/`textarea` values by id across re-renders but NOT
  `<select>`** — use state-driven pill groups for choices.
- Every user string goes through `esc()`. Short helper names (`S`, `R`, `IC`)
  are intentional; match the surrounding code.
- Work in small slices: build → verify → bump versions → commit + tag → push.
  Merging to `main` deploys to the real user, so merge only when asked.
- Verify in the browser at http://localhost:5487 (`npm run dev`). Seeding test
  data then reloading? Set `_resetting = true` first or `beforeunload` will
  overwrite your seed.

## Before you finish

If this session changed anything, **add an entry to the top of the entry list in
`docs/SESSION-LOG.md`** (format is documented in that file) so the next session
picks up instantly. Keep it to a few lines: what you did, what's next, and any
live gotcha. No entry needed for question-only sessions.
