# Product demo delivery — 26 September 2026

The working reservation preparation pilot runs at <http://127.0.0.1:4430/> with `npm run demo:product` / `./run.sh product`. See [the runnable demo guide](PRODUCT_DEMO_GUIDE.md). OpenBot's missions page now leads with this real preparation flow; the separate simulated recovery action remains available below it.

## User outcome and scope

The user wants a usable product that prepares a real reservation on a booking website for them to submit. They clarified that existing application service keys are permitted, but a coding-assistant API key is not. Do not place a reservation, payment, or final submission on their behalf. The earlier interpretation of no keys anywhere produced a local rehearsal; retain it as a separate, explicitly simulated mode, not the primary product claim.

## Evidence and existing changes

OpenBot chat calls actor actions but emits text-only AG-UI messages. The missions list had no creation control, the creation helper sent a field rejected by the strict API, and list records lacked the fields its UI expects. These are corrected in the current working tree. Chat-created missions remain operator-owned; ownership checks were not widened. Existing app/API/control/desk, PostgreSQL and llama-server processes were observed on loopback; this observation is not a current provider-readiness claim.

An explicit `npm run demo:local` / `./run.sh local` rehearsal now uses the production worker and effect protocol with SQLite event persistence and deterministic providers. It does not read `.env`, inherits no hosted credentials, and blocks external fetches in the launcher/worker. Its standalone board shows the independent desk ledger before the mission receipt is saved. Local mode is a substitute for hosted providers, not evidence of live sponsors or real travel reservations.

## Architecture and boundaries

Keep the hosted actor, signed identity and effect protocol intact. Keep fixed F3 simulation constraints honest; do not pretend editable trip fields change its hardcoded resources/dates. A real reservation-preparation slice must use the official site's observed interfaces and current availability, preserve a reviewable result, and stop at the human submission boundary. Research the booking site before selecting the adapter or claiming URL prefill. Do not invent private endpoints or claim an external effect from a generated plan.

## Ownership and steps

Root owns integration, config, local storage/server, scripts, docs and tests. `local_providers` owns the completed local provider adapter/runner switch and is now researching public official reservation interfaces. `demo_ui` owns the completed standalone board and OpenBot creation UI and is now advising on product flow. `demo_diagnosis` independently reviewed the local backend and chat claims. No overlapping writes. All are Codex sessions; requested Claude models/Fable were not invoked through API credentials and the Fable gate is not claimed.

Delivered slice: one explicitly supported Tiburon–Angel Island departure, October 9, 2026 at 10:00 AM Pacific, 1–6 adult tickets and an editable total ferry budget. `providers/reservation.ts` allows only the official schedule and FAQ, rejects unknown service/date exceptions and source errors, and constructs FareHarbor's documented `ctrs` quantity prefill using browser-observed item/availability/rate IDs. No IDs are inferred from dates. Nimble could not render FareHarbor (`no-assets`, task `ec4e9b89-a8ee-40bc-8d23-48593b09b39e`), so it is used only for live operator sources; the actual provider form is embedded directly and is also available as an external handoff. There is no claim of remote browser session transfer, live automated capacity verification or freshly fetched price.

`control/src/preparations.ts` saves original inputs, deduplicated command IDs, step states, source content/metadata and handoff records in a distinct SQLite preparation journal. It never emits a booking receipt or modifies canonical DR mission truth. Production ownership is acquired by binding port 4430 before restart recovery touches records. Interruptions fail visibly without automatic hosted-call replay. `product-server.ts` binds loopback, requires same-origin JSON mutations, limits one active preparation, and returns only safe evidence metadata. The launcher constructs no coding-assistant or planner-model client. UI has actual progress, budget blocks, saved history, downloads, dated fare estimates and the provider form. The user must accept any terms and submit/payment themselves.

Ownership: root implemented the service, persistence, launcher and contract tests; `local_providers` implemented the bounded adapter and source tests; `demo_ui` implemented product.html and the OpenBot primary action; `demo_diagnosis` independently reviewed and rechecked the concrete fixes. These were Codex assignments, not the unavailable requested Claude/Fable identities.

## Verification so far

- Final root unit/integration suite: 274/274 passed (local HTTP test doubles, no live providers).
- Recovery suite: 19/19 passed, including real SIGKILL and new PID.
- Local focused suite after network guard: 13/13 passed. Confirms same ferry receipt recovered, one ferry POST, four receipts totaling $280 after Site A closes, and explicit block when both accessible sites close.
- Final product suite: 42/42 passed, including deduplication, changed-input rejection, same-port ownership conflict, restart interruption, over-budget short circuit, safe errors and source/date exception validation. Root type and lint checks passed; whitespace check clean.
- OpenBot app creation tests: 3/3; app typecheck/build passed earlier, and app typecheck passed again after the product action was added. Existing build warnings remain. The integrated OpenBot chat/browser adapter was not exercised; this slice uses the separate preparation product linked from OpenBot.
- Browser local rehearsal reached real simulated-desk ferry commitment, missing mission receipt, and observed PID 88100 SIGKILL for run f3-20260926-26ec.
- Real product UI run `f935fad4-3bf2-4667-b775-90f47ba8227b`: two adults, $100 budget, two live Nimble reads (`56549fbf-4130-4ced-9faa-7f9ecfa1c3a8`, `ccd98d8b-ee16-4381-85e2-2f27dc56d405`), real FareHarbor iframe showed October 9 / 10 AM / 2 adults / $38.16 including fees. This record survived the product service restart.
- UI budget block `7ffb9bcd-822e-414d-ac44-06e04b97a5b8`: two adults / $20 budget, explicit block and zero source records.
- Changed-input UI run `5d85fc91-b206-4d41-8c2b-0122b5cda29b`: three adults / $100 budget, new live checks, actual FareHarbor iframe readback was 3 adults and $57.24 including fees. The terms checkbox remained unchecked, no cart or reservation was submitted, and no contact/payment data was entered. Local proof: `artifacts/product/prepared-ferry.png`; reviewable record: `artifacts/product/preparation-record.json`.

## Review dispositions and limits

Accepted: prevent local storage checkpoints from reaching RawTree; reject `DR_DEMO_MODE=local` in the hosted control entrypoint; add fetch guard in local child instead of relying on a parent-only spy; decode serialized constraint values in board; fix misleading chat completion wording. Parent restart intentionally begins a fresh session; existing mission takeover remains blocked. Existing `start no crash` chat parsing ambiguity and operator ownership of chat missions are deferred; neither defines the new product flow.

Accepted product review findings: bind the production port before opening/recovering the shared preparation database (tested a conflicting second startup during a held live-read promise); reject date-specific schedule exceptions even when the weekday timetable still lists the departure (tested cancellation, unknown exception and altered positive notice). The original independent Codex reviewer rechecked both fixes and found no new issues. This is not a completed Fable gate.

Limits: pilot departure only; stored fare is a dated observation, provider checkout remains authoritative; no live campsite/permit/gear booking and no complete-trip guarantee. General-date discovery and OpenBot's persistent computer-control deployment are not implemented by this slice. Native computer-control source exists but its service/dependencies are not running; no silent deployment or claim was made.

The checkout advanced concurrently through `edb120d`, `c9ac053` and `b99be06` during this task. Concurrent actor/chat fixes, projection retries, README and release work were preserved. Some earlier control/local demo changes were committed by the concurrent workflow; this task did not commit or push. Do not overwrite concurrent work or treat historical evidence as a current run.
