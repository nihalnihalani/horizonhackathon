# Dead Reckoning — the three-hour cut

Written 12:13 PM PT, Fri 25 Sep 2026. Code freeze **3:15 PM PT**, video 3:20, submission 4:00. This document cuts [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (a 2–3 day plan) down to what two humans plus one scaffold agent, three parallel Opus builders and one integration agent can finish today. It does not re-open decisions recorded in [AGENTS.md](../../AGENTS.md), [CONTRACTS.md](CONTRACTS.md) or [VALIDATION_AND_DEMO.md](VALIDATION_AND_DEMO.md); where it narrows them, it says so in §9.

Revised 12:3x PT after the critic pass (15 must-change edits applied: scaffold 12:30–12:45, integration from 12:45 on fakes, HOLD crash hook, `/internal/projection`, Postgres 5433, board.html). Status vocabulary for every report today: **planned / implemented / tested / live-verified**. Nothing below is implemented at the time of writing.

## 1. What must be true at 3:15 PM (demo floor + invariants)

Demo floor (all four in the recording):

| # | Floor item | Proof the recording must show |
|---|---|---|
| (a) | Real kill + restore purely from RawTree + recovered receipt | `HOLDING AFTER DESK COMMIT pid=<pid>` then `kill -9 <pid>` visible, new PID on resume, `control cache invalidated;` `RESTORING FROM RAWTREE… N rows · epoch 2`, ferry receipt `RECOVERED FROM DESK`, desk ledger shows one ferry row |
| (b) | Live-edited status page fetched via Nimble extract; campsite superseded by Liquid curator | operator edits Site A → CLOSED while runner is dead; Nimble `task_id` on screen; Liquid `decision: superseded` (or validator-promoted, labeled) with `curator_ms` |
| (c) | Naive picture-in-picture arm | `--resume=transcript` run on the same fixture: a second ferry key in the desk ledger (`duplicate_effects 1`), attempted booking of closed A rejected by the desk (`stale_actions 1`), verdict INVALID by the shared code validator (rule printed) |
| (d) | Per-step context-token metric | `metrics.context_tokens` rows for both arms; DR bounded ≤ 6,000 with no monotone growth, naive growing; rendered as a table/inline bars from a live RawTree query |

Invariants 1–6 ([FINAL_PROJECT.md §3](../FINAL_PROJECT.md)) are enforced in code, never by a model:

1. No desk call without an acked `intent` row (fail closed on anything but `{"inserted":1}`).
2. No re-execution of an `action_key` that has a success receipt.
3. No step executes while depending on a stale, unrevalidated volatile fact.
4. At most one active commitment per resource/slot.
5. An irreversible commitment is superseded only by a compensating receipt or an explicit block.
6. Terminal state is VALID or BLOCKED with a reason; never silent success.

## 2. Timeline (PT)

```
12:30  SCAFFOLD (one agent)                         hard stop 12:45 — shared/ + all package skeletons frozen
12:45  WP A  desk + storage + kernel + R02          deadline 2:15
12:45  WP B  apps/console (OpenBot) + AG-UI stub    HARD GATE 1:15 · deadline 2:00 · board.html from 1:30
12:45  WP C  providers (nimble/curator/planner/ctx) deadline 2:00
12:45  INTEGRATION control + runner against in-process fakes of the frozen ports
 1:45  INTEGRATION acceptance: `demo:f3` exits 0 against fakes with a REAL SIGKILL of the HELD child
 2:15  INTEGRATION swaps fakes for real A + C modules (module swap only)  deadline 3:00
 3:00  Full rehearsal x2, WORKLOG entries, commits
 3:15  CODE FREEZE. 3:20 record. 4:00 submit.
```

Humans (in parallel): `.env` custody, ngrok tunnel for the status feed (12:45), Nimble reachability check of the tunnel host (12:50), OpenBot browser check (1:15), operate world edit + kill in rehearsals, record.

## 3. Ground truth already verified (do not re-probe; use as is)

- RawTree tables exist in database `deadreckoning` with sorting key `run_id, ts`: `epochs, constraints, facts, commitments, receipts, plan_steps, context_ops, metrics` (+ `smoke`). Insert `POST /v1/tables/{t}?database=deadreckoning` → `{"inserted":N}`. Query `POST /v1/query?database=deadreckoning {"sql","format":"JSON"}` → `{meta,data,rows}`. Read-only SQL, no bind params, ISO timestamps normalized to `YYYY-MM-DD HH:MM:SS`.
- Nimble `POST https://sdk.nimbleway.com/v2/extract` works (sample in `.omc/smoke/nimble-extract.json`); domain health is **v1** `POST /v1/domain-health/check`.
- Liquid llama-server on `http://127.0.0.1:8081/v1`, model id `LiquidAI/LFM2.5-1.2B-Instruct-GGUF`, `response_format: {type:"json_schema", json_schema:{name,schema}}` works (~850 ms). Known issue: old "open" vs newer "closed" answered `conflict`, so the supersede rule goes in the system prompt **and** the validator promotes `conflict → superseded` when the new `observed_at` is strictly later (logged as `promoted_by: validator`).
- OpenAI Responses with `text.format` json_schema strict verified; `DR_PLANNER_MODEL=gpt-5.5-2026-04-23`.
- Intelligence key works only via `@copilotkit/runtime/v2` SDK.
- Human 12:50 pre-check before `smoke:nimble` on the tunnel: `curl -sA 'Mozilla/5.0' https://<host>/status.html | grep -c 'id="site-A"'` → `1` (proves no ngrok interstitial).
- Tools: Node v25.8.0, npm 11.11.0, Bun 1.3.14 at `~/.bun/bin/bun`, `ngrok` at `/opt/homebrew/bin/ngrok` (no cloudflared), `lsof` present. Postgres (pgvector/pg17) in Docker `dr-postgres` on **127.0.0.1:5433** (Homebrew PostgreSQL 16 without pgvector owns 5432 — never point OpenBot at 5432). Root `.env` `DATABASE_URL` already says 5433; copy it byte-for-byte, never retype it.
- OpenBot pin `3c73cf00` confirmed in `reference/openbot`; `app/vite.config.ts:84` has `host: "::"` and proxy target `http://localhost:${apiPort}`; `server/src/index.ts` `serve({...})` has no `hostname`; health route is `GET /health` on 3001; `server` scripts include `db:migrate`; `@ag-ui/core|encoder 0.0.59` are in its lockfile; tenant loader accepts `type: remote-ag-ui` with `endpoint: ${VAR:-}` and drops the agent when the endpoint is blank.

## 4. Fixture F3 (frozen at scaffold; nobody edits after 12:45)

Story values from the task brief; prices from CONTRACTS §9, stored as integer cents.

| Field | Value |
|---|---|
| `run_id` | `f3-<yyyymmdd>-<4 hex>` generated per run; naive arm uses its own run_id with `arm=naive` |
| Dates / party / budget | 2026-10-09 → 2026-10-11, party 2, budget 40000 cents USD |
| Constraint keys | `dates`, `party_size`, `budget_cents`, `accessible_required=true` (never evictable) |
| Resources | `ferry-tiburon-1009` 12000; `site-A` 8000 accessible open→**closed at world v2**; `site-B` 6000 not accessible; `site-C` 9000 accessible; `permit` 3000; `gear` 4000 |
| Slots | `ferry`, `campsite`, `permit`, `gear` |
| Crash point | `after_desk_commit` on the ferry step |
| Expected DR outcome | ferry receipt recovered (`recovered=true`), A superseded, B rejected (not accessible), C booked, permit+gear booked, total 28000 ≤ 40000, verdict VALID |
| Companion F3b (only if time) | C also closed → verdict BLOCKED `no_accessible_site_available` |

## 5. SCAFFOLD (one agent, 12:30–12:45, hard stop)

Goal: builders never touch the same file. Everything listed here is created by the scaffold agent and then **frozen**; changes after 12:45 go through the integration agent only.

**Rule:** no WP edits the root `package.json` or another package's `package.json` after scaffold. Every dependency is hoisted to the root `package.json` at scaffold; a missing dependency is requested from the integration agent.

Files (exact):

```
package.json                    # npm workspaces ["packages/*"] only (apps/console keeps its own bun lockfile per CONTRACTS §1); ALL deps hoisted here; scripts point at FINAL paths; private:true
tsconfig.base.json              # ESM NodeNext, strict, target ES2022, moduleResolution NodeNext
vitest.config.ts                # projects: packages/*/vitest.config.ts or include packages/**/*.test.ts
.gitignore                      # + apps/console/.env, apps/console/node_modules, **/*.sqlite, artifacts/, .omc/
packages/shared/package.json    # name @dr/shared, type module, exports ./src/index.ts (tsx-run; no build step)
packages/shared/src/index.ts
packages/shared/src/tables.ts   # TABLES const: epochs|constraints|facts|commitments|receipts|plan_steps|context_ops|metrics
packages/shared/src/records.ts  # zod schemas + types for every row (FINAL_PROJECT §3 columns + `rev`, `arm`)
packages/shared/src/action-key.ts # actionKey(runId, stepId, resource, date, party) = sha256 hex; argsHash(canonical JSON)
packages/shared/src/config.ts   # loadConfig(scope) zod-validated from process.env after dotenv; scopes control|runner|desk|providers|console-stub; RUNNER_ENV_ALLOWLIST
packages/shared/src/tokens.ts   # countTokens(text): {count, method:"gpt-tokenizer/o200k_base"}
packages/shared/src/fixture-f3.ts # the §4 fixture as data
packages/shared/src/status-page.ts # DOM contract + Nimble parser fields for /status.html (see below)
packages/shared/src/ports.ts    # interfaces only: RowSink, ProjectionLoader, DeskClient, Sensor, Curator, Planner, ContextComposer, AgUiMissionPort
packages/shared/src/sql.ts      # assertRunId(/^[a-z0-9-]{6,64}$/), assertEnum(); nothing else builds SQL outside packages/storage
packages/shared/test/action-key.test.ts  # tokens.test/config.test deferred to WP C
packages/{desk,storage,kernel,providers,control,runner}/{package.json,tsconfig.json,src/index.ts,scripts/not-implemented.ts}
                                # identical skeletons; the owning WP replaces src/ and adds scripts/ files
```

Root scripts already point at the **final** file paths in the owning package (e.g. `tsx packages/storage/scripts/smoke-rawtree.ts`); until the owner creates that file the script runs the package's `scripts/not-implemented.ts`, which exits 2 `NOT IMPLEMENTED`. Scripts: `check:types` (tsc -p each package --noEmit), `test:unit` (vitest run --exclude '**/*.recovery.test.ts'), `test:recovery` (vitest run packages/kernel/test/r02.recovery.test.ts), `smoke:rawtree|smoke:nimble|smoke:liquid|smoke:planner` (tsx scripts in the owning package), `dev:desk`, `dev:control`, `demo:f3`, `demo:naive`, `demo:numbers`. Every script that is not yet implemented exits 2 with `NOT IMPLEMENTED` so nobody reports a green that did not run.

Dependencies pinned at scaffold (one `npm install` at root): `typescript`, `tsx`, `vitest`, `zod`, `dotenv`, `express@5`, `@types/express`, `gpt-tokenizer`, `@ag-ui/core@0.0.59`, `@ag-ui/encoder@0.0.59`. SQLite: try `better-sqlite3` first; if its prebuilt binary does not install for Node 25 on the first attempt, use Node's built-in `node:sqlite` (`DatabaseSync`) and record the choice in WORKLOG. Do not spend more than 3 minutes on this.

Row shape decision (binding): every row carries `run_id, ts (ISO), epoch (int), rev (int), arm ("dr"|"naive")`. `rev` is a per-run monotonic integer assigned by the single writer; `rev` and `epoch` are always sent as JSON numbers. Projection = **in code**: one query per table `SELECT * FROM <table> WHERE run_id = '<validated>' ORDER BY rev, ts LIMIT 5000`; if a table returns 5000 rows fail with `RESTORE_CAPACITY` (S07 is this capacity rejection); sort by `(rev, ts)`, take the last row per key; the next `rev` is derived from the loaded rows (max+1), not from a separate `max()` query. Receipts are keyed by `receipt_id`. Live probe 12:2x: inserted rows visible at t+0.63 s; Dynamic `max(rev)` and `ORDER BY rev` behave numerically. `argMax(value, ts)` SQL is used only for the as-of/closing-numbers queries, never for restore. This honors "do not order authoritative state only with argMax(value, ts)" without inventing a checkpoint table today.

Status page DOM contract (`status-page.ts`), so WP A renders and WP C parses the same thing without talking:

```html
<h1 id="park-name">Angel Island SP — Campground Status</h1>
<span id="world-version">2</span> <time id="updated-at">2026-10-11T09:00:00Z</time>
<table id="sites">
  <tr id="site-A"><td class="site-id">A</td><td class="status">closed</td><td class="accessible">yes</td><td class="price">80</td><td class="notice">Storm damage</td></tr>
  <tr id="site-B">…</tr><tr id="site-C">…</tr>
</table>
```

Nimble parser: terminal fields `world_version`, `updated_at`, and for each of A/B/C: `site{X}_status`, `site{X}_accessible`, `site{X}_price`, `site{X}_notice` with CSS selectors `#site-{X} .status` etc. and `extractor: {type:"text"}`. Fourteen terminal fields (2 + 3 sites × 4; earlier text said eleven — corrected at scaffold), no list parser.

Ports (`ports.ts`) — signatures frozen; implementations live in the owning package:

```ts
RowSink.append(table, row) → Promise<{inserted: 1}>                 // throws AckError otherwise
ProjectionLoader.load(runId, opts?: {asOf?: string}) → Promise<Projection>
DeskClient.book(req) / lookup(actionKey) → {status:"found",receipt}|{status:"absent"}|{status:"unavailable"}
Sensor.health(host) / extractStatusPage(url) → Observation (fields + task_id + retrieval_mode "live"|"cache")
Curator.compareFact(old, obs) → {decision, new_value, reason, curator_ms, raw, promoted_by?}
Planner.decide(rendered) → {action:"book"|"cancel"|"keep"|"block", resource?, action_key?, reason}
ContextComposer.render(state) → {text, tokens:{count,method}, items:[ids]}; propose/apply context_ops
AgUiMissionPort.handle(text, threadId) → AsyncIterable<string>     // integration wires to the actor
```

`ProjectionLoader` HTTP implementation contract (runner side): control exposes `GET /internal/projection?run_id=<id>` authenticated with the per-generation `DR_RUNNER_TOKEN`. It explicitly discards control's in-memory state for that run, calls `RawTreeLoader.load(runId)`, returns `{projection, rows_loaded: {<table>: n}}` and logs `control cache invalidated; RESTORING FROM RAWTREE… N rows · epoch E` (shown on screen, because control itself survives the kill). The runner uses `HttpProjectionLoader` against it; kernel recovery still takes a `ProjectionLoader` port (R02 injects `RawTreeLoader` over `FakeRawTree`). `RAWTREE_API_KEY` never enters the child.

Acceptance for the scaffold: `npm install` exits 0; `npm run check:types` exits 0; `npm run test:unit` runs the shared tests green; `git add package.json package-lock.json tsconfig.base.json vitest.config.ts .gitignore packages && git commit` done by 12:45; WORKLOG entry with the SQLite choice.

## 6. Work packages (parallel, disjoint paths)

### WP A — desk + storage + kernel + R02 harness (deadline 2:15 PM)

Owned paths: `packages/desk/**`, `packages/storage/**`, `packages/kernel/**`.

Deliverables:

1. `packages/desk` (Express, loopback 127.0.0.1:4401): SQLite tables `world_versions, resources, action_outcomes, book_requests` partitioned by `run_id/arm`. Routes: `POST /book` (idempotent on `action_key`; inside one transaction: record attempt → existing key with identical `args_hash` returns the original outcome with `dedupeHit:true` **before** any world check → different args `409` → new key checks current resource status/version, rejects closed/stale-version with `committed:false` (recorded), else inserts outcome + receipt), `GET /actions/:key` (200 outcome / 404 authoritative absence / 503 cannot answer), `GET /status.html` (DOM contract from shared), `POST /admin/world` (operator token; set site status/notice, bump world version). **Cut now:** `/cancel`, `/time` (a fixed `sim_clock` string is used instead), `/admin/reset` (restart the desk per run; namespaces by `run_id/arm`). Second listener 127.0.0.1:4402 serving **only** `GET /status.html` (the ngrok target). `DR_WORLD_TOKEN` guards `/book`, `/actions`; `DR_OPERATOR_TOKEN` guards `/admin/*`.
2. `packages/storage`: `RawTreeSink` (plain fetch, awaits `{"inserted":1}`, throws otherwise; 8 s timeout; no retry for intents — an ambiguous intent write means "do not act, step blocked wal_unavailable"), `RawTreeLoader` (one `ORDER BY rev, ts LIMIT 5000` query per table, `RESTORE_CAPACITY` at 5000, in-code projection per §5, `asOf` filter), `MetricsWriter` (same acked path; metrics rows are not gated), `sql.ts` (fixed templates + whitelisted identifiers only), `FakeRawTree` (in-process HTTP server for tests with controllable ack/visibility). `scripts/smoke-rawtree.ts`: insert one row into `smoke`, query it back, print `inserted`, latency and row.
3. `packages/kernel`: `protocol.ts` (write-ahead: `intent` row acked → desk → `receipts` + `commitments confirmed` acked; invariants 1, 2, 4 as thrown `InvariantViolation`), `runFerryStep(deps, {holdAfterCommit})` (the ONE crash hook, used by both `r02-child.ts` and the runner: after the desk 200 and before the receipt row it logs `HOLDING AFTER DESK COMMIT pid=<pid> receipt_id=<id>` and waits up to 120 s for `/demo/kill` or a human `kill -9`; on expiry it logs `hold expired` and continues), `recovery.ts` steps 1–4 (epoch row; projection load with restored-row count; reconcile every `intent` **idempotently**: if the projection already holds a receipt for that action_key, skip the lookup and write only `commitments confirmed`; otherwise `GET /actions/:key` → found: `receipts recovered=true` + `confirmed`; 404: `not_executed`; 503/timeout: `unknown` + dependent step `blocked`; mark stale every volatile fact with `epoch < current` or expired `valid_until`), `naive-transcript.ts` (writes/reads a local `transcript.json` summary; used by the naive arm; no reconcile, no stale marking, fresh action_key from attempt number — this is the honest naive behavior), `r02-child.ts` (a real child process that calls `runFerryStep(deps,{holdAfterCommit:true})` against a given sink/desk; the R02 harness SIGKILLs it with `process.kill(child.pid,"SIGKILL")` on seeing the HOLD line — one mechanism for test and demo). Projection keys receipts by `receipt_id`; `duplicate_effects` = distinct confirmed `receipt_id`s per slot minus 1 (desk ledger is the tie-breaker).
4. Tests (reduced now): desk A01, A05; storage S05 (non-ack → no desk call); kernel invariants 1/2/4 unit tests; kernel **I2b** (second kill between the recovered `receipts` row and the `commitments confirmed` row → epoch 3 reconcile skips lookup, writes only `confirmed`, still exactly one receipt_id); **R02** `packages/kernel/test/r02.recovery.test.ts`: starts FakeRawTree + real desk on ephemeral ports, spawns `r02-child.ts` with `tsx`, waits for the `HOLDING AFTER DESK COMMIT` line, SIGKILLs the child, waits for exit, asserts `signal === "SIGKILL"` and `process.kill(pid,0)` throws ESRCH, desk has exactly one `ferry` outcome, RawTree fake has `intent` without `receipts`, then runs `recovery.ts` steps 1–4 in-process and asserts one recovered receipt with the same `receipt_id`, `book_requests` count still 1, and `commitments` latest status `confirmed`.

Acceptance (commands, all exit 0):

```sh
npm run check:types
npx vitest run packages/desk packages/storage packages/kernel --exclude '**/*.recovery.test.ts'
npm run test:recovery            # R02 real SIGKILL, new PID, one desk effect, recovered receipt
npm run smoke:rawtree            # live: prints {"inserted":1} and the queried row (no secrets)
npm run dev:desk & curl -fsS http://127.0.0.1:4401/status.html | grep -c 'id="site-A"'   # → 1
lsof -nP -iTCP:4401 -sTCP:LISTEN | grep -c 127.0.0.1                                        # → 1
```

Already cut (12:45): `/cancel`, `/time`, `/admin/reset`. Keep the 4402 feed listener (five lines; satisfies U07). Never cut: idempotent `/book`, `/actions/:key`, acked sink, recovery 1–4, R02.

Commit: `git add packages/desk packages/storage packages/kernel && git commit -m "Add desk, RawTree storage and kernel with R02 kill test"` (+ Co-Authored-By line).

### WP B — apps/console (OpenBot) + AG-UI stub (HARD GATE 1:15 PM, deadline 2:00 PM)

Owned paths: `apps/console/**`, `packages/control/src/ag-ui/**`, `packages/control/src/stub-server.ts`, `packages/control/public/board.html`.

Deliverables:

1. Export: `mkdir -p apps/console && git -C reference/openbot archive 3c73cf00efba46122dfd0447485e2b61f1d6a2cd | tar -x -C apps/console`. Record the SHA in `apps/console/EXPORT.md`. No nested `.git`. Keep `LICENSE`.
2. Loopback patches (DEVILS_ADVOCATE DA01): `apps/console/app/vite.config.ts` `host: "::"` → `host: "127.0.0.1"` and proxy target `http://127.0.0.1:${apiPort.port}`; `apps/console/server/src/index.ts` `serve({ hostname: "127.0.0.1", port, ... })`. Diff limited to those lines.
3. Tenant package `apps/console/examples/dead-reckoning/` copied from `examples/fintech` (brand/channels/knowledge/model/skills yaml kept minimal, `brand.yaml` tenant id `dead-reckoning`, product name "Dead Reckoning"), `agents.yaml` with one agent `id: dead-reckoning`, `type: remote-ag-ui`, `endpoint: ${DEAD_RECKONING_AG_UI_URL:-}`, plus the built-in general assistant. Remove the fintech risk-analyst row.
4. `apps/console/.env` (git-ignored): only OpenBot keys — `DATABASE_URL, KEY_ENCRYPTION_KEY, INTELLIGENCE_API_URL, INTELLIGENCE_GATEWAY_WS_URL, INTELLIGENCE_API_KEY, OPENBOT_SINGLE_USER=true, PORT/SERVER_PORT=3001, APP_PORT=3010, TRUSTED_ORIGINS, TENANT_PACKAGE_DIR=../examples/dead-reckoning, DEAD_RECKONING_AG_UI_URL=http://127.0.0.1:4400/ag-ui, AGENT_ENDPOINT_ALLOWED_HOSTS=127.0.0.1:4400, OPENBOT_GENERATIVE_UI=false, DR_INTERNAL_TOKEN`. Copy values with a script that reads root `.env`; never echo them.
5. First command at 12:45, before writing any file: after the export, `cd apps/console && ~/.bun/bin/bun install --frozen-lockfile` in the **background** (cold cache, 2–5 min). The env copy script copies `DATABASE_URL` byte-for-byte from root `.env` (5433; never retyped). Then `psql "$DATABASE_URL" -Atc 'select 1' >/dev/null && echo db-ok` (never echo the URL) → `bun run --filter server db:migrate && bun run dev` (background). Prove: `curl -fsS http://127.0.0.1:3001/health` → `{"status":"ok"}`; `curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/` → 200; `lsof -nP -iTCP:3001 -sTCP:LISTEN` and `:3010` show `127.0.0.1` only; a human opens `http://127.0.0.1:3010`, sees the Dead Reckoning bot in the roster and gets a reply from the stub.
6. AG-UI stub: `packages/control/src/ag-ui/handler.ts` exports `createAgUiHandler(port: AgUiMissionPort)`: parses `RunAgentInput` with zod `.passthrough()` (ignores `tools`, `context`, `forwardedProps`; does **not** require `x-openbot-agent-token`), streams `RUN_STARTED → TEXT_MESSAGE_START/CONTENT/END → RUN_FINISHED` via `@ag-ui/encoder` `encodeSSE`, maps the last user message to `port.handle(text, threadId)`. `packages/control/src/stub-server.ts` binds 127.0.0.1:4400 with a stub port that answers `Dead Reckoning control online (stub). Mission commands arrive after integration.` and `GET /health`. The integration agent replaces the stub port with the actor without touching `ag-ui/`. Control keeps `currentMission[arm]`, so AG-UI verbs `start/status/resume/kill` need no thread→mission map (a message may name a `run_id` to override).
7. **Proof panel / fallback board (built unconditionally from 1:30)**: one static file `packages/control/public/board.html` served by control at `GET /board` on 4400 (vanilla `EventSource('/events')`, ~120 lines, no build, no deps, same origin so no CORS). Renders receipts, facts (with status), plan steps, and the context-tokens table for `dr` and `naive` side by side. Contract: SSE event types `snapshot`, `row`, `worker`, `metric`. OpenBot chat stays the integrated surface if the 1:15 gate passes; if it fails, the board is the surface and WORKLOG/README say "OpenBot integration deferred; standalone board used". The WORKLOG names which surface was used in the recording.

Acceptance:

```sh
cd apps/console && ~/.bun/bin/bun run --filter server typecheck        # exit 0
curl -fsS http://127.0.0.1:3001/health                                  # {"status":"ok"}
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/        # 200
lsof -nP -iTCP:3001 -sTCP:LISTEN; lsof -nP -iTCP:3010 -sTCP:LISTEN       # 127.0.0.1 only
curl -fsS http://127.0.0.1:4400/health                                  # stub up
curl -sS -X POST http://127.0.0.1:4400/ag-ui -H 'content-type: application/json' \
  -d '{"threadId":"t1","runId":"r1","messages":[{"id":"m1","role":"user","content":"hello"}],"tools":[],"context":[],"state":{},"forwardedProps":{}}' | grep -c RUN_FINISHED   # 1
# Human: chat with "Dead Reckoning" in the browser and receive the stub reply (screenshot into artifacts/)
```

Hard gate rule: at **1:15 PM** if the browser chat with the DR agent is not answering, stop OpenBot work, make `board.html` the surface, and write the gate result in WORKLOG. Do not report the board as the OpenBot result. If OpenBot comes up later, it may be used, but the recording uses whichever was rehearsed at 3:00.

Cut first if late: tenant brand polish → nothing else (the `.env` copy stays scripted: a hand-typed `DATABASE_URL` is how 5432 sneaks in); the stub handler is required by integration.

Commit: `git add apps/console packages/control/src/ag-ui packages/control/src/stub-server.ts packages/control/public/board.html && git commit -m "Export OpenBot console with loopback patches and AG-UI stub"`. Verify `git status` shows no `apps/console/.env` or `node_modules` before committing (the export brings its own `.gitignore`; check it).

### WP C — providers (deadline 2:00 PM)

Owned paths: `packages/providers/**`.

Deliverables:

1. `nimble.ts`: `health(host)` → `POST /v1/domain-health/check {domains:[host]}`; `extractStatusPage(url)` → `POST /v2/extract {url, render:false, formats:["markdown"], parse:true, parser:{…fourteen terminal fields from shared/status-page.ts…}}`; returns `Observation {fields, task_id, status, status_code, fetched_at, retrieval_mode:"live", raw_hash}`; send `headers: {"ngrok-skip-browser-warning":"1"}` on every status-page extract (verified in `nimble-openapi.json`); assert `fields.world_version` equals the desk's current version and on mismatch retry once with `?v=<version>` appended; on non-success status throw `SourceUnverified` (never treat "site down" as "closed"). Preserve `task_id` and `metadata`. `render:false` first (static page); fall back to `render:"auto"` once if parsing is empty.
2. `curator.ts`: `compareFact(old, obs)` → `POST {DR_LIQUID_BASE_URL}/chat/completions` with the `.omc/smoke/curator.json` shape, system prompt containing the rule *"A newer observation of the same key with a strictly later observed_at SUPERSEDES the old fact. Answer conflict only when observed_at is equal and values differ."*, temperature 0.1, max_tokens 120, `response_format json_schema {decision enum, new_value, reason}`; measure `curator_ms`; `validateCuratorDecision()` in code: same key only, schema parse, scope/date check, **promotion** `conflict → superseded` when `obs.observed_at > old.observed_at` (record `promoted_by:"validator"`), reject anything else with a reason (emit a `context_ops` row proposal with `accepted:false`). `proposeContextOps(state)` via Liquid → `{evict:[ids], keep:[ids], reason}` schema — **required**: after the superseded fact lands, Liquid proposes evicting the old site-A fact and the epoch-1 raw observation stub; the validator forbids evicting any `constraints.*` key or any commitment with status `intent|unknown`, then applies it; the accepted eviction must change the next planner input's item-id set, recorded before/after in `context_ops` with `proposed_by:"liquid"`. Curator inputs are parsed fields only, never raw Nimble markdown (llama-server runs `-c 4096`).
3. `planner.ts`: `decide(renderedContext, affectedStep, candidates)` → `POST https://api.openai.com/v1/responses` with `model: DR_PLANNER_MODEL`, `store:false`, `text.format = {type:"json_schema", name:"dr_decision", strict:true, schema}`; schema: `{action: enum[book,cancel,keep,block], resource?: string, action_key?: string, reason: string}`; refuse to send if `countTokens(input) > DR_PLANNER_CONTEXT_BUDGET` (throw `ContextCapacity`); return provider `usage` separately from the local estimate. Candidate filter in code before the call: dates, party, budget, `accessible=true` when `accessible_required`; the planner only sees valid candidates, and its `book` is validated again on return (invariant 3/4 hooks are functions exported for the runner).
4. `context.ts`: `render(state)` builds the working context **from state, never appended**: constraints (pinned), unresolved commitments (pinned), confirmed receipts as one-line stubs, active non-superseded facts the remaining plan depends on, plan frontier, ≤ 8 items + instructions; returns `{text, tokens, items}`. `applyContextOps` applies validated evict/keep and returns the next render. Superseded facts are dropped from the render (they remain in RawTree).
5. Tests (fixtures under `packages/providers/test/fixtures/`): nimble parser mapping from a saved response; curator validator (F03 wrong key/date rejected; conflict promotion; superseded accepted), C01 (evict accessibility rejected), C02 (invented receipt/action_key rejected), C04 (pinned overflow → `ContextCapacity`), planner schema parse + candidate filter rejects B. Live smoke scripts, each printing ids/timings only: `smoke-nimble.ts <url>` (default `https://www.parks.ca.gov/?page_id=468` for health + extract; accepts the tunnel URL to test the status page), `smoke-liquid.ts` (the F3 A open→closed case; prints decision, `promoted_by`, `curator_ms`), `smoke-planner.ts` (F3 repair with candidates B/C → expects `book site-C`; prints action, reason, usage tokens).

Acceptance:

```sh
npm run check:types
npx vitest run packages/providers
npm run smoke:liquid      # prints decision superseded (direct or promoted_by validator), curator_ms
npm run smoke:planner     # prints {"action":"book","resource":"site-C",...} and usage
npm run smoke:nimble      # prints task_id, status success, health status for parks.ca.gov
npm run smoke:nimble -- https://<ngrok-host>/status.html   # after the human's tunnel is up: 14 parsed fields
```

Cut first if late (in order): `render:"auto"` fallback → planner `cancel` action handling (block instead) → last, and only with an on-screen `proposed_by:"rule"` label: `proposeContextOps` via Liquid. The fact-comparison call always stays Liquid.

Commit: `git add packages/providers && git commit -m "Add Nimble, Liquid curator, OpenAI planner and context composer"`.

## 7. INTEGRATION (one agent; from 12:45 against in-process fakes, module swap 2:15–3:00)

From 12:45 the integration agent builds against in-process fakes of the frozen ports (FakeDesk, FakeSink/FakeLoader, FakeSensor returning the F3 v1/v2 pages, FakeCurator, FakePlanner). **Acceptance at 1:45:** `npm run demo:f3` exits 0 against fakes with a real SIGKILL of the HELD child. 2:15–3:00 is module swap only.

Owned paths: `packages/control/**` except `src/ag-ui/**`, `src/stub-server.ts` and `public/board.html`, `packages/runner/**`, `scripts/**`, root `package.json` (sole editor after scaffold), `README.md` (new, short), `docs/implementation/WORKLOG.md` (append).

Deliverables:

1. `packages/control` (127.0.0.1:4400): mission actor (single writer: in-memory state + `RowSink` to RawTree, serialized queue, assigns `rev`), supervisor (spawns `packages/runner` with `tsx` and the **env allowlist** from shared: `NIMBLE_API_KEY, OPENAI_API_KEY, DR_PLANNER_MODEL, DR_LIQUID_BASE_URL, DR_LIQUID_MODEL, DR_WORLD_BASE_URL, DR_WORLD_TOKEN, DR_PLANNER_CONTEXT_BUDGET, DR_RUN_ID, DR_EPOCH, DR_ARM, DR_CRASH_AFTER, DR_CONTROL_URL, DR_RUNNER_TOKEN`; no RawTree, Intelligence, operator or internal tokens), `GET /internal/projection?run_id=` (see §5 ProjectionLoader contract), `POST /internal/rows` (runner → control; per-generation `DR_RUNNER_TOKEN`; control appends via the acked sink and replies only after ack — this keeps RawTree credentials out of the child and makes control the one writer), `GET /missions/:id` snapshot, `GET /events` SSE (`snapshot|row|worker|metric`), demo controls behind `DR_OPERATOR_TOKEN` and `DR_ENABLE_DEMO_CONTROLS=true`: `POST /demo/start {arm:'dr'|'naive'|'both'}` (`both` runs dr and naive in separate desk namespaces), `POST /demo/arm-crash {point}`, `POST /demo/kill` (SIGKILLs every HELD child; returns pids+signals), `POST /demo/resume` (resumes both), `GET /board` (serves `public/board.html`), `POST /demo/world {site,status,notice}` (proxies to the desk `/admin/world`). Wire `createAgUiHandler(actorPort)`: message verbs `start`, `status`, `resume`, `kill` → commands; anything else → `status` rendered as markdown (receipts with `RECOVERED FROM DESK`, facts with `superseded`, verdict, context-token table for both arms).
2. `packages/runner`: the loop. Boot → recovery steps 1–4 (kernel) → steps 5–9: revalidate only stale facts that a non-done step depends on (Nimble health → extract → curator → validator → `facts` row + `context_ops evict` of the old key), repair (`needs_repair` for steps depending on superseded facts; planner over filtered candidates; validator re-checks; write-ahead protocol executes), after each step a `metrics` row `{arm, step, epoch, context_tokens, planner_tokens_in, curator_ms, nimble_ms, duplicate_effects, stale_actions}`. **Metric contract:** `context_tokens` = `countTokens(exact Responses input string incl. instructions + schema)` measured inside `planner.decide` for BOTH arms; both arms call `planner.decide` once per step (ferry, campsite, permit, gear) in both epochs; claim wording is "bounded ≤ 6000, no monotone growth", never "flat". **Verdicts:** one code validator runs over both arms' RawTree rows at terminal; INVALID iff ≥ 2 distinct confirmed `receipt_id`s on one slot (invariant 4, printed as `duplicate_effects`) or a booking executed against a stale fact; `stale_actions` = desk rejections with reason `closed`/`stale_version`; otherwise VALID/BLOCKED with reason written to `plan_steps`/`epochs`. Do not pre-script the naive planner's choices. `--resume=transcript` arm: skips reconcile and stale marking, reloads `transcript.json`, derives action keys from attempt number, appends the transcript to its planner input (so `context_tokens` grows), still goes through the desk (which rejects closed A → counted as `stale_actions`). `DR_CRASH_AFTER=after_desk_commit` → the runner calls kernel `runFerryStep(deps,{holdAfterCommit:true})` (HOLD, not self-kill; the operator's visible `kill -9` or `/demo/kill` lands deterministically in the window).
3. `scripts/demo-f3.ts`: new desk namespace → start control (if not running) → `demo/start both` → `arm-crash after_desk_commit` → wait for `HOLDING AFTER DESK COMMIT` → `demo/kill` → wait for child exit (prints pid, signal) → assert desk has 1 ferry and RawTree has intent without receipt → `demo/world site-A closed` → `demo/resume` → wait for verdict → print recovered receipt id, Nimble task_id, curator decision, chosen site, verdict, per-step tokens. `scripts/demo-naive.ts`: same fixture, `arm naive`, prints its ledger rows honestly (used only if `both` is not green). If `both` is not green by 2:45, run naive once at 2:50 and during the recording show its rows via a live RawTree query captioned `naive arm: run <run_id> recorded <time> PT today`. README labels the naive arm "transcript-resume baseline, not the VALIDATION §6b competent comparator" and prints the INVALID rule. `scripts/closing-numbers.sql` + `demo:numbers`: `SELECT arm, max(context_tokens), sum(duplicate_effects), sum(stale_actions) FROM metrics WHERE run_id IN (...) GROUP BY arm`, `SELECT quantile(0.5)(curator_ms), quantile(0.95)(curator_ms) FROM metrics WHERE run_id='…' AND curator_ms > 0`, and the as-of query `argMax(value, ts) … WHERE ts <= T` for facts (the "what it believed before the outage" number, printed only).
4. WORKLOG entry + README with run commands, real/simulated boundary, fallback status.

Acceptance:

```sh
npm run check:types && npm run test:unit && npm run test:recovery
npm run dev:desk & npm run dev:control &
npm run demo:f3          # exits 0; prints SIGKILL + old pid, new pid, RECOVERED receipt id, task_id, superseded, site-C, VALID
npm run demo:naive       # exits 0; prints duplicate_effects 1, stale_actions 1, verdict INVALID (or the honest outcome)
npm run demo:numbers     # live RawTree query; DR max(context_tokens) <= 6000, no monotone growth; naive higher
curl -sS -X POST http://127.0.0.1:4400/ag-ui -d '<RunAgentInput with "status">' | grep -c TEXT_MESSAGE_CONTENT   # ≥ 1
ps -o pid,command | grep -c 'packages/runner'   # 0 after the verdict (children reaped)
```

Cut first if late (in order): AG-UI markdown richness (plain text ok) → `demo/world` proxy (human edits via desk `/admin/world` directly) → per-step `nimble_ms` → naive arm's planner call (naive uses the same planner; do not fake its output). Never cut: real kill, reconcile by key, live Nimble + Liquid on the edited page, metrics rows, verdict.

Commit: `git add packages/control packages/runner scripts package.json README.md docs/implementation/WORKLOG.md && git commit -m "Wire control actor, runner loop and F3 demo scripts"`.

## 8. Fallback rules (exact times)

| Time | Check | If it fails |
|---|---|---|
| 12:45 | Scaffold committed; `check:types` green | Freeze `packages/shared` as-is; builders start; integration agent fixes shared later. Nobody else edits shared. |
| 12:50 | Human: `ngrok http 4402` up; `npm run smoke:nimble -- https://<host>/status.html` returns 14 fields | Try `ngrok http 4401` with a different region; if Nimble still cannot fetch the tunnel by **1:30**, WP C adds a `direct` retrieval mode (plain fetch of the page, labeled `retrieval_mode:"direct"`), and the live Nimble proof moves to domain-health + extract of the real parks.ca.gov page. Say so on screen and in WORKLOG. Floor (b) is then "live-edited page fetched (direct), Nimble live on the public source". |
| 1:15 | OpenBot chat answers via DR stub | `board.html` (already in progress from 1:30) becomes the surface. Record "OpenBot integration deferred" in WORKLOG. |
| 1:45 | Integration `demo:f3` exits 0 against fakes with real SIGKILL | Integration drops AG-UI richness and naive-in-`both`; runs arms separately. |
| 1:45 | WP A `test:recovery` green | Only R02 matters. Integration starts against A's protocol as it stands. |
| 2:00 | `smoke:liquid` gives `superseded` (direct or promoted) | Keep the promotion path (it is code-validated and labeled); do not swap Liquid for a rule. If llama-server is down, humans restart it; the runner blocks the step with `curator_unavailable` rather than guessing. |
| 2:15 | WP A + C committed | Integration proceeds with whatever is committed; missing pieces are stubbed **and listed as not implemented** in README. |
| 2:45 | `demo:f3` green once (real modules) | Cut in §7 order. If `both` is not green, run naive once at 2:50 and show its rows in the recording via a live RawTree query captioned with its run_id and time. |
| 3:00 | Two clean rehearsals | Freeze anyway at 3:15. Record the best rehearsal path; caption anything simulated or cached. |
| 3:15 | Code freeze | No commits except WORKLOG/README text. |

## 9. Cut list (explicitly not built today)

- Privacy boundary (`constraints.private`, local-only evaluation, cloud sees booleans).
- RawTree trigger webhooks / orphan detector; `/v1/logs` panel.
- As-of **toggle** in any UI (the as-of SQL runs in `demo:numbers` only).
- Fully-local planner (LFM2.5-2.6B); Nimble agent runs with trust grades; Nimble templates/network capture.
- Hypothesis/property tests, Toxiproxy, chaos beyond the one HOLD-and-SIGKILL hook; crash points `after_intent`/`after_receipt` as demo controls (the hook supports only `after_desk_commit` today; R01/R03 are not run).
- OpenMuse `packages/task-kernel` adaptation; `THIRD_PARTY_NOTICES.md` beyond the console export note.
- CONTRACTS §4 `mission_events`/`mission_checkpoints` tables, pending-append descriptor, checkpoint dedupe (S08–S10), `DISPATCH_CLAIMED`, pause/cancel state machine (R07–R11), approvals (U04/U06), `CONTROL_RECOVERY_REQUIRED` — the cut keeps one writer + acked intents + reconcile-by-key, and states that parent loss is out of scope.
- OpenBot: signed `forwardedProps.openbotRun` verification route, authenticated DR proxy, mission route `_authed/_app/missions/$missionId.tsx`, gallery card, React mission board components, routines.
- Paired benchmark (`checkpoint-summary-v1`, M1 12-round trace, B01/C06/C07 batches); F1/F2/F4–F6 fixtures; monetary cost estimates.
- Map animation, receipt-roll/thermal UI, `+48h` overlay (a text line `sim_clock +48h SIMULATED` is printed instead).
- Permit/gear as desk effects with their own live receipts are **kept** only if they fall out of the same protocol path for free; otherwise they remain typed planned steps marked `pending` and the verdict says "valid plan, 2 steps pending" (invariant 6 forbids "all booked").
- Any deployment, tunnel of anything other than the status feed, phone operator UI.

## 10. Reporting rules for every agent today

- Run `date` before starting and before reporting; budget to your deadline.
- Report planned / implemented / tested / live-verified separately, with the exact commands and exit codes.
- Bind every listener to 127.0.0.1. Never print `.env` values; smoke scripts print ids, statuses and timings only.
- Commit only your owned paths; message subject imperative; end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Do not push. Do not commit `.env`, `apps/console/.env`, `reference/`, `node_modules`, `*.sqlite`, model files.
- Append a dated WORKLOG entry (what ran, what passed, what is blocked). Unchecked items stay unchecked without evidence.
- A fallback (board, direct fetch, rule proposer) is always named as a fallback on screen, in WORKLOG and in README.
