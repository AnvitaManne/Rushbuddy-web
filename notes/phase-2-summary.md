# Phase 2 Summary - Auth and Registration Flow

## 1. Goal of the phase

Phase 2 = Implement the MVP authentication and registration core loop for sender/runner onboarding:
- collect required identity fields (email, name, hostel block, gender),
- add pre-OTP email confirmation,
- verify with OTP (demo),
- promote pending registration to authenticated `User`,
- preserve privacy boundaries (gender is internal, not shown in user-facing UI),
- and make runner-feed behavior clearer before authentication.

Source references:
- `docs/plans/sjt-mvp-core-loop.md`
- `notes/phase-1-summary.md`

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `notes/phase-2-summary.md` | Captures Phase 2 implementation decisions, validations, and remaining gaps. |

### Changed across Phase 2 slices (app code)

| File | What changed |
|------|--------------|
| `app/src/domain/types.ts` | Added reusable `PendingRegistration` type. |
| `app/src/app/context/AppContext.tsx` | Added `pendingRegistration` + setter; kept `pendingEmail` compatibility mapping to `pendingRegistration.email`. |
| `app/src/app/components/pages/AuthPage.tsx` | Added gender capture, validation, and email confirmation step before OTP send. |
| `app/src/app/components/pages/VerifyPage.tsx` | Promoted `pendingRegistration` into authenticated `User`; added safe missing-registration handling; added "Wrong email?" return action. |
| `app/src/app/components/pages/RunnerFeedPage.tsx` | Added auth-required empty state when `user` is null while preserving eligibility filtering for logged-in users. |

---

## 3. Slice map (what each slice did)

| Slice | Deliverable |
|------|-------------|
| **2.1** | Added pending registration state to `AppContext` (`pendingRegistration`, `setPendingRegistration`) and compatibility with `pendingEmail`. |
| **2.2** | Captured gender in Auth registration form (`male` / `female` / `prefer_not_to_say`) with validation and context storage. |
| **2.3** | Inserted pre-OTP confirmation step: "We'll send a code to [email]. Is this correct?" with `Yes, Send Code` and `Change Email`. |
| **2.4** | Updated Verify flow to create authenticated `User` from `pendingRegistration`; blocked unsafe user creation when registration is missing. |
| **2.5** | Completed OTP edge-case UX: resend timing behavior retained, explicit "Wrong email? Go back and change it." action added. |
| **2.6** | Privacy and feed sanity checks: no gender exposure in user-facing UI; runner feed shows helpful auth-required message before login. |
| **2.7** | Added this phase summary note. |

---

## 4. Product decisions implemented in Phase 2

- **Registration fields aligned with spec**: email, full name, hostel block, gender.
- **Gender domain mapping**:
  - Male -> `male`
  - Female -> `female`
  - Prefer not to say -> `prefer_not_to_say`
- **Email typo guard before OTP**: confirmation card inserted before sending OTP.
- **OTP behavior (demo)**:
  - demo code remains `123456`,
  - wrong code decrements attempts (3 total),
  - lockout copy remains mocked at 15 minutes,
  - validity copy remains 10 minutes (no backend expiry yet).
- **User creation source of truth**: successful OTP now uses `pendingRegistration` for identity fields.
- **Privacy constraint upheld**: gender remains internal and not displayed on profile/feed surfaces.
- **Runner feed pre-auth UX improved**: before authentication, users see explicit auth-required guidance instead of a misleading empty jobs state.

---

## 5. Validation steps

Build + lint checks run during slices:

```bash
cd app
pnpm build
```

Manual checks performed:

1. Registration form requires valid `@vitstudent.ac.in` email.
2. Registration requires gender selection before proceeding.
3. Email confirmation card appears before OTP screen.
4. `Change Email` returns to editable form with entered values preserved.
5. `Yes, Send Code` proceeds to Verify page.
6. Wrong OTP still decrements attempts and shows remaining-attempt copy.
7. Correct OTP (`123456`) logs in and routes to Home.
8. Authenticated user identity fields reflect pending registration values.
9. Verify screen "Wrong email?" returns to auth flow.
10. Runner feed before verification shows auth-required guidance, not a silent empty feed.
11. Gender does not appear in Profile or runner-facing job cards.

---

## 6. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| Verify previously used only `pendingEmail`, causing incomplete identity promotion. | Switched to `pendingRegistration` and mapped required identity fields into `User` on successful OTP. |
| Risk of creating partially populated user if Verify loaded directly. | Added safe missing-registration handling in Verify with clear return-to-auth path. |
| OTP flow allowed immediate navigation without typo check. | Added explicit email confirmation card before send-and-navigate. |
| Runner feed looked like "no jobs" when user was unauthenticated. | Added auth-required empty state messaging while keeping eligibility logic unchanged for logged-in users. |
| Backward compatibility needed while migrating from `pendingEmail`. | Kept compatibility fields in context while introducing `pendingRegistration` as primary state. |

---

## 7. Gaps before Phase 3 (checklist)

- Persist auth session/registration across refreshes (current context is in-memory only).
- Replace demo OTP logic with backend-driven OTP:
  - actual send,
  - server-side expiry,
  - attempt lock enforcement.
- Pre-fill Auth form from `pendingRegistration` when returning from Verify for best UX continuity.
- Add automated tests for auth flow:
  - validation,
  - confirmation step,
  - OTP success/failure paths,
  - missing-registration guard.
- Finalize post-verification profile completion and KYC deterrence integration milestones from plan.
- Keep auditing for privacy leaks so `gender` remains matching-only and never displayed in UI.

---

*Create `notes/phase-3-summary.md` after Phase 3 implementation completes.*
