# Dead Reckoning

A trip-planning agent that survives `kill -9` after a booking desk commits but before the agent records the receipt. It restarts with zero local state, restores from RawTree, reconciles the orphan booking by `action_key` (no duplicate ferry), notices that the park's status page changed while it was dead (Nimble), has a local Liquid model supersede the stale fact, repairs only the campsite step (Site C, accessible, instead of closed Site A or inaccessible Site B), and a code validator stamps the verdict. A naive "transcript resume" arm runs the same fixture beside it.

Design docs: [AGENTS.md](AGENTS.md), [docs/FINAL_PROJECT.md](docs/FINAL_PROJECT.md), [docs/implementation/](docs/implementation/) (CONTRACTS, VALIDATION_AND_DEMO, WORKLOG).

## Run it

Prereqs: root `.env` (git-ignored; see `.env.example`), `npm install`, llama-server with LFM2.5-1.2B on 127.0.0.1:8081, and (for Nimble to reach the status page) `ngrok http 127.0.0.1:4402`. Control auto-detects the ngrok tunnel; without it the runner falls back to a plain fetch of `http://127.0.0.1:4402/status.html` and labels it `FALLBACK direct fetch (NOT Nimble)` in every log line.

```sh
./scripts/demo-f3.sh          # starts desk (4401/4402) and control (4400) if needed, runs fixture F3 end to end, exits 0 on 11/11 checks
npm run demo:numbers          # live RawTree closing numbers for the last demo (scripts/closing-numbers.sql)
npm run demo:naive            # the naive arm alone
npm run check:types && npm run test:unit && npm run test:recovery
```

Surfaces:
- OpenBot console (integrated surface): `cd apps/console && bun run dev`, open http://127.0.0.1:3010, chat with the Dead Reckoning agent. Verbs: `plan my Angel Island trip` (starts both arms, streams until both HOLD), `kill`, `close site A`, `resume` (streams until verdicts), anything else → status.
- Proof panel: http://127.0.0.1:4400/board (SSE from control; side-by-side arms, receipts, site-A fact, per-call token bars; demo buttons need the operator token).
- HTTP demo controls (Bearer `DR_OPERATOR_TOKEN`, `DR_ENABLE_DEMO_CONTROLS=true`): `POST /demo/{reset,start,kill,world,resume}`; `GET /missions`, `GET /events`.

## What is real and what is simulated

Real: the SIGKILL (the supervisor kills the held child; a new pid resumes), RawTree as the only durable state (runner writes go through control's acked single writer; the child never holds the RawTree key), the desk's idempotent booking and ledger, Nimble `/v2/extract` of the live status page through the ngrok tunnel, the Liquid LFM2.5-1.2B curator on llama-server, the OpenAI planner (`DR_PLANNER_MODEL`), token counts (o200k) and provider-reported input tokens.

Simulated or labelled: the booking desk and the park status page are local simulations (127.0.0.1:4401/4402); the +48h clock jump is a `sim_clock` string (`SIMULATED`); Nimble parses the 14 status fields server-side (`parse nimble`); if its parsing is ever incomplete, the same selectors run locally on the HTML Nimble fetched (`parse local-css`).

The naive arm is a transcript-resume baseline, not the VALIDATION §6b competent comparator: it reloads a local transcript, does not reconcile or revalidate, derives action keys from the attempt number, and uses the same planner and the same desk. Its verdict comes from the same code validator: INVALID if any slot has two or more distinct committed desk receipts (invariant 4), if a committed campsite is not accessible, or if the total exceeds the budget; BLOCKED if a step is not done; otherwise VALID.

## Full-plan branch (`full-plan`)

This branch closes most of the gap to [IMPLEMENTATION_PLAN.md](docs/implementation/IMPLEMENTATION_PLAN.md). Status and evidence are in [WORKLOG.md](docs/implementation/WORKLOG.md) and [FULL_PLAN_WAVES.md](docs/implementation/FULL_PLAN_WAVES.md).

- **Canonical events.** Every canonical write is first a typed `mission_events` event in RawTree (acked and query-visible), with a checkpoint after each commitment outcome. Restore is latest valid checkpoint ≤ watermark + contiguous events; gaps, conflicting duplicates and unresolved ambiguous appends block. The row tables are derived mirrors.
- **Mission API** (Bearer `DR_INTERNAL_TOKEN` + `x-dr-actor-id`, or the operator token): `POST /missions`, `GET /missions/:id`, `POST /missions/:id/{resume,pause,cancel}` (commandId + expectedRevision), approvals, evidence and per-mission SSE. Operator-only: `POST /demo/:id/arm-crash {point}` with `after_intent | after_claim | after_desk_commit | after_receipt | desk_response_lost`.
- **Effects.** Visible intent → actor-serialized `DISPATCH_CLAIMED` → desk POST. Cancel before the claim means no POST; a claim before cancel settles and is recorded. After a runner exit, pausing/cancelling reconciles by lookup only and never resends.
- **OpenBot.** An authenticated proxy (`/api/dead-reckoning/missions*`) and a mission screen (`/missions/$missionId`). A service-token `verify-run` route checks the signed `forwardedProps.openbotRun`; the AG-UI check is enforced when `DR_REQUIRE_AGUI_ASSERTION=true`.
- **`packages/task-kernel`** holds the OpenMuse-derived guard and exact-binding approvals (see `THIRD_PARTY_NOTICES.md`).
- **Benchmark.** `npm run bench:paired -- --planner=live --curator=live` runs the frozen M1 12-round memory trace through DR and `checkpoint-summary-v1` under one manifest (B01). Results are in `docs/results/<batch>/`.
- **Scripts.** `npm run dev:core`, `demo:doctor`, `check:lint`, `test:integration`, `test:recovery` (all real-subprocess recovery tests), `test:e2e` (live mission REST path) and `test:smoke:live` (fails on missing prerequisites).

The naive arm now goes through the same dispatch claim. After the crash it is refused `SLOT_BUSY` on the ferry instead of double-booking. That matches VALIDATION §6: both arms keep the safety machinery, and the difference shows up as refused or stale actions and planner-input growth.

### Operating the demo from a phone

Control stays on 127.0.0.1. `npm run demo:phone` starts an allowlisted gateway on 127.0.0.1:4410, and a tunnel exposes only that gateway: `cloudflared tunnel --url http://127.0.0.1:4410`.

- **What the gateway forwards:** `/board`, `/events`, `/scorecard` and `POST /demo/{session,reset,start,kill,world,resume}`. Every other path returns 404 and never reaches control. That includes `/internal/*`, `/missions*`, `/ag-ui` and OpenBot.
- **Auth:** the operator buttons need the operator token. The event stream and scorecard need the HttpOnly SameSite=Strict session cookie.
- **Brute-force limit:** a client that fails auth 10 times within a minute is blocked for 5 minutes.
- **On the phone:** open `https://<tunnel>/board` and paste the operator token once.
- **Afterwards:** stop the tunnel after the demo. Never tunnel 4400, 3001, 3010 or `scripts/openbot-public-proxy.mjs`.
