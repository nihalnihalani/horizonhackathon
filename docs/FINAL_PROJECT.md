# DEAD RECKONING

**One line:** An agent that goes dark mid-mission, comes back, checks its receipts before it checks its plan, re-verifies the world through the web, evicts what died, and finishes the job without forgetting the one constraint that mattered.

**Event:** Long Horizon Agents Hack, Fri Sep 25 2026, AWS Builder Loft SF. Build 11:00–4:30 PT. Video due 4:00–4:30. Finalist demo 5:00 (90 s–3 min). 4 people.
**Sponsors (all load-bearing):** Tinybird/RawTree · Nimble · Liquid AI.
**Status:** Spec only. Nothing has been built or measured. Every number in "Baseline & metrics" is a target, not a result.

---

## 0. Judge decision (why this and not the others)

Scored the three live candidates against the four judge archetypes we expect on this panel (OpenAI architect = CTO; Liquid + Nimble + Tinybird = API evangelists; Razorpay/Gap/LinkedIn/Airbyte = BizDev and investor lenses). Filter: DEMO-ABILITY × STORY × MOSS-IS-LOAD-BEARING × UNPOPULAR-FEATURE-HOOK.

| Archetype | Dead Reckoning (merged) | Shadow Negotiator | Greenroom / Witness |
|---|---|---|---|
| API judges (unique sponsor use) | RawTree: acked write-ahead + argMax projection + as-of query over one log. Nimble: Extract with CSS parser (no LLM) + Domain Health to separate "site down" from "fact changed", trust-graded agent run for the repair search. Liquid: grammar-constrained same-key curator measured P50/P95. **5** | Liquid Audio is the star; RawTree and Nimble are supporting. **3** | Nimble Jobs interesting; RawTree/Liquid ordinary. **3** |
| CTO judges (buildable, scales) | Deterministic protocol, code validator, idempotent service, kill at any point. Buildable in 5.5 h by 4. **5** | Live voice with a judge; audio model on CPU; free-form negotiation state is hard to validate. **2** | All-day audio at a table, unpredictable input, high failure surface. **1** |
| Investor judges (market, comparables) | Durable-execution + memory is a funded category (Temporal, Letta, Zep, Mem0); the gap we name is receipts + revalidation + bounded context together. **4** | Negotiation agents are a real category but the demo proves privacy more than durability. **3** | Event concierge is not a fundable wedge. **2** |
| BizDev judges ("can I picture myself as the user?") | Everyone has had a booking go wrong; Razorpay/Airbyte judges will map it to payments and sync jobs immediately. **5** | Renters and vendors, yes; but "the judge plays landlord" can derail. **4** | Only if you attend events. **2** |
| **Total** | **19** | **12** | **8** |

**Committed (disagree-and-commit):** Dead Reckoning, with three merges that address the known critiques:
- **Live input (from Gaslight/Witness):** the campsite closure is not a fixture. It is a public status page the team controls; the team (or a judge) edits it on stage and Nimble fetches it.
- **Privacy boundary (from Shadow Negotiator), stretch tier:** the user's private constraints (accessibility need, card last-4) are evaluated only by the local Liquid model; the cloud planner sees a boolean.
- **Pull the Plug (flourish):** the kill button is live at any point in the run because the intent/result protocol makes every point safe. We also delete the local cache on restart so the restore comes purely from RawTree.

**Domain kept: camping, upgraded to Angel Island (SF Bay).** We considered payments (Razorpay), procurement (Gap), and pipelines (Airbyte). They score higher on stakes but lower on the two things that decide a 90-second demo: a map that a projector can show and a story every judge already knows in their body. The primitive is domain-agnostic; the pitch names payments and sync jobs explicitly in "Future". The stakes inside the trip are made real: a non-refundable ferry ticket, a permit window, and a wheelchair-accessible campsite requirement that the repair must honor.

**Rejected:** ASOF (visually a table), Shadow Negotiator (voice risk, no validator), Greenroom (logistics), Unlearn (deprecation is not breakage; no body-level stake), Red String (a visualization, not a product), Gaslight (a mechanism; absorbed as the live-edited page).

---

## 1. User and pain

**User:** anyone who runs an agent for longer than one process lifetime: an ops engineer with a nightly reconciliation agent, a payments team with a refund bot, a data team with a multi-hour sync, or a person who told an assistant "book my trip" and closed the laptop.

**The pain, with 2026 evidence from our research (`docs/research/`):**
- Enterprise agents collapse when runs get long: 78% of surveyed companies have pilots, 14% are at production scale, and single-task success above 80% drops to 38% or less in continuous real-world settings (Mar 2026 survey of 650, `r2-vertical-pain-points.md`).
- Compaction destroys the things that must not be forgotten: Claude Code `/compact` keeps 53% of safety rules after one round and 10% after five (`compaction-cliff.md`).
- Long runs fail through forgotten orders and misread schedules, not through missing recall (Vending-Bench 2; ForgetEval: production failures are mostly forgetting failures).
- Task horizons double every ~4 months; the top model is at ~14.5 h (METR, Feb 2026). Every multi-hour agent will be killed at least once by a deploy, a rate limit, or a lid.

**The specific failure we fix:** after a crash, an agent's transcript cannot answer the only two questions that matter: *what did I actually do?* and *what is still true?* A transcript-resume agent re-books the ferry it already paid for, then books a campsite that closed while it was offline, and forgets that the user needs an accessible site.

---

## 2. The story

A user asks for a 3-day Angel Island trip, Oct 9–11, party of 2, budget $400, **one traveler uses a wheelchair**. Four linked steps: ferry (Tiburon → Angel Island), campsite, permit, gear pickup.

The agent books the ferry. The booking desk commits it and prints a receipt. In the millisecond before the agent records that receipt, the process is killed. The simulated clock jumps 48 hours. While it is dark, someone edits the park's campground status page: **Site A (the accessible one the agent had chosen) is closed for storm damage.**

The agent restarts with nothing but RawTree. It rebuilds its state, finds an intent with no result, asks the booking desk "did action `ferry-oct9-…` happen?", and gets back the existing reservation. No second ticket. It marks every volatile fact stale, re-fetches the status page through Nimble, and the local Liquid curator says: *Site A: superseded, closed.* Site A leaves working memory (kept in RawTree). The planner repairs only the campsite step, rejects Site B (not accessible), picks Site C (accessible), and finishes. The independent validator stamps the itinerary VALID.

In a picture-in-picture corner, the naive transcript-resume agent prints a second ferry receipt in red and books the closed site.

---

## 3. Architecture

```
                 ┌──────────────────────┐
  user brief ───►│  Mission state       │◄──────── RawTree projection (argMax) on restart
                 │  (typed, mutable)    │
                 └──────┬───────────────┘
                        │ bounded working context (≤ ~6K tokens)
                        ▼
   ┌───────────┐   ┌─────────────┐   ┌────────────────┐   ┌───────────────────┐
   │ Nimble    │──►│ Liquid      │──►│ Validator      │──►│ Planner           │
   │ revalidate│   │ curator     │   │ (code, invari- │   │ (bounded actions) │
   │ + health  │   │ (JSON gram.)│   │  ants 1–6)     │   └────────┬──────────┘
   └───────────┘   └─────────────┘   └────────────────┘            │
                                                                    ▼
                 INTENT row → RawTree (await 200) → act on Booking Desk → RESULT row → RawTree (await 200)
                                                                    │
                                                    ┌───────────────┴──────────────┐
                                                    │ World server (team-owned)    │
                                                    │  /book /actions/:key /cancel │
                                                    │  /status.html (public page)  │
                                                    │  /admin/world  /admin/kill   │
                                                    │  /time (simulated clock)     │
                                                    └──────────────────────────────┘
```

### Components
| Component | Tech | Owner |
|---|---|---|
| `agent/` runner | Node 20 + TypeScript. Single-writer loop. Planner = Claude (or OpenAI) choosing from a bounded action list. | P1 |
| `agent/state` | Typed records below; projection loader; write-ahead protocol; recovery algorithm. | P1 |
| `world/` server | Express + SQLite. Booking desk with idempotency keys and its own authoritative ledger. Serves the public `status.html`. Simulated clock. Kill endpoint (SIGKILL to agent PID). Exposed via ngrok/cloudflared so Nimble can fetch it. | P2 |
| `sense/` | Nimble JS SDK: `extract` with CSS parser, `domainHealth.check`, one `agents.run` at `effort: low` with `output_schema` (stretch). | P3 |
| `curate/` | `llama-server` with `LiquidAI/LFM2.5-1.2B-Instruct-GGUF`, `--jinja`, JSON-schema constrained output. Validator in code. | P3 |
| `ui/` | Vite + React, WebSocket from the agent. Map, receipt roll, working-memory cards, offline screen, PiP naive arm. | P4 |
| `naive/` | Same runner with `--resume=transcript`: reloads last summary, no reconcile, no revalidation. | P2 |

### Data model (RawTree tables; append-only; create each with `sorting_key: "run_id, ts"`)

All rows carry `run_id`, `ts` (ISO), `epoch` (int). Current state = `argMax(value, ts) GROUP BY key`. As-of = add `WHERE ts <= T`.

| Table | Columns | Notes |
|---|---|---|
| `epochs` | run_id, ts, epoch, reason (`boot`\|`resume`), restored_rows, sim_clock | One row per process start. |
| `constraints` | run_id, ts, epoch, key, value, authority (`user`), private (bool), version | Never evicted, never summarized. `private=true` rows are only read by the local model (stretch). |
| `facts` | run_id, ts, epoch, key, value (json), source_url, observed_at, valid_until, volatile (bool), trust (`high`\|`medium`\|`low`\|`extract`\|null), status (`active`\|`superseded`\|`conflict`), superseded_by, excerpt, nimble_request_id | `trust` is Nimble's grade when an agent run produced it; `extract` when a parser produced it. Never overwritten; superseded rows point forward. |
| `commitments` | run_id, ts, epoch, action_key, kind (`book`\|`cancel`), resource, date, party, status (`intent`\|`confirmed`\|`failed`\|`not_executed`\|`unknown`\|`cancelled`), receipt_id, reversible (bool), compensates (action_key) | `intent` row is written and acked **before** the desk is called. |
| `receipts` | run_id, ts, action_key, receipt_id, outcome, service_ts, amount, recovered (bool) | Copy of the desk's authoritative result. `recovered=true` when found during reconcile. |
| `plan_steps` | run_id, ts, epoch, step_id, depends_on (array of fact keys), commitment_key, status (`pending`\|`active`\|`done`\|`needs_repair`\|`blocked`), reason | |
| `context_ops` | run_id, ts, epoch, step, op (`keep`\|`evict`\|`recall`\|`pin`), key, reason, proposed_by (`liquid`\|`rule`), accepted (bool) | The visible record of the agent editing its own context. |
| `metrics` | run_id, ts, epoch, step, phase, context_tokens, planner_tokens_in, curator_ms, nimble_ms, duplicate_effects, stale_actions | Drives the thin metrics strip and the closing slide. |

The booking desk keeps its own SQLite `actions(action_key PRIMARY KEY, resource, date, party, receipt_id, outcome, created_at)`. That table, not RawTree, is the authority on whether an effect happened.

### Persist / update / evict policy
| Data | Policy | Where |
|---|---|---|
| User constraints | Persist for the whole mission. Pinned in working context. Validator rejects any `evict` on them. | working context + RawTree |
| Commitments with status `intent`/`unknown` | Persist and pinned until resolved. Cannot be evicted. | working context + RawTree |
| Confirmed commitments + receipts | Persist. In working context as one-line stubs (key, resource, receipt_id). | working context (stub) + RawTree (full) |
| Active facts the remaining plan depends on | Persist while volatile facts pass freshness. Every volatile fact observed in a prior epoch is marked stale on resume and must be revalidated before any dependent step runs. | working context + RawTree |
| Superseded facts, cancelled commitments | Evicted from working context. Kept in RawTree with lineage; recallable by key. | RawTree only |
| Raw fetched pages, Nimble bodies | Never enter the planner prompt. Stored by hash with `nimble_request_id`. | RawTree only |
| Reasoning traces, unpromoted search noise | Discarded after the step. No recall promise. | nowhere |

Freshness: `valid_until` is a policy we set (status page: 1 h; ferry timetable: 24 h; permit rules: 7 d) unless the source states one. A high trust grade is not a proof of freshness; scope (dates, party) is checked in code.

### Intent / result write-ahead protocol (answers critique a)
1. Build `action_key = sha1(run_id + step_id + resource + date + party)`. Stable across restarts.
2. `POST /v1/tables/commitments` to RawTree with `status: intent` via plain `fetch`, **not the batching SDK**. Wait for HTTP 200 and `{"inserted":1}`. If RawTree is unreachable or returns anything else: **do not act**; mark step `blocked: "wal_unavailable"`. Fail closed.
3. Call the booking desk `POST /book {action_key, ...}`. The desk is idempotent on `action_key` and writes its own ledger before responding.
4. `POST /v1/tables/receipts` and a `commitments` row with `status: confirmed`, again synchronous and acked.
5. If killed between 3 and 4, the recovery algorithm below finds the orphan intent and asks the desk.

RawTree is the durable evidence, projection, as-of and measurement layer. It is not claimed to be a transactional store; the desk's ledger is the authority on effects. We considered a local fsync'd SQLite WAL mirrored to RawTree and chose the acked HTTP insert because it lets us delete all local state on restart and restore from RawTree alone, which is the demo.

### Recovery algorithm (on every process start)
1. Write an `epochs` row (`reason: resume` if any prior epoch exists for `run_id`).
2. Load projection: `SELECT key, argMax(value, ts) ... GROUP BY key` for `constraints`, `facts`, `commitments`, `plan_steps`. Count restored rows for the screen.
3. **Reconcile actions.** For every commitment whose latest status is `intent`: `GET /actions/{action_key}` on the desk. Found → write `receipts` row (`recovered: true`) and `commitments` row `confirmed`. Not found → `not_executed` (safe to retry with the same key). Desk unreachable → `unknown` and the dependent step is `blocked`; never infer failure from a missing receipt.
4. **Mark stale.** Every fact with `volatile=true` and `epoch < current`, or `observed_at + valid_until < sim_clock`, is marked stale in working context.
5. **Revalidate only what the remaining plan needs.** For each stale fact referenced by a `plan_steps.depends_on` where the step is not `done`:
   a. `nimble.domainHealth.check({domains:[host]})` → if the site is down, the fact stays stale and the step blocks with "source unreachable" (not "closed").
   b. `nimble.extract.run({url, render:"auto", parse:true, parser:{...css selectors...}})` → structured observation, no LLM tokens.
   c. Liquid curator receives `{old_fact, new_observation, constraints_keys}` and emits `{decision: "unchanged"|"superseded"|"conflict", new_value, reason}` under a JSON schema grammar.
   d. Validator: same key only; scope/date check; if `superseded`, write the new `facts` row, mark old row `superseded_by`, write `context_ops evict` for the old key.
6. **Repair.** Any step whose `depends_on` includes a superseded fact becomes `needs_repair`. The planner is given constraints, unresolved commitments, the affected step, and the new facts only (bounded). It chooses from `{book(resource), cancel(action_key), keep, block(reason)}`. Candidate resources come from the status page (must-have) or a Nimble agent run at `effort: low` with trust claims (stretch). Validator checks every candidate against constraints in code (dates, party, budget, **accessible=true**).
7. Execute remaining steps with the write-ahead protocol. A confirmed irreversible commitment is only replaced through a separately tracked `cancel` commitment; otherwise it is surfaced as "kept, unused".
8. After each step, Liquid proposes `context_ops` (evict transient tool output, keep stubs). Validator forbids evicting constraints or pending commitments. Working context is re-rendered from state, never appended.
9. Terminal: validator returns `VALID` (every constraint satisfied, every step has a receipt) or `BLOCKED` with a precise reason. Both are legitimate endings.

### Deterministic invariants (checked in code, not by a model)
1. No desk call without an acked `intent` row.
2. No re-execution of an `action_key` that has a success receipt.
3. No step executes while depending on a stale, unrevalidated volatile fact.
4. At most one active commitment per resource.
5. An irreversible commitment is superseded only by a compensating receipt or an explicit block.
6. Terminal state is VALID or BLOCKED with a reason; never silent success.

---

## 4. Exact role of each sponsor (verified against `docs/briefs/`)

### Tinybird / RawTree (biggest pool; two judges)
- **Write-ahead evidence:** synchronous `POST https://api.rawtree.com/v1/tables/{table}?database=deadreckoning` with `Authorization: Bearer $RAWTREE_API_KEY`, response `{"inserted":1}` [brief §3]. We explicitly avoid `@rawtree/sdk` batching for intents because "short scripts otherwise drop the last batch" [brief §7.6].
- **Projection on restart:** `argMax(value, ts) GROUP BY key`, the pattern RawTree's own CDC use case recommends [brief §5].
- **As-of:** the same query with `WHERE ts <= T`; the UI's epoch toggle shows "what the agent believed before vs after the outage".
- **Zero-schema ingest:** tables auto-create on first insert; we add `context_ops` and `metrics` mid-hack without migrations [brief §3]. Create the four core tables explicitly with `sorting_key: "run_id, ts"` (admin key, cannot be removed later).
- **Measurement:** every step writes `metrics`; the closing slide is a live `SELECT` (`quantile(0.5)(curator_ms)`, `quantile(0.95)(curator_ms)`, `max(context_tokens)`, `sum(duplicate_effects)`).
- **Unpopular-feature hooks:** as-of over an agent's beliefs; `/v1/logs` shown to the Tinybird judges to prove the acked inserts happened in order; `__raw_data` to inspect the Nimble body we stored. Stretch: a SQL trigger every 5 s on `intent rows older than 60 s with no result` → webhook "orphan detected" (needs org-admin token and trigger service; ask Enzo/Brian at 11:00 [brief §3, §7.13]).
- **Read-only, no bind params:** all SQL is built from enum/whitelisted values [brief §7.2].

### Nimble ($1.5K; Yaniv judges)
- **The change detector.** On resume, every stale fact the remaining plan depends on is re-fetched with `POST /v2/extract` (`render: "auto"`, `parse: true`, `parser` with CSS selectors → typed fields, no LLM tokens) [brief §3.2, §5.7]. The closure is discovered from a page the team edits live, fetched by Nimble; never a hardcoded event.
- **Outage vs change:** `nimble.domainHealth.check({domains})` before revalidating separates "the park site is down" from "the campsite closed" [brief §5.5]. Few teams will touch this.
- **Real grounding:** initial facts (ferry timetable, park rules) are extracted from real public pages (Angel Island–Tiburon Ferry, parks.ca.gov) at 11:15 and cached with `nimble_request_id`; live vs cached is labeled on the fact card.
- **Trust as persistence policy (stretch):** the repair search runs `nimble.agents.run({input, effort: "low", output_schema, sources: {prioritize: [...]}})`, polls on `is_active` (409 while running), and persists only `high`/`medium` claims; `low` is shown grey and discarded [brief §3.7, §4, §6]. Pre-warm one run at 11:20 and cache it as the labeled fallback.
- **Gotchas handled:** our ngrok/cloudflared host must not be on the blocked-domain list (verify at 11:10); `effort: low` explicitly (default `high` takes 5–15 min); `formats` must include `html` if we ever need it (March 2026 change).

### Liquid AI (Edge kit + $250; Viviana and Tianshu judge)
- **The curator that runs every step, locally.** `llama-server -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF -c 4096 --jinja --port 8081 --temp 0.1 --top-k 50 --repeat-penalty 1.05` [brief §3]. Every call uses `response_format: {type: "json_schema", json_schema: ...}` (llama.cpp constrained generation) [brief §4].
- **Two narrow, validatable jobs:** (1) same-key fact comparison → `{decision, new_value, reason}`; (2) per-step context edit → `{evict: [keys], keep: [keys], reason}`. Code validates every proposal; rejections are logged to `context_ops` with `accepted=false` and shown on screen, so a wrong proposal is a visible event, not a silent bug.
- **Why local, in the judges' language:** the curator is called on every step, so its cost and latency must be flat; the conv+GQA hybrid's low KV-cache pressure is the architectural reason; we log P50/P95 `curator_ms` to RawTree and show it [brief §6]. Uses LFM2.5 ids, not deprecated LFM2 ones.
- **Privacy boundary (stretch tier 1):** `constraints.private=true` rows (wheelchair need, card last-4) are only ever rendered into the local model's prompt. The cloud planner receives `candidate_ok: true/false` per campsite from the local check. "The cloud never learns why Site B was rejected."
- **Fully-local mode (stretch tier 2):** swap the planner to `LiquidAI/LFM2.5-2.6B-GGUF:Q4_K_M` with `-c 131072 -fa on --jinja`, bounded tool list per phase. Nothing leaves the laptop except the Nimble fetch and the RawTree log.

---

## 5. The screen (projector-first, not a dashboard)

Full-bleed, dark. Three zones and one overlay. No tables anywhere on the main screen.

**Center (70%): the Bay.** A high-contrast map of the north Bay: Tiburon, Angel Island, the ferry lane. Pins: a ferry glyph at Tiburon, three tent glyphs on the island (A, B, C), a small permit-kiosk glyph, a gear-shop glyph on the mainland. The plan is a glowing route line through the pins in order. Each pin has a status ring: grey (pending), blue pulse (active), green (receipted), amber "?" (stale, revalidating), red X (closed). When a fact is superseded, the red pin *slides off the route* and a new pin *snaps in*, and the route redraws with a short easing animation. That five-second redraw is the demo.

**Left (15%): the receipt roll.** A thermal-printer strip. Each booking prints a receipt stub from the top with a barcode, `action_key` (short), resource, date, amount, and a stamp: `CONFIRMED`. On recovery, the ferry receipt slides back in with a second stamp: `RECOVERED FROM DESK`. The naive arm's roll (PiP, bottom-right) prints a second ferry receipt with a red `DUPLICATE` stamp.

**Right (15%): working memory.** A short stack of cards, bounded at ~8. Constraint cards have a pin icon and a lock icon if private. Fact cards show the source favicon, an age dot (green/amber/red), and the excerpt on hover. Commitment cards are receipt stubs. When Liquid evicts, the card *flies down* into a drawer at the bottom labeled `RawTree · 217 rows` with a counter that increments. When the curator's proposal is rejected by the validator, the card shakes and stays. Users see the agent editing its own context.

**Bottom strip (thin):** four live numbers, small: `context 5.8K tokens · duplicate effects 0 · stale actions 0 · curator p95 __ ms`. Not a chart.

**Overlay: the outage.** On kill, the whole screen cuts to black with a small `NO SIGNAL` and a clock that winds forward: `+48h` (labeled SIMULATED). A card appears: `WORLD EDIT (live): Site A → CLOSED` with the URL of the status page. On restart: `RESTORING FROM RAWTREE… 14 rows · epoch 2` types out, then the map fades back in with every volatile pin wearing the amber `?`.

**PiP (bottom-right, 20%):** the naive arm, same map, greyscale, labeled `TRANSCRIPT RESUME`. It runs the same fixture and its receipts and pins are what they are.

---

## 6. 90-second demo script

| t | Beat | On screen | Spoken |
|---|---|---|---|
| 0–10 | Setup | Map, constraints cards pinned (Oct 9–11 · 2 people · $400 · **wheelchair**). | "Three-day Angel Island trip. One constraint that matters: an accessible campsite." |
| 10–22 | First action | Ferry pin turns blue, intent card appears, receipt prints `CONFIRMED`. | "It writes what it's about to do to RawTree, does it, and writes the result." |
| 22–28 | The kill | Presenter (or a judge) hits the red button. Terminal shows `kill -9 48213`. Black. `NO SIGNAL`. | "We kill it after the desk committed and before the agent recorded the receipt. The worst moment." |
| 28–38 | The world moves | `+48h`. Presenter edits the public status page live: Site A → CLOSED. Card shows the URL. | "While it's dark, the park closes the site it picked. This is a real page; we just edited it." |
| 38–50 | Restore + reconcile | `RESTORING FROM RAWTREE… 18 rows · epoch 2`. Ferry receipt slides back with `RECOVERED FROM DESK`. PiP: naive prints `DUPLICATE`. | "It comes back with nothing local. First question: what did I actually do? It asks the desk by key. One ticket, not two." |
| 50–68 | Revalidate | Pins go amber `?`. Nimble card: `extract 1.5–3.7s` (domain-health unavailable). Curator card: `Site A: superseded → closed` (`~560 ms`, n=3). Site A card flies into the RawTree drawer. Red pin slides off. | "Second question: what's still true? Nimble re-reads the page. The local Liquid model proposes what died; a code validator accepts or rejects, and here it agreed. Site A leaves working memory. It's not deleted; it's in RawTree." |
| 68–82 | Repair | Planner considers B and C. B card shakes: `not accessible`. C snaps in, route redraws. Campsite receipt prints. Permit, gear complete. | "It repairs one step. Not B. **It remembered the wheelchair.** The ferry ticket it already paid for is kept." |
| 82–90 | Verdict | Validator stamp `VALID`. Strip: `duplicates 0 · stale actions 0 · context peak ~623 / 6000`. Side-by-side naive (append-only transcript ablation): `INVALID: duplicate ferry` (it tried closed Site A; the desk rejected it). | "Receipts before plans. Revalidation before action. Memory the size of the job, not the size of the history." |

**As built (measured 13:08 and 13:15 PT, fixer note 2026-09-25).** Surfaces are the OpenBot chat stream and `/board`; the map, pins, receipt roll and drawer animations above do not exist. Machine time alone is ~85–90 s (start → both HOLD ≈ 29 s; resume → both verdicts ≈ 46–48 s), so record under VALIDATION §7's two-minute allowance. Sequence: `plan my Angel Island trip` (also resets the desk world to v1) → wait for "Both runners are holding…" → `kill` → `close site A` → `resume` → final status markdown (receipts with RECOVERED FROM DESK; tokens per planner call DR ~528/623/440/455 vs naive 485→843). The HOLD now lasts 10 min (`DR_HOLD_MS`), so narration cannot expire it. Say "does not grow with history, peak ~623 of 6000", not "flat". Fallbacks, labelled as such: `/board` and `./scripts/demo-f3.sh` in a terminal.

**Retellable moment:** "They killed it mid-booking, closed the campsite while it was dead, and when it came back it didn't double-book and it remembered the wheelchair."

If we have 3 minutes: add the as-of toggle ("what it believed before the outage") and invite a judge to press kill at a random moment.

---

## 7. Baseline and metrics (honest)

**Fixtures (frozen by 1:30):** F1 unchanged world; F2 ferry time changed; F3 campsite closed after ferry booked (the demo). Same planner, same prompts, same desk, same fault point.

**Arms:**
- **Dead Reckoning:** full protocol.
- **Transcript resume (naive):** same code, `--resume=transcript`. Reloads a summary of its last context, no reconcile, no revalidation, no typed constraints.
- **Stretch fair comparator:** checkpoint + receipts but no revalidation (isolates the revalidation benefit).

**Measured per fixture per arm (targets, not results):**
| Metric | Target for DR | Note |
|---|---|---|
| Duplicate irreversible effects in the desk ledger | 0 | Counted from the desk's table, not from agent logs. |
| Actions with a stale precondition | 0 | Validator counts. |
| Final itinerary VALID or correct BLOCKED | yes | Independent validator reads world truth. |
| Unaffected commitments retained | 1/1 (ferry) | |
| Working context tokens per step | flat, ≤ ~6K | Measured by tokenizer count of the rendered prompt. |
| Curator latency P50/P95 | measured, reported | Mac M-series, LFM2.5-1.2B Q4_K_M. |
| Recovery wall time | measured | From process start to first repaired action. |

If the naive arm ties on any fixture, the slide says so. No dollar savings, no pass rates, no latency claims until we have run it. A replay of simulated days is not proof of multi-day uptime; say that in the demo.

---

## 8. Risks and fallbacks

| Risk | Likelihood | Fallback |
|---|---|---|
| Nimble cannot fetch our ngrok/cloudflared page (blocked domain, tunnel down) | medium | Deploy `status.html` to Vercel/GitHub Pages and edit via API; last resort: labeled cached extract from 11:20. |
| Liquid curator emits wrong decision live | medium | Validator gates every proposal; rejection is a visible event. Rule-based proposer exists behind the same interface but a demo run must use Liquid (three-sponsor rule). |
| llama-server grammar flag differs from docs | low | Assistant prefill `{"decision": "` + strict JSON.parse; log schema failures. |
| RawTree insert latency makes the loop feel slow | low | Only intents/results are synchronous; facts/metrics batch via SDK with `flush()` at step end. |
| Kill lands before RawTree ack (intent never written) | by design | Then the desk was never called; step is `pending`; retry with the same key. Show it if a judge presses early. |
| Planner (cloud) picks a bad action | low | Bounded action set, validator rejects; blocked with reason is a legitimate ending. |
| Map tiles need network | n/a | Static pre-rendered map image with absolute-positioned pins; no tile server. |
| Video deadline | high stakes | Freeze code at 3:15. Record at 3:20 regardless of stretch state. |

---

## 9. Build schedule (11:00–4:30 PT, 4 people)

**11:00–11:30 all hands:** keys in `.env`; P1 publishes `schema.ts` (types + table names) in the first 15 min and nobody deviates; RawTree smoke insert+query; Nimble extract of a real parks page; `llama-server` up with a JSON-schema call; ngrok up; ask Tinybird judges about the trigger service and the RawTree↔Tinybird framing; start one Nimble agent run at `effort: low` and cache it.

| Time | P1 State & protocol | P2 World & naive | P3 Sense & curate | P4 UI & video |
|---|---|---|---|---|
| 11:30–1:00 | Write-ahead protocol with acked `fetch`; projection loader; epoch rows; recovery steps 1–4; invariants 1, 2, 4. | Express desk: `/book` idempotent, `/actions/:key`, `/cancel`, SQLite ledger; `status.html` with Sites A/B/C + accessibility flags; `/admin/world`, `/admin/kill`, `/time`; fault-injection flag `CRASH_AFTER=ferry`. | `sense/revalidate.ts`: domainHealth + extract with CSS parser for status page and ferry page; `curate/curator.ts`: grammar-constrained call, P50/P95 timing; `validator.ts`. | Vite app; static map with pins and route; receipt roll component; working-memory card stack; WebSocket event bus schema agreed with P1. |
| 1:00–2:15 | Recovery steps 5–9; planner with bounded actions; `context_ops` after each step. | Naive arm flag; kill button wired to agent PID; ngrok public URL verified fetchable by Nimble. | Wire curator into revalidation; constraint check for candidates; freeze fixtures F1–F3. | Offline overlay, `+48h` clock, restore typewriter, pin state machine, eviction fly-to-drawer animation. |
| 2:15–3:15 | End-to-end F3 with real kill, 3 clean runs; metrics rows. | Run naive arm on F3, capture outcome honestly. | Nimble agent run (stretch) for candidates; privacy boundary (stretch 1). | PiP naive; metrics strip; polish timings to the 90-s script. |
| 3:15–3:50 | Freeze. README + Devpost text + the three hard answers. | Operate kill/edit during recording. | Live query for the closing numbers. | Record video, two takes, edit. |
| 3:50–4:30 | Submit by 4:00. Rehearse live pitch twice. Stretch only if green. | | | |

**Must-have (all four in the video):** write-ahead protocol + real kill + restore purely from RawTree; reconcile by key with recovered receipt; Nimble extract of the live-edited page + domain health; Liquid curator with grammar and validator, measured; repair honoring the accessibility constraint; validator verdict; naive PiP; map/receipt/memory screen.
**Stretch, in order:** (1) privacy boundary for private constraints; (2) Nimble agent run with trust-graded candidates; (3) as-of toggle; (4) RawTree trigger orphan detector; (5) fully-local planner with LFM2.5-2.6B.

---

## 10. Pitch bookends

**First sentence:** "Every long-running agent eventually goes dark, and when it comes back its transcript can't answer the two questions that matter: what did I actually do, and what is still true?"

**Last sentence:** "Dead Reckoning lets an agent go dark and come back honest: receipts before plans, revalidation before action, and a working memory that stays the size of the job, not the size of its history."

Order for the 3-minute version: Problem → Solution → Market (payments reconciliation, data sync, ops runbooks; comparables Temporal, Letta, Zep, Mem0) → Validation (fixtures, measured numbers, ties reported) → Demo → Business model (a state contract + SDK sold to teams running multi-hour agents; usage-priced on the evidence log) → Future (compensation planning, multi-agent handover packets, fine-tuned curator via LEAP) → Team.

---

## 11. The three hardest judge questions

**1. "Isn't this just Temporal / sagas / durable execution?" (Saptarshi, OpenAI)**
Durable execution replays your code and, with service-side idempotency, gets you the receipt half of this. It does not know that a fact your plan depended on went stale while the worker was down, it does not revalidate that fact before the next activity, and it does nothing about the model's context, which is where long-horizon agents actually rot. Temporal's own docs say the effect can succeed before the worker reports completion and that idempotency is the service's job; we agree and we build on it. The contribution is the combination: action reconciliation + belief revalidation + bounded, self-edited context, as one typed state contract, with the desk's ledger and the agent's beliefs kept as separate truth sources. Temporal would be a fine host for the runner.

**2. "You're using an analytics database as a write-ahead log. Why not Postgres?" (Enzo/Brian, Tinybird)**
We are not using it as a transactional store and we say so. The gate is a synchronous, acked, single-row insert, and the desk's ledger is the authority on effects. What RawTree gives us that a row store does not, at zero setup, is one append-only log that serves three jobs: current state by `argMax` projection, as-of by `WHERE ts <= T` (what did the agent believe before the outage), and measurement (`quantile` on curator latency, duplicate counts) over the same rows, with new tables appearing mid-hack without migrations. We deliberately bypassed SDK batching for intents because of the last-batch drop, and we show the `/v1/logs` order to prove it.

**3. "Why a 1.2B local model? A frontier model could curate." (Viviana/Tianshu, Liquid; or Saptarshi)**
Three reasons. Frequency: the curator runs on every step, so its cost and latency have to be flat; that is the conv+GQA argument and we show P50/P95 on screen. Behavior: CMU's ACM work found GPT-5.5 made near-zero context-management calls when merely given the tools; a dedicated, grammar-constrained curator makes the edit happen every time, and the validator makes its mistakes visible. Privacy: the constraint that decided the repair (a wheelchair) never has to leave the laptop. The job is deliberately narrow, same-key patch decisions, which is where a small model is reliable and a validator can check it.

**Bonus, "Is the closure hardcoded?"** No. It is a public page we edit on stage; Nimble fetches it; the fact card shows the URL, request id, and time. Press the kill button whenever you like.

---

## 12. Team (4)
- **P1 State/Protocol:** RawTree, recovery, planner. Owns the pitch's architecture answers.
- **P2 World:** booking desk, status page, kill switch, naive arm. Operates the demo.
- **P3 Sense/Curate:** Nimble, Liquid, validator. Owns the sponsor-specific answers.
- **P4 Screen/Story:** UI, video, 90-second script. Presents.
