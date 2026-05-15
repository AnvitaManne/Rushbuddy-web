---
name: SJT MVP Core Loop
overview: Finalize business-side MVP rules for SJT package pickup and home↔college flows with mode-locked handoff, liability boundaries, no-show handling, and trust/risk controls. Align existing mockup logic to these policies before implementation.
todos:
  - id: spec-unification
    content: Consolidate agreed rules into one canonical business-flow spec replacing contradictory mockup assumptions.
    status: pending
  - id: handoff-mode-definitions
    content: Document Mode 1/2/3 with immutable mode-lock and explicit completion evidence per mode.
    status: pending
  - id: noshow-dispute-playbook
    content: Define pre-pickup no-show, receiver no-show, and post-pickup ghosting response ladders with SLA and account actions.
    status: pending
  - id: risk-liability-policy
    content: Finalize Rs. 2,000 cap, KYC deterrence copy, and legal/T&C clause placeholders for legal drafting.
    status: pending
  - id: ops-evidence-fir
    content: Define minimum event logging and FIR export payload required in ops dashboard.
    status: pending
isProject: false
---

# RushBuddy MVP Core Loop Plan

## Objective

Lock a single business-operating model for MVP that resolves current mismatches in the mockup/spec and defines exactly how completion, payment release, no-shows, and liability boundaries work for sender/runner workflows.

## Current Baseline (from existing artifacts)

- Existing flow/spec references: [c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\imports\pasted_text\rushbuddy-core-flow-specs.md](c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\imports\pasted_text\rushbuddy-core-flow-specs.md)
- Existing runner active flow UI: [c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\app\components\pages\ActiveDeliveryPage.tsx](c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\app\components\pages\ActiveDeliveryPage.tsx)
- Existing sender tracking flow UI: [c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\app\components\pages\TrackingPage.tsx](c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\app\components\pages\TrackingPage.tsx)
- Existing posting/pricing assumptions: [c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\app\components\pages\PostRequestPage.tsx](c:\Users\anvit\Documents\rushbuddy-web\design and logic\mockup from figma\src\app\components\pages\PostRequestPage.tsx)
- Existing working notes baseline: [c:\Users\anvit\AppData\Roaming\Cursor\User\workspaceStorage\800b5c2bdb3b73d1b8877b2786553491\pdfs\cd3e3cf9-ff32-4a2c-bede-3e1d23af4992\RushBuddy_WorkingNotes_v1.pdf](c:\Users\anvit\AppData\Roaming\Cursor\User\workspaceStorage\800b5c2bdb3b73d1b8877b2786553491\pdfs\cd3e3cf9-ff32-4a2c-bede-3e1d23af4992\RushBuddy_WorkingNotes_v1.pdf)

## Agreed Business Rules (locked)

- `Condition Acknowledged` is a pickup-state record only (pre-existing damage/broken notes allowed); it is not completion.
- No pickup OTP/code from sender to runner.
- Delivery completion is code-driven at handoff. The 4-digit single-use code is generated at job creation and held by the sender. The sender shares it out-of-band with the receiver (themselves or an informal delegate). At handoff, the receiver tells the runner the code, and the runner enters it in-app on their own session. The receiver does not need the RushBuddy app.
- Pre-pickup no-show: if runner does not acknowledge pickup within 10 minutes of agreed window, sender can trigger `Runner Unresponsive → Find New Buddy` to unassign/re-pool.
- V1 declared-value cap: hard block for all jobs above Rs. 2,000.
- Trust/risk controls: strong KYC deterrence (College ID + Aadhaar + phone), immediate suspension on theft/dispute flag, FIR facilitation protocol, 2-hour dispute window.
- Carry-and-deliver only: purchase-and-deliver is a hard lock in V1.

## Authentication (locked)

- Email domain: only `@vitstudent.ac.in` accepted in beta.
- Registration captures: email, full name, hostel block, gender (`Male` | `Female` | `Prefer not to say`).
- Email confirmation step inserted before OTP send (typo guard).
- OTP: 6-digit, 10 min expiry; resend button after 60s.
- Gender is immutable post-verification.
- Aadhaar name match deferred to V1.5; T&C covers misrepresentation in V1.

## Job Types and Posting Rules (locked)

- Job type chosen first at posting; controls expiry and visible fields. Mode-lock applies once posted.
  - Campus Immediate: expires 30 min after posting; sender notified at 25 min with extend/cancel.
  - Campus Scheduled: sender picks time window; job goes live instantly, expires at end of window if unmatched.
  - Intercity: sender picks travel date; job stays live until 2h before; auto-expires if unmatched.
- Item type prompts: hard disclaimer for carry-only; Food requires explicit "already ordered and ready" confirmation.
- Pickup location type: `general` | `mens_hostel` | `womens_hostel`.
- Drop location type: `general` | `mens_hostel` | `womens_hostel`.
- Gender filtering rule: applied if **either** pickup OR drop type is a gendered hostel. Filter resolves to the gender of that hostel (Women's hostel → female-only runners; Men's hostel → male-only runners). If both endpoints are gendered hostels of the same gender, same rule applies. If both endpoints are different gendered hostels, the job is rejected at posting (cannot satisfy both rules with one runner).
- "Prefer not to say" runners never see jobs where either endpoint is a gendered hostel.

## Active Delivery Rules (locked)

- Pickup: for `Fragile`/`Valuable`, photo capture is mandatory and gates the `Condition Acknowledged` button. For `Low`, photo is suggested only.
- All photos and status taps are timestamped and stored against `job_id`.
- No-answer-at-dropoff protocol:
  - Runner taps `No Answer at Door` → sender push notification.
  - Runner waits 20 minutes at/near drop location.
  - If sender responds in 20 min: runner follows new instructions, delivery continues.
  - If no response in 20 min: runner taps `Sender Unreachable — Holding Item`; ops contacts both parties to coordinate return or alternative drop.
  - Runner payout: full agreed fee regardless of outcome.
  - Sender refund: none.
- This protocol replaces the earlier "10 min + 2 attempts + unattended drop with photo + ops approval" path. There is no unattended drop in V1.

## Payment Rules (locked)

- Standard delivery: agreed fee paid on `CLOSED` (after handoff code + 2h dispute window).
- No-answer at dropoff: full agreed fee.
- Runner abandons after pickup: payout withheld pending ops review.
- Runner no-show before pickup: no payout, `no_show_count` increments.
- Cash option visibility:
  - Mode 1 (Direct P2P) AND the runner has entered the handoff code received verbally from the person physically present at the drop: cash allowed.
  - Mode 2 (Landmark): UPI only; cash hidden.
- Rationale: cash is unenforceable at a landmark; UPI creates a paper trail. Within Mode 1, informal proxies are fine for cash because the receiver is in person and the runner's app session has logged the code entry.

## Handoff Architecture (mode-locked) — V1

- Two modes only, selected at posting and immutable mid-job:
  - Mode 1: Direct P2P (campus default)
  - Mode 2: Landmark Handoff (intercity default)
- No proxy mode in V1. Proxy receivers are handled informally: the sender shares the 4-digit confirmation code with whoever they want to receive. No proxy registration, no proxy declaration UI, no separate proxy flow.
- Liability endpoint is explicit per mode and tied to the runner entering the confirmation code (received verbally from the receiver) in their app.

## Data Model Additions (locked)

- `User`: `gender` (`Male` | `Female` | `Prefer not to say`), `no_show_count`, `suspension_status`, `trust_score`.
- `Job`:
  - `job_type`: `campus_immediate` | `campus_scheduled` | `intercity`
  - `pickup_location_type`: `general` | `mens_hostel` | `womens_hostel`
  - `drop_location_type`: `general` | `mens_hostel` | `womens_hostel`
  - `scheduled_window`: `{start, end}` (when `campus_scheduled`)
  - `travel_date`: date (when `intercity`)
  - `expires_at`: timestamp (computed from `job_type`)
  - `photo_url`: nullable string (set at pickup)
  - `condition_acknowledged`: boolean
  - `no_answer_at`: nullable timestamp
  - `purchase_type`: `carry_only` (V1 hard lock)
  - `handoff_mode`: `mode_1_direct_p2p` | `mode_2_landmark` (locked at posting; no proxy mode in V1)
  - `confirmation_code`: 4-digit, single-use, expires when job closes
  - `corridor_landmark`: text (Mode 2 only)
  - `receiver_phone`: text (Mode 2 only)
  - `dropoff_photo_url`: nullable string (set on unattended drop fallback)
  - `ops_notified`: boolean
- Job model does NOT include: `proxy_name`, `proxy_phone`, `proxy_declared`, or any proxy-related fields.

## Pricing (locked)

- Hybrid floor model: system computes a non-negotiable floor from item type × weight × risk (and corridor base for intercity); sender can post **at or above** the floor; runner sees and accepts the posted amount; price is fixed at acceptance.
- UI must show the floor and prevent submission below it; sender's posted price is editable above floor only.

## No-Answer at Dropoff (locked)

- Trigger (unified): runner taps `No Answer at Door` → immediate push to sender → runner waits 20 minutes and makes 2 contact attempts during the wait.
- If sender responds within the window: runner follows new instructions, delivery continues.
- If no response after 20 min + 2 attempts: runner taps `Sender Unreachable`, then risk-based branch:
  - `Low` risk: runner locates the nearest secure spot (hostel gate, shop counter, security desk), leaves the package, photographs it with geotag and timestamp, uploads photo against `job_id`, ops notified.
  - `Fragile` or `Valuable`: no unattended drop. Runner holds item and awaits ops instruction only.
- Runner payout: full agreed fee regardless of which path is taken.
- Sender refund: none.
- All paths log: `no_answer_at`, contact attempts, `dropoff_photo_url` (nullable), `ops_notified`, payout state.

## Runner Ghosting After Pickup (locked)

- First offense: warning issued; ops attempts item recovery; runner payout withheld.
- Repeat offense: account suspension.
- 24-hour escalation: if item is unrecovered after 24h from `pickup_confirmed_at`, the case escalates to the theft/FIR-facilitation protocol regardless of offense count. Account is suspended pending investigation; sender is given the FIR support package (runner identity, GPS log, photos, timestamps).

## Gender Field Privacy (locked)

- `gender` is collected at registration, stored on the User object, and used **only** for matching/filtering when either pickup or drop is a gendered hostel.
- Never displayed in any UI (runner card, profile, ratings, tracking, post-request review).
- For non-gendered jobs, gender does not influence visibility, ranking, pricing, or notifications.
- "Prefer not to say" runners are excluded from gendered hostel job matching by default and are otherwise treated identically to other runners.

## Policy Modules to Finalize (before implementation starts)

- Theft/misappropriation module text for onboarding, in-job alerts, and dispute pages.
- FIR kit schema (fields, log export contents, response SLA).
- T&C clauses (independent provider, liability cap, peer-risk acknowledgement, V1 carry-only).
- Ops decision tree for `Sender Unreachable — Holding Item` resolution.

## Acceptance Criteria for the Business Spec

- A single narrative flow exists for each mode, each with entry condition, completion signal, and liability endpoint.
- Every no-show branch has timer, actor action, and account consequence.
- Payment release events are unambiguous for normal and fallback flows.
- All above-Rs. 2,000 jobs are blocked at posting across lanes.
- Ops receives enough logs to produce FIR-support exports without manual reconstruction.

