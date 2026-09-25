# Implementation status and handoff log

This file begins as a truthful planning handoff. Update it during implementation; do not turn unchecked items green based on source inspection alone.

## Current state

- [x] OpenBot/OpenMuse source review and pinned reference clones.
- [x] Architecture adoption plan and three independent reviews.
- [x] API/configuration inventory and official-source checks from the preceding research turn.
- [x] Detailed implementation phases, contracts, validation/demo specification, and root AGENTS.md written and peer-reviewed.
- [x] Complete devil's advocate pass by three independent reviewers; ten findings corrected in the specification and mapped to acceptance cases.
- [x] Claude Code native-team research and proposed roster, ownership, staffing waves, launch prompts and task dependencies documented in AGENT_TEAM_PLAN.md.
- [x] Root `.env.example` with blank credentials, documented defaults and process ownership; real environment files remain ignored.
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

## Environment example — 26 September 2026

Added the root [.env.example](../../.env.example) from the configuration contract and pinned OpenBot source, with blank provider/service/encryption credentials, an explicitly unselected planner model, local Liquid settings, OpenBot ports/tenant/Intelligence settings and a separate optional test database. The template distinguishes the root inventory from OpenBot's own environment file and records runner secret exclusions and the loopback patch prerequisite. Updated `.gitignore` to allow only the root example, and linked it from contracts and Phase 1.5. No real environment file, credential, provider probe, runtime loader or application service was created.

Validation: 29 unique assignments cover all 23 configuration-contract variables plus six verified upstream/test settings; ten sensitive fields and the planner model remain blank. Shell syntax checking (without execution), template-link checks and seven Git-ignore cases pass, including rejection of private root/service env files. A source reviewer independently checked names, defaults and secret audiences against the pinned OpenBot config/example and the DR contracts. Application startup and live provider checks remain pending.

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

## 2026-09-25 12:30–12:40 PT — Scaffold (Opus scaffold owner)

Status: **implemented + tested (local)**. Nothing live-verified against sponsors in this slice.

- Plan: applied the 15 critic must-change edits to `THREE_HOUR_CUT.md` (scaffold 12:30–12:45; integration from 12:45 on fakes with `demo:f3` gate at 1:45; `/internal/projection` ProjectionLoader contract; HOLD crash hook + `runFerryStep`; idempotent reconcile + I2b; desk routes cut now; Postgres 5433; `board.html` proof panel; AG-UI `.passthrough()`; Nimble ngrok header + version assert; Liquid `proposeContextOps` required; metric/verdict contracts; `both` arm demo; storage one-query-per-table with `RESTORE_CAPACITY`). Corrected at scaffold: status-page parser is **14** fields (plan said eleven); npm workspaces are `packages/*` only (apps/console keeps its own bun lockfile per CONTRACTS §1).
- Built: root `package.json` (all deps hoisted; scripts at final paths via `packages/shared/bin/dr-run.mjs`, which falls back to each package's `scripts/not-implemented.ts` → exit 2), `tsconfig.base.json` (ESNext + Bundler resolution, `allowImportingTsExtensions`, noEmit — deviation from NodeNext to remove import-extension friction; tsx/vitest run sources directly), `vitest.config.ts`, `.gitignore` additions, `packages/shared` (tables, records, action-key, config, tokens, sql, sse, fixture-f3 + `fixtures/f3.json`, status-page, ports), skeletons for desk/storage/kernel/providers/control/runner.
- SQLite choice: **better-sqlite3 ^12** — prebuilt binary installed and `select 1` worked on Node v25.8.0 first try.
- action_key: sha256 (plan §5), not sha1 (older task text).
- Commands: `npm install` exit 0; `npm run check:types` exit 0 (7/7 packages); `npm run test:unit` 8/8 passed; `npx tsc -p packages/shared --noEmit` exit 0; `npm run smoke:rawtree` → `NOT IMPLEMENTED` exit 2 (expected stub); `loadConfig` against real `.env` ok for storage/providers/desk/control/console-stub (values never printed).
- Not done: tokens.test/config.test as separate files (covered inside `packages/shared/test/shared.test.ts`), no live sponsor calls.

## 2026-09-25 12:37–12:45 PT — WP B: OpenBot console + DR AG-UI stub (Opus, WP B owner)

Status: **1:15 PM hard gate MET at 12:40 PT** (OpenBot integrated path; no fallback board built). The DR agent is a **stub** reply only; the real mission actor is not wired (integration owns that).

- Export: `git -C reference/openbot archive 3c73cf00efba46122dfd0447485e2b61f1d6a2cd | tar -x -C apps/console` (no nested .git; upstream MIT LICENSE kept; `apps/console/EXPORT.md` + `THIRD_PARTY_NOTICES.md` added).
- Loopback patches only: `app/vite.config.ts` host `"::"`→`"127.0.0.1"`, proxy target `http://127.0.0.1:${apiPort.port}`; `server/src/index.ts` `serve({ hostname: "127.0.0.1", port, ... })`.
- Tenant `apps/console/examples/dead-reckoning/` (copied from fintech): tenant id `dead-reckoning`; `agents.yaml` risk-analyst row → `dead-reckoning` (`remote-ag-ui`, `${DEAD_RECKONING_AG_UI_URL:-}`); `channels.yaml` risk-and-compliance channel → `dead-reckoning` channel (the loader refused the package while the channel still named `risk-analyst`: `channel references unknown agent "risk-analyst"` — fixed).
- `apps/console/.env` generated by a python script from the root `.env` OpenBot section + `DR_INTERNAL_TOKEN` (mode 600, git-ignored via apps/console/.gitignore; values never printed). Checked by key only: DATABASE_URL targets 5433, AGENT_ENDPOINT_ALLOWED_HOSTS contains 127.0.0.1:4400.
- `packages/control/src/ag-ui/handler.ts` `createAgUiHandler(port: AgUiMissionPort)` (RunAgentInputSchema validation → 400; SSE RUN_STARTED / TEXT_MESSAGE_START/CONTENT/END / RUN_FINISHED via `EventEncoder.encodeSSE`; port throw → RUN_ERROR). `packages/control/src/stub-server.ts` binds 127.0.0.1:4400 (GET /health, POST /ag-ui with canned `stubMissionPort`). Test file `packages/control/test/ag-ui.test.ts`.
- Commands / exit status: `bun install --frozen-lockfile` 0 (2392 pkgs); `bun run --filter server db:migrate` 0; `bun run --filter server typecheck` 0; `npx vitest run packages/control/test/ag-ui.test.ts` 4/4 pass; `npx tsc -p packages/control --noEmit` 0.
- Live-verified: `curl http://127.0.0.1:3001/health` → `{"status":"ok"}`; `curl -w %{http_code} http://127.0.0.1:3010/` → 200; `lsof` shows 3001 and 3010 listening on 127.0.0.1 (IPv4) only; `curl http://127.0.0.1:4400/health` → `{"status":"ok","mode":"stub"}`; POST /ag-ui sample | grep -c RUN_FINISHED → 1. Browser (Chrome via agent): onboarding lists "Dead Reckoning", new channel with DR agent, sent "hello from the console", stub reply rendered in OpenBot chat. Screenshot `artifacts/wpB-openbot-dr-stub-chat.jpg` (artifacts/ is git-ignored).
- Running processes (background, started by agent): `bun run dev` in apps/console (server 3001 + app 3010), `npm run dev:control-stub` (4400). Integrator must stop the stub before starting `dev:control` on 4400.
- Not done / uncertain: CopilotKit Intelligence thread persistence not specifically verified beyond the channel appearing in the sidebar; built-in OpenBot bots (General Assistant etc.) have no OPENAI key in console .env by design and were not exercised; DR_INTERNAL_TOKEN is not yet checked by the stub (integration's control server should verify it).

## 2026-09-25 12:37–12:50 PT — WP A: desk + RawTree storage + kernel + R02 (Opus 5.5, `claude-opus-5-5`)

Status: **implemented + tested (local) + partly live-verified (RawTree, dev desk)**. The runner, control and providers are not in this slice.

- **Desk** (`packages/desk`): Express 5 on 127.0.0.1:4401 and a second loopback listener on 127.0.0.1:4402 that serves only `GET /status.html`. better-sqlite3 tables `world_versions`, `resources`, `action_outcomes`, `book_requests`. `POST /book` runs in one transaction: record the attempt, recompute `args_hash` (a mismatch returns 400 and keeps the attempt), look up the existing key (identical args return the original outcome with `dedupeHit` before any world check; different args return 409). A new key is checked against resource status, then against a per-resource `changed_at_version > expected_world_version` test, which gives `stale_version`. Rejections are recorded with `committed:false`. Other routes: `GET /actions/:key` (200, 404, or 503 via `POST /admin/fault`), `POST /cancel`, `GET|POST /time`, `POST /admin/world` (operator token; bumps the world version), `POST /admin/reset`, `GET /admin/ledger?run_id=&arm=` (outcomes, attempts, `committed_by_slot`), and `GET /world` (JSON form of the status model). The body is the snake_case `BookRequest` from `@dr/shared/ports`, not CONTRACTS §6 camelCase. **Deviation:** world and resources are global (one park, and both arms see the same edit); outcomes and requests are namespaced by `run_id`/`arm`; lookup accepts `?run_id=&arm=`. The stale-version check is per resource, so a site-A edit does not reject the naive arm's second ferry booking.
- **Storage** (`packages/storage`): `RawTreeClient` (plain fetch with an 8 s timeout; insert resolves only on `{"inserted":N}`; otherwise `AckError`, with no retry). A never-written table answers `400 EMPTY_LIST_OF_COLUMNS_QUERIED`, which is read as 0 rows (observed live). `RawTreeSink`, `MetricsWriter`, `RawTreeLoader` (paginated `ORDER BY rev, ts LIMIT/OFFSET` per table; `RestoreCapacityError` at `RESTORE_ROW_LIMIT`; in-code projection by `(rev, ts)`; nulls stripped; identical rows deduped; `asOf` filter). `sql.ts` holds the fixed templates. `FakeRawTree` has controllable ack and visibility. `waitForRow`/`intentVisibilityGate` implement S06 bounded visibility polling. Live timestamp format is `YYYY-MM-DD HH:MM:SS.nnnnnnnnn` UTC; bools and arrays come back native.
- **Kernel** (`packages/kernel`): `Journal` fills BaseRow, assigns rev and applies a row locally only after the ack. `protocol.ts` `executeBooking`/`runFerryStep` does: invariants 2/4 checked (`InvariantViolation`) → acked `commitments intent` + `plan_steps active` → optional `awaitIntentVisible` gate → desk → HOLD hook (`HOLDING AFTER DESK COMMIT pid= receipt_id=`, 120 s, or `selfKill`) → acked receipts → `commitments confirmed|rejected` → plan step. `recovery.ts` steps 1–4: load projection, write the epoch row with `restored_rows` and log `RESTORING FROM RAWTREE… N rows · epoch E`, then reconcile `intent|unknown`. If the receipt is already in the projection, only `confirmed` is written (I2b). Otherwise lookup: found gives `receipts recovered=true` plus `confirmed` (`RECOVERED FROM DESK`); 404 gives `not_executed`; unavailable gives `unknown` and the step `blocked`. Volatile active facts from earlier epochs, or past `valid_until`, are marked `stale`. Also: `naive-transcript.ts` (local transcript.json; attempt-derived `naiveActionKey`; no reconcile or stale marking), `desk-client.ts` (`HttpDeskClient`), and `r02-child.ts`.
- Commands and exit codes: `npm run check:types` 0 (7/7). `npx vitest run packages/desk packages/storage packages/kernel --exclude '**/*.recovery.test.ts'` 0, 23/23 passed. Coverage: desk A01/A02/A03/A05/A06 plus lookup 404/503/401, status DOM and feed isolation; storage S01/S03/S05/S07, empty table, asOf, SQL guard; kernel invariants 1/2/4, S06 gate, happy path, recovery absent/unknown→later epoch, I2b, naive double-book. `npm run test:recovery` 0, 2/2 passed: the real child was spawned with `node --import tsx`, and both harness `SIGKILL` on the HOLD line and child self-SIGKILL were run. Each asserted `signal=SIGKILL`, HOLD pid = child pid, `ESRCH` on the old pid, one desk outcome and one request, intent without receipt, and then recovery from an empty dir: the same `receipt_id` with `recovered=true`, `confirmed`, and `book_requests` still 1.
- **Live-verified:** `npm run smoke:rawtree` exit 0 (`{"inserted":1}` ack ~440 ms, visible ~600 ms). `npm run dev:desk` with `curl …/status.html | grep -c 'id="site-A"'` → 1; `lsof` shows 127.0.0.1:4401 and 127.0.0.1:4402 only; `/admin/world` gives 401 without a token and 200 with the operator token (world v2, site-A closed, "Storm damage"). `npx tsx packages/kernel/scripts/live-recovery.ts` (dev desk + **real RawTree**, in-process crash after desk commit, intent visibility gate on) exit 0; runs `f3-20260925-8ae2` and `f3-20260925-2d33` recovered their receipts (`RECOVERED FROM DESK`), and a re-load from live RawTree showed `recovered:true`, amount 12000, commitment `confirmed`, step `done`.
- Not done / notes for integration: the live R02 variant with a real child against real RawTree was not run (the child would need the RawTree key; in the real system the runner goes through control `/internal/rows`). Control should pass `awaitIntentVisible` (or gate inside `/internal/rows`) so an acked intent is visible before `/book`. Without it, a restart within about 0.6 s could miss the intent. That case is still safe, because the same key is deduped or gets a 409 at the desk, but it is noisy. `Journal` assigns rev locally; if control re-assigns rev, only control's value is authoritative. Kernel `plan_steps` rows keep the existing `depends_on`.

## 2026-09-25 12:37–12:52 PT — WP C: providers (Nimble, Liquid curator, OpenAI planner, context composer) (Opus 5.5)

Status: **implemented + tested (local) + live-verified (Liquid, OpenAI planner, Nimble extract on parks.ca.gov)**. **Not yet live-verified:** Nimble extract of the tunnelled `/status.html` (no tunnel was up at 12:48; `curl 127.0.0.1:4040/api/tunnels` returned nothing).

- `packages/providers/src/nimble.ts` `NimbleSensor`: `health(host)` → `POST /v1/domain-health/check {domains:[host]}` (never throws; non-200 → `status:"unavailable"`); `extractStatusPage(url,{expectedWorldVersion})` → `POST /v2/extract {render:false, formats:["html","markdown"], parse:true, parser:NIMBLE_STATUS_PARSER (14 fields), headers:{"ngrok-skip-browser-warning":"1"}}`, one `render:"auto"` retry if nothing parses, world-version assert with one `?v=<n>` retry, non-success / target ≥400 / missing fields / unknown status → `SourceUnverified` (a site that is down never reads as closed). Observation keeps `task_id`, `status`, `status_code`, `metadata`, `raw_hash` (sha256), `retrieval_mode`, `parse_mode`, `nimble_ms`. Also `extractStatusPageDirect` (labelled `retrieval_mode:"direct"` FALLBACK, off unless `directFallback:true`), `extractPage` (plain public extract), `siteMap` → `{siteA:{status,accessible,price_cents,notice},…}`, `factsFromObservation` (site-X.status volatile + site-X.accessible rows), `classifySource` (unreachable / changed / unchanged / first).
- **Live finding (Nimble):** `/v2/extract` returned `data.parsing: {}` for every custom parser tried (example.com, parks.ca.gov, books.toscrape.com; terminal / schema-wrapped / xpath / string-selector shapes; render false/auto/true). So when Nimble's parsing is empty, the sensor applies the same 14 CSS selectors locally to the HTML **Nimble retrieved** (`parse_mode:"local-css"`, `retrieval_mode` stays `"live"`). **`POST https://sdk.nimbleway.com/v1/domain-health/check` returns HTTP 404 (empty body)** for this key (also tried trailing slash, v2, api.nimbleway.com, GET). `health()` reports it as `unavailable`; classification falls back to the extract outcome.
- `curator.ts` `LiquidCurator.compareFact`: llama-server `/chat/completions`, temperature 0.1, max_tokens 120, json_schema `{key, decision, new_value, reason}`, system prompt carries the verbatim supersede rule and a decision table; the user message gives parsed fields only plus code-computed "observed_at LATER/EQUAL/EARLIER" and "values EQUAL/DIFFERENT" lines. `validateCuratorDecision` covers same key only, schema, key scope (`site-[ABC].*`), UTC parsing of RawTree `YYYY-MM-DD HH:MM:SS`, **conflict→superseded promotion when strictly later (`promoted_by:"validator"`)**, and rejection of not-later / value-not-observed / unchanged-but-different. `new_value` is always the observed value. Rejections become `compareOpRow(...)` with `accepted:false`. Unreachable Liquid throws `DrError CURATOR_UNAVAILABLE`, not a decision. `proposeContextOps(rendered)`: the evict enum is grammar-constrained to evictable ids. Also exported: `latencyStats()` (P50/P95) and `curatorMetricRows` (phase `curator`).
- `context.ts` `renderWorkingContext` / `Composer`: re-rendered from the Projection every call. Pinned: all constraints, `intent|unknown` commitments, `plan:frontier`. Unpinned (cap 8): confirmed receipt stubs (`RECOVERED FROM DESK`), active/stale facts that non-done steps depend on, caller evidence stubs (`obs:<task>` / `fact:<key>@<ver>`). Naive `transcript` lines are uncapped. Superseded facts are dropped. `budget` → `ContextCapacity` on pinned overflow. `validateContextOps` / `applyContextOps` reject constraint, unresolved-commitment, pinned, receipt, live-fact and unknown (invented) ids. `contextOpRows` records items_before/after.
- `planner.ts` `OpenAIPlanner.decide(rendered, step, candidates, ctx?)`: `filterCandidates` in code (slot, open, accessible, remaining budget, dates, party) → `POST /v1/responses` with `store:false`, strict json_schema `dr_decision` (`resource` enum = valid ids + null). It throws `ContextCapacity` before sending if `countTokens(instructions+input+schema)` > budget. It returns `context_tokens` (local o200k) separately from `planner_tokens_in` (provider usage), and re-validates the returned book or cancel (invalid → action `block` with the validator reason).
- Commands / exit codes: `npm run check:types` 0 (7/7 ok). `npx vitest run packages/providers` 0, **43/43** passed (nimble 13, curator 14, context 10, planner 6: parser mapping, local-css fallback, render:auto retry, SourceUnverified paths, ?v= retry, health 404, classify, throwaway 127.0.0.1 http server direct fetch, F03 rejections, conflict promotion, superseded accepted, C01, C02, C04 at render and planner, B rejected, invented cancel key rejected).
- **Live-verified:**
  - `npm run smoke:liquid` exit 0. F3 site-A open→closed gave `superseded` directly (accepted, curator_ms ≈ 540).
  - The 3-case confusion (expected→model) was unchanged→unchanged, superseded→superseded ×2, conflict→**superseded** (wrong; the validator rejected it as `not_later`).
  - Live Liquid context-ops proposal evicted `obs:task-epoch1` and `fact:site-A.status@epoch1` (both accepted). Items went 10→8 and tokens 308→256.
  - Curator latency P50 ≈ 520 ms, P95 ≈ 1.4 s (n=5).
  - An earlier prompt without the decision table answered superseded for all 4 cases (validator rejected the 2 wrong ones).
  - `npm run smoke:planner` exit 0: `{"action":"book","resource":"site-C"}`; model gpt-5.5-2026-04-23; context_tokens 499 (o200k) vs provider input_tokens 500; ~4.4 s; site-A rejected `closed`, site-B `not_accessible`.
  - `npm run smoke:nimble` exit 0: parks.ca.gov extract `status success`, status_code 200, task_id `3d5f14ff-…`, ~4.5 s; health `unavailable` (HTTP 404).
  - `npm run smoke:nimble -- https://www.parks.ca.gov/?page_id=468` (status parser on a non-status page) failed closed with `SOURCE_UNVERIFIED` after the render:auto retry.
  - I started WP A's desk briefly, ran `npm run smoke:nimble -- http://127.0.0.1:4402/status.html --direct` (14 fields parsed from the real desk DOM, labelled FALLBACK), then stopped the desk.
- Blocked / pending: (1) Nimble status-page extract of the tunnel URL: run `npm run smoke:nimble -- https://<ngrok-host>/status.html` once the humans' tunnel is up. Expect `parse_mode:"local-css"` given the empty-parsing finding. (2) Nimble domain-health 404 — raise with Nimble at their table if time allows; the demo should not claim a health status. (3) If Nimble cannot reach the tunnel by 1:30, construct the sensor with `directFallback:true` (labelled `direct`) and keep Nimble live on parks.ca.gov.
