# GroomPace — Handoff Guide (for the next AI or developer)

You are taking over GroomPace. This file is your entry point. Read it fully,
then read the four binding documents in the next section before writing any
code. It is written to be model-agnostic — GPT, Codex, another Claude, or a
human can all follow it.

**One-line summary:** GroomPace is a "Strava for dog groomers" — a mobile
performance app that times grooms, races your own personal-best pace ("ghost
racing"), tracks returning dogs with before/after photos, and awards
milestones. It is a vanilla HTML/CSS/JS Progressive Web App with **no
framework and no build step**, deployed to production automatically by Vercel.
It is currently being wrapped with Capacitor to ship on the Apple App Store
and Google Play.

**Current shipped version: v0.14.0** (live at https://groom-pace.vercel.app).

---

## 0. Read these first (they are binding, not optional)

Read in this order. Everything below assumes you have read them.

1. **`.cursor/rules/groompace.mdc`** — architecture, the *sacred invariants*
   (breaking them destroys the real user's data), code patterns, workflow rules.
2. **`PRODUCT.md`** — what the product is, who it's for, the business model,
   and the non-negotiable leaderboard/privacy constraints.
3. **`ROADMAP.md`** — the ordered milestone sequence and the local-first sync
   architecture you must follow when the backend work begins.
4. **`docs/adr/001-backend.md`** — the decision record for the (not-yet-built)
   Supabase backend.

Also useful: `docs/STORE_LISTING.md` (everything for store submission),
`docs/SECURITY.md`, `PLAN.md` (historical), `README.md`.

> Note: `CLAUDE.md` / `claude.md` are instruction files for the Claude CLI
> tool specifically. The *content* they point to (the cursor rules + PRODUCT.md)
> is what matters and applies to any AI. You do not need the Claude tooling.

---

## 1. Who this is for and the prime directive

- **Owner / maintainer:** Brandon (GitHub: `BrandoBlue`). He is a CS student
  learning from this project — explain the "why" behind changes, briefly.
- **The one real production user** is his wife, a working professional groomer
  in Tacoma, WA, who uses the app **daily on her phone**. She is the design
  partner. Her data lives in her phone's browser storage.
- **PRIME DIRECTIVE:** *Production (the `main` branch → groom-pace.vercel.app)
  must never break, and her data must never be lost.* Every one of the sacred
  invariants exists to protect this. When in doubt, do the safe thing and ask.

---

## 2. Architecture in 60 seconds

- **Pure vanilla JS PWA. No framework (no React/Vue), no bundler, no build
  step for the web app.** Do not introduce one without explicit approval — it
  is a hard project rule. This constraint is a feature, not tech debt.
- **`index.html`** — thin shell (~30 lines). Loads `style.css` and `app.js`.
- **`app.js`** — the entire app (~3,000 lines): state, rendering, all logic.
- **`style.css`** — design system via CSS custom properties (warm cream +
  rose palette, Fraunces serif headings, DM Sans body), dark mode via
  `prefers-color-scheme` and a `data-theme` override.
- **`sw.js`** — service worker (network-first for the app shell, cache-first
  otherwise; precaches fonts and icons).
- **`manifest.json`** — PWA manifest (icons, shortcuts, categories).
- **`fonts/`** — self-hosted DM Sans + Fraunces woff2 (so the app makes
  **zero external network requests** — important for the privacy story).
- **Data storage:**
  - `localStorage` key **`groompace-v5`** holds all state as JSON.
  - **IndexedDB** database `groompace-photos` holds photos as blobs; state
    references them as `idb:...` strings.
- **Deploy:** push to `main` → Vercel auto-deploys to groom-pace.vercel.app
  in ~1 minute. `vercel.json` pins it to **no build command** (static serve)
  so the presence of `package.json` doesn't trigger an npm build.

### The rendering model (understand this before editing app.js)
- A single global state object **`S`** holds everything.
- **`R()`** re-renders the whole app from `S` into the DOM. You call `R()`
  after any state change. It is cheap because it's just string templating.
- All interactivity uses **event delegation**: elements have
  `data-action="name"` attributes; one document-level click listener looks the
  name up in the **`ACTIONS`** map (near the middle of app.js) and calls the
  handler. **Never add inline `onclick`** (the one legacy exception is
  `event.stopPropagation()` on lightbox images and the file-input `onchange`
  for photo pickers).
- **`R()` snapshots and restores `<input>` and `<textarea>` values by `id`**
  across re-renders — but **NOT `<select>`**. This is why every choice control
  (size, difficulty, cut-style) is a state-driven pill grid, not a dropdown.
  If you add a native `<select>`, it will silently reset on the next `R()`.
- **`esc()`** escapes every user-provided string before it goes into HTML.
  Use it always.
- Quiet-helper house style: short names (`S`, `R`, `vib`, `esc`, `IC`) are
  intentional. Match the surrounding code.

---

## 3. The sacred invariants (memorize; see the cursor rules for the canonical list)

Breaking any of these loses real user data or bricks returning users:

1. **`localStorage` key `groompace-v5` and the `SCHEMA_VERSION` / `MIGRATIONS`
   logic must keep loading existing data.** Never rename the key without a
   copy-over migration. `SCHEMA_VERSION` is currently `4`; migrations live in
   the `MIGRATIONS` object. To change the data shape, bump `SCHEMA_VERSION`
   and add a migration function — never mutate existing fields in place.
2. **IndexedDB `groompace-photos` and the `idb:` ref format** must not change
   without a migration.
3. **Every release bumps `CACHE_NAME` in `sw.js`** or returning users get
   stuck on a stale cached version.
4. **Export / Import (backup / restore) must keep working** in every change.
5. **Every release bumps BOTH `CACHE_NAME` (sw.js) AND `APP_VERSION` (top of
   app.js) together, matching the git tag.** A version label that lies is
   worse than none.

Extra caution: `load()`, `save()`, the `MIGRATIONS`, and the photo IndexedDB
functions are load-bearing. Flag loudly and test export/import before and
after touching them.

---

## 4. How to work: small slices + release discipline

This project ships in **small, independently-testable slices**. The rhythm is:

> plan one slice → build it → the maintainer tests it on the real app → commit
> → repeat.

For each slice:
1. Make the change.
2. **Bump `APP_VERSION` (app.js) and `CACHE_NAME` (sw.js) together** to the
   next semver, e.g. `0.14.0` → `0.14.1`.
3. Verify it works (see §7).
4. Commit with a clear message explaining the "why". Tag it `vX.Y.Z` matching
   the version constants.
5. Push. Merging to `main` = deploying to the real user, so only merge when
   the maintainer says so (or per whatever authority he grants you).

**Git / PR mechanics:** the maintainer authorizes committing, tagging, and
pushing each verified slice directly. Merges to `main` happen on his word.
Use whatever GitHub tooling your environment provides (`gh` CLI if available,
or the GitHub REST API, or the web UI). The repo is `BrandoBlue/GroomPace`.
End commit messages with a co-author trailer if your platform uses one.

**Never** skip the version bump, and never auto-merge to `main` without
authorization.

---

## 5. Current state — what is DONE (as of v0.14.0)

Everything here is shipped to production unless noted.

**Product fixes (the two the maintainer asked for):**
- **Breed is optional when saving.** All three save paths (manual log form,
  live timer review, edit form) require only a valid time. A groom missing a
  breed shows a "+ Add breed" chip that opens the edit form to fill it in
  later. Breed-less grooms never render blank and are excluded from per-breed
  bests / breed-count badges.
- **Cut style is a preset picker.** A `CUT_STYLES` constant drives a tappable
  pill grid on all three forms (Bath & Brush, Puppy Cut, Teddy Bear,
  Summer/Kennel Cut, FFF, Lamb/Lion Cut, Full Shave Down, De-Matting, etc.),
  plus a "Breed Specific…" option that reveals a free-text input. Stored as
  the same single `style` string, so old typed styles still display and edit.

**Store-readiness hardening:**
- Self-hosted fonts (zero external requests).
- Manifest polish: `id`, `orientation`, `categories`, and app-icon shortcuts
  (Start Timer / Log a Groom) that deep-link via `?tab=`.
- "Updated to vX.Y.Z" toast on first load after an update.
- **Native storage durability** (only active inside the Capacitor wrapper,
  no-ops on the web): mirrors state to the device filesystem on save and
  restores it if web storage is ever evicted; weekly full backup incl. photos.
- **Native-feel adapters** (also wrapper-only): haptics via `vib()`, status-bar
  theming, and a native share sheet for the before/after image and for export
  (WKWebView lacks `navigator.share` with files and `<a download>`).

**Capacitor wrapper + CI (all additive — the web app is untouched):**
- `package.json`, `capacitor.config.json` (**appId `com.groompace.app`**),
  `scripts/sync-www.mjs` (copies web files into a gitignored `www/` — the
  Capacitor `webDir`; deliberately excludes `sw.js`), `vercel.json` (no-build
  guard), and the committed `android/` and `ios/` platform projects.
- **CI proof builds, both currently green, both cost $0:**
  - `.github/workflows/android-build.yml` → a sideloadable **debug APK**
    (needs **JDK 21** — Capacitor 7 targets Java 21).
  - `.github/workflows/ios-build.yml` → builds on a macOS runner and uploads a
    **screenshot of the app running on an iPhone simulator**. This is how iOS
    is verified without owning a Mac or an Apple account.

**Custom icon system (v0.13.2 + v0.14.0):**
- Every UI emoji was replaced by a cohesive hand-drawn SVG set. `IC('name')`
  returns a `1em`-sized, `currentColor` SVG (drops in wherever an emoji sat,
  inherits size + color). `diffDot(n)` renders the green/amber/coral
  difficulty dots. The icon path dictionary `_ICP` and `IC`/`NAV_ICONS` live
  near the top of app.js. Deliberately kept as emoji: transient toast text,
  the canvas share-image watermark, and instructional text arrows.

**Store assets:**
- `docs/STORE_LISTING.md` — descriptions, review notes drafted to pass Apple
  guideline 4.2, data-safety answers, the tester-recruitment plan.
- `privacy.html` — the privacy policy, live at groom-pace.vercel.app/privacy.html
  (both stores require the URL, even though the app collects no data).
- `scripts/store-shots.mjs` — regenerates the store screenshots (seeds demo
  data via headless Chromium, captures at Apple 6.9" resolution). Run with the
  dev server on :5487 and `npm i --no-save puppeteer sharp` available.

---

## 6. What is NEXT — goals, in priority order

### A. Ship to the stores (the immediate goal)
The app is *provably* store-ready (both proof builds pass). Remaining steps
are mostly account/money, not code:
1. **Buy Google Play Console ($25 one-time) FIRST.** New personal Play
   accounts must run a **closed test with 12+ testers for 14 continuous days**
   before public release — that clock is the schedule's long pole, so start it
   early. Recruit testers via the wife's groomer network + TikTok + family;
   they just install from an opt-in link and keep it installed.
2. **Buy Apple Developer ($99/yr).** TestFlight has no 14-day requirement.
3. **Wire release signing** (not yet done — the CI only does unsigned proof
   builds): an Android upload keystore (kept out of git; the CI reads it from
   a GitHub secret) → `bundleRelease` AAB; and iOS distribution cert +
   provisioning profile + App Store Connect API key in GitHub secrets →
   archive → export → TestFlight upload. `docs/STORE_LISTING.md` has the plan.
4. **Version scheme for stores:** `versionName` / `CFBundleShortVersionString`
   = `APP_VERSION`; a monotonic integer `versionCode` / build number (e.g.
   `major*10000 + minor*100 + patch`). Recommend jumping to `1.0.0` for the
   first store release. **appId `com.groompace.app` is permanent after the
   first Play upload — do not change it.**

### B. The backend + competitions (the big roadmap — DESIGNED, NOT BUILT)
This is what makes the app best-in-class and unlocks revenue. It is defined in
`PRODUCT.md` + `ROADMAP.md` + `docs/adr/001-backend.md`. **Backend = Supabase
(Postgres + Auth + RLS).** Build it in this order, each shipping without
breaking the offline-first baseline:
1. **Auth** — email magic-link accounts. The leaderboard *handle* is stored
   separately from the auth identity (a hard privacy requirement).
2. **Cloud backup / multi-device sync** — local-first; the device is always
   the source of truth for writes; last-write-wins reconciliation with soft
   deletes. This also permanently retires the storage-eviction risk.
3. **Leaderboards** — boards keyed by **class = breed × size × difficulty** so
   comparisons are fair. Integrity rules are **non-negotiable** (see
   PRODUCT.md): self-chosen handles only, no location below state/region,
   ranked entries require timed sessions with real split telemetry,
   server-side plausibility validation rejects impossible times, rate limits,
   one-tap "wipe my presence."
4. **"Local" = state/region boards** (never GPS, never finer than state) +
   "Rivals" (the handles just above you in your state class).
5. **Weekly/seasonal challenges** with percentile bands + participation badges
   (so mid-pack groomers have a reason to compete), and **share cards** for
   every competitive result (feeds TikTok-first growth).

### C. Monetization (why "free forever" is not a contradiction)
- **Free forever** = the core app (timer, ghost racing, logs, photos,
  achievements, all local). This is the *marketing engine* — it spreads
  groomer-to-groomer and via TikTok (every shared card is watermarked).
- **GroomPace Pro (~$9/mo)** sells what genuinely costs money to run and what
  free can't do: cloud backup + photo storage + multi-device sync + online
  leaderboards/competitions + advanced analytics. None of this breaks the
  free promise. Build order: ship free to stores → grow installs → build the
  backend (B) → turn on Pro. Charging before the community features exist
  would be charging for nothing.
- Later options: annual plan, a salon/team tier, brand-sponsored challenges.
  Avoid ads (off-brand for a made-by-groomers product).

---

## 7. How to verify a change (do this before every commit)

There is a local static dev server config; the app runs at
**http://localhost:5487**. Any static file server pointed at the repo root
works (e.g. `npx serve -l 5487 .`). Then:

- **Manual smoke test on the real screens:** log a groom (with and without a
  breed and a style), run the live timer end to end, edit an existing groom,
  and do an **Export → reset → Import round-trip** (protects invariant #4).
- **Seed test data safely:** you can set `S.logs = [...]; save(); R()` from the
  browser console. **Gotcha:** if you reload after seeding, set the module
  flag `_resetting = true` first, or the `beforeunload` `save()` will overwrite
  your seeded `localStorage`.
- **Simulate an empty breed:** `S.logs[0].breed=''; save(); R();`.
- **Check the browser console for errors** and confirm every tab + sub-tab
  renders.
- **Screenshots for review:** `node scripts/store-shots.mjs` regenerates a full
  set (seeds demo data, headless). Great for eyeballing visual changes.
- After merge to `main`, confirm the deploy: fetch
  `https://groom-pace.vercel.app/app.js` and check `APP_VERSION` updated
  (~1 min after push).

---

## 8. Gotchas that will bite you (learned the hard way)

- **`<select>` loses its value on `R()`.** Use state-driven pill groups. (§2)
- **`_resetting = true` before any programmatic `location.reload()`** or the
  unload handler re-saves stale state over your change. (§7)
- **`appId` is immutable after the first Play upload.** It's `com.groompace.app`.
- **`package.json` can trick Vercel into running `npm build`.** `vercel.json`
  pins `buildCommand: null` / `outputDirectory: "."`. Don't remove it; verify
  the next deploy after any change that touches build config.
- **iOS WKWebView** has no Service Worker on the app scheme, no
  `navigator.share` with files, and no working `<a download>`. The wrapper code
  handles these with Capacitor plugins and by *not* registering the SW when
  native. Keep those guards.
- **Capacitor 7 needs JDK 21** for the Android build (not 17).
- **The `www/` directory is generated** by `scripts/sync-www.mjs` and
  gitignored; never edit it directly — edit the root web files and re-sync.
- **Every user string through `esc()`.** XSS-safety and correctness.
- **Don't reproduce the difficulty logic ad hoc** — use `diffDot(n)` and the
  existing `l.diff` field (1 easy / 2 mod / 3 hard).

---

## 9. Key landmarks in `app.js` (search for these)

Line numbers drift, so search by name:
- `const APP_VERSION` — the version constant (top of file).
- `const SCHEMA_VERSION` / `MIGRATIONS` / `function migrate` — data migrations.
- `function load` / `function save` — persistence (load-bearing; test I/O).
- `const _ICP` / `function IC` / `function diffDot` / `NAV_ICONS` — icon system.
- `const CUT_STYLES` / `function styleGrid` — cut-style presets.
- `const ACH` / `function renderAch` — achievements.
- `const ACTIONS` / `function wireActions` — the event-delegation map.
- `function R` — the master re-render (and its input snapshot/restore).
- `function renderHome` / `renderTimer` / `renderLog`... — one per screen.
- `function getGhostTime` / `paintTimer` — ghost racing.
- `function shareBeforeAfter` / `exportData` / `importData` /
  `sanitizeImport` — the share canvas and backup/restore.
- Capacitor-guarded helpers (native mirror, haptics, native share) are wrapped
  in `if (window.Capacitor?.isNativePlatform?.())` and no-op on the web.

---

## 10. Literally handing it over — checklist for the maintainer

To move to another AI/tool:
1. Make sure the new tool/agent has **read access to the GitHub repo**
   (`BrandoBlue/GroomPace`) and, ideally, push access so it can commit slices.
2. Point it at **this file (`HANDOFF.md`) first**, then the four binding docs
   in §0.
3. Keep the **Vercel ↔ GitHub** integration as-is (auto-deploys `main`). No
   action needed unless you move hosting.
4. When you reach store signing (§6.A.3), you'll create **GitHub repository
   secrets** for the keystore/certs — the new tool can write the workflows,
   but *you* paste the secret values (never commit them).
5. Nothing depends on the Claude-specific CLI tooling. The code, the docs, and
   the CI are all standard and portable.

---

*This project was built in small, tested slices with a "never break the real
user's app" discipline. Please keep that rhythm — it's the whole reason the
one production user has never lost data. Good luck; it's a genuinely nice app
and a real groomer depends on it every day.*
