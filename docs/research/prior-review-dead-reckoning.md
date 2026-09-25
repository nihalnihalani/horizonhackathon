# Prior review of Dead Reckoning (our own, 2026-09-25)

Verdict given: "Yes, it's a good project. It's the strongest of everything we've looked at for this judging panel. It isn't a guaranteed win, though, and one weakness could cost it the top prize if you don't fix it."

## Why it's good (as argued)
- Solves a real problem: an agent crashes after acting but before recording it; on restart it double-acts or trusts stale facts. Payment systems double-charge this way; developers complain agents lose track after compaction.
- Demo is clear to anyone: "they killed it mid-booking, closed the campsite while it was dead, and it didn't double-book and remembered the wheelchair."
- Suits the panel: 6 of 10 judges are data/infra engineers (Tinybird ×2, Razorpay, Gap, LinkedIn, Airbyte) who respect intent-before-action, reconciliation with the booking service, fault injection.
- Real, not mock: real kill, real page edit, live Nimble fetches, real local Liquid model, real RawTree rows, chaos-mode counts over the afternoon.
- Every sponsor has a real job, once Nimble is the change detector.
- Honest: names prior art, labels what's simulated.

## The weakness flagged
It can come across as a crash-recovery project, not a long-horizon context project. The brief is about agents slowing down and getting unreliable as history piles up. A 90-second trip-planning run with one crash can make a judge think "nice durable execution, but where's the long horizon?"

Proposed fix: run it all afternoon as a trip desk handling a stream of requests with random crashes; show context growth side by side (naive 142K tokens vs flat 5.8K); say "crashes are the sharpest version of the long-horizon problem."

## Smaller risks listed
| Risk | Severity | Fix |
|---|---|---|
| "Isn't this just Temporal?" | Medium | Durable execution doesn't re-check stale facts or manage the model's context |
| Nimble looks decorative | Medium | Nimble must detect the campsite closure, plus the real ferry schedule |
| Camping is low-stakes | Low | Non-refundable ferry, accessibility constraint; name payments/data pipelines as future markets |
| Live model or planner misbehaves | Medium | Validator gating, limited action set, rehearsal, BLOCKED as valid ending |
| Scope creep | High | Freeze code at 3:15; chaos harness beats any extra feature |

## Scorecard given
| Criterion | Score |
|---|---|
| Fit to the brief | 4/5 |
| Technical depth | 5/5 |
| Demo impact | 4/5 |
| Sponsor fit | 4/5 |
| Buildable in 5.5h | 4/5 |
| Originality | 3/5 |

## Live "product mode" additions proposed afterwards
Supervisor with auto-restart; booking desk as a separate FastAPI service with SQLite and unique action_key; public status page with admin form (judge edits it); UI driven by real events (SSE); fault injector running from 2:30 with live counters read from RawTree; optional Stripe test mode; Hypothesis stateful tests; Toxiproxy for network faults. Cut the "as of before outage" toggle and privacy-boundary stretch to pay for it.
