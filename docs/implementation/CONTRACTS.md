# Dead Reckoning implementation contracts

Status: proposed interfaces for implementation, 25 September 2026. No endpoint or type below should be assumed to exist until its implementation phase passes. Read [the execution plan](IMPLEMENTATION_PLAN.md) and [root agent instructions](../../AGENTS.md) first.

## 1. Runtime topology and ownership

Use Bun 1.3.14 and TypeScript for the new services. Keep the exported OpenBot application in its own workspace and lockfile. Do not start the OpenMuse application as a second service; selectively adapt its framework-neutral task and approval patterns.

The addresses below are required bindings, not merely URLs to print. The pinned OpenBot Vite configuration uses wildcard `host: "::"`, and its Bun server supplies no explicit `hostname`. In the exported copy, set Vite's shared dev/preview host and Bun's `serve` hostname to `127.0.0.1`; align the Vite API proxy target with that address. Verify actual listening sockets. Single-user mode treats reachable visitors as administrators, so opening a localhost URL does not establish isolation. Keep the reference clone unchanged.

| Process | Proposed address | Responsibility | Survives demo kill? |
|---|---|---|---|
| OpenBot Vite app | `127.0.0.1:3010` | Console, chat, mission board | Yes |
| OpenBot API | `127.0.0.1:3001` | Existing authentication/runtime; authenticated DR proxy | Yes |
| DR control API | `127.0.0.1:4400` | Per-mission command serialization, RawTree writer, child ownership, snapshots | Yes |
| DR runner child | No public listener | Planner, sensing, curation, guarded desk calls | **No** |
| Simulated desk | `127.0.0.1:4401` | Authoritative fixture world, idempotent effects, request ledger | Yes |
| Liquid llama-server | `127.0.0.1:8080` | Local structured proposals | Yes |

Refinement of the adoption plan: **one control-process mission actor serializes every canonical write**, including worker transitions and user commands. The child submits typed transitions through this actor rather than racing direct RawTree writes against approvals/cancel requests. The actor is an implementation abstraction, not a new distributed actor framework. Its in-memory projection is disposable. Resume explicitly invalidates the cache and queries RawTree before a new worker plans.

Use a parent-owned IPC channel for child transition/dispatch/recall requests, with schema validation, bounded messages and the generation bound to the actual child handle. Do not reuse the OpenBot service token as child identity. Explicitly allowlist child environment variables when spawning: required model/Nimble settings and the limited desk credential, plus mission/generation metadata. Do not inherit RawTree, Intelligence, OpenBot encryption, internal verification or operator credentials into the runner.

RawTree owns mission/evidence state; the desk owns committed effects; OpenBot PostgreSQL owns identity and existing operational metadata; Intelligence owns conversation history. No mission fact is restored from a chat transcript, SSE replay, browser storage, or an OpenBot task cache.

MVP failure scope is death of a single runner while the parent, desk, and storage remain available. Automatic recovery of an existing mission after parent/control loss is explicitly deferred. A fresh parent without that mission's ownership/watermark metadata returns `CONTROL_RECOVERY_REQUIRED` and does not resume it. For a new demo, stop any old owned processes and create a fresh isolated namespace. Multi-host fencing, durable parent ownership recovery, total-machine-loss recovery and distributed exactly-once execution require a separate design and tests.

## 2. Identity, time, versions, and money

- `missionId`, `commandId`, `eventId`, `evidenceId`, and `approvalId`: generated stable opaque identifiers. Fixtures may use explicit deterministic IDs; production inputs must pass a strict schema.
- `batchId` and `arm`: required benchmark namespace. `arm` is `dr`, `checkpoint`, or explicitly labeled `transcript-ablation`.
- `revision`: strictly increasing integer per mission, assigned by the sole writer. It is the order of canonical state changes, not wall-clock time.
- `planRevision`: increments only when the plan or its approval-relevant dependencies change. A worker heartbeat must not invalidate a review.
- `epoch`: new runner generation; diagnostic process metadata is separate from business identity.
- `actionKey`: stable business-intent identity, e.g. `batch/arm/mission/ferry/reservation-1`. Never generate it from a retry number, current timestamp, PID, or epoch. URL-encode it when placing it in a path.
- `argsHash`: SHA-256 over a versioned fixed-field canonical JSON serialization of all effect-relevant arguments, including namespace, slot/resource, dates, party size and expected world version. Both actor and desk compute it from validated arguments; neither trusts a caller's supplied hash. Specify UTF-8, sorted field names, integer-only numeric fields and omitted-versus-null behavior in domain tests. Store canonical arguments alongside the hash. Action identity is bound separately; a hash of arguments alone is not approval for another key.
- `observedAt`, `writtenAt`: real UTC timestamps. `effectiveFrom`/`effectiveUntil` describe what an assertion applies to. `worldTime` is the explicitly simulated scenario time. Keep these clock domains distinct.
- Money: integer minor units plus currency. No floating-point budget arithmetic. Compare current committed spend plus the proposed remaining plan against the constraint; record refunds separately.

## 3. Canonical record definitions

Implement Zod schemas first and derive TypeScript types. Reject unknown enum values and invalid state transitions at every API boundary. Illustrative field sets below are the required domain contract, not a claim about an existing SDK.

| Record | Required fields and rules |
|---|---|
| `Mission` | ID, owner ID, batch/arm, schema version, revision, plan revision, status, goal, current epoch, timestamps; references to constraints/plan/current facts/commitments/context manifest |
| `Constraint` | ID, kind, typed value, origin command, revision, active flag; kinds include accessible accommodation, budget, currency, party size, travel interval; model cannot weaken/delete it |
| `Evidence` | ID, source URL, source class `official_web`/`simulated_operator`/`desk`, retrieval mode `live`/`cache`/`fixture`/`replay`, content hash, observed time, excerpt, raw-content reference, provider request/task ID where supplied |
| `Fact` | Stable fact key, version, typed value, evidence ID, subject/scope, observed/effective times, epoch, volatile flag, freshness deadline, status `current`/`stale`/`superseded`/`conflict`, supersedes reference |
| `PlanStep` | ID, kind, candidate/resource, status, required constraint IDs, dependencies `{factKey,factVersion}`, optional commitment key, explanation; invalidation tracks versions rather than key alone |
| `Commitment` | Action key, logical itinerary slot, kind `book`/`cancel`, canonical arguments and hash, status, intent event/revision, approval binding if any, receipt ID, optional compensation key |
| `Receipt` | Immutable desk receipt ID, action key, args hash, outcome, amount/currency, desk committed time, resource, provenance, recovered flag; model cannot create or edit one |
| `Approval` | ID, mission/owner, plan revision, action key, slot, operation kind/resource, canonical argument hash, displayed action and binding hash, expiration, decision and actor, decision command ID; acceptance is a durable state transition |
| `ContextItem` | ID, record references/versions, class, pin reason, rendered representation, token count method, last-used marker, retrieval cost if measured |
| `ContextOperation` | Operation ID, proposal source/model, expected revision, typed operation, referenced items, rationale, accepted/rejected decision, validator reason; rejected proposals are evidence too |
| `Checkpoint` | Deterministic ID from mission/revision/schema version, complete projection JSON, canonical content hash, last included event ID/hash; identical retries deduplicate and conflicting content for the same mission/revision blocks restore |
| `Metric` | Batch/arm/mission/epoch/call ID, phase, elapsed time, provider token usage if present, tokenizer estimate if used, model/quantization/config, outcome/error, fixture/retrieval mode |

Separate `mission.status` from transport and worker status. Proposed lifecycle:

`created → queued → restoring → reconciling → revalidating → planning → executing → curating → planning`, with branches to `waiting_approval`, `pausing`, `paused`, `cancelling`, `cancelled`, `valid`, `blocked`, and `failed`.

`blocked` means a known unmet precondition and requires a structured reason. `failed` means a terminal implementation/service error after allowed recovery, not that the model disliked an itinerary. Resume from `paused` or a recoverable `blocked` state starts with restore/reconcile, not with the next remembered line of code. Worker death is observed by the parent; it is not equivalent to cancellation or business-action failure.

Create starts in `created` with no child or automatic effect, so the operator can arm a crash before first execution. The existing Resume route also admits this initial start. Later it accepts a paused/pausing or recoverably blocked mission, or a nonterminal mission whose owned child is confirmed exited. It rejects an active child, `cancelling`, `cancelled` or completed `valid` mission; a terminal `failed` run needs a new explicitly isolated mission unless a recovery path is separately defined. This lifecycle rule does not bypass pending-append resolution or reconciliation.

Commitment outcomes: `intent`, `unknown`, `confirmed`, `not_executed`, `rejected`, `compensation_pending`, `compensated`. Only a definitive desk response proves rejection/non-execution. A timeout or HTTP 500 leaves uncertainty. Evidence of a committed effect must still be recorded if a cancellation arrived while the request was in flight.

Enforce one unresolved/active commitment per `(missionId, slotId)`, including intents, unknown outcomes and confirmed reservations. A second key must not bypass this rule. A definitively rejected/non-executed intent can be replaced by an explicitly linked new business intent after refreshed preconditions; a confirmed one requires compensation or a visible block. This prevents the planner from avoiding idempotency by simply inventing a new key.

An approval's binding hash covers mission, owner, plan revision, action key, slot, operation kind/resource and `argsHash`. At the dispatch claim, require the accepted, unexpired approval for that exact binding; accepting a review is not a reusable grant for another key or slot. Once dispatch is claimed, expiry does not erase an effect or prevent receipt reconciliation. For the MVP's simulated desk, mission creation explicitly records authorization for automatic fixture bookings within the fixed constraints. Per-action review is an optional mode, implemented and tested if exposed; no real purchases are authorized by the demo policy.

## 4. Ordered events and RawTree projection

Minimal storage tables, with distinct authority:

- `mission_events`: canonical ordered typed transitions and command deduplication.
- `mission_checkpoints`: validated complete projections of canonical events for bounded restore.
- `evidence`: immutable source material/provenance referenced by canonical events, outside model context.
- `context_ops`: derived projection of accepted/rejected `CONTEXT_EDIT_DECIDED` events for inspection; never a second write authority.
- `metrics`: per-call and per-run measurements, not mission-state authority.

Additional analytical fact/receipt views are optional projections, not separate authorities. A canonical event contains enough data to reproduce its state transition even if an analytical mirror write fails. Avoid a transaction assumption across tables.

Event envelope:

```ts
type MissionEvent = {
  schemaVersion: 1;
  eventId: string;
  missionId: string;
  batchId: string;
  arm: "dr" | "checkpoint" | "transcript-ablation";
  revision: number;
  previousRevision: number;
  commandId?: string;
  epoch: number;
  writtenAt: string;
  type: string; // implement as a discriminated union, not an arbitrary string
  payload: unknown; // validate a specific payload schema for each event type
  payloadHash: string;
};
```

Event types initially include `MISSION_CREATED`, `COMMAND_ACCEPTED`, `RUNNER_STARTED`, `CONSTRAINT_SET`, `EVIDENCE_OBSERVED`, `FACT_REPLACED`, `FACT_MARKED_STALE`, `PLAN_PROPOSED`, `PLAN_ACCEPTED`, `APPROVAL_REQUESTED`, `APPROVAL_DECIDED`, `INTENT_RECORDED`, `DISPATCH_CLAIMED`, `OUTCOME_RECORDED`, `CONTEXT_EDIT_DECIDED`, `MISSION_PAUSED`, `MISSION_BLOCKED`, `MISSION_VALIDATED`, and `MISSION_CANCELLED`. A final implementation may combine an accepted command and its transition into one event to preserve one-record atomicity; do not write an accepted command that requires an unrecorded second transition to become meaningful.

Writer algorithm:

1. Serialize command handling for a mission. Validate owner, command ID, expected revision, and reducer preconditions.
2. Reuse an existing event/outcome for a repeated command with identical arguments; reject conflicting reuse.
3. Assign next revision; construct and validate one event. Retain a pending-append descriptor containing event ID, revision, canonical payload/hash and command result mapping in the surviving parent before sending the insert. This is retry/ownership metadata, not a separate recoverable fact store. Write through acknowledged HTTP insertion.
4. Inspect returned row count and errors. Verify the event is query-visible with the expected hash. An ambiguous timeout is resolved by event ID; it does not justify allocating another revision.
5. Advance the acknowledged watermark, clear the pending descriptor and apply the event to the disposable projection. Publish a revision hint. Checkpoint after each effect outcome and major recovery phase in the MVP.
6. If an insert may have succeeded but cannot be observed, suspend that mission's writes and effects until resolved. Retrying the same event ID may create physical duplicates; projection deduplicates identical events and rejects conflicting hashes.

Before Resume restores anything, resolve a parent-retained pending append by its exact event ID/revision/hash. It may lie above the last acknowledged watermark. An identical visible event advances the watermark; an uncertain event may only be retried with the same identity and payload. Conflict or continued invisibility blocks new revisions, worker planning and effects. Clearing the projection cache must not clear pending append metadata. Do not reload to an earlier watermark and then reuse the pending revision. Parent loss still follows the explicitly deferred recovery policy.

Restore algorithm: choose the latest complete valid checkpoint **at or below** the resolved acknowledged watermark, then read ordered canonical events after its revision through that watermark. Deduplicate checkpoint retries with the same mission/revision/content hash; conflicting snapshots at the same revision are corruption, not an invitation to choose one. Validate the snapshot's schema/hash, mission/revision and last included event ID/hash against its canonical event boundary. A missing checkpoint can fall back to an earlier valid snapshot or full event replay; a detected conflict blocks instead of silently falling back. Deduplicate events by event ID; require contiguous revisions, one logical event per revision and `previousRevision` agreement. Block on gaps, conflicting duplicates or unsupported schema. Bounded queries must paginate until the requested range is complete; `LIMIT` must not silently truncate a restore.

Evidence publication also needs an explicit boundary: include the bounded evidence excerpt, hash and provenance required by a transition in its canonical event. If that event promises recall of larger raw content, persist and verify that immutable content before publishing its reference; a failed canonical append may leave an unreferenced evidence row, which is safe. `context_ops` and analytical mirrors are derived from canonical events. Their write failure cannot hide an accepted context edit or make an unpublished proposal authoritative. No cross-table transaction is assumed.

For the worker-crash demo, the surviving control process retains the acknowledged watermark as operational metadata and forces a RawTree reload against it. The checkpoint and events contain the actual mission state. General control-plane-loss behavior needs a separate durability/consistency design; do not claim that a startup visibility smoke test proves all consistency properties of an analytical database.

RawTree calls from the documented HTTP surface:

```text
POST https://api.rawtree.com/v1/tables/mission_events?database=deadreckoning
Authorization: Bearer <backend key>
Content-Type: application/json
Body: [validatedEvent]
Expected critical acknowledgement: {"inserted":1}

POST https://api.rawtree.com/v1/query?database=deadreckoning
Body: {"sql":"<bounded validated SELECT>","format":"JSON"}
```

Parse the documented `data`, `rows`, and error fields. Implement SQL only in a narrow adapter using validated IDs, fixed table names and tested escaping. Never accept raw SQL from the planner or browser. Do not invent SQL bind parameters for this API. See [RawTree brief](../briefs/rawtree-tinybird.md) and [OpenAPI snapshot](../sponsors/rawtree-openapi.json).

## 5. Public/control API contracts

All mutation bodies carry `commandId`; mutations of an existing plan/state carry the relevant `expectedRevision` or `expectedPlanRevision`. Authenticate at OpenBot and authorize again in DR. Identity comes from a trusted server boundary, not a caller-supplied `ownerId` in arbitrary JSON.

| Route | Request essentials | Response/behavior |
|---|---|---|
| `POST /missions` | goal, typed constraints, command ID, optional fixture/batch namespace | `201` in `created` with mission ID/revision and no child; duplicate command returns existing result |
| `GET /missions/:id` | authorized mission ID | `200` canonical snapshot with revision, updated time, state and service availability; no invented success on query failure |
| `POST /missions/:id/resume` | command ID, expected revision | `202` after durable command; one child only; refuses while previous child still active |
| `POST /missions/:id/pause` | command ID, expected revision | `202` while `pausing`; stops new dispatch claims, waits for in-flight effect reconciliation before stable pause |
| `POST /missions/:id/cancel` | command ID, expected revision | `202` while `cancelling`; no promise to reverse already-dispatched effects |
| `POST /missions/:id/approvals/:approvalId` | decision, displayed binding hash, expected plan revision, command ID | Durable accepted/rejected/expired decision for the exact commitment; stale revision/binding `409`; repeated identical decision is idempotent |
| `GET /missions/:id/evidence/:evidenceId` | bounded excerpt request | Original provenance/mode and bounded text; no arbitrary URL fetch |
| `GET /missions/:id/events` | optional last known revision | SSE revision hints; snapshot refetch handles reconnect or missing hints |
| `POST /ag-ui` | Valid `RunAgentInput` through authorized OpenBot transport | Standard AG-UI run lifecycle; accepted mission ID or explanation; short-lived observation, durable work separate |
| OpenBot `POST /api/dead-reckoning/internal/verify-run` | DR service credential plus opaque signed assertion, input run/thread IDs | **New internal route**; verifies the existing OpenBot signature and returns authorized actor/Bot/run identity; no browser-session assumption |
| `POST /demo/:id/arm-crash` | operator command, named crash point | Arms a test hook for the registered mission worker; no arbitrary PID or command execution |

Error envelope: `{code, message, retryable, missionId?, currentRevision?, details?}`. Use stable codes such as `REVISION_CONFLICT`, `STORAGE_UNAVAILABLE`, `OUTCOME_UNKNOWN`, `SOURCE_UNVERIFIED`, `CONTEXT_CAPACITY`, `APPROVAL_EXPIRED`, `WORKER_ACTIVE`, and `INVALID_TRANSITION`. Use `400/401/403/404/409/422/503` consistently; do not turn an unavailable lookup into `404`.

For the remote AG-UI path, OpenBot supplies the opaque signed assertion in `forwardedProps.openbotRun`; it does not forward a normal browser session. DR calls the new internal verify route using its server-to-server credential. The route runs the pinned OpenBot `readRunAssertion(signed, config.keyEncryptionKey)` helper inside the OpenBot server, checks expiry, expected DR Bot identity, matching run/thread IDs, and current actor/Bot access. It returns verified identity over the authenticated loopback service boundary; DR then checks mission ownership and command deduplication. Never share OpenBot's signing/encryption key with the runner, trust unsigned `openbotBotId`/`actorId`, or send assertions into model context/logs. Keep the verification route separate from browser-cookie `requireUser` routes and authenticate it with the configured internal service token.

The assertion authorizes admission of a particular command; long-running mission execution uses its durable authorization plus current worker ownership, not a ten-minute chat assertion held forever. Later user commands require fresh authentication. If assertion verification is unavailable, reject chat-origin mission reads/mutations; the ordinary authenticated browser proxy can still serve authorized UI commands. Source: [callback-token.ts](../../reference/openbot/server/src/agents/callback-token.ts) and [remote forwarding](../../reference/openbot/server/src/copilot.ts). No new API may silently fall back to trusting request-body identity.

If RawTree is unavailable, the API may report a transient availability error alongside a labeled last-known snapshot. It cannot claim that a new `MISSION_BLOCKED` event was durably written when the store rejected that write. Separate operational availability from canonical mission status in the response.

Suggested frontend route is `app/src/routes/_authed/_app/missions/$missionId.tsx`, following the pinned app's actual `_app` layout. This refines the earlier adoption document's generic `routes/_authed/missions/` placeholder. Let the existing route generator maintain its generated tree.

## 6. Desk contract and effect boundary

Desk SQLite tables: `world_versions`, `resources`, `action_outcomes`, and `book_requests`. Persist request attempts separately from committed effects. Partition all scenario data by batch/arm/mission. Demo reset creates a new namespace; it does not erase another run's proof.

`POST /book` body:

```json
{
  "actionKey": "batch/dr/mission/ferry/reservation-1",
  "batchId": "batch",
  "missionId": "mission",
  "arm": "dr",
  "argsHash": "canonical-arguments-hash",
  "resourceId": "ferry-outbound",
  "slotId": "outbound-travel",
  "startDate": "2026-10-02",
  "endDate": "2026-10-02",
  "partySize": 2,
  "expectedWorldVersion": 1
}
```

Dates and names above are synthetic fixtures; the hash placeholder is replaced by the domain serializer's actual SHA-256 in executable requests. Control checks explicit `batchId`/`arm`/`missionId` against the recorded intent; the desk validates them against its registered fixture namespace and binds them to the key. Do not infer namespace by splitting an opaque key or give the desk RawTree credentials to perform this check. The desk derives prices and currency from trusted resources rather than caller-provided amounts.

The desk recomputes the canonical hash and rejects a supplied mismatch. Inside the SQLite transaction, first record the attempt and look up the existing key in its namespace. Different bound arguments give `409`; an identical existing terminal outcome returns the original result with `dedupeHit:true`, **before any current-world check**. This applies to saved rejections as well as receipts: a rejected old key does not become a new action because the world reopened. Only a genuinely new key proceeds to current resource/version checks and outcome insertion. A stale-world precondition records a definitive rejection with `committed:false`; refresh before proposing a linked new business intent. Expected business rejections commit their request/outcome record rather than throwing an exception that rolls back the attempt ledger. A storage failure is unavailable, not a recorded rejection. Never rely on a stale agent-side availability check alone.

`GET /actions/:key` returns `200` with the authoritative committed/rejected outcome, `404` only when authoritative lookup succeeded and no outcome exists, or `503` when the desk cannot establish the answer. If a prior request may still be in flight, an absent lookup does not prove it will never commit; a retry still uses the same key so the unique constraint settles that race.

Effect sequence: validate → record and observe intent → actor-serialized dispatch claim → desk request → optional post-commit SIGKILL hook → record outcome → checkpoint. `claimDispatch` is a new internal domain command: under the same queue as cancellation, it validates current generation/status/preconditions, appends and observes `DISPATCH_CLAIMED {dispatchId,actionKey,argsHash,epoch}`, and returns permission for this action. The effect is considered in flight at that durable claim, even if the HTTP request has not yet left the child. If Cancel wins the queue order, claim is refused and no POST occurs. If claim wins, Cancel enters `cancelling` and waits for the already-authorized outcome/reconciliation; it does not promise to prevent that POST. This defines the race without pretending a local guard is atomic with a remote service.

The worker must have a successful claim before dispatch. A claimed action that never reaches the desk is still reconciled by its stable business key after confirmed worker exit; do not allocate a new business key. On timeout, reconcile before another effect request. Confirmed outcomes are never automatically resent. An incomplete outcome may be resent with the same key only after the recovery policy permits it. Late receipts are admitted as evidence against the claimed key/hash even when the current plan revision or cancellation state has changed.

Cancellation/pause policy is deliberately precise:

| Order / observed outcome | Allowed continuation |
|---|---|
| Pause/Cancel admitted before claim | No claim and no corresponding POST |
| Claim admitted first; original runner still owns the attempt | That authorized attempt may begin or settle even after Pause/Cancel; no later claims are allowed |
| Original runner exits while pausing/cancelling | Reconciliation is lookup-only; do not resend the booking request |
| Lookup returns a recorded confirmed/rejected outcome | Record it, retain any receipt/spend, and finish pause/cancel only once every claimed action is resolved |
| Lookup returns `404`, times out or is unavailable | Preserve unknown outcome; bounded polling then expose `reconciliationStatus: blocked` with reason while mission remains `pausing`/`cancelling`; no false `not_executed`, no automatic retry or terminal cancellation |
| Explicit Resume from pausing/paused | Restore/reconcile first; active retry policy may resend the original key/arguments only after authoritative lookup and validated current preconditions |
| Resume requested while cancelling/cancelled | Reject; it must not silently revoke cancellation or start a new booking |

`reconciliationStatus` is an orthogonal operational field, not a replacement mission success state. A cancel can remain unresolved when the desk cannot prove the outcome; this is an explicit MVP limitation. Do not add a speculative new-key retry to make the UI finish.

The primary hook self-terminates the registered child after a successful desk response and before submitting `OUTCOME_RECORDED`. The parent observes actual exit signal/PID. A second failure-injection test can drop the response after desk commit; it proves recovery when the worker never received the receipt at all.

## 7. Sponsor/model adapters

| Adapter | Allowed operation | Contract |
|---|---|---|
| Nimble | `POST /v2/extract` at `https://sdk.nimbleway.com` | Known allowlisted source URL; explicit extraction options; preserve `task_id`, source URL, driver/timing metadata and result status |
| Nimble diagnostics | `GET /v2/domain-knowledge/driver`, `POST /v1/domain-health/check` | Optional driver and health evidence; preserve the v1 exception; health does not mean business availability |
| Liquid | `POST http://127.0.0.1:8080/v1/chat/completions` | Local LFM2.5-1.2B-Instruct; schema-constrained proposal; bounded input and output; backend validates again |
| Planner | OpenAI `POST /v1/responses` | Explicit selected model, `store:false`, bounded state input; both benchmark arms same model/config |
| Intelligence | OpenBot SDK/runtime integration | API URL, WebSocket URL and project key; mission state independent of thread storage |

Liquid proposal operations are a discriminated allowlist: `keep_context_item`, `evict_context_item`, `replace_fact_value`, `summarize_completed_step`, and `request_recall`. Each refers to existing IDs/versions and contains an explanation. No arbitrary JSON Patch path, SQL, receipt creation, key change, user-constraint deletion, or terminal-success flag. A fact replacement must cite new evidence of the same subject/scope and a valid effective interval. Reject a patch contradicting structured source status; rejection does not refresh the old fact.

Start the planner with one structured decision per iteration: select a validated candidate/step, request a bounded evidence refresh/recall, propose a plan adjustment, or block with a reason. The worker dispatches only after validation. Add a model tool loop only when needed. If continuing a Responses tool loop, preserve required output/reasoning items and matching `call_id` results within that bounded decision episode; do not drop a pending tool result during compaction. Finish the episode before replacing it with a canonical state summary. `store:false` by itself does not prevent growing input.

The 6,000-token planner-input target includes instructions, schemas, evidence, current state, and any in-episode items. The curator has a separate input/output budget matching its configured local context window. If exact counting is unavailable, record an estimate with its method; do not label it provider usage. Pin overflow is `CONTEXT_CAPACITY`, never silent eviction of a constraint.

## 8. Configuration contract

Existing OpenBot variables retain upstream semantics:

```dotenv
DATABASE_URL=postgres://...
KEY_ENCRYPTION_KEY=
INTELLIGENCE_API_URL=https://api.intelligence.copilotkit.ai
INTELLIGENCE_GATEWAY_WS_URL=wss://realtime.intelligence.copilotkit.ai
INTELLIGENCE_API_KEY=
TENANT_PACKAGE_DIR=../examples/dead-reckoning
DEAD_RECKONING_AG_UI_URL=http://127.0.0.1:4400/ag-ui
AGENT_ENDPOINT_ALLOWED_HOSTS=127.0.0.1:4400
OPENBOT_GENERATIVE_UI=false
# New setting for our OpenBot extension; same value in DR control, never in the runner:
DR_INTERNAL_TOKEN=
```

Proposed DR-specific variables to implement in one validated config module:

```dotenv
RAWTREE_API_KEY=
RAWTREE_DATABASE=deadreckoning
NIMBLE_API_KEY=
OPENAI_API_KEY=
DR_PLANNER_MODEL=
DR_LIQUID_BASE_URL=http://127.0.0.1:8080/v1
DR_LIQUID_MODEL=LFM2.5-1.2B-Instruct
DR_WORLD_BASE_URL=http://127.0.0.1:4401
DR_CONTROL_PORT=4400
DR_PLANNER_CONTEXT_BUDGET=6000
DR_ENABLE_DEMO_CONTROLS=false
DR_INTERNAL_TOKEN=
DR_OPERATOR_TOKEN=
DR_WORLD_TOKEN=
```

An empty model must cause an actionable configuration error; no silent model substitution. `DR_*` names are newly proposed, not variables already supported by OpenBot. Configure trusted server-to-server identity/token handling explicitly; bind internal services to loopback in the MVP. Do not copy `x-openbot-agent-token` conventions blindly from the managed Python harness to a custom remote endpoint.

Provision `DR_INTERNAL_TOKEN` in both the DR control API and OpenBot server for their authenticated proxy/verification calls; neither copy reaches the child. Provision `DR_WORLD_TOKEN` in the desk and permitted runner/control clients for booking/lookup access; it does not authorize world edits. `DR_OPERATOR_TOKEN` authorizes demo controls and the world editor. The public fixture feed needs none of these tokens. Generate local secrets during setup and keep only empty placeholders in committed examples.

Four hosted service keys are needed: RawTree, Nimble, OpenAI, Intelligence. Liquid requires local model access and a running server rather than a hosted Liquid key. Managed Intelligence does not require the optional self-host license token. OpenBot single-user mode grants admin access to every visitor; keep it local. Only the read-only fixture feed needs a public tunnel for Nimble; protect or keep local the operator controls.

## 9. Concrete fixture for the first vertical slice

Synthetic two-person trip, 2–4 October 2026, USD 350 budget, accessible accommodation required. Ferry costs 120; campsite A costs 80 and starts open/accessible; campsite B costs 60 but is inaccessible; campsite C costs 90 and is accessible; permit costs 30; gear costs 40. All amounts shown here are fixture dollars and stored as cents in code.

The hook kills after ferry commit. The operator changes A to closed at world version 2 while the child is stopped. Expected repair keeps the one ferry receipt, rejects B for accessibility, selects C if all remaining conditions hold, and stays within 280 total projected dollars. This is an oracle-defined fixture, not a benchmark result. A companion fixture closes C too; the correct terminal result is `blocked` with the accessibility/availability reason.

Keep permits/gear as typed planned steps first; add their simulated effect calls after the ferry/site path is stable. A successful terminal verdict must distinguish an entirely booked itinerary from a valid plan with pending bookings; never display `all booked` for unexecuted steps.
