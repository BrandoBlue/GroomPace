# Session Log

**Newest first.** One short entry per working session. This is the trail a new
session reads to catch up fast — keep it skimmable, not a diary. Git history
already records *what changed line by line*; this records *why, and what's next*.

Format for a new entry:

```
## YYYY-MM-DD — vX.Y.Z · Short title
**Did:** one or two sentences, plus anything surprising.
**Next:** the single most useful thing to do next.
**Watch out:** only if there's a live gotcha or something half-finished.
```

Add the entry **before finishing a session** that changed anything. If a session
only answered questions and changed no files, skip it — no entry needed.

---

## 2026-08-06 — v0.16.0 → v0.18.0 · Log date pickers + scroll that stays put

**Did:** Reworked how she finds grooms in the Log, plus the scroll bug behind it.

- **Day filter with a calendar.** "Today" is now **Day**: arrows step a day, and
  the date chip opens a month grid. `S.logDate` (`'YYYY-MM-DD'`, null = today).
- **Week filter is a date *range*.** Hotel-style: first tap sets the start (hint
  becomes "From <day> — now tap the last day"), second tap applies the span;
  tapping before the start restarts it. Held in `S.logRange = { start, end }`
  (null = this Mon–Sun week) with `rangeKeys()` / `rangeBounds()` /
  `rangeLabel()` / `shiftRange()`. The chip arrows step by the span's own length.
- **The calendar is in-app**, not `<input type="date">` — a transparent native
  input over the chip was clickable but never opened a picker in Chrome, and the
  wrapper would have been worse. `renderCalendar()` into `modalRoot`, driven by
  `_cal = { mode:'day'|'week', month, sel }`; Monday-first, a dot on every day
  with grooms, month arrows capped at the current month. It **stays open** on a
  pick so a mis-tap costs one tap, and closes on Done or the backdrop.
- **All filter removed** — it loaded the whole history and wasn't usable. The bar
  is Day | Week; a saved `logFilter: 'all'` falls back to Day in `load()`.
- **Scroll no longer jumps to the top.** `R()` snapshots `window.scrollY` and
  restores it after the re-render, so opening/closing a photo keeps her on the
  same dog. Deliberate jumps opt out via `_scrollToTop` (tab switches, filter
  changes); the edit and manual-log forms open at the top and return to the same
  dog when closed (`openInlineForm()` / `closeInlineForm()`, `_formReturnY`).

All UI-only state — no schema change, backup/restore untouched. Verified with
seeded data through `store-shots/` puppeteer scripts (those files are gitignored;
`npm run shots` needs `npm i puppeteer --no-save` first — it is *not* a declared
dependency).

**Next:** Store submission — buy the Google Play account first (the 12-testers /
14-day clock is the long pole). Everything to paste is in `docs/STORE_LISTING.md`.

**Watch out:** `S.logWeekOffset` survives in state *only* as the migration input
that converts an older save into a range — nothing reads it after `load()`. The
range band tint is a `::before` reaching half the grid gap each side; give
`.cal-cell.in-range` a real background and the seams come back. `_cal` sits above
`_lightbox` in R()'s modal branch — keep that order.

## 2026-07-24 — Session continuity system (no app change)

**Did:** Set up the catch-up trail so new sessions start informed without
re-explaining the project. Three pieces: `claude.md` is now a real project map
(auto-loaded every session); `docs/SESSION-LOG.md` is this journal; and a
SessionStart hook in `.claude/settings.json` runs `node scripts/status.mjs
--hook`, which injects a live digest (version, branch, uncommitted changes,
unmerged commits, recent tags/commits, latest log entries) straight into
context. The digest is derived from git, so it can't go stale. Also fixed
`package.json` version, which was lagging at 0.13.1.

**Next:** Unchanged — store submission, Google Play account first.

**Watch out:** No app code changed, so no version/cache bump was needed here.

## 2026-07-24 — v0.15.0 · Service-driven timer

**Did:** Replaced the 15 cut-style pills with three multi-select services
(Bath + Brush, Full Hair Cut, FFF; the last two are mutually exclusive). The
timer's step buttons are now generated from the selection and de-duplicated.
Notes moved to the timer setup screen and show as a "Your Plan" card mid-groom —
still one single Notes field, editable afterwards. "Mod" → "Med", the small
"Done" checkpoint and the Tail step are retired. Schema bumped to 5 (additive:
Bath/Blow Dry/FFF fields); old grooms keep their Tail/Finished times and any
pre-existing style, which now shows in its own field on the edit form.
Set up this session-log + auto-status system so new sessions start informed.

**Next:** Store submission. Buy the Google Play account **first** — new personal
accounts need 12+ testers for 14 continuous days before public release, so that
clock is the long pole. Then Apple. Release signing is not wired yet (CI only
does unsigned proof builds); see `docs/STORE_LISTING.md`.

**Watch out:** Nothing half-finished. Production is on v0.15.0 and verified.

## 2026-07-21 — v0.10.2 → v0.14.0 · Store-readiness + custom icons

**Did:** Made breed optional on all three save paths (with an "+ Add breed" chip
to fill it in later). Self-hosted the fonts so the app makes zero external
requests. Manifest polish + app-icon shortcuts, an "updated to vX" toast, native
storage mirroring and haptics/status-bar/share adapters for the Capacitor
wrapper. Added the Capacitor wrapper itself plus both CI proof builds — the
Android debug APK and an iOS simulator screenshot, both green at $0. Replaced
every emoji app-wide with a custom hand-drawn SVG icon set. Wrote
`HANDOFF.md`, `privacy.html`, and `docs/STORE_LISTING.md`.

**Next:** (superseded by the entry above)

**Watch out:** `appId` is `com.groompace.app` and becomes permanent at the first
Play upload. The app icon is currently upscaled from a 512px source — swap in a
crisp 1024px master before the real store build.
