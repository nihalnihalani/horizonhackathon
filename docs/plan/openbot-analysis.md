# OpenBot as a host for Dead Reckoning: analysis

Clone: `reference/openbot`, v0.0.15, commit `3c73cf0` (2026-09-23). All paths below are relative to
`reference/openbot/` unless absolute. Line numbers are from this clone.

**Bottom line first.** OpenBot is a well-built governance shell (gateway → CEL policy → append-only audit → act),
but it is heavy: Docker (5 images, one is Ubuntu+Chromium), pgvector Postgres, Bun 1.3.14, an interactive
CopilotKit Intelligence login, and an OpenAI key, all hard-required before a single turn runs. Its memory
model is the opposite of our theme: every run replays the **whole Intelligence thread** into the Bot. The
good news is that a Bot is just an HTTP endpoint that may ignore that history. Recommendation: **Option A**
(external AG-UI Bot, unmodified OpenBot), with a hard 12:00 cutover to a standalone build if boot fails.

---

## 1. Architecture map

| Service | Port | Runs where | Purpose | Source |
|---|---|---|---|---|
| `app` | 3010 | host, `bun run dev` | React/Vite UI | `app/` |
| `server` | 3001 | host, `bun src/production-entry.ts` | Hono API, CopilotKit runtime, auth, policy, audit, plugins, channels, routines | `server/src/index.ts` (1515 lines), `app.ts` (1617), `copilot.ts` (2305) |
| `agent-computer` | 4100 | Docker (`ubuntu:24.04` + Playwright Chromium) | browser, `/workspace`, shell, file tools | `agent-computer/src/index.ts` |
| `agent-bot` | 4200 | Docker | proof-of-concept AG-UI Bot (OpenAI chat-completions) | `agent-bot/src/index.ts` |
| `agent-langgraph` | 4201 | Docker | default managed coworker (`MANAGED_AGENT_AG_UI_URL`) | `agent-langgraph/src/index.ts` |
| `supervisor` | 4500 host / 4300 container | Docker, holds Docker socket | one computer container per Bot | `supervisor/src/docker.ts` |
| `postgres` (pgvector pg17) | 5432 | Docker, own `data` network | everything durable except threads | `docker-compose.yml:2-45` |
| `worker` | none | host, `bun worker/src/index.ts` | routine sweep loop, 30 s tick | `worker/src/index.ts:96` |
| CopilotKit Intelligence | external SaaS | — | threads, memory, realtime gateway | `server/src/intelligence-client.ts` |

**Hard-required before the server boots** (`server/src/config.ts:881-898`, `docs/configuration.md:17-29`):
`DATABASE_URL`, `KEY_ENCRYPTION_KEY` (base64 32 bytes, `config.ts:407`), `INTELLIGENCE_API_URL`,
`INTELLIGENCE_GATEWAY_WS_URL`, `INTELLIGENCE_API_KEY` (checked as a set; partial = refused), and either an
identity provider or `OPENBOT_SINGLE_USER=true` (`.env.example:46`, `config.ts:453-457`).
Model key: `OPENAI_API_KEY` is checked at startup by `agent-bot` (`agent-bot/src/index.ts:87-105`) and by
built-in package agents at run time (`server/src/copilot.ts:363`). Anthropic works with
`BOT_PROVIDER=anthropic` + `BOT_MODEL` (`prompt.txt` "For Anthropic, set all three").
Toolchain: Bun **1.3.14** pinned (`package.json:6`), Docker + Compose, `npx` (only for `copilotkit login`),
`openssl`, `lsof`, `python3` (start.sh stage 3 parses JSON with python, `scripts/start.sh:379-393`).

**What `scripts/start.sh` does** (433 lines):
1. Refuses without `.env` (l.16). Reads ports with defaults 3010/3001/4100/4200/4201/4500 (l.44-52).
2. Generates and **writes back** `MANAGED_AGENT_TOKEN` and `AGENT_TOOL_TOKEN` into `.env` if empty (l.85-137);
   `SECRETS_ROTATED=true` forces a server restart later.
3. Stage 1/4: `docker compose up -d --build postgres supervisor agent-computer agent-bot agent-langgraph`,
   then `docker compose run --rm --build migrate` (47 Drizzle migrations, `server/drizzle/`), waits on
   `/health` of each Bot container, checks `agent_profiles`/`agent_preferences` tables (l.219-260).
4. Stage 2/4: starts `server` on host with supervisor URL (l.318-330), then the `worker` (l.359-372).
5. Stage 3/4: `curl /api/copilotkit/info`; **exits 1 unless `licenseStatus == "valid"`** and ≥1 Bot registered
   (l.376-393). This is the Intelligence gate.
6. Stage 4/4: `bun run dev --port 3010` for the app; prints next steps.

**Boot-time estimate, fresh clone, Apple-silicon Mac, good Wi-Fi:**
`bun install` (3 workspaces, ~1-2 min) + `npx copilotkit login` + `project select` (interactive browser,
2-5 min) + Docker image builds: `agent-computer` pulls `ubuntu:24.04` and installs Playwright Chromium with
deps (`agent-computer/Dockerfile:8-22`, ~1.5 GB, **5-10 min**), plus server (for `migrate`), supervisor,
agent-bot, agent-langgraph images (each `bun install --frozen-lockfile`, 1-3 min each) → **15-30 min if
nothing goes wrong, 45+ if Docker Desktop, arm64, or Intelligence sign-in misbehaves.** Start the clock at
11:00 and treat 12:00 as the decision point (see §8).

**What fails without Intelligence:** everything. `config.ts:896-898` throws
`CopilotKit Intelligence is required and is not configured`; `copilot.ts:54-57`: "There is no SSE branch.
Intelligence is a requirement of the product, not a tier"; `start.sh:379-385` exits on any licence status
other than `valid`. Routines also go through the Intelligence gateway's Phoenix channel on the cron critical
path (`server/src/routines/run-turn.ts:33-40`). There is no offline mode. Bypass = self-host Intelligence
(not a hackathon task) or rewrite `copilot.ts`.

---

## 2. The AG-UI Bot contract

A Bot is one HTTP endpoint. OpenBot dials it with `@ag-ui/client`'s `HttpAgent` (`copilot.ts:1049-1056`),
so anything speaking AG-UI is a Bot. The canonical reference is `agent-bot/src/index.ts`; the framework
examples (`agent-strands/src/main.py`, `agent-claude-sdk/src/main.py`, `examples/pydantic-ai-bot/src/app.py`)
are the same contract behind an adapter.

**Request** (`agent-bot/src/index.ts:308-320`): `POST /ag-ui`, JSON body `RunAgentInput`:
`threadId`, `runId`, `messages[]` (the whole thread, see §4), `tools[]` (every callable tool, with JSON-schema
`parameters`), `forwardedProps` carrying `openbotBotId`, `openbotDeploymentTools[]` and the signed run
assertion `openbotRun` (`copilot.ts:1216-1250`). Message 0 is the standing-role system message built from the
coworker's title/role (`copilot.ts:140-148`, `docs/coworkers.md` "Standing role"); message 1 may be a
`granted-tools:<id>` system message listing MCP holdings (`copilot.ts:1200-1207`).

**Auth in:** managed Bots check header `x-openbot-agent-token == MANAGED_AGENT_TOKEN` in constant time
(`shared/agent-authorisation.ts:12-20`; `agent-bot/src/index.ts:309`; `agent-strands/src/main.py:30-40`).
A coworker registered from `/agents` instead gets whatever write-only `authorization` header you stored
(`copilot.ts:1053-1055`; `examples/pydantic-ai-bot/src/app.py:55-58` checks `REQUIRE_KEY`). `GET /health`
must answer 200 without a token.

**Response:** SSE (`EventEncoder.getContentType()`), events in order (`agent-bot/src/index.ts:125-236`):
`RUN_STARTED{threadId,runId}` → zero or more `TEXT_MESSAGE_START{messageId,role:"assistant"}` /
`TEXT_MESSAGE_CONTENT{delta}` / `TEXT_MESSAGE_END` → for each tool call `TOOL_CALL_START{toolCallId,
toolCallName,parentMessageId}` / `TOOL_CALL_ARGS{delta}` / `TOOL_CALL_END` → `RUN_FINISHED`. On failure emit
`RUN_ERROR{message}` rather than closing the stream (l.220-229), or the UI waits forever (there is a stall
guard, `AGENT_STALL_TIMEOUT_MS=60000`, `.env.example:156`).

**Two kinds of tools arrive in `input.tools`, with two different execution paths:**

1. **Surface (frontend) tools**: `computer_navigate/screenshot/read/snapshot/click/type/key/scroll/
   read_file/write_file/list_files` (`server/src/computer/schema.ts:19-31`), `computer_run_command`
   (`app/src/lib/copilot/computer-tools.tsx:759`), `computer_request_help`, gallery components. **The loop
   runs on the client**: emitting a `TOOL_CALL_*` ends the run; the browser's `useFrontendTool` handler
   (`computer-tools.tsx:243-252`) POSTs to `/api/computers/:botId/...` (l.66) → gateway → audit → computer;
   then the surface starts a **new run** with the tool result appended (`agent-bot/src/index.ts:19-23`).
   Consequence: these tools only work while a person's browser session is open on the channel
   (`server/src/computer/gateway.ts:519-523`: "a headless run has no way to drive the computer at all today").
2. **Deployment tools** (granted MCP tools, routines, Composio): names listed in
   `forwardedProps.openbotDeploymentTools`. The Bot calls them back **itself, mid-run**:
   `POST http://127.0.0.1:3001/api/agent-tools/call` with header `x-openbot-agent-token: <AGENT_TOOL_TOKEN>`
   and body `{name, args, run: forwardedProps.openbotRun}` (`agent-langgraph/src/index.ts:232-289`;
   server side `server/src/app.ts:1358-1450`). The server verifies token + signed run assertion against each
   other (`server/src/agents/callback-token.ts:1-45, 300-330`), then `pluginStore.callTool` → grant check →
   CEL policy → audit row → vendor. `AGENT_TOOL_TOKEN` is the "legacy" shared secret (`app.ts:1357`); a
   per-agent `obot_agt_…` token can be minted via `POST /api/agents/:agentId/callback-token`
   (`server/src/agents/routes.ts:615`). Refusals are returned as text prefixed with a marker, not thrown
   (`app.ts:1424-1436`), so the model reads "Refused…" as a result.

**Registration** of our Bot, no code changes: `/agents` → create coworker → endpoint
`http://127.0.0.1:4700/ag-ui`, optional auth header; or in a tenant package `agents.yaml` as
`type: remote-ag-ui` (`examples/fintech/agents.yaml:63-70`). A private address must be listed in
`AGENT_ENDPOINT_ALLOWED_HOSTS=127.0.0.1:4700` (`README.md:206-214`; loopback `:4201` is the shipped
precedent). `POST /api/agents/test-connection` checks reachability before saving (`docs/coworkers.md`).

**Minimal Dead Reckoning Bot skeleton (Bun/TypeScript, deps: `@ag-ui/core`, `@ag-ui/encoder`):**

```ts
import type { BaseEvent, RunAgentInput } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";

const enc = new EventEncoder();
const TOOL_URL = "http://127.0.0.1:3001/api/agent-tools/call";
const TOOL_TOKEN = process.env.AGENT_TOOL_TOKEN ?? "";

async function callDeploymentTool(run: string, name: string, args: unknown) {
  const r = await fetch(TOOL_URL, { method: "POST", headers: { "content-type": "application/json",
    "x-openbot-agent-token": TOOL_TOKEN }, body: JSON.stringify({ name, args, run }) });
  return (await r.json()) as { text: string; isError?: boolean };
}

Bun.serve({ port: 4700, idleTimeout: 120, async fetch(req) {
  const url = new URL(req.url);
  if (url.pathname === "/health") return Response.json({ ok: true, bot: "dead-reckoning" });
  if (url.pathname !== "/ag-ui" || req.method !== "POST") return new Response("nf", { status: 404 });
  if (req.headers.get("authorization") !== process.env.DR_BOT_KEY) return new Response("no", { status: 401 });
  const input = (await req.json()) as RunAgentInput;
  const run = String((input.forwardedProps as any)?.openbotRun ?? "");
  const stream = new ReadableStream<Uint8Array>({ async start(c) {
    const send = (e: BaseEvent) => c.enqueue(new TextEncoder().encode(enc.encodeSSE(e)));
    send({ type: "RUN_STARTED", threadId: input.threadId, runId: input.runId } as BaseEvent);
    try {
      // THE THEME: ignore the replayed thread. Take only the newest user message and the newest
      // tool result; everything else comes from our own typed memory + RawTree, not input.messages.
      const lastUser = [...input.messages].reverse().find(m => m.role === "user");
      const lastTool = input.messages.at(-1)?.role === "tool" ? input.messages.at(-1) : undefined;
      const step = await deadReckoningStep({ threadId: input.threadId, lastUser, lastTool,
        surfaceTools: input.tools ?? [], callDeploymentTool: (n, a) => callDeploymentTool(run, n, a) });
      const id = `msg_${input.runId}`;
      if (step.text) { send({ type: "TEXT_MESSAGE_START", messageId: id, role: "assistant" } as BaseEvent);
        send({ type: "TEXT_MESSAGE_CONTENT", messageId: id, delta: step.text } as BaseEvent);
        send({ type: "TEXT_MESSAGE_END", messageId: id } as BaseEvent); }
      for (const t of step.surfaceCalls) { // e.g. computer_write_file → executed by OpenBot, audited
        send({ type: "TOOL_CALL_START", toolCallId: t.id, toolCallName: t.name, parentMessageId: id } as BaseEvent);
        send({ type: "TOOL_CALL_ARGS", toolCallId: t.id, delta: JSON.stringify(t.args) } as BaseEvent);
        send({ type: "TOOL_CALL_END", toolCallId: t.id } as BaseEvent); }
      send({ type: "RUN_FINISHED", threadId: input.threadId, runId: input.runId } as BaseEvent);
    } catch (e) { send({ type: "RUN_ERROR", message: String(e) } as BaseEvent); }
    finally { c.close(); }
  }});
  return new Response(stream, { headers: { "content-type": enc.getContentType(), "cache-control": "no-cache" } });
}});
```

`deadReckoningStep` is our planner + typed memory + RawTree `capture()` + Liquid curator + Nimble calls;
none of it touches OpenBot. Python equivalent: copy `examples/pydantic-ai-bot/src/app.py` (80 lines) and
replace `AGUIAdapter.dispatch_request` with a hand-rolled SSE generator, or keep Pydantic AI and bound
`messages` in a `history_processor`.

---

## 3. Gateway + audit

**Decision path** (`server/src/computer/gateway.ts`): every acting call (`COMPUTER_ACTING_TOOLS`,
`schema.ts:33-58`, plus shell and MCP) goes: resolve target from server-held snapshot (l.395-470) → build
`PolicyContext` (l.480-530: `tool.name`, `intent`, `bot.id`, `actor.id`, `page.url/host`, `element.*`, `key`,
`command`, `file.*`, `mcp.*`, `initiator.*`) → `evaluateActionPolicy` (l.532) → **write audit row** (l.533-544)
→ `if (!decision.forward) throw ActionRefusedError` (l.545-547) → `run(address)` (l.583) → on throw, a second
row `computer.action_failed` / `computer.action_stopped` (l.584-620). "There is no path that acts without the
record existing first" is true in the code, not only the README.

**Policy engine** (`server/src/computer/policy.ts`): `cel-js` 0.8.2 (l.17), `deny[]` evaluated before
`allow[]` (l.293-330), missing/empty policy permits nothing (l.333), a throwing or non-boolean rule fails
closed (l.238-250). Shipped default `{deny:[], allow:["true"]}`; override via `AGENT_COMPUTER_POLICY` JSON
(`.env.example:278`) or `/admin/boundaries`. Custom functions `contains()`/`matches()` because cel-js has no
string methods (l.211-230). MCP calls use the same engine with `mcp.effect` read/write classification.

**Audit row schema** (`server/src/db/schema/core.ts:431-447`, table `audit_events`):

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `actor_user_id` | text, nullable | no FK; trail is append-only, a trigger refuses updates (l.435-438) |
| `initiator_kind` | text, default `person` | `person` / `deployment` / `routine` / `handoff` |
| `initiator_id` | text, nullable | routine id or handing-off Bot id |
| `event_type` | text | from `auditEventTypes` union (`server/src/audit.ts:~360-440`), e.g. `computer.action_allowed/refused/failed/stopped`, `computer.help_requested/control_taken/control_released`, `mcp.callback_refused`, `mcp.tools_discovered`, `agent.escalated`, `channel.routed`, `credential.*` |
| `target_type` / `target_id` | text | `computer` + botId for actions; `mcp_tool` + name for MCP |
| `payload` | jsonb | for computer actions (`gateway.ts:1095-1140`): `action`, `bot`, `actor`, `page`, `ref`, `key?`, `file?` (path only), `command?` (never output), `decision {allowed, source, matched, reason}`, `carriedOut`, `failure?`. Sensitive keys redacted (`audit.ts:540-555`) |
| `created_at` | timestamptz | four covering indexes (l.465-487) |

**Where to tee to RawTree (single choke point):** `server/src/audit.ts:576-586`, `createAuditStore(database)`
returns `{ insert }`; every writer goes through `recordAuditEvent(store, event)` (l.557-565). Wrap `insert`
to also `POST` the row to RawTree's ingest (fire-and-forget, buffered, `flush()` on exit). Three call sites
construct the store (`server/src/index.ts:259, 310, 1256`), so changing the factory covers all of them. ~25
lines. That is the entirety of Option B's "must-have" patch.

**Honest assessment for our theme.** This is an *action/decision* log, not an *observation* log. By design it
never stores model prompts, token counts, tool results, page text, file contents or command output
(`gateway.ts:1121-1130` "The command, in full, and its output never"). It also does not see anything our Bot
does on its own (model calls, Nimble runs, RawTree recalls, Liquid curator decisions). So OpenBot's audit
trail can be *one stream* into RawTree ("what the platform let the agent do"), but Dead Reckoning's event log
(observations, state patches, keep/discard, tokens/step) must be emitted by our Bot regardless. Selling the
audit tee as "the event log" would be overclaiming; selling it as "governance events joined to the agent's
own telemetry by `bot`/`threadId` in SQL" is honest and still a nice Tinybird story.

---

## 4. Memory and threads

**Who owns history:** CopilotKit Intelligence (SaaS). A channel maps to one Intelligence thread
(`intelligence_channel_mappings`, `core.ts:489-500`; `docs/coworkers.md` "Channels"). The runtime restores
the thread and the **browser sends the full `input.messages` on every run** (`copilot.ts:1256-1268`
"this middleware is the last thing between the browser's `input.messages` and the endpoint"). Routines run a
headless turn into the same thread by reaching into five `ɵ`-prefixed private runtime methods
(`run-turn.ts:1-30`). "Memory" beyond the transcript is Intelligence's own feature; OpenBot code only
stamps threads with `DEPLOYMENT_ID`.

**Can it be bypassed?** Not for the platform (§1). But **a Bot may ignore what it is sent.** The remote-Bot
path assembles `[standingMessage, holdingsMessage?, ...sanitizeSeededHistory(input.messages)]`
(`copilot.ts:1262-1298`) and forwards it. I found **no truncation or windowing anywhere** in `copilot.ts`
or `agents/history-sanitize.ts` (the sanitiser only drops dangling tool calls and inlines attachments), so
the shipped Bots' context grows with the thread. `agent-bot/src/history.ts` converts everything to provider
messages. That is exactly the "ever-growing history" the brief attacks, and it hands us a free baseline:
log `input.messages` token count per run (naive) beside our working-view token count (Dead Reckoning) into
RawTree, and the "flat vs climbing" chart comes from the same runs.

**Where we bound it:** inside our Bot (§2 skeleton): read only the last user message and last tool result,
keep RULES/FACTS/PLAN/EPISODES/SCRATCH in our own store, and rebuild the ≤8K working view per run. The
Intelligence thread still holds the human-readable transcript for the UI, which is fine: it is the
*display* log, not the model's context.

---

## 5. Routines

Created by chat only, gated by per-Bot grants of `create_routine/update_routine/delete_routine`
(`docs/routines.md` "Creating one"; `server/src/plugins/builtin-routines.ts`). **15-minute floor** hard-coded
(`server/src/routines/schedule.ts:4,15`, scanned across 200 occurrences l.85-120), cap 20 enabled, 10
consecutive failures disable. Firing: the host `worker` ticks every 30 s (`worker/src/index.ts:96`),
claims `work_items` with `select … for update skip locked`, POSTs `{routineRunId}` to
`/internal/routines/run` with `Bearer WORKER_SHARED_SECRET` (l.60-80); the server runs a headless turn
(`run-turn.ts`) as the routine's owner, `initiator_kind=routine`. Missed windows are skipped, not replayed.

**Usable for "multi-day agent compressed into minutes"?** No. The floor means at most one firing per 15
minutes per routine, routine tools can only be `message_bot`/`ask_person`-free deployment tools (computer
and file tools need a browser session, `gateway.ts:519-523`), and it needs a grant + the worker + the
Intelligence gateway up. Use it, if at all, for one **real** scheduled firing during the pitch as proof the
agent survives unattended, and drive the "7 simulated days" loop from inside our Bot with a simulated clock
that stamps `sim_day` on every RawTree event. Do not build the demo on routines.

---

## 6. Computer per Bot

With `COMPUTER_SUPERVISOR_URL` set (start.sh does), the supervisor creates one container per Bot with two
named volumes: `<bot>-profile:/profiles` (Chromium profile, logins) and `<bot>-workspace:/workspace`
(`supervisor/src/docker.ts:416-424`, volumes created l.507-512). `reset` deletes the profile only; the
workspace survives resets and container removal (l.478-480, 625-642). Path confinement is three-layer
(`agent-computer/src/workspace.ts:1-25`); reads are byte-capped so a file cannot flood the context (l.58-66).

**Can typed memory live there?** Yes, mechanically: `computer_write_file("RULES.md")`,
`FACTS.json`, `PLAN.json`, `episodes/000123.md`, `scratch/…`, and `computer_list_files` to show them. Each
write is a governed action with an audit row naming the path (`gateway.ts:1118-1120`), which gives a nice
"persist" event for free, and a CEL rule like `deny: intent == "write_file" && contains(file.path, "RULES")`
demonstrates *rules are never rewritten* at the platform layer. Two costs: (1) every file op is a
client-side round trip that ends the run and starts a new one (§2), so a step that writes three memory
files costs three extra runs; (2) it only works while a person is on the channel. **Recommendation:** keep
the authoritative typed memory in our Bot's own store (SQLite/JSON on disk + RawTree), and *mirror* the
five files into `/workspace` at task boundaries so the demo can open the Files panel and the audit trail
shows the persist-vs-discard split (`scratch/` is written then deleted; `RULES.md` is written once).

**Take-the-wheel for a demo moment.** The Bot calls `computer_request_help` (prompt guidance in
`shared/bot-prompt.ts`); server routes `GET /:botId/control`, `POST …/control/request|take|release|secret`
(`server/src/computer/routes.ts:346-426`); events `computer.help_requested`, `computer.control_taken`,
`computer.control_released` (`gateway.ts:1195-1213`); while a person drives, Bot actions are refused rather
than queued (`agent-computer/src/control.ts:89-91`). Script: the agent hits a login wall on day 3 of the
simulated run → asks for help → teammate takes the wheel in the screen panel, signs in, hands back → the
agent resumes from PLAN state without re-reading the transcript. The 10-minute TTL on help requests
(`control.ts:77`) is fine for a live demo.

---

## 7. Reuse / rip out / leave alone, and risks

| Piece | Verdict | Why |
|---|---|---|
| AG-UI Bot contract (§2) | **Reuse** | Zero-code integration; our Bot is a 100-line HTTP service |
| Standing role + granted-tools system messages | Reuse | Free persona; we ignore the rest of the history |
| Gateway + CEL policy + audit trail | Reuse (unmodified) | Governance story for infra judges; audit tee optional |
| `/workspace` files + Files panel | Reuse (mirror only) | Visible typed memory; audited writes |
| Take-the-wheel | Reuse | Best live moment OpenBot gives us |
| Screen panel (live Chromium) | Reuse | Only if a Nimble-less browsing step is in the demo |
| Intelligence threads | Leave alone | Required; treat as display transcript + naive baseline |
| Routines/worker | Leave alone | 15-min floor, no computer access; maybe one real firing |
| Components/gallery, playground | Leave alone | Our proprioception panel is easier as our own page reading RawTree |
| MCP catalogue, Composio, voice, SAML/OIDC, SPIRE, desktop | Ignore | Not on the demo path |
| `agent-bot`, `agent-langgraph` containers | Rip out of the compose set if boot is slow | `BOT_PROVIDER=anthropic` already skips `agent-bot` (`start.sh:200-206`); `agent-langgraph` can be dropped from `SERVICES` if we set `MANAGED_AGENT_AG_UI_URL` empty |

**Risks (honest):**
- **Size and churn:** ~660 `.ts` files outside `node_modules` by `find` (lead's count 875 incl. tests), alpha
  `0.0.15`, last commit two days ago; 2305-line `copilot.ts` mirrors private `@copilotkit/runtime` internals
  (`run-turn.ts:2-9`). Debugging anything inside it during the hack is a black hole.
- **Five external dependencies just to say hello:** Docker Desktop, pgvector Postgres, Bun 1.3.14 exactly,
  CopilotKit Intelligence account + interactive `npx copilotkit login`, OpenAI (or Anthropic) key. Any one
  missing = no boot. Intelligence is SaaS: an incident on their side kills the demo.
- **Chromium image build** on arm64 Mac: 5-10 minutes and the most likely place to hit a Docker/space error.
- **Client-side tool loop:** browser and file tools only run with a person's tab open (`gateway.ts:519-523`).
  A "long-running agent" that needs the tab open contradicts the theme unless our Bot does the long work
  itself and uses OpenBot only for the governed moments.
- **Single-user mode** (`OPENBOT_SINGLE_USER=true`) refuses to start on any public address
  (`docs/architecture.md` "Security boundaries"); fine on a laptop, but no "live website" checkbox from OpenBot.
- **Commit-history rule:** the submission must be built after 11:00. A fork of OpenBot (Option B) puts
  875 files of not-our-code in the repo; keep OpenBot as a git submodule/reference or out of the repo.
- **Judge fit:** none of the ten judges is from CopilotKit. OpenBot buys "governed agent platform" polish and
  a take-the-wheel moment; it does not by itself score Tinybird, Nimble or Liquid points. Those come from our Bot.

---

## 8. Two options, 4 people, 5 hours (11:00-16:30, video at 16:00)

### Option A: Dead Reckoning as an external AG-UI Bot, OpenBot untouched (recommended)

| Who | 11:00-12:00 | 12:00-13:30 | 13:30-15:00 | 15:00-16:00 | 16:00-16:30 |
|---|---|---|---|---|---|
| P1 platform | `cp .env.example .env`, `copilotkit login`, keys, `bun install`, `start.sh`; drop `agent-bot` via `BOT_PROVIDER` if slow | register Bot at `/agents` (`AGENT_ENDPOINT_ALLOWED_HOSTS=127.0.0.1:4700`), test-connection, CEL deny rule on `RULES.md`, `/workspace` mirror | take-the-wheel rehearsal; optional 25-line audit tee (`audit.ts:576`) if everything else is green | demo run, screen recording | submit |
| P2 bot core | skeleton (§2) answering "hi" through OpenBot; RawTree `capture()` per run incl. `input.messages` token count (naive baseline) | planner loop, typed memory store, working-view builder (≤8K), `recall(sql)` | crash/resume (`kill -9`, resume from RawTree + STATE), rule-survival counter | freeze | |
| P3 sponsors | `llama-server` for LFM2.5 up; Nimble key + one agent run | Liquid curator JSON patch (keep/discard/state_patch); Nimble claims → FACTS by confidence | semantic compaction at sub-task boundaries; episodes compression | README sponsor section | |
| P4 dashboard/pitch | RawTree schema (`events`, `steps`) + SQL endpoints | proprioception panel page: tokens/step flat vs naive, block table (size/age/pinned), keep/discard feed | rule-survival and recall-accuracy numbers; 3-min script | record video, screenshot | |

Integration cost with OpenBot: **~1.5 person-hours** (boot + registration + one policy rule). Everything
else is the project we would build anyway, so OpenBot failing late costs us only the demo shell.

### Option B: fork `server/` for a RawTree tee + memory panels

Tee at `audit.ts:576` (25 lines) is cheap, but "memory panels" inside the app means: a new TanStack route
in `app/src/routes/`, a server route in `app.ts` (1617 lines, dependency-injected constructor with ~20
positional args at `index.ts:1248-1290`), typecheck across three workspaces, and a rebuilt `migrate` image
if any table changes. Realistic: **2 people × 3.5 hours** with a high chance of fighting the runtime's
private APIs, and the repo becomes an OpenBot fork that violates the "built during the event" spirit.
Payoff over A: the proprioception panel lives inside the OpenBot chat instead of on our own page. Judges will
not distinguish. **Not recommended**; take only the audit tee as an A+ stretch at 14:30 if green.

### Plan B if OpenBot is not answering `/api/copilotkit/info` with `licenseStatus: valid` by 12:00

Stop. P1 joins P4. Dead Reckoning runs standalone: same AG-UI endpoint (so "OpenBot-compatible, any AG-UI
host" stays a true sentence in the README), driven by a 40-line CLI or a `<CopilotChat>` page pointed at our
endpoint, plus the RawTree dashboard. The demo loses the take-the-wheel moment and gains 90 minutes; the
three sponsor stories and all numbers are unchanged. Decide at 12:00, not 12:30.
