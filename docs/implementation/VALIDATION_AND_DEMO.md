# Dead Reckoning validation and demo specification

Status: acceptance specification, not recorded test results. Read [contracts](CONTRACTS.md) and [implementation phases](IMPLEMENTATION_PLAN.md). New command names below are proposed until the scaffold implements them.

## 1. Evidence levels

Every check/result identifies one of these levels:

1. **Source-reviewed:** interface or behavior appears in inspected code/docs. No runtime claim.
2. **Deterministic unit test:** pure reducer/validator/hash/context behavior under controlled inputs.
3. **Local integration:** actual HTTP services/SQLite/processes with explicitly fake external adapters.
4. **Live smoke:** real sponsor/provider calls in a disposable namespace, with provider IDs recorded.
5. **Paired benchmark:** frozen fixtures, named models/configuration, both arms, complete measured outcomes.
6. **Live demonstration:** fresh interactive run, labeled simulation boundary and actual process termination.

A mock test cannot satisfy a live-sponsor gate. A recorded prior run cannot be presented as the current run. A model explanation cannot satisfy a deterministic invariant.

## 2. Reusable upstream test patterns

| Source | What it can help test | What it does not prove |
|---|---|---|
| [OpenMuse engine tests](../../reference/openmuse/tests/engine.test.ts), lines 46–99 | Cancellation guards, expired lease, checkpoint restoration | They close/reopen a store; they are not the required subprocess crash test |
| [OpenMuse action tests](../../reference/openmuse/tests/actions.test.ts) | Hash/owner/expiry checks, competing approval decisions, unknown outcomes | A DR booking ledger or RawTree protocol |
| [OpenMuse model-worker tests](../../reference/openmuse/tests/model-worker.test.ts) | Injected model fixtures and worker iteration | Real Intelligence entitlement or live model behavior |
| [OpenBot queue tests](../../reference/openbot/server/tests/work-queue.integration.test.ts) | Real PostgreSQL claim/lease/stale-owner tests | Exactly-once external effects or DR receipt recovery |
| [OpenBot DB helper](../../reference/openbot/server/tests/support/database.ts) | Dedicated `TEST_DATABASE_URL` and test database isolation | Permission to point tests at an app/production database |
| [Channel event patch tests](../../reference/openbot/app/tests/channel-event-patch.test.ts) | Stale/unknown UI event treatment | Mission durability |
| [Channel history refresh tests](../../reference/openbot/app/tests/channel-history-refresh.test.tsx) | Restore/refetch interaction patterns | Business-effect reconciliation |
| [Cross-process lock fixture](../../reference/openbot/server/tests/fixtures/provider-oauth-lock-cross-process.ts) | Mechanics of spawning and killing a real child | Booking correctness; write a separate mission test |

Copy relevant behavior assertions and harness ideas with attribution. Do not add tests that merely repeat an implementation expression or run unrelated browser/computer suites to create an appearance of coverage.

## 3. Acceptance matrix

Implement tests under the proposed root `tests/` tree. Names identify expected behavior; exact runner wiring belongs in Phase 1.

| ID | Scenario | Required assertions | Level |
|---|---|---|---|
| D01 | Malformed command or unknown event type | Schema rejects; no event/effect occurs; clear error | Unit/integration |
| D02 | Same command repeated | Same durable result; no extra transition/child | Integration |
| D03 | Same command ID with different args | Conflict; no second effect | Integration |
| D04 | Two commands at same expected revision | Serialized; one accepted, stale conflicting one rejected | Integration |
| S01 | Identical duplicated RawTree event | Projection applies once | Unit |
| S02 | Same event ID with different hash | Restore blocks; no arbitrary winner | Unit/integration |
| S03 | Equal/skewed timestamps | Revision order determines state | Unit |
| S04 | Missing event revision | Restore detects gap; no partial green snapshot | Integration |
| S05 | Partial/ambiguous insert acknowledgement | No desk call; resolve by original event ID | Integration |
| S06 | Acknowledged row not yet visible | Bounded polling; block if deadline expires | Integration/live probe |
| S07 | More events than one query page | Restore paginates or clearly rejects capacity; never truncates silently | Integration |
| S08 | Duplicate/conflicting checkpoints at one revision | Identical snapshot retries deduplicate; conflicting hashes block; never choose by timestamp | Integration |
| S09 | Checkpoint above watermark or wrong boundary event | Do not restore future state; reject wrong event ID/hash; an absent snapshot can fall back to earlier replay | Integration |
| S10 | Ambiguous append survives child death | Resolve original pending ID/hash before restore or a new revision; delayed visibility advances exactly once; unresolved visibility stays blocked | Integration/real subprocess |
| S11 | Evidence/mirror write interruption | Published evidence references resolve; failed event append may leave safe unreferenced content; mirror failure does not lose canonical context edits | Integration |
| A01 | Same desk key and args twice | Two attempts recorded; one reservation/receipt | Integration |
| A02 | Same desk key with altered args | `409`; original reservation unchanged | Integration |
| A03 | World changes after fetch before booking | Desk current-state/version precondition rejects stale action | Integration |
| A04 | New action key proposed for already committed/unknown slot | Validator rejects bypass; existing commitment remains authoritative | Unit/integration |
| A05 | Commit, mutate world, retry identical key/args | Original receipt returned before mutable precondition checks; saved rejection also remains rejected after reopening | Integration |
| A06 | Forged argument hash or mismatched batch/arm/mission | Recomputed hash/namespace check rejects; no cross-run lookup/effect contamination; business rejection attempt retained | Integration |
| R01 | Kill after visible intent, before request | No initial effect; resumed request uses original key | Real subprocess |
| R02 | Kill after desk commit, before receipt | Same committed receipt recovered by lookup; no second reservation | Real subprocess + live smoke |
| R03 | Kill after persisted receipt | Completed action not resent | Real subprocess |
| R04 | Desk response lost after commit | Timeout does not become failed booking; lookup recovers outcome | Integration |
| R05 | Desk unavailable during reconcile | Unknown visible; affected work blocked; no new booking key | Integration |
| R06 | Repeated Resume while child alive | One worker generation; duplicate command returns same run | Integration |
| R07 | Cancel races a dispatch claim | Cancel-before-claim causes no POST; claim-before-cancel is in flight, and late receipt is recorded; no subsequent unclaimed effects | Integration |
| R08 | Parent loses ownership/watermark metadata | Existing mission resume returns `CONTROL_RECOVERY_REQUIRED`; no automatic takeover claim | Integration |
| R09 | Claim held before HTTP, then Cancel | Original claimed attempt may send/settle; new claims refused; UI does not promise no POST after Cancel | Integration with barriers |
| R10 | Claim, kill before HTTP, then Cancel and absent lookup | No recovery POST; unknown stays visibly blocked while cancelling; no false not-executed/cancelled; explicit pause Resume tested separately | Real subprocess |
| R11 | Pause, runner exit, absent lookup, explicit Resume | No retry before user Resume; after restore/reconcile, only original key/args may retry with valid preconditions; changed/unknown preconditions block instead; cancelling/cancelled Resume is rejected | Integration with barriers |
| F01 | Campsite closes while runner down | New evidence/version; dependent unfinished step repaired or blocked | Integrated/live |
| F02 | Extraction fails / only old cache available | Stale fact stays stale; cache label; no freshness-dependent effect | Integration |
| F03 | Model patch wrong scope/date/resource | Rejected with reason; unrelated fact unchanged | Unit/integration |
| F04 | Same-source conflicting observation | Conflict surfaced; no convenient value selected without policy | Unit |
| C01 | Curator evicts accessibility or pending intent | Rejected; pinned item remains in next model input | Unit/integration |
| C02 | Curator invents receipt/action key/success | Rejected; desk/mission unaffected | Unit |
| C03 | Raw observation evicted then recalled | Detail absent from ordinary prompt; bounded recall preserves original provenance | Integration |
| C04 | Pinned content exceeds input cap | Explicit capacity block; required state retained | Unit/integration |
| C05 | Ongoing Responses tool episode | Required output items and matching call IDs preserved; no orphaned tool result | Adapter test if tools enabled |
| C06 | Fixed repeated-memory trace | Successive prompt manifests preserve pins; accepted evictions affect following input; durable evidence survives and bounded recall works | Integration + measured trace |
| C07 | Positive Liquid-authored edit | Real local-model proposal accepted and changes next prompt item set; proposal/output/input hashes trace the change; rule fallback does not count | Deterministic reducer + live smoke |
| U01 | Reload after worker death | Current canonical revision shown; historical success message not treated as current outcome | Browser |
| U02 | Out-of-order or missing SSE hint | Newer state never overwritten; reconnect fetch repairs view | Unit/browser |
| U03 | Unauthorized mission access | Denied before data/effect; browser owner field cannot bypass | Integration |
| U04 | Replayed/expired/stale approval card | No action; decision bound to current authorized proposal | Integration/browser |
| U05 | Forged/expired/wrong-Bot AG-UI assertion | No mission read/mutation; verification uses server-resolved signed identity; transport retry deduplicates | Integration |
| U06 | Approval reused for another action key/slot | Exact commitment binding rejects replay even when displayed resource/args and plan revision otherwise match | Unit/integration |
| U07 | Single-user listener exposure | Console dev/preview, API and core bind only loopback; inspect actual sockets and test non-loopback access where available; tunnel routes expose only the public feed | Local deployment check |
| B01 | Paired-run manifest mismatch | Refuse measured comparison when fixture, model/config, cap, tools, safety rules or crash schedule differ; preserve policy/summary-call costs | Benchmark harness |
| V01 | No accessible available replacement | Explicit blocked reason; never invalid success | Oracle/integrated |

## 4. Primary subprocess harness: R02

The test runner owns a test namespace and starts desk, control and worker processes. Use readiness probes and explicit barriers, not fragile arbitrary sleeps.

1. Seed fixture A/B/C, two people, accessible accommodation, USD 350 budget. Record a manifest hash.
2. Create mission and arm `after_desk_commit` before starting the first booking.
3. Wait for an acknowledged/query-visible ferry intent; capture event ID/revision.
4. Allow `POST /book` to commit. The child hits its registered hook and receives SIGKILL before `OUTCOME_RECORDED` is submitted.
5. Wait for observed child exit. Assert the exit signal/process handle, original PID gone, and control/desk still responsive.
6. Assert desk has one confirmed reservation and RawTree projection contains intent without its receipt. Read from persistence, not a cached test object.
7. Change campsite A to closed, version 2, using the operator route while the worker is stopped. Assert no auto-restart has occurred.
8. Issue explicit Resume. Assert a new PID/generation and forced RawTree projection load.
9. Assert a desk lookup for the original key precedes any possible booking retry. Recovered outcome contains the original receipt ID and args hash.
10. Revalidate relevant evidence, apply a validated proposal, reject inaccessible B, and select C or return an honest block.
11. Confirm one ferry effect, correct request/lookup counts, preserved constraints and bounded composed planner input.
12. Export sanitized event trace, desk request/outcome rows, provider IDs/modes, worker lifecycle and verdict. Shut down only processes created by the harness.

The deterministic version uses provider/storage fakes with controlled visibility behavior. A separate live-storage/live-model rehearsal repeats the critical path. Both versions are useful; neither is silently substituted for the other.

## 5. Verification commands

After the new scripts exist, run the relevant subset for each change and all required gates before declaring the integrated feature complete:

```sh
bun run check:types
bun run check:lint
bun run test:unit
bun run test:integration
bun run test:recovery
bun run test:e2e
bun run test:smoke:live
git diff --check
```

Run changed console checks from `apps/console`: `bun run typecheck`, `bun run build`, `bun run lint`; targeted relevant test files first. Upstream `bun run test:ci` enforces a minimum test count; understand its environment requirements before using it as the final console regression gate. Its dedicated test database must be separate from the application database.

If a live dependency is absent, exit with an explicit missing-prerequisite status and list the check as not run. Never silently skip every live test and call it a passing live suite. Full upstream reference suites were not run during this planning task.

## 6. Fair benchmark contract

Use a competent checkpoint/transcript comparator as the primary baseline. It has the same receipt lookup, idempotent desk, model, output allowance, candidate information, evidence updates, action permissions, step limits and fixture clock. Its memory policy can summarize or checkpoint; do not forbid obvious recovery behavior to manufacture a win.

Two experiments must be labeled separately:

- **Fixed-budget reliability/cost:** both primary arms receive the same planner input cap and model settings. Each implements its own disclosed retention policy within that cap. Compare validity, blocks, calls, token/cost totals and recovery work. Ties and higher DR overhead are valid results.
- **History-growth ablation:** raw append-only history versus DR context policy over repeated observations. The raw arm stops honestly at its documented cap/provider window or cost ceiling. This weaker ablation illustrates growth; it is not the sole reliability comparator.

Begin with six paired fixtures and expand with predeclared repetitions if stable: F1 normal completion; F2 kill after intent; F3 kill after desk commit plus campsite closure; F4 kill after receipt; F5 unreachable required source; F6 no accessible alternative. F3 deliberately combines two conditions, so this six-fixture set covers all three crash boundaries and changed-world recovery. Maintain isolated desk/state namespaces. Freeze fixtures before measured runs; do not choose only cases where DR wins.

For continuous-session claims, both arms must process the same repeated requests in a persistent session, and DR must persist its bounded session summary/receipt references outside the active prompt. If that session layer is not implemented, report the benchmark as independent missions and chart per-mission observation/step growth. A collection of unrelated one-shot missions does not prove stable context over a continuous session.

Record: batch/arm/mission/call/epoch IDs; fixture and code revision; model/provider and local quantization; actual elapsed duration; planner input/output usage; curator input/output usage; estimated versus provider-reported counts; total calls; source fetch/cache/replay mode; recovery time; repeated/deduped requests; committed effects; stale-action violations; preserved constraints; terminal verdict and reason. Keep wall-clock request latency distinct from model prefill/decode timing.

Both arms retain desk idempotency. Actual duplicate effects should normally be zero for both. Recovered versus re-sent/deduplicated requests is the useful distinction. Do not turn off desk idempotency for the main comparison. Never assert the naive agent will book a closed site: the independent desk should reject an invalid request; report attempted stale actions separately from committed ones.

Run latency comparisons sequentially when sharing the local Liquid server, or explicitly report contention. Use actual provider pricing only after current verification if displaying monetary estimates; otherwise show token/call counts. Avoid percentiles with misleading precision on tiny samples.

### 6a. Required memory workload and Liquid causality

A short ferry crash alone does not exercise accumulating history. Add one fixed **same-mission** trace, M1, with 12 observation/decision rounds. Freeze the source snippets, order, IDs, relevant/irrelevant labels, clock changes and expected invariant outcomes before recording measured runs. Use plausible trip-source excerpts, not random padding; both comparison arms receive the same sequence. The corpus should exceed twice the configured planner-input target in cumulative raw text under the disclosed counting method. This is a workload size, not an expected result. If it does not, label context pressure insufficient rather than claiming a plateau or window-limit benefit.

| Rounds | Fixed event / required behavioral evidence |
|---|---|
| 1–3 | Set constraints, ingest initial candidate evidence, complete the ferry; retain its compact receipt and constraints |
| 4–6 | Add completed-step detail and competing/irrelevant observations; obtain and validate curation proposals; compare prompt item sets before/after accepted edits |
| 7–9 | Introduce the fixed closure and superseding evidence; invalidate affected dependencies, preserve the receipt, and repair/block from current evidence |
| 10–12 | Request one older evicted evidence ID, return a bounded provenance-labeled excerpt, then finish subsequent prompt construction without re-adding the entire transcript |

Store each actual planner call's ordered item IDs/versions, pin reasons, composition hash, counting method and token count, plus accepted/rejected curator operation IDs. Preserve sanitized input artifacts for inspection. The behavioral pass requires at least one accepted eviction to remove raw detail from the **following** planner input, every mandatory pin to survive, and the evicted original to remain recallable. Every composed input either meets the declared cap or explicitly blocks with `CONTEXT_CAPACITY`; an all-blocked run is not a successful completion or latency win. Early terminal blockage is recorded as an incomplete trace, not filled with fabricated model calls.

At least one measured integrated trace must use the actual local Liquid model to author a valid context edit. Record model/build/quantization, raw structured proposal, validator decision, operation ID, before/after input item sets and hashes, and duration. The edit must cause a real item-set change; a reason string, status copied from the dropdown, or ignored proposal is insufficient. Code still protects truth and pins. A rule fallback and a rejected-only model run remain useful failure evidence but do not satisfy the positive Liquid integration gate. Never force acceptance of a harmful proposal to make this gate green.

The scripted trace establishes repeated per-mission memory behavior in a short run. The scenario clock and actual elapsed time appear separately. It does not establish days-long uptime or continuous multi-mission session stability. Show its prior measured plot with a batch/run label; the fresh interactive demo may replay only the selected closure/recall beats and must not pass the earlier measurements off as newly generated.

### 6b. Frozen primary comparator policy

Use one named implementation, `checkpoint-summary-v1`, rather than choosing among summarization policies after seeing results:

1. Share the same typed effect ledger, constraints, validators, receipt lookup, candidate information, planner model/config, action permissions, freshness policy and input cap as DR. These are safety controls, not features withheld to create baseline failures.
2. Save a checkpoint after every accepted observation/decision and every action outcome. On Resume, reconcile every pending action first and refresh dependencies of unfinished steps under the same freshness policy as DR.
3. Render the mandatory constraint/commitment/receipt/current-frontier block first, then a running summary capped at 800 tokens, then the most recent observations that fit the remaining input allowance in reverse chronological priority. Render retained observations chronologically. System/schema overhead counts against the same cap. Pin overflow blocks for either arm.
4. When retained raw history no longer fits, summarize the evicted batch plus the previous summary in a separate call to the same planner model, using a frozen prompt and a bounded input/output allowance. Split oversized batches deterministically. Preserve evidence IDs; summary prose never overrides canonical facts, constraints or receipts. Charge every summary call to baseline totals. If summarization fails after the shared configured retry bound, block/report the error rather than silently switching policy.
5. Give the baseline the same bounded recall operation and evidence registry. It may request older evidence. It does not receive Liquid curation for free; DR's Liquid input/output, calls and latency are included in DR totals. There is no required winning score or presumption DR is cheaper.
6. Before the first measured batch, write the policy version, prompts, thresholds, provider retry/step limits, code/fixture hashes, model configuration and candidate/effect budgets to the manifest. Keep these fixed for the batch. Any later policy change creates a new version and reruns both arms; include failed runs and ties.

This comparison tests the consequences and overhead of the disclosed memory policies atop common safety machinery. It cannot attribute a shared idempotency success solely to DR or prove this is the best possible summary agent. The optional append-only ablation remains separately labeled.

## 7. Demo choreography and screen contract

Primary screen: goal/constraint strip, route and current step, receipt rail, working-context tray. Proof panel: event revisions, key/receipt IDs, source/task IDs, Liquid proposal/validation, and real measurements. Operator page: status enum, notice, Save, Resume. Keep controls readable on a projector. The default operator uses the local laptop; responsive styling may support a future phone view, but phone access is not a reason to expose a single-user admin console or the whole desk service.

| Time target | Operator action and evidence | Presenter line |
|---|---|---|
| 0–12 s | Show constraints and arm crash before execution | “The mission must preserve accessibility and stay within budget.” |
| 12–27 s | Visible intent, desk commit, actual child exit; agent receipt still missing | “The booking succeeded. The worker died before recording that result.” |
| 27–42 s | Judge closes A while runner stays stopped | “The world changes while the agent is offline.” |
| 42–55 s | Explicit Resume; new PID; original key looked up; original receipt recovered | “It checks what happened before deciding what to do next.” |
| 55–72 s | Source re-fetch, fact version change, Liquid proposal and validator verdict | “It refreshes the evidence the unfinished plan depends on.” |
| 72–83 s | Preserve ferry/accessibility, repair to C or show precise block; raw detail leaves context | “Important state stays; unnecessary detail leaves working context.” |
| 83–90 s | Proof strip plus clearly labeled prior measured batch | “These records and measurements are from the run, not generated narration.” |

Ninety seconds is a rehearsed target. The interactive version can take two minutes if typing or retrieval is slower. The three-minute cut adds a brief problem explanation, sponsor evidence, and comparison limitations.

## 8. Readiness and fallback rules

- The booking service and closure are always labeled **SIMULATED**. Worker death, persistence, and any claimed live provider call must be real.
- Preload the model and rehearse the exact hardware/network. Do not download model weights on stage.
- Public tunnel serves only an explicit allowlisted read-only status-feed route needed by Nimble, through a route-restricting proxy or separate feed listener. Do not tunnel the whole desk port. Keep single-user OpenBot console and operator controls out of that public route; confirm loopback listener bindings before rehearsal.
- Source replay/cache mode is visible. Cached evidence cannot authorize an action requiring current freshness. A replay demonstration is a separate mode with no new claimed live effects.
- The model may reject a notice or produce an invalid patch. Show rejection and a block; a rule-based fallback must name itself.
- RawTree unavailable means no new effect that needs a durable intent. Keep last-known state visible with its timestamp and availability warning.
- No valid route means `blocked`. This can be a successful correctness demonstration, but do not relabel it as a completed booking.
- Freeze features before recording. Keep the process-death/recovery section uncut where possible. Caption accelerated scenario time and edited footage.
- Internal submission target is 4:00 PM Pacific; the advertised event cutoff in cached organizer evidence is 4:30 PM. Confirm the actual portal when submitting. Record/upload before the internal target.

## 9. Completion evidence bundle

Publish sanitized files only when publication is authorized by the implementation task. Suggested bundle:

```text
docs/results/<batch-id>/manifest.json
docs/results/<batch-id>/metrics.jsonl
docs/results/<batch-id>/summary.md
docs/results/<batch-id>/recovery-trace.json
docs/results/<batch-id>/desk-outcomes.json
docs/results/<batch-id>/source-provenance.json
docs/results/<batch-id>/limitations.md
```

The manifest names commit, fixtures, models, quantization, API versions/config and which checks were live. Reports include failure counts and unknown/missing metrics. Remove secrets, private identities and unnecessary raw third-party content. README distinguishes upstream reused code, new DR implementation, fallback paths, and unimplemented stretch features.

An implementation is complete only when its requested behavior exists, relevant deterministic checks pass, diff matches scope, and remaining service limitations are stated accurately. A plan is complete when its contracts, phases, gates and references are ready; that is not a claim the application has passed these checks.
