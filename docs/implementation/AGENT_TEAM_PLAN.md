# Claude Code agent team for implementing Dead Reckoning

Research and proposed operating design · 25 September 2026

This guide translates the existing [implementation phases](IMPLEMENTATION_PLAN.md) and [Claude Code policy](../../AGENTS.md) into a concrete team. It does not start Claude sessions, enable settings, install tools or claim the project is implemented. All application paths below are proposed until their implementation task lands.

## Recommendation

Use **one Opus 5.5 lead, three Sonnet 5 builders, and a Fable 5 devil's advocate who rotates into a builder slot at review gates**. These are five logical roles, with no more than the lead plus three active teammates. Run the integrated demo and latency benchmarks through one designated operator.

The lead also owns the state kernel and recovery integration. This lets the three builders advance storage/world, provider/context, and console work in parallel without competing over the most sensitive protocol. Fable challenges their concrete contracts and integrated evidence; it is not a continuous fifth implementation worker. This staffing rule is a project choice, not a claimed Claude Code limit.

## What the research establishes

Claude Code's native teams are experimental and require interactive use with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; `-p` does not spawn teammates. They support separate teammate contexts, direct messages and explicit model assignments. In-process display avoids a terminal multiplexer. Teammates inherit lead effort. Automatic plan approval is not a substantive review. In-process teammates are not restored by session resume. Runtime team configuration is generated; a project `.claude/teams/teams.json` is not a supported roster file. [Official agent-team documentation](https://code.claude.com/docs/en/agent-teams).

For these newer models, enable task tools explicitly with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. `CLAUDE_CODE_ENABLE_TASKS=1` selects the Task family rather than the older checklist tool. Confirm `TaskCreate`, `TaskGet`, `TaskList` and `TaskUpdate` actually appear; otherwise dependencies exist only in our written board and messages. [Tool availability](https://code.claude.com/docs/en/tools-reference#task-tool-availability), [environment variables](https://code.claude.com/docs/en/env-vars).

Use full IDs: `claude-opus-5-5`, `claude-sonnet-5`, `claude-fable-5`. Do not substitute the moving `fable` alias. Check resolved identities and organization restrictions before attributing work to a model. A forced global subagent model can defeat a mixed-model roster. [Model configuration](https://code.claude.com/docs/en/model-config), [subagent model selection](https://code.claude.com/docs/en/sub-agents#choose-a-model).

Local checks found Claude Code **2.1.282**. `tmux` is absent from the current PATH. CLI help documents background sessions (`--bg`, `claude agents`) separately; those commands alone do not establish a coordinated team. The team display flag is documented on the official team page although absent from local top-level help. Account/model access and actual team startup remain untested.

## The named teammates

| Name | Model | Responsibility | Success looks like |
|---|---|---|---|
| `dr-lead` | Opus 5.5 | Architecture, shared contracts, task kernel, control/runner recovery, integration and final decisions | One coherent executable protocol; reviewed contracts; actual recovery evidence |
| `dr-storage-desk` | Sonnet 5 | RawTree storage/replay, simulated desk, source fixture and persistence tests | Intent/receipt evidence survives; duplicate requests cause one effect; uncertain writes block correctly |
| `dr-intelligence-memory` | Sonnet 5 | Nimble, Liquid, Responses adapters; facts/context/planning proposals; evaluation harness | Revalidated evidence and an actual Liquid edit change subsequent bounded prompts |
| `dr-console-delivery` | Sonnet 5 | OpenBot adoption, authenticated proxy, mission board, evidence display and demo assets | UI reflects canonical state and makes the real crash/recovery understandable |
| `dr-critic` | Fable 5 | Read-only architecture, failure-path, integration and benchmark challenge | Concrete findings with source/evidence, accepted corrections and focused rechecks |

Normal Sonnet effort is medium for a bounded module and high for difficult debugging; architecture/critical review uses high. For native-team waves, choose and verify the session's effective effort rather than promising independent per-teammate effort settings. Separate subagent sessions may use their own supported effort configuration.

## Exact ownership boundaries

The lead records the following ownership in every task packet. Directory ownership includes associated files only after the package scaffold is agreed; no worker independently rewrites root configuration or installs a competing dependency set.

| Owner | Exclusive writes during its assignment | Shared boundary to freeze first |
|---|---|---|
| Lead / A | Canonical docs/worklog; root manifests, lockfile, scripts and config; `packages/mission-domain/**`; `packages/task-kernel/**`; control actor/supervisor/HTTP/IPC/AG-UI; runner entrypoint/recovery/effect executor | Event schemas, canonical hash, actor transitions, storage port, worker IPC, API view |
| Storage / B | `services/control/src/storage/**`; `services/world/**`; proposed `tests/unit/storage/**`, `tests/integration/storage/**`, `tests/integration/desk/**`; authoritative world fixture definitions | Actor is revision/watermark owner; adapter confirms persistence/visibility; desk is effect authority |
| Memory / C | `services/runner/src/providers/**`, `context/**`, `facts/**`, `planning/**`; corresponding scoped tests; `bench/**` | Modules return typed proposals/results to A; they cannot independently dispatch effects or write canonical state |
| Console / D | `apps/console/**` and its separate lockfile; optional `apps/fallback/**`; `tests/e2e/**`; assigned demo presentation assets | OpenBot verifies actor identity; DR authorizes mission access; UI reads canonical snapshots |
| Critic / R | None during review | Returns findings by message; lead records dispositions and owners implement corrections |

These narrower boundaries resolve four likely collisions:

1. **Runner orchestration versus adapters:** A owns the episode loop, IPC client, recovery ordering and guarded effect calls. C owns the pure composition/proposal/provider modules that the loop invokes. A imports their interfaces; C never introduces another scheduler.
2. **Actor versus storage projection:** A owns the serialized queue, pending append descriptor, acknowledged watermark and disposable cache. B owns transport, fixed SQL, event replay, deduplication and checkpoint validation. B does not allocate revisions; A does not skip query visibility.
3. **Runtime verdict versus benchmark oracle:** A owns deterministic domain validation used for mission status. C owns the external benchmark oracle checking frozen fixture expectations and desk records. Neither planner prose nor the benchmark report can authorize an effect or invent runtime success.
4. **OpenBot versus DR identity:** D implements the signed-run verification route inside OpenBot; A implements DR's service call, owner checks and command admission. The signing key stays inside OpenBot. Freeze their request/error shapes before parallel implementation.

World fixture truth belongs to B. C's benchmark fixtures reference that manifest by ID/hash and supply sequences/expectations; they do not maintain a competing copy of resource truth. The lead owns root `tests/recovery/**`; B executes/reviews its storage/desk assertions as an independent collaborator. A task may transfer a file explicitly, after its former owner stops editing; transfer is recorded rather than inferred.

## Staffing waves and release gates

| Wave | Teammates beside the lead | Parallel work | Release gate |
|---|---|---|---|
| 0a: prerequisite proof | Storage, Memory, Console | Required environment/account probes and minimal safe console bootstrap | Actual evidence or named blockers; apply the existing 30-minute OpenBot gate |
| 0b: contract challenge | Critic plus relevant feasibility owner(s) | Lead authors contracts; Sonnet verifies source interfaces; Fable attacks the concrete draft | Dispositions recorded; no unresolved in-scope contract blocker |
| 1: bounded construction | Storage, Memory, Console | Desk/storage, adapters/context and fixture-shaped UI; lead builds kernel/control | Frozen interfaces, module checks and no duplicate ownership |
| 2: first recovery | Storage, Memory, Critic | Lead integrates crash/reconcile path; console builder hands off and stops | Real R02 trace plus relevant retry/cancel/persistence cases |
| 3: memory and console | Memory, Console, Critic; swap Storage in only when needed | Canonical UI/auth, M1 trace, positive Liquid edit | Correct visible state; pins/recall survive; live evidence labeled |
| 4: results and delivery | Memory, Console, Critic | Frozen paired runs, demo/README/evidence, independent claim review | Integrated checks, actual results, limitations and reproducible setup |

Finish or hand off a slot before bringing another teammate into the active wave. Do not leave an idle model in a polling loop merely to keep its name in the roster. Provider blockers are reported with the independent work that can continue. A blocker is not permission to substitute mocks for a required live claim.

## Initial task board

Task IDs below are project labels; create actual native task IDs at launch. Give each a description, owner, dependencies, allowed files and evidence requirements. Where a joint task is shown, one owner writes each file and the other supplies review/probe evidence.

| Project task | Owner | Depends on | Deliverable / acceptance |
|---|---|---|---|
| T00: capability and provider gates | A with B/C/D | None | Versions, model/tool availability, source pins, service probes or precise blockers; never key contents |
| T01: shared contracts and scaffold | A; C feasibility; R challenge | T00 evidence sufficient for chosen path | Types/serializer/API/storage/IPC interfaces and manifests; D01 passes; D02–D04 integration cases authored, pending T07 |
| T02: simulated world and desk | B | T01 | Namespace/hash binding, existing-outcome-first behavior, world preconditions; A01–A03/A05/A06 |
| T03: canonical storage and restore | B | T01 | Acknowledged visible append, deterministic checkpoints, evidence publication; S01–S11 as applicable |
| T04: sensing/model/context modules | C | T01 | Verified adapter shapes, bounded proposals/composition and bad-output checks; F/C cases |
| T05: console bootstrap | D | T00 minimal export/bind prerequisites; T01 view contract | Pinned export, loopback listeners, tenant/runtime, fixture-shaped board; no fabricated backend success |
| T06: domain/task kernel | A | T01 | Typed reducer, invariants, runtime verdict and exact approval binding; A04/U04/U06/V01 |
| T07: command actor and supervisor | A | T03, T06 | Serialized writes, pending-append/watermark handling, child ownership/IPC and manual Resume; D02–D04 pass against the implemented actor/supervisor |
| T08: complete mission loop | A with C | T02, T04, T07 | Intent → claim → effect → outcome; refresh/curate/planning modules integrated |
| T09: identity/transport connection | A and D | T05, T07 | OpenBot verification/proxy ↔ DR admission; U03/U05 and duplicate command behavior |
| T10: crash/cancel proof | A, B; R review | T08 | Real SIGKILL/new PID, all three boundaries, unknown outcomes and cancellation; R01–R11 |
| T11: repeated memory proof | C, A | T08, T10 | M1 composition manifests, C06/C07 and bounded recall with required pins |
| T12: canonical console integration | D | T09, T10 | Snapshot reconnect, real receipt/evidence UI, U01/U02/U07, e2e flow |
| T13: paired evaluation | C | T10, T11 | Frozen `checkpoint-summary-v1`, B01, isolated namespaces and complete outcomes |
| T14: independent readiness challenge | R; A dispositions | T11, T12, T13 | Sources and traces support every completion/demo claim; open issues visible |
| T15: delivery | A and D | T14 plus required checks | Reproducible setup, truthful README, recording and final handoff |

The local-only OpenBot patch happens before any single-user startup probe, even if the full T05 console task starts later. A provider probe may use an isolated external page while the public fixture route is still being implemented. Neither shortcut establishes later integration automatically.

Native task completion is scheduling metadata. For this project, dependent implementation is released only after the lead has inspected the specific artifacts and check results. Automatic platform plan approval does not satisfy our Fable challenge or contract-freeze gate.

## Launch procedure for a future authorized implementation session

No command in this section was executed during this research. Start in the existing repository so the current untracked instructions and plans are available. Use in-process display because it needs no tmux installation on this machine.

```sh
cd /Users/nihalnihalani/Desktop/Github/horizonhackathon
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 \
CLAUDE_CODE_ENABLE_TODO_TOOLS=1 \
CLAUDE_CODE_ENABLE_TASKS=1 \
claude --model claude-opus-5-5 --effort high --teammate-mode in-process
```

The environment settings are documented in the [environment reference](https://code.claude.com/docs/en/env-vars); the display option is documented under [team display modes](https://code.claude.com/docs/en/agent-teams#choose-a-display-mode). This command does not bypass permissions or persist global settings. Effective managed/local settings still need to be checked in the actual session.

Before coding, the lead records a capability receipt: loaded AGENTS/CLAUDE instructions, actual model identity per participant, available task tools, current checkout/dirty files, active tool restrictions and supported team transport. Give a missing capability its real status; do not silently call ordinary subagents a native team. If native teams are unavailable, use the same ownership/dependency design with ordinary explicit-model subagents and lead-owned coordination, labeled as that fallback.

### Critic profile to prepare during implementation setup

The profile below is a proposed `.claude/agents/dr-critic.md`, not an installed file. Use a tool allowlist for the critic, not only a sentence asking it to avoid edits. Full model IDs and explicit tool lists are supported in [custom subagent definitions](https://code.claude.com/docs/en/sub-agents). Review its structure against that specification, then verify its loaded definition, resolved model and effective tools in the authorized session before relying on it.

```markdown
---
name: dr-critic
description: Independently challenge Dead Reckoning contracts, patches and demo evidence.
model: claude-fable-5
tools: Read, Glob, Grep
---
Read AGENTS.md and the assigned implementation documents/source files.
Review independently. Do not edit files, operate services, or claim tests ran.
Return findings with severity, exact location, concrete failing sequence,
violated invariant, evidence, smallest correction and acceptance case.
Distinguish an intentional MVP limit from an in-scope defect.
No finding is required when the evidence supports the implementation.
Report missing access or evidence honestly; the owner runs reproducers.
```

Spawn the critic by explicitly requesting the `dr-critic` custom-agent type. Creating a profile or naming a teammate `dr-critic` alone does not prove the profile was selected. The critic's communication/task tools may be supplied by the team runtime. Check effective tools rather than assuming a profile body is a sandbox. Do not add shell or mutation-capable connectors to work around this role boundary. A separate reproduction assignment can be given to a builder without granting the critic write authority.

### Discovery-only startup prompt

Use this when still evaluating readiness; it does not authorize implementation:

```text
Read AGENTS.md and docs/implementation/AGENT_TEAM_PLAN.md.
Research implementation readiness only. Use an agent team if supported, with
the lead on claude-opus-5-5 and at most three teammates:
dr-storage-desk on claude-sonnet-5 for persistence/desk feasibility;
dr-intelligence-memory on claude-sonnet-5 for provider/context feasibility;
dr-critic on claude-fable-5 for an independent challenge.
Use the restricted dr-critic custom-agent type. If it is not prepared,
report that setup requirement; do not claim a restricted review ran.
Inspect local source/docs and report exact interfaces, missing prerequisites,
ownership conflicts and the next executable slice. Do not implement the app,
start services, modify settings or make paid provider probes in this pass.
Verify actual model identities and Task tools. If a model or native teams
are unavailable, disclose that and report the supported alternative.
```

### Implementation startup prompt

Use this only when the user chooses to begin implementation:

```text
Implement Dead Reckoning using root AGENTS.md and these files in
docs/implementation: IMPLEMENTATION_PLAN.md, CONTRACTS.md,
VALIDATION_AND_DEMO.md and AGENT_TEAM_PLAN.md.
First inspect current files and preserve existing user changes.

Act as dr-lead on claude-opus-5-5. Form a native agent team when supported.
Use the exact models and named ownership in AGENT_TEAM_PLAN.md:
dr-storage-desk, dr-intelligence-memory and dr-console-delivery use
claude-sonnet-5; the independent dr-critic uses claude-fable-5.
Use no more than three active teammates beside the lead. Rotate the critic
into a builder slot at contract and integration gates; do not launch all
logical roles simultaneously. Prepare the restricted critic profile before
using it; explicitly spawn the critic using the dr-critic custom-agent type.
Verify resolved models, tool restrictions and shared Task tools.

Create the T00–T15 task board with explicit dependencies and exclusive files.
Execute prerequisite probes and freeze contracts before dependent coding.
Inspect deliverables yourself before releasing dependent tasks; a platform
plan approval or task status does not establish review or correctness.
Keep Fable independent and read-only. Resolve accepted findings with the
owning builder, run meaningful checks, and obtain a focused recheck.

Preserve the single control writer, independent desk authority, bounded
context and all execution invariants. Prove actual subprocess death,
receipt reconciliation, changed-source handling and M1 context behavior.
Keep live, simulated, cached and replayed evidence distinguishable.
Record failures, missing credentials and model substitutions honestly.
Continue authorized independent work when one dependency is blocked.
Do not commit, push, deploy, publish or change global permissions without
authorization. End with actual check results and remaining scope.
```

## Shared workspace and service coordination

The current AGENTS.md, CLAUDE.md and implementation directory are untracked. A new worktree cannot be assumed to contain them. Claude-created worktrees normally start from the default branch; the `head` base uses committed HEAD and still does not copy uncommitted changes. [Worktree documentation](https://code.claude.com/docs/en/worktrees#choose-the-base-branch).

For the first small team, use this checkout with strict file ownership. If later isolation becomes useful, deliberately establish the correct baseline and transfer only required non-secret files; do not auto-commit unrelated user changes or copy the entire ignored environment. Separate sessions/worktrees are an explicit alternative to the shared-checkout plan, not an assumed property of every teammate.

Only the lead owns root dependency changes and root generators. Console lockfile changes belong to D. Builders request a shared dependency change with the exact package, reason and affected interface rather than racing package-manager writes.

Before parallel tests, each owner identifies its namespace, temporary database, ports and child handles. Never reset the shared desk, terminate processes by name, or use the application database for a test. Use the existing dedicated `TEST_DATABASE_URL` rule. One operator controls the live demo process tree. Latency runs sharing local Liquid execute sequentially; other teammates may inspect saved results meanwhile.

Each handoff includes task ID, files/revision, requested/resolved model, assumptions, actual checks/exit status, evidence locations, open findings and next dependency. A receiving teammate re-reads the files; an old chat summary is not the current interface. After a lead restart, reconstruct assignments from the worklog and actual filesystem, then identify which workers must be newly created. Do not assume a hidden or absent worker completed its task.

## Evidence gates and optional automation

Completion requires the existing acceptance matrix, not a teammate saying “done.” For each task, the lead checks that the claimed artifact exists, commands ran against the delivered version and unresolved findings are visible. Live-provider readiness remains separate from deterministic tests. The critic cannot mark an unrun test passed.

Optional later automation can use `TaskCompleted` to reject unsupported completion. The official hook supports exit code 2 to prevent marking a task complete. [Hook reference](https://code.claude.com/docs/en/hooks#taskcompleted). Our proposed hook would verify a task-specific evidence record, not run every expensive suite for every status update. Do not install such a hook until its behavior is implemented/tested; avoid a hook that creates an endless retry loop or treats stale test output as current.

## Research status and limitations

Official sources above were checked against local CLI help. Two repository reviewers independently mapped task ownership and inspected CLI capabilities. The agent-reach web-reader attempt failed DNS resolution; the source research continued through the available web tool. No account data or secrets were inspected.

This turn produced research and a team plan only. No Claude implementation team, paid model call, provider probe, service, new worktree, background session or persistent team setting was started. Model entitlement, native-team behavior on this account and the proposed launch command need an actual authorized session to validate. The existing application implementation gates remain pending.
