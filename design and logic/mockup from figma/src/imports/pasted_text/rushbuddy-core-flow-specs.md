RushBuddy — Core Flow Specs (Cursor-Ready)

FLOW 1: AUTHENTICATION
Who triggers it: New user opening the app for the first time.
Step-by-step:

User enters VIT email (@vitstudent.ac.in), full name, hostel block → taps '"Send OTP'"
System validates email domain. If not @vitstudent.ac.in, block submission and show inline error: "Only VIT email addresses are accepted during beta."
System creates a PendingUser record and sends a 6-digit OTP to the email
User enters OTP across 6 individual inputs → taps "Verify & Enter"
System validates OTP against stored value and checks expiry (10 min window)
On success: PendingUser is promoted to User with verified: true, session is created, user lands on Home screen
System records: user_id, email, name, hostel_block, verified_at timestamp, role: null (role is chosen at home, not here)

Edge cases:

Wrong OTP entered → show "Incorrect code. X attempts remaining." Lock after 3 failed attempts for 15 minutes
OTP expired → show "Code expired. Resend?" which regenerates and re-sends
Non-VIT email or Wrong-VIT email → inline block, never reaches OTP step
User tries to register with already-verified email → "This email is already registered. Log in instead."
User closes app mid-OTP → PendingUser record persists, resumes at OTP step on reopen with same email


FLOW 2: POST A REQUEST (Sender)
Who triggers it: Authenticated user in Sender mode tapping "+ Post an Urgent Request."
Step-by-step:

Sender selects item type (Document / Food / Medicine / Object)
Sender selects weight tier (Light / Medium / Heavy)
Sender selects risk level (Low / Fragile / Valuable)
System calculates and displays price range in real time using the formula: base × weight_multiplier × risk_multiplier. Min and max shown. This is not editable by the sender.
Sender enters pickup location (free text, e.g. "MBA Hall Gate") 
Sender enters drop location (free text, e.g. "MH-B Block 3, Room 214")
Sender optionally enters description
Sender taps "Post Request"
System creates a Job object with status: OPEN and records: job_id, sender_id, item_type, weight, risk, pickup_location, drop_location, description, price_min, price_max, created_at, status: OPEN
System pushes notification to all available runners within the campus scope
Sender is navigated to the Waiting / Tracking screen

Edge cases:

Sender leaves pickup or drop blank → block submission, highlight empty field with "Required"
Sender tries to post while already having an ACTIVE job → show warning: "You already have an active request. Cancel it before posting a new one?" with Cancel / Keep Both options. V1: allow only one active job per sender.
Risk level set to "Valuable" → system shows an additional disclaimer: "Items above ₹2,000 value require your runner to be ID-verified. This may increase matching time." Sender must acknowledge before posting.
No runners currently online → job still posts with status OPEN, but sender is warned: "No runners are currently active. Your request will be visible when runners come online."
Sender cancels before posting (navigates away) → no Job record is created, no notification sent


FLOW 3: MATCH & ACCEPT (Runner side)
Who triggers it: System notifying runners when a new OPEN job is posted; runner browsing the feed.
Step-by-step:

Runner is on the Runner Feed and sees the job card (type, route, pay, urgency, distance, weight)
Runner taps "Accept ₹X"
System checks: is this runner eligible? (not suspended, acceptance rate not flagged, if job is women's hostel delivery, runner gender must match)
If eligible: Job status changes from OPEN to MATCHED. System records runner_id, matched_at timestamp, agreed price (the system-calculated value, not negotiable in V1)
Runner sees the job card turn green with "Accepted — Start Delivery →"
Sender on the Waiting screen sees status update from "Finding your Buddy" to "Buddy found!" with runner name, rating, and ETA
Runner taps "Start Delivery" → moves to Active Delivery screen

Edge cases:

Two runners tap Accept simultaneously (race condition) → only the first write wins. Second runner sees: "Job just taken. Check other listings." Job status is atomic — once MATCHED, it cannot be accepted by another runner.
Runner accepts then immediately goes offline or ghosts → system waits 3 minutes for runner to tap "Confirm Pickup." If no action, job reverts to OPEN, runner's no-show counter increments by 1, sender is notified: "Your runner is unresponsive. Finding a new one..."
Runner tries to accept a job outside their verified scope (e.g., women's hostel job, male runner) → Accept button is simply not shown for those jobs. No error needed — they never see it as an option.
Zero runners accept within 10 minutes → system alerts sender: "No runner picked this up yet. Extend wait or cancel for full credit."
Runner tries to skip more than 5 consecutive jobs → system does not penalise in V1 but logs the pattern for ops review


HANDOFF MODES (V1)
RushBuddy V1 supports exactly two handoff modes. There is no proxy receiver as a separate mode. If the sender wants someone else to receive the item, they share the 4-digit confirmation code with that person directly. No proxy registration, no proxy declaration UI, no separate proxy flow.

Mode 1 — Direct P2P (Campus jobs)
- Receiver is present at the drop location in person (the receiver may be the sender themselves, or someone the sender shared the code with informally).
- The 4-digit confirmation code is generated when the job is created and held by the sender. The sender shares it with the receiver out-of-band (verbal, message) before handoff.
- Completion: at handoff, the receiver tells the runner the code. The runner enters the code in-app on their own session. The receiver does not need the RushBuddy app.
- Liability ends when the runner successfully enters the code.

Mode 2 — Landmark Handoff (Intercity jobs)
- Sender provides corridor_landmark and a receiver_phone number at posting.
- The 4-digit confirmation code is shared by the sender with the receiver out-of-band before the meeting.
- Receiver meets the runner at the landmark within a 15-minute window and tells the runner the code.
- Completion: the runner enters the code in-app on their own session at the landmark. The receiver does not need the RushBuddy app.
- Liability ends when the runner successfully enters the code.

Handoff mode is selected at job posting and is immutable once posted. It cannot change mid-job.


FLOW 4: ACTIVE DELIVERY
Who triggers it: Runner tapping "Start Delivery" after accepting a job.
Step-by-step:
Pickup leg:

Runner sees job details, pickup location, sender contact
Runner goes to pickup location and collects the item
Runner taps "Condition Acknowledged" — confirming item received in acceptable condition. This is a mandatory tap, not optional. Job does not proceed without it.
System records pickup_confirmed_at timestamp. Job status → IN_TRANSIT
Sender's tracking screen updates to "Picked up 📦"

Dropoff leg:
6. Runner arrives at drop location
7. Runner taps "Confirm Delivery — Job Done"
8. System records delivered_at timestamp. Job status → DELIVERED
9. Sender receives notification: "Your item has been delivered! Rate your Buddy."
10. Runner is navigated to their home screen with earnings updated
11. A 2-hour dispute window opens. After 2 hours with no dispute, job status → CLOSED
Edge cases:

Runner reaches pickup but sender is unreachable (wrong location, sender not there) → runner taps "Report an Issue." Ops is notified. Job status → ISSUE_REPORTED. Sender gets a notification to respond within 5 minutes or the job is cancelled with no charge.
Runner abandons mid-delivery (taps "Report an Issue" after pickup) → runner must tap "Return Item" or ops is flagged automatically after 15 minutes of inactivity post-pickup. Item location is logged at last status tap. Runner's trust score flagged for review.
Sender tries to tap "Delivered" themselves — they can't. Only the runner can confirm delivery. This is intentional — prevents false confirmations.
Runner marks delivered but sender claims non-delivery → dispute flow opens (see Flow 5). Delivery is not auto-closed; ops reviews.
Runner reaches dropoff and no one answers → runner taps "No Answer at Door." System sends an immediate push to the sender. Runner waits 20 minutes and makes 2 contact attempts during the wait. If the sender responds within the window, the runner follows the new instructions and the delivery continues. If no response after 20 minutes plus 2 contact attempts, runner taps "Sender Unreachable." Branch by risk: Low risk → runner locates the nearest secure spot (hostel gate, shop counter, security desk), leaves the package, photographs it with geotag and timestamp, uploads the photo against job_id, and ops is notified. Fragile or Valuable risk → no unattended drop is permitted; runner holds the item and awaits ops instruction only. Runner payout: full agreed fee regardless of which path is taken. Sender refund: none. System records: no_answer_at, sender_response, ops_notified, dropoff_photo_url (if applicable).


FLOW 5: RATING & PAYMENT + DISPUTE
Who triggers it: Sender receiving "Rate your Buddy" prompt after delivery confirmed.
Step-by-step:

Sender sees rating screen with runner name
Sender selects 1–5 stars
Sender sees payment summary: base fee + ₹0 platform fee (beta) + optional tip (₹0 / ₹5 / ₹10 / ₹20)
Sender selects payment method. Cash is shown only when the job is Mode 1 (Direct P2P) and the runner has entered the handoff code received verbally from the person physically present at the drop. UPI (including PhonePe) is the only option for Mode 2 (Landmark) jobs.
Sender taps "Confirm Payment & Rate"
System records: rating, tip_amount, payment_method, rated_at
Runner's aggregate rating is recalculated. Runner's total earnings updated.
Job status → CLOSED
Both parties get a confirmation notification

Dispute path (branching from step 5):

Sender taps "Report an Issue" instead of rating → dispute form opens
Sender describes issue (item damaged / not delivered / wrong item)
System flags Job as DISPUTED, notifies ops immediately via WhatsApp/dashboard
Ops has 4 hours to review and resolve
Resolution outcomes (3 possible):

Runner at fault → runner's payout partially or fully withheld, trust score penalty applied
Pre-existing damage / sender error → runner paid in full, sender notified
Unclear → partial goodwill credit to sender (platform absorbs), no runner penalty


Dispute window: 2 hours post-delivery. After 2 hours with no dispute filed, job auto-closes and runner is paid in full. No exceptions.

Edge cases:

Sender closes app without rating → job stays in PENDING_RATING for 24 hours. After 24 hours, system auto-closes with a default 5-star rating and no tip. Runner is paid the agreed base fee. Sender gets a push notification at 1 hour and 12 hours reminding them to rate.
Sender gives 1-star with no dispute filed → system prompts: "Want to tell us what went wrong?" Soft prompt only, not mandatory. Low ratings without dispute context are still recorded and affect runner score.
Runner disputes the sender's rating (claims it's unfair) → V1: no runner appeal on ratings. Log it, review manually if pattern emerges.
Payment marked as "Cash" → only allowed for Mode 1 jobs where the receiver who provided the handoff code to the runner is the same person settling payment. System records sender's intent but cannot verify settlement. Cash is hidden by the UI for Mode 2 (Landmark) jobs. The escrow fix is V2.
Tip added but payment is cash → system records tip intent. Unenforceable in V1. Flag for post-payment UPI integration.


DATA OBJECTS SUMMARY (for your cofounder)
ObjectKey StatesUserpending_verification → verified → suspendedJobOPEN → MATCHED → IN_TRANSIT → DELIVERED → CLOSED / DISPUTED / ISSUE_REPORTEDRunneravailable → on_job → suspendedDisputeopen → under_review → resolved

Job fields include: handoff_mode (mode_1_direct_p2p | mode_2_landmark), confirmation_code (4-digit, single-use, expires when job closes), corridor_landmark and receiver_phone (Mode 2 only), no_answer_at, dropoff_photo_url (nullable), and ops_notified.

Job model does NOT include: proxy_name, proxy_phone, proxy_declared, or any other proxy-related fields. Proxy handoff is not a registered mode in V1; if a sender wants someone else to receive the package, they share the 4-digit confirmation code with that person directly.
