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

Simulated or labelled: the booking desk and the park status page are local simulations (127.0.0.1:4401/4402); the +48h clock jump is a `sim_clock` string (`SIMULATED`); Nimble parsing returns empty `data.parsing`, so the same CSS selectors are applied to the HTML Nimble fetched (`parse local-css`); Nimble domain-health returns 404 for this key and is shown as `unavailable`.

The naive arm is a transcript-resume baseline, not the VALIDATION §6b competent comparator: it reloads a local transcript, does not reconcile or revalidate, derives action keys from the attempt number, and uses the same planner and the same desk. Its verdict comes from the same code validator: INVALID if any slot has two or more distinct committed desk receipts (invariant 4), if a committed campsite is not accessible, or if the total exceeds the budget; BLOCKED if a step is not done; otherwise VALID.
