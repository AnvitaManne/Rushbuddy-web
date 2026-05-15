**RushBuddy**

Founder Working Notes — Operations, Trust & Expansion

*Version 1 · Internal Use Only · Do Not Distribute*

# **1\. How Peer Delivery Happens Today — and Why That's the Opportunity**

Peer package delivery among students and train travellers isn't a new behaviour — it's unorganised, unreliable, and unmonetised. RB formalises it.

## **1.1 The Current State: Reddit, Facebook & WhatsApp**

Students and intercity travellers currently coordinate informal package-carrying through Facebook groups, Instagram stories, WhatsApp communities, and Reddit threads. Posts look like: "Anyone travelling Vellore to Chennai this weekend? Can you carry a small package?"

The problems with this approach are fundamental:

* Discoverability is terrible. You have to be in the right group, checking it at the right time.

* There is no accountability. No verification, no ratings, no paper trail if something goes wrong.

* Matching is manual and slow. Someone has to post, wait for replies, DM back and forth, and coordinate — this kills urgency-use-cases entirely.

* Payment is awkward. No standard, no floor, often no payment at all — people feel strange asking.

* Trust is assumed, not verified. You're handing your package to a stranger you found on a Facebook post.

| The Core Insight RushBuddy is not creating a new behaviour. It is capturing an existing one, adding a trust and verification layer, and making it fast enough to be useful for urgent deliveries. The informal network already exists — our job is to own it. |
| :---- |

# **2\. Runner Motivation — Making Sure People Actually Show Up**

The most important supply-side question in any delivery platform is: why would someone run? If runners are not motivated, the platform is dead. 

## **2.1 Why Runners Might Not Show Up (The Real Risks)**

* Pay feels too low relative to effort, especially for intra-campus jobs in heat or rain.

* Social awkwardness of being seen as an errand-runner by peers in a college environment.

* No guaranteed income — if requests are sparse, the effort of being available feels wasted.

* Fear of being blamed if something goes wrong (damage, loss, dispute).

## **2.2 How We Solve the Motivation Problem**

The answer is not just higher pay — it is making running feel worth it on multiple dimensions: financial, social, and low-friction.

**Financial Levers**

* Price floors that are non-negotiable. Runners cannot be underpaid below the floor. This protects runner dignity and prevents a race to the bottom.

* Multi-package stacking on intercity runs. A runner going Chennai to Vellore can carry 3-4 packages simultaneously and earn Rs. 450-600 in one trip they were already taking. This is the core unit economics of the train corridor model.

* Streak bonuses and weekly earnings visibility on the home screen. Showing runners "You're Rs. 80 away from your best week" is a low-cost motivation lever.

* Tip visibility. The platform explicitly tells runners when a tip was added — this is a behavioural nudge for senders to tip good runners.

**Social and Friction Levers**

* Verified runner badge displayed on profile. Running for RushBuddy is not a gig — it is a trust-marked campus role. This reframes the social dynamic.

* Intra-campus jobs are designed to match runners already going in that direction. A student with class at SJT who lives in GH block can earn Rs. 40-50 just by picking up an Amazon package on the way. Zero detour, real money.

* Acceptance rate tracking. Runners who decline too many jobs lose access to high-value requests. This creates soft pressure to stay engaged without being punitive.

# **3\. Risk, Liability & What Happens When Things Go Wrong**

Every logistics operation fails sometimes. The question is not whether failures happen — it is whether we have a system that handles them fairly, quickly, and in a way that preserves trust on both sides. This section covers our protocol for the three main failure modes.

## **3.1 Runner No-Show**

A runner accepts a job and then does not appear, goes offline, or abandons the delivery midway. This is the most common failure mode in early-stage peer delivery.

| Scenario | Response Protocol |
| :---- | :---- |
| **Runner accepts, then ghosts** | TBD |
| **Runner abandons mid-delivery** | TBD |
| **Pattern of no-shows** | Suspension \+ drop in rating |

## **3.2 Theft or Misappropriation**

This is the trust-critical failure that could kill the platform if not handled right. The honest answer is: in V1, we cannot prevent a bad actor from stealing. What we can do is make it extremely costly to try and nearly impossible to get away with.

* All runners are Aadhaar \+ college ID verified. A thief is not anonymous — they are a named, documented student with a real identity on file. FOR V1 MVP, VIT STUDENTS WILL BE VERIFIED ONLY WITH VIT MAIL ENDING WITH @[vitstudent.ac.in](http://vit.ac.in) I.E WE AUTHENTICATE USING GMAIL ONLY

* Every status tap is timestamped and logged. There is a paper trail from pickup to delivery. AND STATUS WILL BE UPDATED AND SHOWN LIKE ANY STANDARD COURIER DELIVERY WEBSITE 

* Declared value cap TO BE DECIDED LATER

* Immediate ops escalation. Any theft report triggers TO BE DECIDED LATER

* We do not offer cash compensation for theft in V1. We are transparent about this in the T\&Cs. We are a peer platform, not an insurer. The verification layer is the trust guarantee, not a payout guarantee.

| Note on Insurance Micro-insurance integration (via Digit or Toffee APIs) is on the roadmap for V2. In V1, we manage exposure by capping declared value and being transparent with senders about the risk profile of peer delivery. This is honest and defensible. |
| :---- |

## **3.3 Damaged Items**

Damage is more common than theft and harder to resolve fairly. The challenge is that both sides will claim the item was already damaged / was fine before handover.

**Prevention**

* Runners are required to tap a "Condition Acknowledged" confirmation at pickup. This is a timestamped in-app acknowledgement that the item was received in acceptable condition. If a runner does not tap this, the job does not proceed.

* For fragile or valuable items (risk level set to Red by sender), the app prompts both parties to photograph the item at pickup. This is not mandatory in V1 but strongly recommended via an in-app prompt.

**Resolution Protocol**

* TBD IN DETAIL

* Both parties receive a dispute form. Photos and descriptions are reviewed by ops (founder) within 4 hours.

* Resolutions: (a) Runner at fault due to negligence — runner's payout is partially withheld and a trust score penalty is applied. (b) Pre-existing damage — no action against runner, sender is notified. (c) Unclear — partial goodwill credit to sender, no penalty to runner. The goal is to resolve fast, not to be perfectly just every time.

* Repeat damage disputes against same runner result in trust score degradation and eventual access restriction for fragile items.

# **4\. User Segments — Who is Actually Paying and Why**

There are two distinct demand profiles and they should not be treated as the same user. Understanding this distinction shapes pricing, marketing, and product decisions.

## **4.1 Segment A: Students on a Budget (Intra-Campus+ STUDENTS GOING HOME)**

These are the senders who need something moved quickly inside or around campus — printouts, food, medicine, Amazon pickups — and who have limited cash but high frequency of need.

* Price sensitivity is high. They will not pay Rs. 150 for a printout. The Rs. 25-60 price range for intra-campus jobs is the right zone.

* Urgency is real. The use case is often: exam in 45 minutes, printout stuck at MBA Hall, class at SJT. That urgency justifies the price.

* They are also the runners. The same student who pays Rs. 35 for a delivery on Monday earns Rs. 50 running a delivery on Tuesday. This dual-role dynamic is core to the campus flywheel.

## **4.2 Segment B: Travellers and Older Users (Intercity)**

These users have more money and less time. A working professional who needs to get a document to Chennai today does not want to go to DTDC, wait in line, and pay for next-day delivery. They want it gone now.

* Price sensitivity is lower. They will pay a meaningful premium for same-day, door-to-door, zero-effort delivery.

* Urgency is the product. The value proposition is not cheaper than courier — it is faster, more convenient, and handled by a verified real person.

* B2B potential. Small businesses — local pharmacies, document centres, boutiques — have regular urgent delivery needs on known corridors. A pharmacy in Vellore that regularly needs to send samples to Chennai is a recurring revenue source, not a one-time sender.

# **5\. Intercity Pricing — How to Set Rates That Work**

The pricing question for intercity is: why would someone use RushBuddy instead of DTDC or BlueDart? The answer is speed and convenience. So our pricing needs to be meaningfully more expensive than standard courier (to justify runner earnings) while remaining reasonable for urgency-sensitive senders.

| Package Size | RushBuddy Price | DTDC/BlueDart Benchmark | Why Choose RushBuddy? |
| :---- | :---- | :---- | :---- |
| Small (\< 0.5 kg) | **Rs. 80 \- 120** | Rs. 50 \- 80 (next day) | Same-day, hostel pickup, zero effort |
| Medium (0.5 \- 2 kg) | **Rs. 150 \- 250** | Rs. 100 \- 150 (next day) | No packaging required, door-to-door within hours |
| Large (\> 2 kg) | **Rs. 300 \- 500** | Rs. 200+ (next day) | Speed \+ convenience premium, justified for urgency |

**The Real Competitive Advantage Over DTDC**

* DTDC requires the sender to pack, go to a collection point, and wait. RushBuddy picks up from wherever the sender is.

* DTDC is next-day at best. RushBuddy is same-day on active corridors.

* DTDC does not work for hostel-to-hostel deliveries where the item lives and dies inside the campus ecosystem.

| Pricing Principle We are not competing with courier companies on price. We are competing on speed, convenience, and trust. Our pricing reflects that. If a sender wants cheap, they use DTDC. If they want it there today, they use RushBuddy. |
| :---- |

SENDER PUTS THE PRICE ON SENDER POST AND RUNNER CAN SEE AND ACCEPT IT. 

## **5.1 The Multi-Package Runner Model (Intercity)**

This is how intercity becomes economically attractive for runners without requiring RushBuddy to subsidise anything.

Example: I am a student at VIT Vellore and I am travelling to Chennai this weekend. I know this 10 days in advance. I post on RushBuddy that I am a runner on the Vellore-Chennai corridor on Saturday. Senders who need packages delivered that day see my listing and book me.

* I carry 3 small packages at Rs. 100 each \= Rs. 300 earned on a trip I was taking anyway.

* Senders get same-day delivery to Chennai without any packaging or post office visit. Their recipient arranges a local runner(eg: porter) for the last mile if needed.

* RushBuddy earns a platform fee on each transaction.

The runner does not pay for any porters on either end — that is the sender's responsibility to arrange. The runner's job is to carry from pickup point A to dropoff point B. Everything else is coordinated separately.

# **6\. Specific Use Cases — How It Works in Practice**

## **6.1 Amazon Package Pickup from SJT**

Hundreds of Amazon packages arrive at VIT daily. The collection point (SJT or equivalent) is a 40-minute round trip in heat from the hostels. A student with a class at SJT can earn Rs. 40-50 by picking up a package on their way back. Zero detour. Real money. The sender gets their package without leaving their hostel.

* No insurance required — this is campus-internal, item already delivered by Amazon, runner is just the last 200 metres.

* Every step is logged in-app: pickup confirmation, photo if prompted, delivery tap, and an automated email confirmation to both parties.

## **6.2 Sensitive Items Inside Gendered Hostels**

A girl in a women's hostel needs sanitary pads or medication delivered inside the hostel. External delivery people cannot enter. Male friends cannot enter. RushBuddy solves this with a same-gender verification rule: for deliveries into women's hostels, the runner must also be a verified female student.

* Gender verification is pulled from the profile registration data at onboarding.

* The app filters the runner pool automatically — male runners simply do not see jobs tagged as women's hostel delivery.

* This is a real, under-served use case and a strong word-of-mouth driver among female students.

# **7\. Marketing, Campus Activation & Club Collaborations**

The first 100 users will not come from paid ads. They will come from peer trust — someone their friend used the app, saw a reel, or heard about it through a club they trust. The campus activation strategy must be personal, credible, and low-cost.

## **7.1 The Bangalore Network (First 8 Weeks)**

I have 8 weeks remaining in Bangalore and a network of friends who can contribute directly to early validation and marketing. This is a time-limited asset that should be used now.

* Sol and Abi (law students): Help draft the platform T\&Cs, the liability cap language, and the runner agreement. Legal clarity at this stage is cheap. Disputes without legal language in place are expensive.

* Ashvin, Nikhil, Shaun: Survey distribution and user research. Have them run the 15-question sender/runner interview script with students they know at other colleges. This gives cross-campus data, not just VIT.

* Instagram Reels: The format that works for campus products is problem-first storytelling. Script: show the pain (it is 43 degrees and your printout is at MBA Hall), then show the solution (RushBuddy runner at your door in 8 minutes). Authentic, not polished. Friends shooting this is more credible than a produced ad.

# **8\. Open Questions & Things Still to Resolve**

These are the gaps I know about. They need answers before launch, not after.

* B2B Onboarding: What does the sales motion look like for onboarding a local pharmacy or document centre as a recurring sender? Do they get a different UI (bulk posting), a different rate card, or just the same app with a business tag? This needs a dedicated conversation.

* Finding Intercity Runners Proactively: The intercity model depends on runners posting their travel plans in advance. How do we build that habit? Do we integrate with train booking flows (IRCTC), send push prompts, or rely on users organically posting? The acquisition of supply-side behaviour needs to be designed.

* Ops Coverage: I am one person. When I start at Maruti in June, who handles late-night disputes and emergency re-matches? The ops playbook needs a contingency section for when I am not available.

* V1 Payment: Cash-on-delivery with UPI screenshots is the V1 payment model. The risk is off-platform settlement. Every job where payment happens outside the app is a job RushBuddy earns nothing on and cannot verify. This is the first payment infrastructure problem to solve post-MVP.

*RushBuddy — Founder Working Notes v1 · Internal Only · Not for Distribution*