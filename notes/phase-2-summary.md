# Phase 2 Summary - Auth and Registration

## 1. Goal of the phase

Phase 2 = Build auth and registration flow:
- capture email, name, hostel block, gender,
- confirm email before OTP,
- verify OTP,
- create `User` from pending registration,
- keep gender internal-only in UI.

## 2. Files/folders added

- `notes/phase-2-summary.md`
- `app/src/domain/types.ts` (added `PendingRegistration`)
- `app/src/app/context/AppContext.tsx` (added `pendingRegistration` state)
- `app/src/app/components/pages/AuthPage.tsx` (registration + email confirm step)
- `app/src/app/components/pages/VerifyPage.tsx` (OTP verify + user promotion)
- `app/src/app/components/pages/RunnerFeedPage.tsx` (auth-required empty state + accept fix)

Slice map (quick):
- 2.1 `AppContext` pending registration state
- 2.2 gender field capture + validation
- 2.3 email confirmation before OTP
- 2.4 Verify creates full user from pending registration
- 2.5 OTP edge-case UX (resend + wrong email)
- 2.6 privacy + runner feed sanity for logged-out user
- 2.7 phase note file
- 2.8 auth prefill + runner accept gating fix

## 3. Important concepts learned

- `pendingRegistration` is the source of truth between Auth and Verify.
- Keep backward compatibility (`pendingEmail`) while migrating flow.
- UI must enforce privacy: `gender` stored for matching only, not displayed.
- Use `canRunnerSeeJob` as eligibility source of truth (no duplicated rule logic).
- Keep phase notes after each slice to preserve decisions and fixes.

## 4. Validation steps

Validation:
- `cd app`
- `pnpm build` passes
- Auth form blocks invalid email and missing gender
- Email confirmation appears before OTP
- `Change Email` returns to form and preserves values
- OTP wrong code decrements attempts; lock copy still shown
- OTP correct code (`123456`) logs in
- User context reflects entered email/name/hostel/gender
- Verify "Wrong email?" returns to auth
- Runner feed logged-out state shows helpful auth-required message
- No gender shown on profile/runner cards/feed UI

## 5. Problems faced

- Verify previously used only `pendingEmail` -> fixed by promoting from `pendingRegistration`.
- Direct visit to Verify could create incomplete user -> added missing-registration guard.
- OTP flow had no typo catch -> added email confirmation card before sending code.
- Runner feed looked silently empty when logged out -> added explicit auth-required message.
- Eligible female users were blocked by location-only "Restricted" CTA -> removed location-only accept gating and relied on filtered eligibility feed.
