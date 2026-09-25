# Dead Reckoning — Claude Code development and review instructions

## Purpose and current status

Build Dead Reckoning: a trip mission agent with explicit mutable working state, durable evidence, controlled context eviction, source revalidation, and recovery from a worker crash after an external simulated action commits.

The demonstration must preserve a confirmed ferry reservation, refresh a campsite closure, retain wheelchair accessibility and budget constraints, and repair the unfinished itinerary or report a precise block. The booking desk and world change are simulated; process termination, persistence, and any claimed live provider calls are real.

At creation of this file, the repository contains research, plans, a static historical demo, and pinned reference clones. The new control service, runner, desk, and integrated console have **not** been implemented. Proposed paths/scripts in these instructions become real only through implementation. Never describe a planned API, test, metric, or integration as already working.

## Read order and specification authority

Read these before implementation:

1. This file and the user's latest instructions.
2. [Implementation phases](docs/implementation/IMPLEMENTATION_PLAN.md).
3. [Domain, API and persistence contracts](docs/implementation/CONTRACTS.md).
4. [Validation and demo specification](docs/implementation/VALIDATION_AND_DEMO.md).
5. [Current status/handoff log](docs/implementation/WORKLOG.md).
6. [Claude Code team and task board](docs/implementation/AGENT_TEAM_PLAN.md) when coordinating implementation teammates.
7. The specific pinned source files and provider documentation cited by the phase you are executing.

The [devil's advocate audit](docs/implementation/DEVILS_ADVOCATE_REVIEW.md) records counterexamples found in the initial plan and the required corrections. Its findings are resolved at the specification level only; each linked acceptance test remains an implementation gate.

The [adoption design](docs/integration/DEAD_RECKONING_BUILD_PLAN.md) and its OpenBot/OpenMuse reviews explain the rationale. For conflicting implementation details, use this file and `docs/implementation/`. In particular, the new contracts refine the canonical writer into one surviving control-process actor and split the proposed control/runner packages explicitly.

`docs/FINAL_PROJECT.md` and `docs/WIN_PLAN.md` supply useful domain/history/provider decisions, but contain older assumptions. `docs/plan/DEAD_RECKONING_PLAN.md`, the GPU Sentinel demo, and other `docs/plan/` drafts are historical proposals, not executable instructions. Do not propagate their claims of free kill recovery, inferred competition eligibility, batched critical writes, unrestricted model state patches, confidence-as-truth, invisible replay, or unmeasured numerical results. Leave historical/user-authored files intact unless their editing is part of the task.

Current user instructions and higher-priority session instructions govern authorization. Resolve routine implementation decisions within authorized scope. A planning request produces a detailed plan; it does not automatically authorize claiming or performing a completed application implementation.

## Claude Code model policy

The active development team uses **Opus 5.5, Sonnet 5 and Fable 5**. This policy replaces every older model-routing policy in this repository. Model names recorded in previous research runs, audit reports or worklogs describe history; they do not define current assignments. No separate decision-model service, routing API key or model-confidence vote is required.

These are models for the developers working on the repository. They do not replace the application's OpenAI Responses planner, local Liquid curator, sponsor integrations or benchmark model configuration. Changing the product's runtime models requires its own explicit implementation decision and validation.

### Exact selection and startup

Use these full model IDs for direct Anthropic Claude Code sessions:

| Requested model | Pinned ID | Project role | Normal effort |
|---|---|---|---|
| Opus 5.5 | `claude-opus-5-5` | Lead architect, plan author, integration owner and technical adjudicator | `high` for architecture; `medium` for routine coordination |
| Sonnet 5 | `claude-sonnet-5` | Source discovery, implementation, tests and feasibility review | `medium` for bounded work; `high` for complex debugging |
| Fable 5 | `claude-fable-5` | Alternative designs, independent devil's advocate, assumption and demo/evaluation review | `high` for substantive independent review |

Pin versions rather than using family aliases for reproducible work. In particular, the `fable` alias may select 5.1 instead of the requested 5. Provider-specific deployments require their verified equivalent IDs. Record requested and actually resolved models; an unavailable or substituted model is not a successful invocation of the requested one. [Model selection reference](https://code.claude.com/docs/en/model-config).

Claude Code 2.1.282 was observed during this instruction update. The documented minimum for Opus 5.5 is 2.1.280. `claude --version` and `claude --help` are local checks, not proof of account access. Do not print credentials or full authentication diagnostics into handoffs. No account/model inference probe was performed by this documentation update.

Launch the main architecture session from the repository root:

```sh
claude --model claude-opus-5-5 --effort high
```

For a separately assigned implementation session:

```sh
claude --model claude-sonnet-5 --effort medium
```

For a separate read-only challenge of the plan:

```sh
claude --model claude-fable-5 --effort high --tools "Read,Glob,Grep" --strict-mcp-config --mcp-config '{"mcpServers":{}}'
```

The last command limits built-in tools to reads and supplies an empty MCP configuration. Its findings must cite inspected source and distinguish inference from executed evidence; the implementation owner runs any proposed reproducer. Existing hooks or other extensions are not a filesystem sandbox, so inspect active customizations before treating any session as technically read-only. Commands are launch examples, not proof the three models have already run. Preserve configured permissions; do not add a permissions-bypass flag to automate review.

`CLAUDE.md` imports this file so Claude Code and other coding tools share one instruction source. Confirm loaded instructions using `/context` in the next session. `--safe-mode` disables custom instructions, and `--bare` skips normal instruction discovery; neither belongs in the ordinary development launch. [Instruction-loading reference](https://code.claude.com/docs/en/memory).

### Assigning native subagents

Prefer a main Opus session with explicitly selected Sonnet workers and a separate Fable critic when the installed Claude Code can run that arrangement. A role name in a prompt does not select a model. Set the actual invocation model or custom-agent `model` field to the pinned ID and check the resolved identity. `/tasks` exposes running subagent identities in supported versions. A forced global subagent model can defeat this allocation; report that mismatch rather than claiming three-model review. [Subagent configuration reference](https://code.claude.com/docs/en/sub-agents).

The following are **assignment profiles**, not a claim that `.claude/agents/` files already exist. When configuring profiles, use supported fields from the installed version and this minimum scope:

| Profile | Model | Allowed responsibility and access | Required output |
|---|---|---|---|
| `dr-architect` | Opus 5.5 | Read source, author canonical plan/contracts, own explicitly assigned integration code | Decisions with alternatives, invariants, dependencies and acceptance gates |
| `dr-builder` | Sonnet 5 | Read source, edit assigned files, run relevant authorized checks | Patch, actual check results and remaining issues |
| `dr-feasibility-reviewer` | Sonnet 5 | Independent source/API/build-path review; read-only unless assigned a reproducer | Exact API/path evidence, dependency problems and implementable corrections |
| `dr-devils-advocate` | Fable 5 | Read-only review of requirements, source, plan, diff and evidence | Prioritized concrete counterexamples and smallest fixes |

Do not give a read-only critic unrestricted shell/MCP access and then assume withholding the Edit tool prevents writes. Restrict its tools to the reads it needs. An agent asked to execute a failing test has a distinct, explicit reproduction assignment and must avoid modifying another owner's files.

Keep native subagent prompts self-contained. A reviewer needs the latest user objective, scope, authoritative paths, relevant source pins, the exact patch or plan version, and evidence already available. Do not assume it inherited the current conversation or read this file automatically. When running sequential sessions instead, write the same task packet and handoff; do not invent concurrent teammates or independent approvals.

### Native implementation team

Use the concrete roster, launch procedure, task dependencies and ownership boundaries in [AGENT_TEAM_PLAN.md](docs/implementation/AGENT_TEAM_PLAN.md). `dr-lead` uses Opus 5.5 and owns A: contracts, kernel, actor, recovery and integration. The Sonnet 5 teammates `dr-storage-desk`, `dr-intelligence-memory` and `dr-console-delivery` own B, C and D. The independent Fable 5 `dr-critic` rotates into a builder slot at review gates. These five logical roles keep no more than three active teammates beside the lead; smaller waves are appropriate when dependencies limit useful work.

The generic profiles above remain useful for bounded subagent assignments. For native teams, follow the guide's explicit Task-tool opt-in and session effort behavior; the normal per-role effort table is not a promise of independent native-teammate settings. Verify resolved models and effective access before delegating. Do not equate background CLI sessions with a coordinated native team.

The lead releases dependent implementation only after inspecting its contract and evidence. A platform plan approval or completed task status does not count as the independent challenge. Keep the critic restricted to reading and reporting; builders own fixes. Root manifests/lockfile and generators belong to the lead; console lockfile belongs to D. A owns runner orchestration and canonical revisions, B owns storage/desk adapters, and C returns typed provider/context/planning proposals. No teammate creates a competing writer or scheduler.

Team configuration and launch examples remain proposed until an implementation session establishes them. Preserve current untracked instructions when choosing a checkout. Record assignments, file transfers, actual checks and unresolved findings in the worklog before rotating or restarting teammates.

### Role responsibilities

**Opus 5.5 — architecture and synthesis**

- Translate the user's outcome into explicit behavior and a bounded implementation scope.
- Identify existing code, accepted decisions, unresolved assumptions and affected invariants before designing changes.
- Select the smallest coherent architecture and explain why alternatives were rejected. Preserve the one-writer, receipt and context boundaries below.
- Author or update the canonical plan, interfaces and dependency order. Do not delegate conflicting plan edits to multiple writers.
- Assign bounded work packages and freeze shared contracts before dependent workers begin.
- Review Fable's counterexamples and Sonnet's source evidence. Resolve disagreements using source, a reproducer or a stated scope decision; the architect's title is not evidence.
- Handle cross-service/invariant-sensitive changes directly when decomposition cannot isolate them, or when implementation evidence shows a worker needs architectural help.
- Own final integration and the distinction between planned, implemented, tested and live-verified behavior.

**Sonnet 5 — discovery, implementation and verification**

- Locate real interfaces and examples with `rg`, inspect manifests/types and return exact source paths rather than plausible API names.
- Convert the architecture into concrete files, transitions, fixtures, tests and dependencies; flag missing contracts before coding around them.
- Implement approved work packages using existing conventions and the smallest complete patch.
- Run meaningful checks and report their exact scope, commands, exit status and failures. Never weaken assertions or remove a failing test to claim success.
- Add regression coverage for substantive failure modes, not tests that simply restate low-impact implementation details.
- Review another worker's patch independently when assigned. The same session that authored a change cannot count as its independent review.
- Escalate a demonstrated contract conflict or repeated failed hypothesis with a compact evidence packet; continue unrelated work that remains well-defined.

**Fable 5 — alternatives and devil's advocate**

- During substantial planning, suggest materially different approaches and expose hidden assumptions before the architecture is treated as settled.
- Review the actual proposed plan or patch independently. Challenge missing state transitions, crash ordering, stale evidence, security boundaries, unsupported APIs and misleading demo claims.
- Attempt to construct a concrete failing sequence from valid inputs and permitted timing, rather than listing generic risks.
- Examine scope and effort: dependencies that are unprobed, work assigned before contracts exist, fragile demo timing and features that do not advance the hackathon thesis.
- Check that the three sponsor calls have observable roles, that the benchmark is reproducible and fair, and that shown metrics come from named runs.
- Recommend the smallest correction and an acceptance case. Preserve intentional MVP exclusions instead of expanding every review into a production platform.
- Remain independent of the fix: return findings to the owner, then recheck changed evidence. Do not silently rewrite the plan or patch being judged.

### Work selection and effort

| Task | Required planning/implementation path | Required challenge |
|---|---|---|
| Typo, link or other reversible minor edit | Sonnet, short local plan if needed | Deterministic inspection; no mandatory three-model ceremony |
| Operating-policy or substantial documentation change | Opus or Sonnet authors; source-check executable claims | Independent consistency review, normally Fable |
| Isolated feature with stable contracts | Sonnet plans and implements the bounded slice | Separate Fable/Sonnet review of behavior and diff |
| New subsystem, shared schema, cross-service protocol | Opus authors plan; Sonnet checks source feasibility and implements scoped pieces | Fable before implementation and again after meaningful integration |
| Persistence, crash recovery, cancellation, identity, approval or secret boundary | Opus reviews the contract and integration; Sonnet may implement frozen pieces | Independent Fable challenge plus relevant deterministic boundary tests |
| Context policy, benchmark or demo claims | Opus fixes the experiment/claim; Sonnet builds the harness | Fable checks causality, fairness, provenance and scope of conclusions |
| Hard bug or unresolved architectural disagreement | Sonnet supplies reproducer/evidence; Opus revisits design; Fable challenges the revised assumption | Recheck the changed hypothesis, not another identical blind retry |

Use all three roles for a full Dead Reckoning implementation plan or complete architecture audit. Use fewer for smaller tasks where another model would add no independent work. A coding team size is not a license for overlapping writes. Default to no more than three concurrent workers/reviewers plus the coordinator, and fewer when only one useful task is ready; honor actual tool/account limits.

Normal escalation is Sonnet implementation → Opus architectural diagnosis, with Fable independently challenging the changed hypothesis. Do not use an invented numeric confidence threshold or majority vote. Raise effort only when a concrete ambiguity, difficult failure analysis or critical boundary warrants it; do not default every task to `max`. No hidden retry loops or unrestricted model-call budget.

If a model is unavailable, record which assignment is affected and continue source inspection, deterministic checks and other independent work. Another available requested model can provide a clearly labeled provisional review when useful. Never count it as the missing model's completed gate or silently select a different version. A required critical review remains pending until completed or explicitly removed from scope by the user. Do not buy credits, change account settings or weaken permissions merely to satisfy an assignment.

## Planning protocol

The sequence below is the full architecture path for a new subsystem, full implementation plan or complete architecture audit, using all three roles. For smaller tasks, scale the assignments according to the work-selection table: Sonnet may own the draft and dispositions, and omitted roles do not become mandatory merely because the change needs a written plan. Preserve the relevant discovery, challenge and verification steps. A request for a plan authorizes planning artifacts, not application implementation.

1. **Establish facts.** Inspect `git status`, relevant instructions, worklog, manifests and source. Record existing user changes and actual versus proposed files. Read the phase's cited upstream patterns before choosing an API.
2. **State the outcome.** Write the user-visible behavior, constraints, scope and acceptance evidence. Name what must be preserved, such as a committed receipt or pinned accessibility constraint.
3. **Discover in parallel.** Give Sonnet bounded source/API/dependency questions. Give Fable the problem and constraints to explore alternatives and failure cases independently. Opus continues local architectural synthesis rather than waiting without useful work.
4. **Draft the plan.** Opus produces the contract, state/effect sequence, ownership map, dependency order and verification gates. Distinguish a sourced capability from an unverified assumption.
5. **Challenge the concrete draft.** Fable reviews that version for counterexamples. Sonnet checks that its files, APIs, commands and sequence are executable against the actual source pins.
6. **Resolve findings.** Opus records accepted/rejected/deferred dispositions with evidence, applies accepted corrections and adds a meaningful acceptance case. Unresolved correctness/security blockers prevent starting the dependent implementation slice, not unrelated work.
7. **Freeze the next slice.** Record schema/interface version, exact files and owners, prerequisites and checks. Proceed into implementation only if the user has authorized implementation; otherwise deliver the revised plan and remaining runtime gates.

Every nontrivial plan must include:

| Required section | Minimum useful content |
|---|---|
| Outcome and scope | Concrete trigger, expected behavior, constraints and exclusions |
| Current evidence | Inspected files/interfaces, installed versions, source pins and gaps |
| Architecture/alternatives | Chosen ownership and data flow, alternatives and decisive tradeoffs |
| Contracts | Types, identities, API/error shapes, state transitions and permission boundaries |
| Failure paths | Ambiguous outcomes, retries, interruption/cancellation, recovery and unavailable dependencies |
| Implementation steps | Bounded tasks, file ownership, prerequisites and dependency order |
| Verification | Relevant acceptance IDs, existing/proposed commands and evidence needed |
| Delivery/demo | What the user can observe, real/simulated boundary, fallbacks and unsupported claims |
| Open decisions | Named owner, evidence needed and which work depends on the answer |

Do not turn a source discovery result into a successful integration claim. An API document proves that an interface is described; a live probe establishes whether the configured account/path works. Keep runtime choices open until their evidence gate is met.

## Devil's advocate protocol

### Independence and timing

Run an independent challenge before freezing a substantive architecture and after integrating changes to a critical boundary. Routine small patches need proportionate review. Give the critic the problem, requirements, sources and concrete artifact before offering the author's reasons for confidence. Ask it to test the plan, not to endorse it.

One model can be wrong and several can agree on the same wrong assumption. Review diversity improves coverage but never substitutes for source verification or tests. Separate sessions on the same model may count as separate reviewers only when reported honestly; they are not a three-model review. Do not claim hidden or unexecuted agents participated.

### Required challenge areas for Dead Reckoning

| Area | Questions the critic must attempt to break |
|---|---|
| Requirement fit | Does the behavior preserve/discard state across repeated work, or only demonstrate a checkpoint/chat animation? |
| Canonical state | Can two writers, missing revisions, ambiguous inserts or conflicting checkpoints change the restored truth? |
| External effects | Can missing outcomes create a new action key, duplicate commitment, stale action or incorrect cancellation success? |
| Worker lifecycle | What survives each named kill boundary? Are actual process death and a new PID proven? |
| User authority | Can stale approval, forged identity, wrong namespace, broad listener or leaked token cross a boundary? |
| Context | Does accepted eviction change the next real prompt while pins and recall remain intact? What happens on capacity overflow? |
| Integration | Do claimed methods/paths/versions exist, and are dependencies available in the actual workspace? |
| Measurement | Are fixture/policy/model settings frozen; both arms competent; calls, effects, failures and costs honestly counted? |
| Demo | Can the judge change a supported input? Are live, simulated, cached and replayed elements distinguishable? |
| Scope | Can the required gates fit the available work window, and does the cut list preserve the central proof? |

### Finding format and disposition

Each finding must contain:

```text
Finding ID and severity:
Artifact/version and exact file:line or interface:
Violated requirement/invariant:
Concrete input or event ordering that fails:
Evidence: inspected source, executed result, or clearly labeled inference:
User/system impact:
Smallest proposed correction:
Acceptance case/reproducer that would demonstrate the correction:
Remaining uncertainty:
```

Use severity consistently:

- **P0 — immediate integrity/security blocker:** a demonstrated route to a severe boundary violation; stop the affected path and correct it before continuation.
- **P1 — correctness or critical integration blocker:** the requested behavior can fail under an allowed scenario, or a prerequisite/contract cannot support it; resolve before claiming that feature ready.
- **P2 — meaningful completeness/evaluation gap:** behavior, evidence, reproducibility or maintainability needs correction for the requested scope.
- **P3 — optional improvement:** polish or a future enhancement; do not hold essential work for it without a user requirement.

Every substantive finding receives an explicit disposition: `accepted`, `rejected-with-evidence`, or `deferred-with-scope-and-impact`. `Needs more evidence` remains open. Resolve factual disputes by inspecting the disputed interface or running a minimal reproducer. Do not reject a finding because a senior model disagrees, or accept it solely because the critic sounds certain.

For an accepted finding, update the owning artifact and the relevant acceptance case; then ask the original reviewer or another independent reviewer to inspect the changed behavior. A documentation fix closes a **specification** gap only. A code fix closes an implementation finding after relevant checks establish it. Record intentionally deferred limits in the worklog and user-facing result.

Use one initial challenge and one focused recheck as the normal review cycle. Additional rounds require a new material finding, changed scope, failed verification or unresolved evidence. Two failed corrections to the same issue should trigger a fresh Opus diagnosis and a revised hypothesis, not repeated identical prompts. Fable may challenge that diagnosis independently. Do not demand endless unanimous approval or manufacture findings to fill a quota.

## Implementation, verification and handoff protocol

### Work package handed to every agent

```text
Task ID / objective / user-authorized scope:
Role, requested model, effort and resolved model when available:
Relevant instructions, contracts, source pins and exact files to read:
Allowed files to edit; files owned by others:
Inputs/dependencies and frozen interfaces:
Required behavior, preserved invariants and explicit exclusions:
Acceptance case IDs and check commands (mark proposed scripts):
Expected deliverable and evidence format:
When to stop this slice and return a blocker:
```

The owner returns files changed, actual behavior, source references, checks with exit status, relevant evidence IDs, open findings and the next dependency. Reviews return findings first. Neither a reviewer nor an implementation worker should copy the full conversation into its report; provide enough evidence for another agent to reproduce the conclusion.

### Ownership and integration

- Opus owns the shared architecture, contract changes and integration decision. Sonnet workers own bounded patches under A/B/C/D as assigned below. Fable owns findings, not concurrent edits to the plan under review.
- No two workers edit the same file simultaneously. Contract changes go to their designated owner before downstream code assumes them.
- Use isolated worktrees when independent repository changes need separation and worktrees are available. Check their actual starting state and account for uncommitted instructions/contracts; a worktree starting from the default branch may not contain the current plan.
- Inspect each incoming diff before integrating it. Run the focused checks at the integrated revision; worker-local success does not prove combined compatibility.
- Keep model-review reasoning separate from the application's deterministic domain validator. A model's approval cannot create receipts, authorize effects or label an itinerary valid.
- Continue authorized reversible work without repeated approval questions. Ask only for a consequential missing decision, unavailable required access or action outside authorization; a review meeting is not itself a new permission requirement.

### Deterministic verification first

| Claim | Required evidence |
|---|---|
| Files changed as intended | Actual diff plus full inspection of new/untracked files |
| Types compile | Relevant compiler/type-checker command and exit status |
| Build works | Build command on the implemented workspace |
| Behavior/regression works | Meaningful runner assertions against the affected boundary |
| Formatting/lint is clean | Appropriate formatter/linter and `git diff --check` |
| Docs are coherent | Links/anchors, examples, obsolete-policy search and cross-file consistency |
| Recovery works | Required real subprocess harness, persistence trace and independent desk result |
| Provider works live | Real response/request identifiers, mode and recorded probe outcome |
| Benchmark claim holds | Frozen manifest, full paired results, failures and limitations |

Run checks that exist; label proposed or unavailable checks. Select tests for the change, complete required gates and broaden only when failures, new changes or unresolved concerns justify it. Do not write new app tests for a prose-only edit. Avoid running unrelated upstream suites merely to inflate verification counts.

After each meaningful implementation cycle: inspect the diff → run focused checks → obtain needed independent review → resolve findings → rerun affected checks → record evidence. The coordinator chooses `CONTINUE`, `REVISE_PLAN`, `FIX`, `VERIFY`, `BLOCKED_ON_DEPENDENCY`, or `COMPLETE` using this evidence. These are worklog states, not an external control API or a substitute for actual task status.

### Completion and session continuity

Only report implementation complete when the requested behavior exists, required checks pass, the diff matches scope and no unresolved in-scope correctness failures remain. State live checks that were not run. A passing mock suite is not a live integration, an accepted plan is not working software, and a review with no new findings is not proof of correctness.

Before compaction or handoff, update [WORKLOG.md](docs/implementation/WORKLOG.md) with the current objective, exact files/revision, active contracts, completed checks, open findings, requested/resolved models, substitutions, next task and dependencies. Preserve source-backed decisions and unresolved risks; do not persist raw private model reasoning or secrets. Start the next session by inspecting the current filesystem and relevant handoff rather than trusting a stale summary.

For a planning-only deliverable, completion means a coherent revised plan, source-backed interfaces, a recorded adversarial pass, implementation gates and truthful runtime unknowns. For this Claude Code instruction update, verification of CLI syntax and documentation is separate from authenticating or executing any of the requested models.

## Architectural boundaries

### OpenBot adoption

- Export pinned OpenBot source to `apps/console/`, preserving its workspace, lockfile, license and required tenant files.
- Patch listener bindings in the exported copy: Vite dev/preview currently uses wildcard `::`, and the Bun API server has no explicit hostname. Set both to `127.0.0.1`, align the API proxy target, and verify actual sockets. A localhost URL or startup log does not keep a single-user administrator console local.
- Use its React/Vite console, tenant registration, CopilotKit runtime/AG-UI transport, authentication and existing audit/UI patterns.
- Add a DR mission route and an authenticated server proxy. The actual route layout is `_authed/_app`; follow its generator conventions.
- Remote AG-UI does not carry a browser session. Verify `forwardedProps.openbotRun` via the proposed service-authenticated OpenBot verification route, using its existing `readRunAssertion` helper inside OpenBot. Check actor/Bot/run/thread binding and mission ownership; never trust unsigned forwarded identity or export the signing key.
- Register the custom remote agent with `type: remote-ag-ui`. Blank endpoint interpolation drops the agent from the tenant roster.
- For a compiled gallery card, use its actual `GALLERY` interface and verify catalog announcement, publication/description, per-agent eligibility, and any data-function grants. First announcement may auto-publish in this source pin; do not invent a mandatory manual-publish flow.
- Card arguments should identify a mission/evidence record; authoritative values come from the API, not model-written display props.
- Existing OpenBot gateway policy does not automatically govern HTTP calls inside the separate DR worker. Validate and audit those calls in DR.

### OpenMuse adoption

- Adapt task status, plan/evidence types, `TaskContext` guard/checkpoint/event ideas, action-review hashes/expiry and uncertain-outcome handling.
- Store adapted code in `packages/task-kernel/` with provenance and license notices. Define narrow interfaces against DR domain types.
- Its full worker depends on SQL CAS, polling, leases, scheduling and multi-task behavior. It is not a drop-in RawTree worker.
- Rebuild useful task-detail interactions in React DOM; do not directly import React Native screens into Vite.
- The selected application does not run OpenMuse's API, PGlite, browser, computer or Google services. A separate upstream worker would require PostgreSQL, not a shared multi-process PGlite database.

### One owner and four authorities

- DR control API owns a serialized per-mission command actor and one active child generation. During the demo, allow one active mission globally.
- The control actor is the canonical writer. User commands and child transitions enter the same queue, with command deduplication and revision validation.
- Bind worker requests to a validated parent-owned IPC channel and actual child generation. Use an explicit child environment allowlist; do not inherit control-plane, RawTree, Intelligence, signing or operator secrets into the runner. `DR_INTERNAL_TOKEN` is shared only by OpenBot and DR control; the desk has a separate limited credential.
- The killable runner performs bounded planning/sensing/curation and guarded desk calls. A browser disconnect stops observation, not the durable mission.
- RawTree owns mission constraints, facts, intents, recorded outcomes, checkpoints, context operations and evidence.
- The independent desk's SQLite ledger owns whether simulated effects committed.
- OpenBot PostgreSQL owns identity/grants/channels and operational metadata.
- CopilotKit Intelligence owns conversation history. It is not the source of mission truth or planner memory.
- SSE/WebSocket/AG-UI events are view updates. Reload/refetch canonical state after reconnect.
- Do not simultaneously schedule DR missions through OpenBot routines, the OpenMuse worker and another supervisor.

## Non-negotiable execution invariants

1. Validate and record the exact action intent in RawTree, confirm acknowledgement and query visibility, then permit the desk call. Critical writes are not buffered telemetry.
2. Action keys identify business intents and survive retries/restarts. Never derive them from an attempt, PID, epoch or current time.
3. A confirmed receipt prevents automatic re-execution. Reconcile unresolved keys against the desk before retrying.
4. Missing local receipt means unknown outcome. A timeout, HTTP 500 or unavailable lookup does not mean failure or authoritative absence.
5. A retry of an uncertain action uses the same key and arguments. The desk rejects conflicting argument reuse and uniquely records outcomes.
6. No effect depending on stale/unverified evidence. Revalidate the relevant unfinished-step dependencies; the desk also checks current world preconditions at commit.
7. Preserve active user constraints, unresolved commitments and compact confirmed receipt references in working context. The model cannot weaken/delete them.
8. No model-authored receipt, action key change, arbitrary SQL, arbitrary JSON Patch, or self-issued validation verdict.
9. Record committed effects even if a pause/cancel arrived in flight. Cancellation stops future dispatch; it does not erase or automatically refund prior effects.
10. Changes to a plan do not undo commitments. Compensation requires its own recorded action/outcome; otherwise block or expose unresolved commitment honestly.
11. Terminal success requires the independent validator's exact completeness criteria. A valid plan with pending bookings must not be labeled fully booked.
12. Keep explicit `blocked` reasons. A correct refusal/block is preferable to an invalid green result.
13. Enforce at most one unresolved or active commitment for a mission's logical itinerary slot. Creating another key is not a way to bypass an unknown or confirmed commitment; replacement requires definitive non-execution or an explicit compensation policy.
14. Serialize a durable dispatch claim with cancellation. Cancel-before-claim prevents the POST; claim-before-cancel is already in flight and its eventual receipt must be recorded. A separate guard immediately before HTTP is not an atomic cancellation boundary.
15. A previously claimed original attempt may start after Cancel is admitted, but no new claim may be issued. After its runner exits, pausing/cancelling recovery is lookup-only; `404`/unavailable does not authorize resend or terminal cancellation. Expose a reconciliation block after bounded polling. Only explicit Resume from pause can restore active retry behavior; cancellation is not silently revoked.
16. Recompute desk argument hashes and validate explicit namespaces. Return an identical existing terminal outcome before consulting mutable world conditions; reopening/closing a resource never changes a saved result for the old key.
17. Bind any per-action approval to mission, owner, plan revision, action key, slot, operation/resource and canonical argument hash. Recheck that binding/expiry at dispatch claim; receipt reconciliation remains valid after approval expiry.

## Persistence, revision and context rules

- Use stable event IDs, hashes, monotonic mission revisions and complete checkpoint records. Deduplicate identical repeated writes; reject conflicting duplicates and gaps.
- Retain pending append identity/payload in the surviving parent before insertion. Resolve it by original ID/hash before Resume reloads a checkpoint, assigns another revision or starts a worker. An unresolved append above the acknowledged watermark cannot be forgotten by clearing the projection cache.
- Give checkpoints deterministic mission/revision identities. Accept identical retry copies; block conflicting snapshots at the same revision. Never restore above the resolved watermark, and verify the checkpoint boundary event. Persist promised recall content before publishing its canonical reference.
- Do not order authoritative state only with `argMax(value, ts)`. Timestamp ties/skew must not change the current fact.
- Do not pretend RawTree supports transactions, uniqueness, compare-and-swap, or undocumented SQL bind parameters.
- Restore from a complete checkpoint plus ordered events to the acknowledged watermark. Paginate bounded queries; never quietly restore only the first page.
- Clear the control projection cache on the demo Resume and reload RawTree. The surviving parent's watermark is operational metadata, not a second fact store.
- The guaranteed MVP scope is runner death with parent/desk surviving. After parent loss, block resume of existing missions whose ownership/watermark metadata cannot be established; return `CONTROL_RECOVERY_REQUIRED`. Automatic parent recovery, distributed partitions, multi-host fencing and total-machine-loss guarantees are deferred until separately designed and tested.
- Compose each model input from typed current state and bounded evidence. Never append the entire restored OpenBot/Intelligence transcript to the DR planner.
- Initial planner-input target is 6,000 tokens including instructions, schemas and current episode items. Record counting method; provider usage and local estimates are different fields.
- If pinned content exceeds the cap, return `CONTEXT_CAPACITY`. Do not drop a required constraint to make a chart flat.
- Eviction removes material from the next prompt, not from durable provenance. Recall takes validated evidence IDs and returns bounded, labeled excerpts.
- Inside an ongoing Responses tool episode, preserve required output/reasoning items and matching call IDs. Finish it before replacing history with a canonical state summary.

## Required integrations and configuration

Core sponsor integrations: RawTree/Tinybird, Nimble, local Liquid AI. OpenAI Responses is the chosen planner API; CopilotKit Intelligence supports the OpenBot console. Framework/provider dependencies remain disclosed even though the demo emphasizes three sponsor integrations.

| Integration | Allowed starting surface | Backend configuration |
|---|---|---|
| RawTree | `POST /v1/tables/{table}`, `POST /v1/query`, optional diagnostic logs | `RAWTREE_API_KEY`, `RAWTREE_DATABASE` |
| Nimble | `POST /v2/extract`; optional driver and `POST /v1/domain-health/check` | `NIMBLE_API_KEY` |
| Liquid local | `POST /v1/chat/completions` on configured llama-server | Proposed `DR_LIQUID_BASE_URL`, `DR_LIQUID_MODEL`; no hosted Liquid key |
| OpenAI | `POST /v1/responses`, explicit bounded input, `store:false` | `OPENAI_API_KEY`, proposed `DR_PLANNER_MODEL` |
| Intelligence | Existing OpenBot SDK/runtime | `INTELLIGENCE_API_URL`, `INTELLIGENCE_GATEWAY_WS_URL`, `INTELLIGENCE_API_KEY` |

Use actual documented HTTP shapes or installed SDK types. Nimble statuses/parsing results are richer than only `success|failed`; optional metadata may be absent. Preserve `task_id`. Health/confidence metadata does not establish business truth or freshness. Verify llama.cpp strict-output syntax on the installed build before relying on it. Do not import old MLX sampling examples as proof of llama.cpp compatibility.

`DR_*` variables in the contracts are proposed project configuration, not existing OpenBot environment variables. Keep secrets in backend environment/local ignored files; never print, log, commit or render them. Commit only empty examples. Avoid provider debug logging that exposes keys or private input.

OpenBot local defaults: app 3010, API 3001; proposed DR control 4400, desk 4401, Liquid 8080. Use `AGENT_ENDPOINT_ALLOWED_HOSTS=127.0.0.1:4400` for the chosen host layout, not a broad private-host override. Public tunnel should expose only the read-only fixture feed. Single-user OpenBot means every visitor is admin; keep that console local.

Enforce the public feed boundary with an allowlisted route proxy or separate feed listener, not a tunnel to every route on the desk port. Operator interaction defaults to the local laptop; phone access is deferred unless separately designed with authentication.

## Verification and evidence requirements

Read [the acceptance matrix](docs/implementation/VALIDATION_AND_DEMO.md). High-value tests cover actual unknown effects, stale facts, revision races, bad model patches, command retries and real subprocess death.

New root scripts to implement in scaffold: `check:types`, `check:lint`, `test:unit`, `test:integration`, `test:recovery`, `test:e2e`, `test:smoke:live`, `bench:paired`, `demo:doctor`, `dev:core`. Until created, do not claim these commands exist or pass.

Existing OpenBot checks from its own workspace: `bun run typecheck`, `bun run build`, `bun run lint`, `bun run test:ci`. Use targeted tests during development. DB integration checks require dedicated `TEST_DATABASE_URL`; never default to the app database. Existing OpenMuse reference scripts use pnpm; do not install the whole source product merely to test a small extraction.

Primary recovery evidence must show: acknowledged intent, committed desk effect, actual SIGKILL/new PID, missing agent receipt before resume, lookup of the original key, recovered same receipt, independent world edit while stopped, refreshed relevant evidence, preserved constraints and valid/blocked verdict. A thrown exception or closed/reopened Store is not the same test.

A benchmark uses matched model/tools/evidence/keys/permissions/crash schedule and a competent receipt-aware checkpoint comparator. Both arms keep desk idempotency. Report requests separately from effects; include failures, ties, sample size and actual duration. A raw transcript ablation is labeled weaker. Never prescribe that a baseline must fail, fake duplicate charges, reuse good numbers as current live results, or claim days-long reliability from a short accelerated scenario.

Freeze the `checkpoint-summary-v1` policy and manifest before measured runs. Include the fixed M1 same-mission memory trace, successive prompt composition records and a positive live Liquid edit that actually changes the following prompt while pins/recall survive. An ignored proposal, copied status or rule fallback does not establish Liquid's causal contribution. Trace success does not establish continuous multi-mission or days-long reliability.

Use source-reviewed, deterministic-test, local-integration, live-smoke, benchmark and live-demo labels consistently. A replay/cache fallback remains visibly labeled and cannot establish live freshness. A rule proposer is not a successful Liquid call.

## Collaboration, repository hygiene and handoff

- Inspect `git status` and existing files before editing. Preserve user/concurrent changes and all historical research unless explicitly in scope.
- Source pins: OpenBot `3c73cf00efba46122dfd0447485e2b61f1d6a2cd`; OpenMuse `f5534c77a8c8740cf792ca73b1f7737829fb7518`. Keep `reference/` read-only during adoption.
- Preserve MIT notices and code-origin mapping in `THIRD_PARTY_NOTICES.md`. Intelligence is a separate service; do not infer entitlement from repository licensing or fake test credentials.
- Assign bounded tasks and exclusive file ownership. A owns schemas/control/recovery; B storage/desk; C providers/context/evaluation; D console/demo. With fewer workers, combine roles deliberately.
- Subagent reports must include sources read, exact findings/interfaces, copy-ready locations, confidence/gaps and checks actually run. Reject unsupported conclusions rather than merging assumptions.
- Shared schema changes require coordination with their owner; no simultaneous unreviewed edits to central contracts. Keep changes small and reviewable.
- Keep generated client/schema/route artifacts synchronized through their generators. Do not manually fork their source of truth.
- Never add model weights, credentials, local databases or large raw recordings to the source repository. Use ignored local artifacts and publish sanitized evidence only within authorization.
- Avoid unrelated refactors, optional browser/computer stacks and excessive tests for low-impact reversible edits. Spend verification on state/effect boundaries.
- Do not commit, push, deploy or send messages beyond the user's authorized task scope. Routine reversible implementation and verification should proceed without repeated permission prompts.
- End each cycle with a concise update in [WORKLOG.md](docs/implementation/WORKLOG.md): files, decisions, commands/status, evidence IDs, unresolved failures, next bounded task, requested/resolved models, effort, review findings and dispositions.

## Demo and scope priorities

Keep the exact armed crash boundary, typed constraints, real required provider paths, RawTree restoration, context edits and honest proof. Cut optional gallery embedding, map animation, broad crawling, automated compensation, expanded benchmarks and browser takeover before cutting those essentials.

Use the 30-minute startup gate and fallback rules in the implementation plan. A standalone UI is a valid fallback but must be described as deferred OpenBot integration. Full adoption is estimated at two to three focused development days; the event cut requires working accounts and strict scope.

For the cached event schedule, 4:00 PM Pacific is the internal submission target and 4:30 PM is the advertised cutoff. Confirm the portal when actually submitting. Record and upload before the internal target; preserve the final buffer. Do not continue adding features through the recording/submission window.
