# GroomPace Evolution Plan

Written against the current `index.html` (~2,440 lines), `sw.js` (cache `groompace-v0.5.2`),
and `manifest.json`. No code has been changed. Every slice below preserves the sacred
invariants: the `groompace-v5` localStorage key + migrations, the `groompace-photos`
IndexedDB and `idb:` ref format, CACHE_NAME bumps on every release, and working
export/import throughout.

---

## 1. Splitting index.html into index.html + app.js + style.css (no build step)

### The shape of the split

| File | Contents |
|---|---|
| `index.html` | Doctype, `<head>` (meta, manifest link, font links, `<link rel="stylesheet" href="style.css">`), the body skeleton (`#app`, `#ct`, `#nv`, `#modalRoot`, the two datalists), and `<script src="app.js"></script>` as the last element before `</body>`. ~35 lines. |
| `style.css` | The entire current `<style>` block, moved verbatim: `:root` variables, dark-mode media query, resets, layout, nav, animations, components. |
| `app.js` | The entire current `<script>` block, moved verbatim: data constants, state, IDB photo layer, migrations, render functions, ACTIONS map, init. |

### Decisions that matter (and why)

1. **Classic `<script src>` at the end of `<body>` — NOT `type="module"`.**
   The HTML templates contain inline handlers (`onchange="rvPhoto()"`, `onchange="hPh('fPB','B')"`,
   `onchange="importData(event)"`, the goals inputs' `onchange`, and the lightbox
   `onclick="event.stopPropagation()"`). These resolve functions on the *global* scope; a module
   gets its own scope and every one of them would silently break. A classic script at the same
   position in the document also preserves the exact execution timing the code relies on
   (`load(); R();` runs after `#ct`/`#nv` exist). *Why this matters: the split should be a pure
   "cut and paste" with zero behavior change, so any bug afterward is provably a move artifact,
   not a logic change.*

2. **Service worker must learn about the new files.** Add `./app.js` and `./style.css` to
   `ASSETS_TO_CACHE` and bump `CACHE_NAME`. *Why: the current SW precaches only `./`,
   `./index.html`, and the manifest; without this, the app shell breaks offline — invariant #3
   territory.*

3. **Serve app.js/style.css network-first, like index.html.** Today everything lives in one file
   that's network-first, so updates always arrive. After the split, the default cache-first branch
   would pin users to a stale `app.js` even when they get a fresh `index.html` — a version-skew
   bug we can't solve with content hashes because there's no build step. Making all three core
   files network-first (with cache fallback) keeps them traveling together. *Why: HTML referencing
   a different JS version than the one served is the classic "split the file, broke the PWA"
   failure mode.*

4. **Move verbatim, refactor later.** The split slices contain no renames, no reformatting, no
   "while I'm here" cleanups. *Why: a diff that is 100% relocation is trivially reviewable; mixing
   relocation with edits makes both unreviewable.*

### What does NOT change
- `SK`, `SCHEMA_VERSION`, `MIGRATIONS`, `load()`, `save()` — untouched (invariant #1).
- `DB_NAME`, `idb:` refs, photo functions — untouched (invariant #2).
- Event delegation through `ACTIONS`/`wireActions()` — untouched.
- Export/import — untouched; verified in the test checklist of each slice (invariant #4).
- Vercel needs no config: it serves static files from the repo root as-is.

---

## 2. UI/UX polish pass (existing CSS variables only)

### a) Spacing & repeated inline styles
- The 11px uppercase section label is re-declared inline ~20 times with drifting values
  (letter-spacing 1.5px / 2px / 2.5px, margin-bottom anywhere from 6 to 18px). Extract one
  `.sec-lbl` class (color stays per-section via a tiny inline `color:var(--lv)` etc.).
- Card padding drifts between 16/18/20/22px and inter-card margins between 10/14/16/18/20px.
  Standardize on: card padding 20px, gap between cards 14px, gap between page sections 24px.
- The pill "tag" chips (`background:var(--ca);border-radius:8px;padding:4px 10px;...`) appear in
  at least 5 places — extract a `.tag` class.
- The rose gradient CTA (`linear-gradient(135deg,var(--ro),var(--rd))` + shadow) appears 6+
  times — extract `.btn-primary`.

*Why: a consistent spatial rhythm is most of what makes an app feel "designed," and one class
per pattern means future polish edits happen in one place instead of twenty.*

### b) Hierarchy & consistency
- Difficulty buttons show `🟢 Easy / 🟡 Mod / 🔴 Hard` in the timer review but bare emoji
  (`🟢`) in the manual and edit forms. Use the labeled version everywhere. *Why: bare color
  dots force the user to remember a code; labels make the same control self-explanatory in
  all three places.*
- Recent-grooms cards on Home show 🔴/🟡 but hide 🟢, while the Log tab shows all three.
  Pick one convention (suggest: hide 🟢 everywhere — "easy" is the default, only exceptions
  need ink).

### c) Empty states
- Log tab: "No grooms yet" has no action. Add a `.btn-primary` "Start the timer" button
  (`data-action="go-tab" data-tab="timer"`).
- Stats tab with zero logs renders the Overall card full of zeros and dashes. Show a short
  friendly empty state instead.
- Dogs tab empty state is text-only; add a "Log a groom" action.

*Why: an empty state is the one screen every new user is guaranteed to see; it should always
answer "what do I do now?" with a tap target, not just describe the absence of data.*

### d) Touch targets
- "Edit" / "Delete" / "History" text buttons on log cards and the `×` delete buttons on breeds
  and standards are ~13–16px text with no padding — well under the ~44px minimum. Give them
  `padding:10px` (negative-margin compensated so layout doesn't shift) or a min-height.
- The checklist checkbox is 24px; make the entire row the tap target (`data-action` on the row).

*Why: this app is used one-handed, standing at a grooming table, often with wet hands — generous
targets are a core requirement, not a nicety.*

### e) Transitions & feedback
- `.fade-in` is forcibly replayed on **every** `R()` call — every checkbox toggle, pill tap, and
  split makes the whole screen fade and shift 8px. Track the previous tab and only animate when
  `S.tab` actually changes. *Why: animation should signal "you went somewhere new"; replaying it
  on every interaction makes the UI feel unstable and visually noisy.*
- Primary CTAs have no pressed state (`file-btn` does). Add a shared
  `button:active { opacity }` or transform for instant tactile feedback.

### f) Dark mode bugs (variables exist, just aren't used)
- Ghost Pace card hardcodes `background: rgba(255,255,255,0.6)` and
  `border: rgba(0,0,0,0.05)` — it renders as a glowing white slab in dark mode. Use
  `var(--card)` / `var(--bd)`.
- `.diff-btn.on-2` / `.on-3` hardcode text colors `#8B6D20` / `#A04030` — near-invisible on
  dark backgrounds. Use `var(--hn)` / `var(--co)`.
- `renderGoals` uses `border-top: rgba(0,0,0,0.05)` → `var(--bl)`.
- `.nav` hardcodes its light background and needs an `!important` dark override; both could
  read from the same variable.

*Why: the dark palette already exists and is good — these are just spots where hardcoded colors
bypass it, which is exactly what the design-system rule forbids going forward.*

### g) Layering bug between toast / lightbox / modal
`#modalRoot` renders modal **else** toast **else** lightbox. So while a toast is visible
(up to 8s for the storage warning), tapping a photo does nothing visible, and opening a modal
silently kills an active toast timer's content. Render toast in its own container so it can
coexist with the lightbox. *Why: `else if` chains for unrelated UI layers create invisible
mutual-exclusion bugs that users experience as "the app ignored my tap."*

---

## 3. Reliability hardening

Ordered roughly by user impact:

1. **`dk()` uses UTC, not local time.** `new Date().toISOString().slice(0,10)` flips to
   tomorrow at 4–5 PM Pacific. The daily prep checklist resets mid-afternoon and the manual
   log form's default date is wrong every evening. Fix: build the key from local
   `getFullYear/getMonth/getDate` (the same code `renderEditForm` already uses). *Why: the
   one real user grooms during business hours in a UTC-negative timezone — she hits this
   window every single workday.*

2. **A reload mid-groom freezes the timer.** `save()` persists `timerStart`, but `load()`
   forces `timerRunning = false` and zeroes `timerPausedAt`/`timerTotalPausedDuration`. After
   the phone kills the tab (very likely during a 40-minute groom), the timer screen shows a
   frozen number, split buttons are disabled, and any paused time gets silently re-added to
   the total. Fix: if `timerStart` is a valid number on load, restore the running (or paused)
   state. ⚠️ This touches `load()` — flagged per the workflow rules; the change is additive
   (restoring fields instead of clearing them). *Why: the timer is the core feature, and
   mobile browsers discard background tabs aggressively — this is the app's most likely
   real-world data-loss path.*

3. **`esc()` doesn't escape quotes.** It uses `textContent → innerHTML`, which escapes
   `& < >` but not `"`. Escaped values are interpolated into double-quoted attributes
   (`value="${esc(S.timerDogName)}"`, `data-name="${esc(d.name)}"`), so a dog named
   `Bella "Bee" Smith` truncates the attribute and can shed arbitrary attributes into the tag.
   Fix: replace with a small replace-map that also escapes `"` and `'`. *Why: this is the
   sanitization chokepoint for the whole app — one quirky-but-legitimate input breaks forms
   today and is an injection vector in principle.*

4. **Service worker fetch fallback returns `null`.** The runtime-cache branch's
   `.catch(() => null)` makes `respondWith(null)` throw a TypeError when offline and uncached.
   Return `caches.match('./index.html')` for navigations and `Response.error()` otherwise.
   *Why: a clean error response keeps the page's own error handling in control instead of
   surfacing a browser-level failure.*

5. **Google Fonts never get runtime-cached.** The precache list has the CSS, but the actual
   woff2 files come from `fonts.gstatic.com`, and the cache check `type !== 'basic'` rejects
   all cross-origin responses — so offline, typography silently degrades. Fix: allow caching
   `cors` responses for the two font origins (and add the missing
   `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`). *Why: "basic"
   means same-origin only; that guard quietly excluded exactly the assets it was meant to
   protect.*

6. **Import overwrites everything with no confirmation.** `importData` does
   `Object.assign(S, clean)` immediately on file pick. Wrap in the existing
   `showConfirm('Replace all current data with this backup?')`. *Why: restore is the most
   destructive action in the app and is currently one accidental file-tap away.*

7. **Zero-minute timed grooms pollute stats.** Stopping the timer within ~30 seconds saves
   `min: 0`, which then wins "fastest groom," sets a ghost PB of 0, and instantly unlocks the
   speed achievements. Guard `saveReview` with `min >= 1` (or confirm). *Why: one accidental
   tap-tap on Start/Done permanently corrupts PBs that the ghost-racing feature trains
   against.*

8. **Timer setup skips validation the manual form enforces.** Manual logging requires a breed;
   the timer can run and save with everything blank, producing logs with empty breed strings
   that flow into PBs and breed stats. Require (or auto-fill "Unknown") at `saveReview` time —
   not at start time, since stopping a groom to fill a form is wrong mid-work. *Why: two entry
   paths writing the same record should enforce the same minimum shape.*

9. **`photoSrc()` cache misses render `<img src="">`.** Before `hydratePhotosForView()`
   resolves, idb-backed thumbs render an empty `src`, which browsers treat as "fetch the page
   itself." Render a placeholder div when `photoSrc` returns falsy. *Why: it's a flash of
   broken UI on every cold start plus a useless network request per photo.*

10. **Unbounded growth, worth noting (not urgent):** `_photoCache` holds every viewed photo as
    a base64 string forever (memory), `S.chk` accumulates one key per checklist item per day
    forever (localStorage), and export builds the entire backup including all photos as one
    in-memory string. Fine at current scale; revisit if photos number in the hundreds.

Not proposed: framework, bundler, TypeScript, backend — all explicitly out of scope.

---

## 4. Slice-by-slice build order

Every slice ends with: app fully working, CACHE_NAME bumped if any shipped file changed,
a manual test, and a suggested commit. Ordering logic: *mechanical moves first (while the code
is unchanged and easy to verify), then invisible correctness fixes, then visible polish* — so
if anything regresses, the suspect slice is obvious.

| # | Slice | Test before committing | Suggested commit |
|---|---|---|---|
| 1 | Extract `style.css`; add `<link>`; add to SW precache; bump CACHE_NAME | Visual diff of every tab (light + dark), offline reload works | `refactor: extract CSS to style.css (no behavior change)` |
| 2 | Extract `app.js` (classic script, end of body, with a comment explaining why it must not be a module); add to SW precache; bump | Full pass: timer + splits + pause, manual log, edit, photos, export/import, reset | `refactor: extract JS to app.js (no behavior change)` |
| 3 | SW: network-first for app.js/style.css; fix `null` fallback; cache cross-origin fonts; bump | Deploy, hard-refresh, then airplane-mode reload — app and fonts both load | `fix(sw): keep split assets in sync, repair offline fallbacks` |
| 4 | Fix `dk()` to local time | After 5 PM PT: checklist keys to today, log form defaults to today | `fix: use local date for day keys (checklist reset at UTC midnight)` |
| 5 | Fix `esc()` to escape quotes | Dog name `Bella "Bee" Smith` survives log → edit → render round-trip | `fix: escape quotes in esc() to prevent attribute breakage` |
| 6 | Restore running timer on reload (⚠️ touches `load()`) | Start timer, kill tab, reopen — timer still counting; pause survives too | `fix: recover running timer after page reload` |
| 7 | Import confirmation + `min >= 1` guard + timer-save breed fallback + fix review clock showing `01:60` at exactly 60 min (`String(rv.min%60 \|\| rv.min)` falsy fallback misfires on 0) | Import asks first; instant stop doesn't save 0m; blank-breed timed groom handled; 60m review shows `01:00` | `fix: guard destructive import and degenerate timer saves` |
| 8 | Extract `.sec-lbl`, `.tag`, `.btn-primary`; replace inline copies | Visual diff every tab — identical rendering | `refactor: extract repeated inline styles into shared classes` |
| 9 | Dark mode fixes (ghost card, diff-btn text, goals border, nav var) | Toggle OS dark mode; check Timer-running, forms, goals, nav | `fix: use design-system variables in dark-mode blind spots` |
| 10 | Spacing normalization + consistent difficulty labels | Visual pass; forms still snapshot/restore input values | `style: normalize spacing rhythm and difficulty buttons` |
| 11 | Empty states with CTAs (Log, Stats, Dogs) | Use Reset All, walk every tab as a brand-new user | `feat: actionable empty states` |
| 12 | Touch targets (Edit/Delete/×, checklist rows) + pressed states; remove `maximum-scale`/`user-scalable` from the viewport meta and add `touch-action: manipulation` to `.app` (kills double-tap zoom delay without blocking accessibility pinch-zoom) | Thumb-test on a real phone; pinch-zoom works, double-tap doesn't zoom | `style: enlarge touch targets, add pressed feedback` |
| 13 | Animate only on tab change; toast/lightbox coexistence | Toggle checklist (no fade replay); open photo while toast showing | `fix: calmer transitions and independent toast layer` |
| 14 | `photoSrc` placeholder for unhydrated photos | Cold start with photo-heavy log — no broken-image flash | `fix: placeholder while photos hydrate from IndexedDB` |

Slices 1–3 are the structural foundation and should ship (and be verified on the deployed
Vercel URL) before anything else, because every later slice edits the new files. Slices 4–7
are small, independent, reorderable. Slices 8–14 are cosmetic and safe to spread out.

**Per the workflow rules: I will stop after each slice, summarize what changed and why, suggest
the commit message, and wait for you to test before continuing.**

---

## Resolved questions

1. Inline `onchange` photo handlers stay grandfathered; `app.js` remains a classic script with
   a comment explaining why. Migration to delegated `change` events is deferred indefinitely.
2. Pinch-zoom will be re-enabled in the polish phase (slice 12): drop
   `maximum-scale`/`user-scalable` from the viewport meta, add `touch-action: manipulation`
   to `.app` to keep taps snappy.
