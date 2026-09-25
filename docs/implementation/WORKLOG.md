# Implementation status and handoff log

This file begins as a truthful planning handoff. Update it during implementation; do not turn unchecked items green based on source inspection alone.

## Current state

- [x] OpenBot/OpenMuse source review and pinned reference clones.
- [x] Architecture adoption plan and three independent reviews.
- [x] API/configuration inventory and official-source checks from the preceding research turn.
- [x] Detailed implementation phases, contracts, validation/demo specification, and root AGENTS.md written and peer-reviewed.
- [x] Complete devil's advocate pass by three independent reviewers; ten findings corrected in the specification and mapped to acceptance cases.
- [x] Claude Code native-team research and proposed roster, ownership, staffing waves, launch prompts and task dependencies documented in AGENT_TEAM_PLAN.md.
- [ ] Bun alignment and dependency installation.
- [ ] OpenBot/Intelligence startup and remote agent registration.
- [ ] RawTree live write/query/visibility smoke test for implementation.
- [ ] Nimble live source/fixture extraction smoke test for implementation.
- [ ] Local Liquid strict-output and token/timing probe.
- [ ] OpenAI planner model selected and structured decision smoke test.
- [ ] Domain/control/runner/desk code implemented.
- [ ] Real process-kill recovery test passes.
- [ ] Console mission route and canonical state refresh implemented.
- [ ] Paired benchmark measured and exported.
- [ ] Demo recorded and submission prepared.

## Current decisions

- Canonical specification: AGENTS.md plus this directory; previous integration docs supply rationale.
- Domain: simulated accessible trip planning; no GPU Sentinel pivot.
- Main UI: OpenBot; fallback UI only if startup gate fails, explicitly reported.
- OpenMuse: adapted task/guard/checkpoint/approval patterns, not a second running application.
- Canonical writer: surviving DR control actor; child submits transitions; RawTree remains mission authority.
- Cancellation is ordered against a durable dispatch claim; a claimed effect remains in flight until reconciled.
- Automatic parent/control-loss recovery is outside MVP; unknown ownership/watermark blocks an existing mission's Resume.
- AG-UI identity is verified through a new internal OpenBot route using its existing signed-run verifier; signing keys remain inside OpenBot.
- Desk SQLite owns effects; conversation storage and transport are separate.
- Explicit loopback patches are required in the exported OpenBot app/API; its pinned listener defaults do not enforce local-only access.
- Pending append resolution precedes Resume; same-revision checkpoint conflicts block restore.
- Existing desk outcomes precede mutable world checks; namespace and argument hashes are validated explicitly.
- Previously claimed original attempts may settle after cancellation; after runner exit, cancelling/pausing is lookup-only and unresolved absence remains visibly blocked.
- M1 same-mission memory trace, a positive causal Liquid edit and frozen `checkpoint-summary-v1` are required evidence; superiority is not assumed.
- Provider: OpenAI Responses planner, explicit model still to select; local Liquid curator.
- Current developer workflow: Opus 5.5 (`claude-opus-5-5`) for architecture/synthesis, Sonnet 5 (`claude-sonnet-5`) for source discovery/implementation/verification, Fable 5 (`claude-fable-5`) for alternatives and independent devil's advocate. Root AGENTS.md governs routing; older model assignments in audit history are historical evidence only.
- Proposed implementation staffing: lead owns A; three Sonnet builders own B/C/D; Fable critic rotates into an active builder slot. Use [AGENT_TEAM_PLAN.md](AGENT_TEAM_PLAN.md) for exact ownership and T00–T15 dependencies, with no more than lead plus three active teammates.

## Open runtime decisions

| Decision | Owner | Evidence required | Current status |
|---|---|---|---|
| Planner model ID and caps | C | Available API model + fixture probe | Unselected |
| llama.cpp schema syntax/build and model quantization | C | Strict-output probe + actual usage/timing shape | Unverified |
| RawTree visibility deadline | B | Observed insert/query behavior; bounded timeout tests | Unverified |
| Official source URLs/selectors | C | Actual extraction and stable provenance | Candidate sources only |
| Intelligence account entitlement | D | Console startup and registered remote response | Unverified |
| Public fixture route/tunnel | B | Nimble can retrieve read-only feed; writes protected | Unconfigured |

## Devil's advocate review cycle

Scope: documentation/source review only. Findings and counterexamples are recorded in `DEVILS_ADVOCATE_REVIEW.md`; authoritative corrections are in AGENTS.md, CONTRACTS.md, IMPLEMENTATION_PLAN.md and VALIDATION_AND_DEMO.md. Three reviewers covered state/recovery, integration/source assumptions and product/demo/evaluation. The orchestrator confirmed findings and authored all changes. Routes, protocols and tests described here remain proposed.

Five P1 corrections address listener exposure, existing-outcome lookup order, ambiguous append handling, checkpoint conflicts and cancellation semantics. Five P2 corrections address desk namespaces, approval binding, a concrete memory workload, comparator reproducibility and Liquid's positive causal contribution. Additional clarifications prevent dangling recall references and distinguish derived context-operation views from canonical events.

All three reviewers rechecked their corrections and confirmed the original findings resolved at specification level. Follow-up clarity fixes add an explicit pause/Resume test, clarify derived `context_ops`, specify the restricted feed listener, and require the loopback patch before the first OpenBot probe. Create does not auto-start a child, allowing the crash hook to be armed before initial Resume.

Checks: all 68 local links/anchors resolve, fenced JSON parses, fences balance, explicit whitespace checks and `git diff --check` pass. Both pinned reference clones remain clean. Existing user changes were preserved. No app code/dependencies were changed; no runtime, provider, recovery or benchmark checks were executed. Jev key remained absent; no Jev approval is claimed. Next implementation step remains Phase 0 environment/service probes, followed by contract/scaffold work.

## Claude Code instruction update

Claude Code instruction update: replaced the prior routing/control policy in AGENTS.md with detailed role assignments, planning/challenge loops, severity/disposition rules, ownership, escalation, verification and handoffs. Added root CLAUDE.md importing the canonical instructions. Verified local CLI version 2.1.282 and supported flags with `claude --help`; checked current official instruction-loading, model-selection and subagent documentation. No Claude model call, account-access probe, global settings change, application implementation or runtime test was performed. The product's OpenAI/Liquid runtime choices remain unchanged.

Instruction-update validation: 69 local links/anchors across seven instruction/implementation documents resolve; JSON/fences/whitespace checks pass; all three launch examples pass shell syntax checking. Obsolete routing is absent from AGENTS.md and CLAUDE.md. An independent repository reviewer checked policy consistency; the remaining lighter-task/full-architecture ambiguity was corrected. This review does not claim that the three requested Claude models executed. The architecture/invariant portion was compared with the prior file and preserved apart from its updated handoff fields.

Initial planning validation, before the devil's advocate cycle, checked 48 local links plus JSON/fences/whitespace. That first review covered dispatch/cancel ordering, deferred control-process recovery, remote AG-UI signed identity, service-token placement and child credential boundaries. The newer cycle above supersedes its validation counts and adds adversarial acceptance cases.

## Agent-team research cycle

Added [AGENT_TEAM_PLAN.md](AGENT_TEAM_PLAN.md), connected it to AGENTS.md and the implementation ownership map, and checked official Claude Code documentation for native teams, model selection, Task-tool availability, profiles, worktrees and hooks. The guide includes five logical roles, rotating staffing waves, exclusive file boundaries, sixteen dependency-linked tasks, restricted critic profile, copy-ready discovery/implementation prompts and a session-scoped launch command. Application runtime architecture and pending implementation gates are unchanged.

Read-only CLI checks found version 2.1.282; `claude --help` and the `agents`, `attach`, `logs`, `stop`, `rm` and `respawn` help commands exited successfully. `command -v tmux` found no executable, so the guide selects in-process display. The agent-reach reader failed DNS resolution; official-source research continued through the available web tool. No Claude inference/account probe, implementation team, provider call, app service, dependency install, worktree, hook or persistent setting was started.

Two repository reviewers independently checked ownership/dependencies and local CLI semantics. Their review corrected the task board so D02–D04 are authored during scaffold but must pass after actor/supervisor integration, and replaced an unspecified profile-validation command with structural and effective-runtime checks. These were Codex repository review tasks, not claims that the requested Claude models executed. Native-team availability and account/model entitlement remain unverified.

Both reviewers rechecked the corrections and found no remaining issue within their scopes. Documentation checks cover 76 local links/anchors across eight documents, five shell examples parsed without execution, one valid JSON block, balanced fences, sixteen unique tasks with acyclic dependencies, and references into the 52-case acceptance matrix. Obsolete routing remains absent from AGENTS.md and CLAUDE.md. No application runtime test is claimed by these documentation checks.

## Per-cycle handoff template

```text
Date / phase / owner:
Requested behavior:
Files changed:
Source/API references read:
Implementation decisions:
Commands run and exit status:
Behavioral evidence / run IDs:
Checks not run and why:
Remaining failure or uncertainty:
Next bounded task and dependencies:
Requested/resolved developer models, effort, substitutions and review IDs:
Accepted/rejected/deferred findings and supporting evidence:
```

When resuming, inspect git status and current implementations before trusting an old checklist. Preserve concurrent user changes. Do not infer that a source review or an empty/skipped test suite proves an integration works.
