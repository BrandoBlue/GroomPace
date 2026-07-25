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
