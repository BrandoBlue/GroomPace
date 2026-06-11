# GroomPace — Product Definition

## What this is
The personal performance app for professional dog groomers — "Strava for
groomers." Groomers time their grooms with section splits, race their own
ghost (PB pace), track returning dogs over time with before/after photos,
earn achievements, and compete on anonymized leaderboards. It is NOT salon
management software (no booking, payments, or CRM — MoeGo/Gingr own that).
It is the groomer's own tool, on the groomer's own phone.

## Who it's for
Individual professional groomers. Primary user and design partner: a working
groomer in Tacoma, WA. Distribution: groomer-to-groomer, TikTok-first.

## Business model (hybrid local-first)
- FREE, no account: full core app, all data local (current feature set).
  The onboarding promise "free forever, data stays on your phone" remains
  literally true for this tier.
- FREE account (email/magic link): cloud backup + anonymized leaderboard
  participation under a chosen handle.
- PRO $9/mo: multi-device sync, photo cloud storage, full analytics history,
  advanced ghost/competition features.
- Future conditional fork (NOT in scope): salon/team mode.

## Leaderboard integrity & anonymity (non-negotiable design constraints)
- Leaderboards show self-chosen handles only; no real names, no photos, no
  location below state/region level.
- Auth identity and leaderboard handle are separated in the schema.
- Scores are never trusted from the client: server-side plausibility
  validation (e.g., a 4-minute full groom on a Standard Poodle is rejected),
  rate limits, and timed-session verification for ranked entries.
- Users can leave/wipe leaderboard presence at any time.

## Engineering doctrine
- The production app (main branch → groom-pace.vercel.app) never breaks.
  One real user depends on it daily.
- Local-first architecture: app fully functional offline; sync reconciles
  when online. Backend: Supabase (Postgres + Auth + RLS) unless a written
  ADR justifies otherwise.
- All work in small slices: plan → build one slice → human tests → commit.
  No slice ships without its test gate. "Zero bugs" is achieved by process,
  not by promise.
- Every schema change ships with a migration. User data is sacred
  (see .cursor/rules/groompace.mdc invariants — they all still apply).