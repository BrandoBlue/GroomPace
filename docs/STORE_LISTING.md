# GroomPace — Store Submission Kit

Everything you paste into App Store Connect and Google Play Console. All of it
reflects the truth that GroomPace collects **zero** data.

Privacy Policy URL (both stores require it): **https://groom-pace.vercel.app/privacy.html**

---

## App identity

| Field | Value |
|---|---|
| App name (Apple) | GroomPace |
| Subtitle (Apple, 30 char) | Speed tracking for groomers |
| App title (Play, 30 char) | GroomPace: Dog Groom Timer |
| Bundle / App ID | `com.groompace.app` (⚠️ permanent after first upload) |
| Category | Productivity (secondary: Lifestyle) |
| Content rating | 4+ / Everyone |
| Price | Free |
| Support email | brandonruth92@gmail.com |
| Support / marketing URL | https://groom-pace.vercel.app |

---

## Descriptions

**Short description (Play, 80 char):**
> Groom faster. Time your grooms, race your personal best, track every dog.

**Promotional text (Apple, 170 char):**
> The performance app made for professional dog groomers. Time your grooms, beat your own best pace, and watch yourself get faster — all private, all on your phone.

**Full description:**
> GroomPace is the personal performance app for professional dog groomers — think "Strava for groomers."
>
> Time each groom with section splits, race your own "ghost" (your best pace on that dog or breed), and watch your speed improve over weeks and months. Track returning dogs with before/after photos, earn achievements as you hit milestones, and keep private breed notes (blade, comb, target time) at your fingertips.
>
> **What you can do:**
> • Live timer with section splits (prework, brush, shave, legs, head, tail, finish)
> • Race your ghost — your personal best pace, live on screen
> • Log grooms manually or with the timer
> • Before/after photos, and a one-tap shareable transformation card
> • Personal bests by breed, plus stats and insights
> • Achievements and streaks
> • Private per-breed notes
> • Works 100% offline
>
> **Your data stays yours.** No account, no sign-up, no tracking. Everything lives on your phone. GroomPace is a groomer's own tool — not salon-management software.

**Keywords (Apple, 100 char):**
> groomer,dog grooming,groom timer,pet groomer,grooming,stopwatch,dog,pace,splits,before after

---

## Apple privacy nutrition label

Answer: **Data Not Collected** — every category. Nothing is collected, tracked, or linked.
(Rare and true here — call it out in the review notes so it isn't mistaken for an oversight.)

## Google Play Data Safety form

- Does your app collect or share any user data? → **No**
- Is all user data encrypted in transit? → N/A (no data leaves the device)
- Do you provide a way to request data deletion? → Data is on-device; user deletes via
  "Reset All Data" or by uninstalling.
- No data types collected. No third-party SDKs that collect data (Capacitor plugins collect nothing).
- Photos: not collected. A user-initiated OS share sheet does not count as collection.

---

## Apple App Review notes (paste into "Notes" — preempts a Guideline 4.2 rejection)

> GroomPace is a fully offline, native performance tracker for professional dog groomers.
>
> Native capabilities: haptic feedback throughout the UI, the native share sheet for exporting a generated before/after image, on-device data protection with an iCloud-backed local backup, status-bar/dark-mode integration, and a splash screen. The app works entirely offline — all assets are bundled and it makes zero network requests. No account or login is required (there is nothing to sign into), so no demo credentials are needed.
>
> To test: complete the one-screen welcome, tap the Timer tab, enter any dog name/breed (both optional), tap Start, tap the section-split buttons as you go, tap Stop, then Save. You'll see the groom in the Log tab with stats, personal bests, achievements, and — if you add two photos — a share card.

---

## Google Play closed-testing gate (schedule risk — start early)

New personal Play Console accounts must run a **closed test with 12+ testers opted in for 14
continuous days** before production access is granted.

**Plan:** the day the Play account exists, create a closed testing track and send the opt-in link
to 12+ people (the wife's groomer network, TikTok followers, friends, family). Testers only need to
tap the link, install once, and keep it installed. Start this clock *immediately* so it runs in
parallel with the iOS work — budget ~3–4 weeks wall-clock from account creation to Play production.

---

## Screenshot shot list (capture from the app)

Capture 4–6, in this order, both phone sizes where required:
1. Live timer mid-groom with the ghost-pace race bar
2. Groom-complete review screen (ideally a new personal best)
3. Log tab: cards with before/after photos
4. Stats: personal bests + overall
5. Achievements grid
6. A shared before/after transformation card

- **Apple** needs iPhone 6.9" and 6.5" sizes — capture from the iOS Simulator
  (`xcrun simctl io booted screenshot`) at those device sizes.
- **Play** needs a phone screenshot set + a **1024×500 feature graphic** (compose in the cream/rose
  brand palette). Tablet shots optional.

---

## Version / build numbering

Store releases keep APP_VERSION, CACHE_NAME, `versionName`/`CFBundleShortVersionString`, and the
build number in lockstep, one commit, one git tag. Build number scheme:
`major*10000 + minor*100 + patch` (e.g. 0.13.1 → 1301). Recommend bumping to **1.0.0** for the first
public store release.

## Before the store build

- Replace `assets/icon.png` with a crisp **1024×1024** master (the current one is upscaled from 512),
  then re-run `npx capacitor-assets generate`.
- Confirm the final `appId` before the first upload — it can't change afterward.
