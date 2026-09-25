# Dead Reckoning on OpenMuse: codebase analysis and build plan

Written 2026-09-25 for the Long Horizon Agents Hack (11:00–16:30 PT). Source: shallow clone at
`reference/openmuse` (HEAD `f5534c7`, `@copilotkit/runtime` 1.70.1, ~8.9K lines server+packages, ~8.7K lines mobile).
All paths below are relative to `/Users/nihalnihalani/Desktop/Github/horizonhackathon/reference/openmuse` unless absolute.

**One-paragraph verdict.** OpenMuse's *durable task engine* (PGlite `records` table, SQL leases, `checkpoint`/`event`
hooks, pause/resume/retry, Activity UI) is exactly the harness Dead Reckoning needs and it runs with no model, no Docker
and no real Intelligence key. Its *chat* path is hard-wired to CopilotKit Intelligence (a hosted service) and is the one
thing that can eat the morning. Build Dead Reckoning as a new task kind inside `executeModelTask` and drive it through
`POST /api/agent/tasks`; treat chat as optional polish.

---

## 1. Architecture map

### 1.1 Processes, ports, env

| Process | Entry | Port | Boot requirement | Skippable? |
|---|---|---|---|---|
| **API + task worker** (Hono + CopilotKit runtime + PGlite) | `apps/server/src/index.ts:6-13` (`readConfig` → `createStore` → `recoverInterruptedActions` → `createApp` → `agent.start()`) | `PORT=8787` (`config.ts:64`) | `CPK_INTELLIGENCE_API_KEY` non-empty (`config.ts:79`, any string passes startup). `WORKSPACE_MODE=sample` needs loopback `HOST` (`config.ts:100`). | **No** – this is the core. |
| **Web / mobile UI** (Expo 54, RN 0.81, `@copilotkit/react-native` headless) | `pnpm dev:web` → `apps/mobile` `expo start --web --port 8081` | 8081 | `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:8787`, `apps/mobile/src/api.ts:3-6`) | Yes for backend work; needed for the demo. |
| **Browser worker** (Playwright Chromium, plain `node:http`) | `apps/worker/src/index.ts` (`pnpm dev:browser`) | 8790 (`index.ts:10`) | `WORKER_TOKEN` ≥32 chars (`worker/server.ts:39`), `BROWSER_WORKER_URL` on the API; `playwright install chromium` | Yes – `read_web`/`browse_web` return a 503 "not configured" (`apps/server/src/browser.ts:52-53`). Nimble replaces it. |
| **Linux computer** (Docker container) | `apps/server/src/computer.ts`, enabled by `COMPUTER_ENABLED=true` | – | Docker daemon (not running on this Mac; colima is installed) | Yes – off by default (`config.ts:86`). |
| **Separate task worker** | `apps/server/src/worker-entry.ts` | – | `DATABASE_URL` Postgres (`worker-entry.ts:6-9`); PGlite is single-process | Yes – API hosts the worker (`TASK_WORKER_ENABLED=true`). |
| **Demo runner** (AI Mock + API on 8788 + worker on 8791) | `apps/server/src/demo/entry.ts` | 8788/8791 | Still requires the Intelligence key (`demo/entry.ts:11`) | Yes. |
| **CopilotKit Intelligence** (hosted, not in repo) | constructed at `apps/server/src/app.ts:44`, injected into `CopilotRuntime` at `apps/server/src/agent.ts:52-56` | – | real project key for any chat/thread traffic | See §2. |

Hard-required to boot the API: Node ≥22 (`package.json` engines; CI uses 24), pnpm 11.19.0 (`packageManager` pin),
`pnpm install`, a `.env` with a non-empty `CPK_INTELLIGENCE_API_KEY`. Nothing else. A model key is only required for
`AGENT_BACKEND=model` tasks (`engine/model.ts:20-25` returns `waiting_input` without `MODEL`).

### 1.2 Where things live

| Concern | File:lines | Notes |
|---|---|---|
| Model call / agent loop (durable tasks) | `apps/server/src/engine/model.ts:13-351` `executeModelTask()`; run at `:307-340` | One fresh `RunAgentInput` per run (`:288-304`, single user message = `task.prompt`), 5-minute run timeout (`:308-311`), `maxSteps: 16` (`:283`). |
| Model adapter + system-prompt assembly | `apps/server/src/engine/tanstack-agent.ts:18-52` (`adapter()`: openai/anthropic/google via TanStack AI; `OPENAI_BASE_URL` at `:28`), `:87-131` (`tanstackAgent()`; system prompt built `:98-108` from `options.prompt` + `input.context` + `input.state`) | The `AGUISendStateSnapshot/Delta` tools (`:56-84`) let the model edit `input.state` via JSON Patch → **existing "edit your own context" primitive**. |
| Chat agent (CopilotKit runtime) | `apps/server/src/engine/conversation.ts:18-236` `ConversationAgent`; tools `:93-216` (`browse_web :149`, `delegate_task :169`, `agent_status :176`, `remember_fact :201`); `maxSteps: 6` (`:219`) | Runtime mounted at `/api/copilotkit` (`agent.ts:61`, proxied `app.ts:320-337`, 503 if no model key `:321-325`). |
| Tool definitions (task) | `engine/model.ts:86-275` via `tool()` wrapper `:46-74` (serial queue `:36-45`, `ctx.guard()` + `ctx.event("step")` `:64-65`, error event `:70`); `cached()` idempotent ops `:75-85` | Tools: `set_plan :94`, `read_workspace :105`, `read_mail_thread :121`, `import_pdf :133`, `inspect_pdf :143`, `fill_pdf :152`, `read_web :166`, `save_artifact :192`, `prepare_email :217`, `prepare_event :228`, `ask_user :245`, `finish_task :254`. Computer tools: `apps/server/src/computer-tools.ts:14-109`. |
| Task engine + SQL leases | `apps/server/src/engine/worker.ts`: `TaskContext :12-17`, poll 1 s `:45-53`, `tick()` `:64-115` (due = queued / scheduled / **running with expired lease** `:79-82`, max 3 concurrent `:109`), lease CAS `:116-132` (`leaseMs` 60 s `:119`), `guard :136-140`, `checkpoint :141-153`, `event :154-164`, heartbeat every `leaseMs/3` `:171-187`, lost-lease → `queued` `:204-211`, failure → `failed` `:212-230` | Constructed in `engine/service.ts:55-57` with a `settled` hook; dispatch to model at `service.ts:738`. |
| Persistence schema (PGlite) | `apps/server/src/db.ts:139`: **one table** `records(owner, kind, id, data jsonb, updated_at)`; `compareAndSwap` (`data @> expected` + `data || patch`) `:47-59`; `claim :78-90`; `recoverInterruptedActions :91-95`; PGlite at `DATA_DIR/postgres` (`index.ts:8`, `db.ts:131`) | `kind` values in use: `tasks`, `run-events`, `runs`, `memories`, `agent-artifacts`, `goals`, `monitors`, `ideas`, `notifications`, `agent-settings`, `conversations`, `conversation-settings`, `actions`, `files`, `browsers`, `worker-status`, `sessions`. |
| Domain types | `packages/domain/src/agent.ts`: `AgentTask :26-48` (`state: Record<string,unknown>`, `plan: TaskStep[]`, `evidence`, `leaseId/leaseUntil`, `attempts`), `RunEvent :49-56` (kinds `plan|step|observation|approval|result|error|status`), `AgentMemory :94-99` (`text, source, createdAt`), `AgentArtifact :100-108`, `AgentWorkspace :123-133` | |
| "Personal context" memories | Read into the task prompt at `engine/model.ts:281,286`; REST CRUD `engine/routes.ts:84-110` (`POST /api/agent/memories`, `/:id`, `/:id/forget`); chat tool `remember_fact` `conversation.ts:201-215`; UI `apps/mobile/src/agent-ui.tsx:1806-1826` + `MemoryRow :1835` | Flat list, no type/confidence/provenance beyond `source`. |
| AG-UI event streaming | Chat: `ConversationAgent.run()` returns `Observable<BaseEvent>` (`conversation.ts:29,226-235`); `splitTextAtToolCalls` `tanstack-agent.ts:136-154`. Tasks: `agent.run(input).subscribe({next})` at `model.ts:318-328` sees every `TOOL_CALL_*`, `TEXT_MESSAGE_*`, `RUN_ERROR` event server-side | Client: `useAgent({agentId, runtimeAgentId:"default", threadId})` `apps/mobile/src/chat.tsx:182`, `runtimeUrl` `App.tsx:94`. |
| Browser worker interface | Server side `apps/server/src/browser.ts:50-80` (`request()` → `fetch(workerUrl+path)`, Bearer token, 45 s timeout); worker routes `apps/worker/src/server.ts:61-101` (`POST /sessions`, `/sessions/:id/{navigate,close,screenshot,read,input,downloads}`); `read` = `document.body.innerText` `apps/worker/src/browser.ts:299-305` | Returns `{url,title,text≤100K,truncated}` (`browser.ts:18-23`). |
| Task REST API | `engine/routes.ts`: `POST /api/agent/tasks :31`, `GET /tasks/:id :34` (returns `{task, files, browsers, events, artifacts}` via `service.detail :160-179`), `POST /tasks/:id/control {pause|resume|cancel|retry} :37-42` (`service.control :231-305`), `POST /tasks/:id/input :43-55`, `GET /api/agent` snapshot `:30` | Auth: `Authorization: Bearer <token>` from `POST /api/session` (`app.ts:101-114`; sample mode needs no access key). |

---

## 2. Boot cost estimate (fresh clone, Mac, model key in hand)

Measured on this machine: Node **v25.2.1** (repo wants 24 LTS; engines `>=22`), pnpm **10.23.0** (pin is 11.19.0; pnpm 10
auto-switches to the pinned version on first run via `packageManager`, needs network), corepack 0.34.6, Docker daemon
**not running**, colima installed, **no `llama-server`**, 24 GB RAM.

| Step | Minutes | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` (root + `apps/mobile` + `apps/worker` workspaces; Expo 54 + RN 0.81 are heavy) | 4–8 | First pnpm-11 download adds ~1 min. `allowBuilds` in `pnpm-workspace.yaml` limits postinstall scripts. |
| `.env` + `CPK_INTELLIGENCE_API_KEY` | 1 (fake) / 5–10 (real: `npx copilotkit@latest login` + `project select`, needs a CopilotKit account) | See below for what a fake key breaks. |
| `pnpm dev` → `/api/health` | 1 | tsx watch; PGlite creates `.openmuse/postgres` on first run. |
| `pnpm dev:web` → localhost:8081 | 2–4 | Expo web bundle; first Metro build is slow. |
| Model: `AGENT_BACKEND=model MODEL=anthropic/claude-sonnet-4.5` (or `openai/gpt-5`) + key | 1 | `agentConfigured()` `agent.ts:14-26` needs one of `OPENAI_API_KEY/ANTHROPIC_API_KEY/GOOGLE_API_KEY`. |
| Browser worker (optional) | 3–5 | `playwright install chromium` download. Skip; Nimble is the web. |
| **Total to "task runs end-to-end via REST + Activity UI"** | **~12–20 min** | Realistic budget: done by 11:30 if one person starts at 11:00. |
| Node 25 vs 24 | +0–15 | If `expo`/`react-native` choke on Node 25, `nvm install 24` (2 min) fixes it. Nothing in the server uses APIs newer than Node 22 (`process.loadEnvFile` `config.ts:4`). |

### What breaks without a real Intelligence key

- Startup: `readConfig()` throws `"OpenMuse requires CPK_INTELLIGENCE_API_KEY…"` (`config.ts:34-38, 79`); `createApp` re-asserts (`app.ts:29`). Docs: "The API fails at startup with a missing-key error when the key is unset" (`docs/RICH-THREADS.md:28`). **Any non-empty string passes** – all tests use `"test-project-key-never-sent"` (`tests/model-worker.test.ts:46`).
- With a fake key the **task engine, REST API, Activity/Goals/Apps screens all work**: `tests/model-worker.test.ts:36-60` boots `createApp` with the fake key and drives `server.agent.worker.tick()` against a local Responses-API fixture (`tests/helpers/model.ts`).
- **Chat breaks**: the client always calls `GET /api/main-thread` (`apps/mobile/src/threads.tsx:53`) because the server hard-codes `richThreads: true` (`apps/server/src/workspace.ts:326`); that route calls `intelligence.getOrCreateThread` and returns 502 "Main conversation is unavailable" (`app.ts:205-216`). Runs themselves go through `CopilotRuntime({agents, intelligence})` (`agent.ts:52-56`); per `docs/OPENBOT-INTEGRATION.md:32`, with Intelligence configured "Runtime run responses are Intelligence connection metadata, not raw SSE", so the chat stream also depends on the hosted service. `docs/VERIFICATION.md:40`: "Intelligence boundary is mocked in tests. Live WebSocket persistence/replay … need a project key." Nobody on the team has verified live chat.
- **Decision**: get a real key in parallel (one person, 10 min), but do not block on it. Plan B for chat (§6) is a two-line change: `richThreads: false` at `workspace.ts:326` (client falls back to `threadId "local-main"` + `PUT /api/conversation`, `chat.tsx:180,244`, `app.ts:219-228`) and omit `intelligence` from `CopilotRuntime` in `agent.ts:52`. Verify at 11:20 with one curl to `/api/copilotkit/agent/default/run`; if it fails, chat is dropped from the demo and everything runs through Activity.

---

## 3. Where Dead Reckoning plugs in

Principle: add a new task kind `"reckon"` (extend the enum at `packages/domain/src/agent.ts:30,137`) and a new file
`apps/server/src/engine/reckon.ts` that is a copy of `executeModelTask` with the prompt, tools and hooks below. Dispatch it
at `engine/service.ts:738` (`if (task.kind === "reckon") return executeReckonTask(...)`). Keep `model.ts` untouched so the
"naive baseline" (ever-growing evidence/state in the prompt, `model.ts:286`) can run side by side for the chart.

### (a) Intercept every step / tool call → RawTree

- **Firehose**: `agent.run(input).subscribe({ next })` at `engine/model.ts:318-328` sees every AG-UI event. Add `rawtree.insert("agent_events", {task_id, run_id: input.runId, step, type: event.type, tool: event.toolCallName, args/delta/content (truncated), ts})` in `next`. Batch with a 500 ms flush and call `flush()` in `complete`/`error` (`:329-338`) – the RawTree SDK loses the last batch without it (playbook §7).
- **Structured step log**: the `tool()` wrapper at `model.ts:52-74` has `name`, parsed `args`, `result`/`error`. Emit one `tool_result` row with result size + token estimate here; also keep `ctx.event("step", …)` (`:65`) so PGlite `run-events` still feeds the Activity UI.
- **Engine-level events** (lease acquired, checkpoint, lost lease, failed): wrap `TaskContext.event/checkpoint` in `engine/worker.ts:141-164` or in the `execute` closure at `service.ts:55`. Send `{kind:"lease"|"checkpoint"|"lost_lease"}` rows – these are the crash/resume proof for the judges.
- Traces: `@rawtree/otel` `registerOTel()` once in `apps/server/src/index.ts` before `createApp`; TanStack AI calls will show under `traces`.
- SQL sanity: `argMax(state, ts) … GROUP BY task_id` gives current state from the log.

### (b) Replace ever-growing history with the bounded typed-memory view

The growth points today: `engine/model.ts:286` stringifies **all** `memories`, **all** `task.state` (`priorState`),
**all** `task.evidence` and `artifactIds` into the system prompt every run; `read_web`/`read_mail_thread` append to
`evidence` on every call (`:127-131, :176-188`); within a run TanStack `chat()` accumulates up to 16 tool round-trips.

Replace with:
1. `task.state.memory = { rules: [...], facts: [{text, source, confidence, ts}], plan: TaskStep-tree, episodes: [{id, headline, tokens, archived}], scratch: {...} }` persisted through `ctx.checkpoint` (CAS-safe, `worker.ts:141-153`).
2. `renderWorkingView(memory, budgetTokens=8000)` → system prompt. RULES verbatim always; FACTS sorted by confidence, truncated to budget; PLAN tree; last N non-archived EPISODE headlines; SCRATCH never rendered across runs. Pass it as `options.prompt` at `tanstack-agent.ts:98`.
3. **Proprioception table** as `input.context` entries (`tanstack-agent.ts:99-102` appends `"## Context from the application"`): `{block, items, tokens, age_steps, budget_pct}` per memory type plus `steps_this_run / maxSteps`, `run attempt`, `lease seconds left`. Also render it into a `run-events` `observation` row per step so it shows in Activity.
4. Put the typed memory into `input.state` (`model.ts:300` currently `{}`) so the model can also edit it with the existing `AGUISendStateDelta` JSON-Patch tool (`tanstack-agent.ts:63-83`); catch the `STATE_DELTA` event in the `subscribe.next` tap and `checkpoint` it. This is "agent edits its own working context" with zero new plumbing.
5. Bound the *within-run* growth: set `maxSteps` to 6–8 and end each run by returning `{ status: "queued", state }` instead of `waiting_input` (`model.ts:343-350`); `tick()` re-queues immediately (`worker.ts:79`) with a **fresh** context built only from `task.state.memory`. Each run is one "session" in the Anthropic-harness sense; tokens per run stay flat.
6. Reversible compression: `read_web`/Nimble results over ~4K tokens go to `save_artifact` (`model.ts:192-216`, PGlite `agent-artifacts`) and only `{artifact_id, url, 10-line preview}` enters an EPISODE.

### (c) Add the tools `pin / archive / recall(sql) / patch_state / compact`

Add to the `tools` array (`engine/model.ts:86-275`) using the same `tool()` helper so guard/serialization/event logging are automatic:

| Tool | Body |
|---|---|
| `pin({type:"rule"\|"fact", text, source?, confidence?})` | push into `memory.rules`/`facts`; RULES are never summarized; `ctx.checkpoint`; also `db.put(owner,"memories",{text, source:"RULE"/"FACT 0.9 · nimble:run_x"})` so it appears in Apps → Memory (`agent-ui.tsx:1806`). |
| `archive({episode_ids, reason})` | mark `archived:true`, keep the RawTree row ids; emit `run-events` `status` "Archived 12 episodes: <reason>". |
| `recall({sql})` | allowlist `^\s*SELECT` + `LIMIT ≤ 200`, reject `;`, inject `WHERE task_id='${task.id}'` via a view or string check (RawTree has no bind params – playbook §7), `rawtree.query`. Return rows; log the query itself as an event. |
| `patch_state({ops: JSON-Patch[]})` | apply to `memory` (reuse the `AGUISendStateDelta` shape, `tanstack-agent.ts:66-81`), CAS checkpoint, log a `state.patch` row. |
| `compact({reason})` | call the Liquid curator synchronously (§e) → apply its `{keep, discard, state_patch, headline}`; log `context.compacted {tokensBefore, tokensAfter}`; return the new proprioception table. |

SelfCompact rubric goes into the prompt ("call compact when a sub-goal is resolved; never mid-derivation").

### (d) Nimble tool

Same `tools` array (and `conversation.ts:93-216` for chat if chat works). `nimble_search({query, depth:"lite"})` →
`POST https://api.nimbleway.com/v2/search` (Bearer, brief `docs/briefs/nimble.md:22-30`); `nimble_research({task, effort:"low"|"medium"})`
→ create run under `/v2/agents/.../runs`, store `run_id` in `task.state.nimble.runs[]` via `ctx.checkpoint` (resumable after
crash), poll `/result` (409 = still running, 422 = failed, `docs/briefs/nimble.md`), return claims + trust grades. Persist-vs-discard rule
in code: only `high`-trust claims are eligible for `pin(fact)`; everything goes to RawTree `claims`. Route through
`cached()` (`model.ts:75-85`) keyed on `run_id` so a restarted run does not re-create the Nimble run. `read_web` stays as fallback if the browser worker is up.

### (e) Background Liquid curator

- Serve: `llama-server -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF --jinja --port 8080` (`docs/briefs/liquid.md:85,94`); call `http://127.0.0.1:8080/v1/chat/completions` with `response_format: json_schema`, temp 0.1.
- **Per-run (demo-visible)**: the `settled` hook on `TaskWorker` (`engine/service.ts:56`, runs after every run settles in `worker.ts:245-246`) → `curate(owner, task)`: input `(memory, last run's run-events)`, output `{keep, discard, state_patch, headline}`; apply with `db.compareAndSwap(owner,"tasks",id,{status: task.status},{state})` and write a `notifications` row ("Curator kept 3 facts, discarded 9 episodes") so it appears in the bell (`agent-ui.tsx:1617`).
- **Sleep-time**: `AgentService.maintain()` runs every 60 s (`service.ts:61-66`) – add a pass over `status in (waiting_input, paused, scheduled)` tasks that dedupes FACTS, re-ranks pins and writes deltas (ACE-style). Alternatively a `kind:"curate"` task with `status:"scheduled"` + `nextRunAt` (`worker.ts:80`) so the curator is itself a leased, crash-safe task.
- Do **not** try to make Liquid the main planner through `MODEL=openai/... OPENAI_BASE_URL=http://127.0.0.1:8080/v1`: TanStack's OpenAI adapter speaks the Responses API (`tests/model-worker.test.ts:66` asserts `/v1/responses`), which llama-server may not serve. Keep Liquid on a direct fetch.

### (f) Reuse crash recovery for the `kill -9` demo

Already there, no code needed: lease 60 s + heartbeat 20 s (`worker.ts:119,186`); after `kill -9` and restart,
`index.ts:11` marks in-flight actions `outcome_unknown`, `tick()` treats `running` with expired `leaseUntil` as due
(`worker.ts:81`), CAS takes a new lease (`:125-131`, `attempts+1`), `executeModelTask` rebuilds the prompt from `task.state`
(`model.ts:286`) and `operations` (`:28-34`) dedupes already-done idempotent tools (`:75-85`). For a snappy demo pass
`leaseMs: 10000` in the `TaskWorker` options at `service.ts:55-57` (env `DR_LEASE_MS`) so resume takes ≤10 s. Show:
Activity → task → events (`agent-ui.tsx:592-606`) with the `lost_lease`/`lease` rows, and a RawTree query
`SELECT run_id, min(ts), max(ts), count() FROM agent_events WHERE task_id='…' GROUP BY run_id` proving two runs, zero lost steps.
`pause/resume/retry` (`service.ts:231-305`, UI buttons in `TaskDetail` `agent-ui.tsx:268`) work unchanged.

### (g) Existing UI surfaces to display memory without new UI

| Surface | File:lines | Use for |
|---|---|---|
| Activity task card: plan progress bar | `agent-ui.tsx:93-146` | PLAN state tree (`set_plan` + step status) |
| Task detail: Plan card, result, browsers, artifacts, **events timeline** | `agent-ui.tsx:268` (`TaskDetail`), plan `:502-523`, events `:592-606` (`stamp · statusLabel(kind)` + title/detail) | Per-step proprioception table (as `observation` events), `compact`/`archive` decisions (as `status` events), lease/resume rows |
| Artifact cards (`plan/comparison/report`) | `agent-ui.tsx:628` `ArtifactCard`, `thread-artifacts.tsx:103` | Offloaded large tool results; the final brief; a "memory snapshot" artifact with the typed memory JSON |
| Apps → Memory (editable / forgettable rows with `source`) | `agent-ui.tsx:1806-1826`, `MemoryRow :1835`; API `routes.ts:84-110` | RULES and high-confidence FACTS with provenance in `source` ("RULE" / "FACT 0.92 · nimble run_ab12"). Forget = discard, visibly. |
| Goals & milestones | `agent-ui.tsx:1138` `GoalsScreen`, `GoalCard :1342`; `publishOutcome` appends a milestone per finished task (`service.ts:757-770`) | Long-horizon goal the reckon tasks roll up into |
| Notifications bell | `agent-ui.tsx:1617` `NotificationsSheet`; `service.notify` `service.ts:578` | Curator decisions ("kept 3 / discarded 9"), budget alerts (RawTree trigger webhook → `POST` into `notify`) |
| Home "Recent activity" | `screens.tsx:346-363` | Latest events |

The tokens-per-step chart (flat vs naive) is the one genuinely new visual; render it as a `report` artifact with a
markdown table, or as a tiny static HTML page that queries RawTree directly (zero RN work).

---

## 4. Reuse / rip out / leave alone

| Component | Decision | Why |
|---|---|---|
| `engine/worker.ts` TaskWorker, leases, checkpoint/event | **Reuse as-is** (+ `leaseMs` option) | This is the crash-safe harness; tested for "two-worker lease races, expired-lease recovery" (`VERIFICATION.md:30`). |
| `db.ts` Store / PGlite `records` | **Reuse** | Typed memory fits in `task.state` jsonb; no schema work. |
| `engine/model.ts` executeModelTask | **Copy to `reckon.ts`, keep original as baseline** | Side-by-side tokens/step chart. |
| `tanstack-agent.ts` (adapter, state tools, prompt assembly) | **Reuse**, feed `context`/`state` | Gives JSON-Patch self-editing for free. |
| `engine/routes.ts` task REST | **Reuse** | Demo driver = `curl POST /api/agent/tasks`. |
| Memories REST + Apps UI | **Reuse** (write typed entries into `source`) | Visible persist/discard. |
| Activity / TaskDetail / artifacts / notifications UI | **Reuse untouched** | Events + artifacts already render. |
| `computer-tools.ts`, Docker computer | **Leave alone, disabled** | Docker not running; no time. |
| Browser worker | **Leave alone**; start only if someone has 5 spare minutes | Nimble covers web. |
| CopilotKit chat + Intelligence threads | **Rip out only if it blocks** (`workspace.ts:326`, `agent.ts:52`) | See §2. |
| Gmail/Calendar, PDF, finance, ideas, monitors | **Leave alone** | Sample data still boots; don't touch. |
| `packages/backends` OpenBot adapter | **Ignore** | Disabled, contract-tests only. |
| `apps/mobile` iOS/Android builds | **Ignore**; web only | Expo dev-client / Xcode not needed. |
| Tests (`pnpm test`, 154 tests) | **Don't run the full suite**; run `tests/model-worker.test.ts` once as the harness for `reckon.ts` | `modelFixture` (`tests/helpers/model.ts`) scripts tool calls without a key – perfect for CI-less verification. |

---

## 5. Risks specific to this codebase

1. **Intelligence hard-dependency** (`config.ts:79`, `workspace.ts:326`, `agent.ts:52`). Chat has never been verified live by the authors (`VERIFICATION.md:40`). Mitigation: fake key + REST-driven tasks; chat is bonus.
2. **Alpha status / unverified boundaries**: "Live model quality and provider-account acceptance are pending" (`VERIFICATION.md:29`); the demo videos use AI Mock, not a live model (`docs/DEMO.md:11,31`). Expect prompt/tool-loop surprises with a real model; keep `maxSteps` small and test with the fixture first.
3. **Toolchain pins**: `packageManager: pnpm@11.19.0`, local pnpm 10.23; Node 24 in CI vs 25.2.1 local; Expo 54/RN 0.81 are picky about Node majors. Keep `nvm use 24` ready.
4. **PGlite is single-process** (`README` "PGlite cannot be opened by separate processes"): a second `pnpm dev` or a stray tsx watcher holding `.openmuse/postgres` will wedge boot. For `kill -9`, kill the *one* API process and restart it; no separate worker.
5. **tsx watch restarts on every save** → the in-process task worker restarts too; mid-edit you will see "interrupted" runs. That is actually the recovery path working, but it can confuse the demo recording. Freeze edits before recording.
6. **Task concurrency cap**: max 3 due tasks per tick (`worker.ts:109`) and `createTask` refuses when too many are non-terminal (`service.ts:188-191`). Cancel old tasks between rehearsals.
7. **5-minute run timeout** (`model.ts:308-311`): a Nimble `high`-effort run (5–15 min) inside one tool call will kill the run. Use `low`/`medium`, or checkpoint `run_id` and return `{status:"scheduled", nextRunAt}` to poll on the next lease.
8. **Prompt-injection posture**: prompts say all tool output is untrusted (`model.ts:286`). Keep that line in the reckon prompt; judges from OpenAI/LinkedIn will ask.
9. **RawTree specifics**: no bind params, `flush()` before exit, column names to verify with `SELECT * FROM agent_events LIMIT 1` (playbook §7). The SDK insert signature differs between docs pages (`docs/briefs/rawtree-tinybird.md:166-176`) – check the installed types.
10. **Mobile build noise**: `docs/VERIFICATION.md:9` – Expo exports do not produce signed binaries; irrelevant for us, but do not let anyone start `pnpm --dir apps/mobile ios`.
11. **Repo must be created after 11:00** (playbook §2). Start a fresh repo, copy OpenMuse in with attribution (MIT), do not fork with history.

---

## 6. Build plan: 4 people, 11:00–16:30

Roles: **A** infra/boot + RawTree, **B** engine (`reckon.ts`, typed memory, tools), **C** Nimble + Liquid curator, **D** demo/UI/metrics/video + submission.

| Time | A (infra, RawTree) | B (engine) | C (Nimble, Liquid) | D (demo, UI, pitch) |
|---|---|---|---|---|
| 11:00–11:30 | New repo; copy OpenMuse; `pnpm install`; `.env` with fake Intelligence key + Anthropic/OpenAI key; `pnpm dev` + `dev:web`; `curl POST /api/agent/tasks` → task runs → Activity shows it. Start `npx copilotkit login` in parallel for a real key. | Read `engine/model.ts`, `worker.ts`, `tanstack-agent.ts`; create `engine/reckon.ts` (copy of `executeModelTask`), add kind `"reckon"` (`domain/agent.ts:30,137`), dispatch at `service.ts:738`. | `rtree key create`; RawTree DB + `agent_events` table; `brew install llama.cpp`, `llama-server … --port 8080`, smoke-test JSON output; Nimble key + one `POST /v2/search` curl. | Write the demo task prompt ("track AI-agent funding rounds… keep a ranked brief"); sketch the 3-min script; set up the OBS/QuickTime recording. |
| 11:30–12:00 | **Gate: boot works by 12:00, else Plan B below.** `@rawtree/sdk` client module `apps/server/src/rawtree.ts` (insert batch + flush + read-only `query`). Tap `agent.run().subscribe` in `reckon.ts` → RawTree. | Typed memory in `task.state.memory`; `renderWorkingView()` + proprioception table into `options.prompt`/`input.context`/`input.state`; `maxSteps` 6, return `queued` at run end. | `nimble_search` + `nimble_research` tools (fetch, poll, `run_id` checkpoint, trust grades). | Baseline: run the same prompt as `kind:"agent"` (unchanged `model.ts`) to collect naive tokens/step. |
| 12:00–13:00 | Lease/checkpoint/lost-lease events → RawTree; `DR_LEASE_MS=10000`; `kill -9` rehearsal; `argMax` state query. | `pin / archive / recall(sql) / patch_state / compact` tools; write RULES/FACTS into `memories` with provenance in `source`. | `curate()` against llama-server with JSON schema; wire into `settled` hook (`service.ts:56`) + notification; sleep-time pass in `maintain()`. | Tokens/step chart page (static HTML querying RawTree, or a `report` artifact); README skeleton with sponsor section + architecture diagram. |
| 13:00–13:30 | Lunch; **leave a long reckon task running** to build 40+ steps of history. | | | |
| 13:30–14:30 | RawTree trigger (budget > 80% → webhook → `service.notify`) if the org-admin token is available; otherwise poll in `maintain()`. | Integration pass: run the fixture test (`tests/model-worker.test.ts` pattern) against `reckon.ts`; fix tool-loop bugs. | Persist-vs-discard rule: only `high` claims pinnable; confidence in FACTS; show Nimble `run_id` resume after kill. | Rehearse: long task → flat chart → `kill -9` → restart → `recall(sql)` about step 3 → curator keep/discard panel in Notifications/Memory. |
| 14:30–15:15 | Freeze code. Metrics dump: tokens/step, cost/step, resume time, rule-survival (RULES count before/after 5 compactions = 100%). | Bug-fix only. | Bug-fix only. | Record the video (must be done by 16:00), screenshots. |
| 15:15–16:00 | README final: sponsors named explicitly (Tinybird/RawTree, Nimble, Liquid AI, CopilotKit/OpenMuse), quick start, metrics. | | | Upload video (unlisted), fill the submit form draft. |
| 16:00–16:30 | **Submit by 16:15.** | | | |

### Plan B if boot is not green by 12:00

Keep the OpenMuse *engine files only*: `apps/server/src/db.ts` (142 lines, PGlite + CAS), `engine/worker.ts` (248 lines,
leases), `packages/domain/src/agent.ts` (types), plus `tanstack-agent.ts` (adapter). Drop `app.ts`, Expo, CopilotKit
runtime and Intelligence entirely. Write a 60-line Hono `index.ts` with `POST /tasks`, `GET /tasks/:id` (events from
`run-events`), `POST /tasks/:id/control`, and a static HTML page (fetch + table) for Activity/proprioception. Everything in
§3 (a)–(f) still applies unchanged because it targets `worker.ts`/`reckon.ts`, not the UI. Cost: ~45 min for A+D; the demo
loses the polished mobile UI but keeps every judged behaviour (flat context, kill -9 resume, SQL recall, curator,
Nimble). Say in the README: "durable task engine adapted from CopilotKit OpenMuse (MIT)".

### Files to create / touch (summary)

- New: `apps/server/src/engine/reckon.ts`, `apps/server/src/rawtree.ts`, `apps/server/src/nimble.ts`, `apps/server/src/curator.ts`, `apps/server/src/memory.ts` (types + `renderWorkingView` + proprioception), `web/chart.html`.
- Touch: `packages/domain/src/agent.ts:30,137` (kind enum), `apps/server/src/engine/service.ts:55-57` (leaseMs, curator in `settled`), `:61-66` (sleep-time pass), `:738` (dispatch), `apps/server/src/index.ts` (OTel register, RawTree flush on shutdown `:17-24`), optionally `apps/server/src/workspace.ts:326` + `agent.ts:52` (Plan B chat).
