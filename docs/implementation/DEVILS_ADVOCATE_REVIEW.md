# Dead Reckoning: devil's advocate review

Review date: 25 September 2026. Scope: the complete root `AGENTS.md` and implementation package, checked against pinned source and earlier project decisions. This is a documentation/source audit, not a running-system certification. No application code, provider probes, build or benchmark was executed during this review.

## Verdict

The architecture remains a defensible MVP: an explicit state contract, reconciliation of external effects, source revalidation and bounded model input demonstrated through a simulated trip. The initial plan was detailed but still left ten material choices ambiguous or unverified. Those ten gaps are now addressed in the authoritative plan and acceptance specification. They must still be implemented and proven; updating documentation does not make their runtime tests pass.

Three independent reviewers challenged state/recovery, actual source integration, and product/demo/evaluation. The orchestrator re-read the findings, confirmed the relevant source behavior and authored the revisions. Review tasks used the configured HIGH → Luna/high lane. `TYPESAFE_API_KEY` was absent; no Jev decision or approval is claimed. Deterministic document checks are recorded separately in [the worklog](WORKLOG.md).

Priority definitions: **P1** must be settled before implementing the affected boundary; **P2** must be settled before the corresponding feature or benchmark can be presented as complete. These are plan gaps, not discovered bugs in a built DR application.

## Findings and disposition

| ID / priority | Concrete counterexample in the original plan | Correction now required | Acceptance evidence |
|---|---|---|---|
| DA01 / P1 | A localhost URL is shown, but copied OpenBot Vite binds `::` and Bun has no explicit hostname. A reachable visitor can be administrator in single-user mode. | Patch only the exported console's dev/preview and API binds to `127.0.0.1`, align proxy target, inspect sockets; public tunnel exposes only the feed route. | U07; local listener check before rehearsal |
| DA02 / P1 | Ferry commits, the world version changes, then the same request is retried. Checking the current world first can return a new rejection instead of the saved receipt. | Recompute arguments; existing-key lookup and identical terminal outcome return precede mutable precondition checks. Preserve saved rejections too. | A05, A06; original receipt/result survives world changes |
| DA03 / P2 | Desk tables partition by batch/arm/mission, but the booking body does not explicitly supply batch. An implementation might parse opaque keys or mix fixture rows. | Explicit namespace in the body; control matches it to intent, desk matches its registered fixture; canonical hash includes namespace. | A06; cross-run mismatch rejected |
| DA04 / P1 | An outcome insert times out and is temporarily invisible above the acknowledged watermark. Resume clears cache, restores an older prefix, and accidentally reuses/skips that revision. | Parent retains the pending append descriptor; resolve the original ID/hash before restore, another revision or a new worker. Continued uncertainty blocks. | S10; delayed visibility and permanently unresolved variants |
| DA05 / P1 | Two retry copies of a checkpoint for one revision have different, individually valid self-hashes. “Latest valid checkpoint” can select different mission state. | Deterministic checkpoint identity; identical copies deduplicate, conflicting content blocks; reject future watermark/bad boundary snapshots. | S08, S09 |
| DA06 / P1 | Claim is durable, child pauses before HTTP, Cancel arrives, then the child sends. Alternatively it dies before sending and lookup returns absent. The old text leaves retry/final cancellation ambiguous. | Earlier claim authorizes the original attempt; Cancel prevents later claims. After runner exit, cancellation/pause recovery is lookup-only. Absence remains unknown/blocked; explicit pause Resume is separate. | R09, R10 plus existing R07 |
| DA07 / P2 | Same displayed arguments and plan revision are reused with another action key or slot. A hash of arguments alone may accept the wrong commitment. | Bind approval to mission/owner/plan revision/key/slot/operation/resource/arguments and validate it at claim. Keep receipt recovery independent of later expiry. | U06 plus existing U04 |
| DA08 / P2 | Six short independent trips demonstrate crashes but never accumulate enough observations or show an eviction influencing a later call. | Add frozen same-mission M1 trace, input manifests, explicit context pressure, pin retention and bounded recall. Label elapsed time and per-mission scope honestly. | C06; actual prompt item sets/counts and trace completeness |
| DA09 / P2 | “Competent checkpoint baseline” allows summarizer/retention choices to change after seeing which comparison DR wins. Results are not reproducible. | Freeze `checkpoint-summary-v1`, cadence, prompt, thresholds and full cost accounting before measured runs. Same safety mechanisms and fixture/model/tool limits. | B01; policy/fixture/code hashes and all runs included |
| DA10 / P2 | Liquid emits a reason or status already supplied by structured data, while rules perform every actual context edit. The sponsor call is decorative. | Require a positive live local-model edit to change the next prompt's item set, with proposal/acceptance/input hashes; fallback or rejection-only paths do not satisfy it. | C07; positive live evidence plus bad-output rejection tests |

The corrections live in [contracts](CONTRACTS.md), [phase tasks](IMPLEMENTATION_PLAN.md), [acceptance and demo rules](VALIDATION_AND_DEMO.md), and [root instructions](../../AGENTS.md). This report explains why; those documents govern implementation.

## Source evidence and reuse checks

- [OpenBot Vite configuration](../../reference/openbot/app/vite.config.ts): the shared `serving` object specifies wildcard `host: "::"`; it is reused for dev/preview. The comment about reaching both loopbacks does not turn a wildcard listener into loopback-only binding.
- [OpenBot server entry](../../reference/openbot/server/src/index.ts): `serve<SocketData>({ port, ... })` lacks a hostname; the final log prints a localhost URL without enforcing that bind. This is the strongest directly source-confirmed integration correction.
- [OpenBot signed-run verifier](../../reference/openbot/server/src/agents/callback-token.ts): `readRunAssertion(signed, encryptionKey, now?)` returns verified identity or `null`. The plan correctly keeps the signing key inside OpenBot and proposes a separately service-authenticated verification route. The new route still has to be built.
- [OpenBot remote forwarding](../../reference/openbot/server/src/copilot.ts), [tenant loader](../../reference/openbot/server/src/tenant-package.ts), and [gallery registry](../../reference/openbot/app/src/lib/copilot/gallery-registry.ts): the planned remote agent, signed assertion forwarding and compiled gallery adoption remain consistent with the pinned interfaces. Source presence does not prove configured transport works.
- [OpenMuse worker](../../reference/openmuse/apps/server/src/engine/worker.ts): `TaskContext.signal`, `guard()`, `checkpoint(Partial<AgentTask>)` and `event(...)` are useful extraction patterns. The full worker's SQL lease/CAS behavior is not proof that RawTree can offer those same operations.
- [OpenMuse action handling](../../reference/openmuse/apps/server/src/actions.ts): exact operation/owner/hash/expiry checks support the approval adaptation. DR must bind its own action identity and slot explicitly.
- [RawTree brief](../briefs/rawtree-tinybird.md) and [OpenAPI snapshot](../sponsors/rawtree-openapi.json): the plan has insert/query surfaces, but no documented transaction, uniqueness or CAS primitive that removes the need for single-writer deduplication/conflict handling.
- The [research recommendation](../research/RECOMMENDED_PROJECT_2026-09-25.md) and [adoption design](../integration/DEAD_RECKONING_BUILD_PLAN.md) support the combined persist/revalidate/discard thesis. Historical `FINAL_PROJECT.md`/`WIN_PLAN.md` claims do not override the corrected implementation specification.

All reference evidence is tied to OpenBot `3c73cf00efba46122dfd0447485e2b61f1d6a2cd` and OpenMuse `f5534c77a8c8740cf792ca73b1f7737829fb7518`. No claim is made that this is a review of a later upstream version.

## Deliberately retained limits

1. **Worker crash, not total-system recovery.** Parent, desk and storage survive the demo kill. Parent-loss takeover, distributed fencing and machine-loss recovery remain outside MVP; the plan blocks rather than claiming them.
2. **Uncertain cancellation may stay unresolved.** Once a request was authorized, a missing receipt/lookup absence is not proof it can never arrive. The chosen conservative policy can show a blocked reconciliation. Adding a desk-side cancellation tombstone protocol is a future design, not silently implied now.
3. **Simulated effects and world edits.** The bookings/closure are fixtures. Process termination, storage and any claimed live provider calls must be real. No payment or booking-site integration is implied.
4. **A short trace is not days-long evidence.** M1 proves repeated behavior within one bounded mission. It does not establish unlimited context, continuous multi-mission memory or long-duration reliability.
5. **Sponsor use and winning potential are unproven.** Positive causal use of each service can be shown. No service is claimed irreplaceable, no benchmark advantage is assumed, and no judge outcome is guaranteed.
6. **Build time depends on gates.** Two to three days remains a planning estimate. The 5.5-hour event cut assumes working accounts and early progress; a missed gate requires honest scope reduction. Polished UI cannot substitute for missing recovery/context proof.

## Before implementation can claim readiness

Complete the Phase 0 probes and record their actual results: RawTree acknowledgement/visibility, Nimble live fixture retrieval, Liquid constrained output, selected Responses model and OpenBot/Intelligence startup. Then implement the corrected contracts and run the acceptance cases above alongside the original ones. The strongest demo is the trace-backed causal story: an effect survives, an outdated fact is replaced, an unnecessary observation leaves the next prompt, and required constraints remain.

This audit found no reason to abandon the project. It also provides no basis for saying the application, runtime integrations or hackathon submission are already ready.
