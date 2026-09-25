# Demo Design: Dead Reckoning
### Long Horizon Agents Hack · Sep 25 2026 · finalist demos 17:00 · ≤4 min

## 1. Hook and why-now

**Hook:** "Long-horizon agents don't fail because they're dumb — they fail because they forget. Dead Reckoning gives an agent a bounded working view, a typed memory it can see and edit, and a log it never loses, so it stays reliable for days, not minutes."

**Why now:** METR's own task-horizon curve is doubling every ~4 months and the best model just crossed **14.5 hours** (Feb 2026) — the memory problem gets bigger every quarter, not smaller. And Vending-Bench 2 shows what happens without an architecture for it: the best agent nets **~$5.5K against a ~$63K optimum**, dying to forgotten orders and meltdown loops it never recovers from. Dead Reckoning is the fix those two numbers are begging for.

## 2. The long-horizon task — 3 candidates, pick one

**Candidate A — AI Funding Tracker** (playbook's own idea): track every AI-agent funding round this week, keep a ranked, cited brief. Rule: never double-count a round; flag any amount that gets corrected. Weak point: abstract for a live audience — "a brief" doesn't visualize well on stage.

**Candidate B — GPU Spot-Price Sentinel (chosen).** The agent's job: *"Find the cheapest way to rent an H100 for our training run this week — but never recommend a vendor on our compliance blocklist, and never exceed budget."* A general audience gets this in 5 seconds ("find the cheapest legal option"). It needs live web research (Nimble against RunPod, Lambda, CoreWeave, Vast.ai, Together, etc.), spans a simulated 5-day price watch (compressed into ~40s of stage time via an internal step-counter clock, not real OpenBot routines — their 15-minute floor is too slow for a stage demo), has a RULE that must never be forgotten ("never select a blocklisted vendor, regardless of price"), and has a natural gotcha: mid-run, Nimble's re-search finds the *cheapest* vendor just got added to the compliance blocklist (or a blocklisted vendor's price craters below everyone else's) — the correct behavior is to keep it out of the recommendation even after 5 rounds of compaction.

**Candidate C — Apartment/Office Lease Hunter.** Same shape (price watch + hard constraint + mid-run change), less resonant with the infra-engineer judge panel (Gap, LinkedIn, Airbnb, Razorpay) than a compliance/cost story.

**Pick: Candidate B.** It is visual (a price ticker), it has teeth (a compliance rule an audience can watch survive or fail), and it plays directly to the data/infra judges who live inside vendor-blocklist and budget-cap problems every day.

## 3. Beat-by-beat script (≤4 min / 240s, target 3:30 with buffer)

Surfaces: **OpenBot** channel ("GPU Sentinel" coworker) as the primary chat/audit surface (gateway decides+records every action — this is the story judges from Gap/Airbnb/Razorpay will recognize), **OpenMuse Activity** (durable task, pause/resume, SQL-lease recovery) for the crash/resume beat, plus two custom panels built for this hack: the **Proprioception Panel** and the **Ledger**.

| Time | On screen | Presenter says | Surface |
|---|---|---|---|
| 0:00–0:15 | GPU Sentinel channel opens on a goal card: *"Cheapest legal H100 rental, budget $3.00/hr"* + a pinned RULES block (`never select blocklisted vendor`, `never exceed budget`) | "This is Dead Reckoning. One rule, one budget, five simulated days of price-watching. Watch what happens to its memory." | OpenBot channel + plan/goal card |
| 0:15–0:35 | Split-screen launches: **naive agent** (left) vs **Dead Reckoning** (right), simulated clock ticking Day 1→5 in fast-forward, a live tokens-per-step chart under each | "Same task, same model, two memory architectures." | Hero visual #1 (split token chart) |
| 0:35–1:00 | Zoom to the **Proprioception Panel** on the DR side: block sizes/ages/last-used/status, a budget gauge, and the **Liquid curator** compacting at each day boundary — naive line keeps climbing, DR line stays flat | **Hero number 1:** "Naive: 4,000 tokens on day 1, 61,000 by day 5. Ours: flat at ~6K the whole way — the curator runs locally on Liquid, for about zero dollars." | Proprioception Panel |
| 1:00–1:25 | A Nimble agent run fires live (`effort: low`), results stream in with confidence badges (high/medium/low) and citations; **high**-confidence prices get promoted into the FACTS block with provenance | "Nimble's trust report is the persist-vs-discard rule already built for us — only high-confidence claims become facts." | Ledger (kept column) + inline browser/search card |
| 1:25–1:50 | **The gotcha:** a re-search on Day 3 shows the cheapest vendor just got flagged on the compliance blocklist. The Ledger shows the FACT updated, the RULE untouched (still pinned, unsummarized) across 5 compaction cycles | **Hero number 2 (rule survival):** "Naive agent: after 5 compactions, the rule has degraded to noise — Compaction Cliff research shows this drops to ~10%. Ours: the RULES block is never touched by the summarizer. 100% survival, every round." | Ledger (RULES lane, kept/archived/discarded columns) |
| 1:50–2:10 | Presenter opens a RawTree SQL console live on stage and types a query for "what was the recommendation at step 12, before the blocklist update?" — exact answer returns instantly | "This isn't a lossy summary I'm trusting. It's SQL against an append-only log." | RawTree query console (Tinybird moment) |
| 2:10–2:35 | **THE KILLER MOMENT.** Presenter runs `kill -9` on the agent process in a terminal on stage. Restarts it. OpenMuse Activity tab shows the task resuming — plan, facts, and step counter rehydrated from RawTree + the typed-state tree, zero lost work | **Hero number 3:** "Kill it. Restart it. Resume time: under two seconds, and it didn't lose a single fact." | OpenMuse Activity tab (durable task, SQL-lease recovery) |
| 2:35–2:55 | **Audience involvement:** a judge is invited to type into the channel: *"add rule: never exceed $2.80/hr."* The agent adds it to RULES live and the recommendation card updates in front of everyone | "You just changed its rules mid-run. Watch it re-decide." | OpenBot channel (judge typing live) |
| 2:55–3:10 | Final recommendation card + a one-line metrics footer: tokens/step, cost/step, rule survival, resume time | "Flat context. Rules that survive. State that survives a crash. That's the split the brief asked for." | Recommendation card + metrics footer |

**Fallback (if live model calls are slow on stage):** every beat after 1:00 has a pre-recorded replay driven by re-playing the exact RawTree event log from a rehearsed run (`rtree query "SELECT * FROM agent_events WHERE run_id = 'demo-run-1' ORDER BY step"` piped into the same UI components). The UI cannot tell replay from live because it is reading the identical event shape — switch to replay by env flag, no code change, no visible seam.

## 4. Hero visuals — UI specs (each buildable in <60 min)

**A. Split naive-vs-DR token chart.** Two stacked recharts `<LineChart>`s sharing an x-axis (step/day), y-axis tokens-in-context. Poll `GET /v1/query` (RawTree) every 2s for `SELECT step, tokens_in_context FROM agent_events WHERE run_id=? ORDER BY step`. Naive line drawn in red trending up, DR line in green flat. Reuse OpenMuse's card/frame chrome (`apps/mobile` artifact frame styling) so it looks native, not bolted-on. ~45 min: chart component + polling hook.

**B. Proprioception Panel.** A table: `block | tokens | age | last_used | status (kept/archived)` plus a horizontal budget-gauge bar (filled % of context budget) and a small "curator: LFM2.5-1.2B-Instruct · N tok/s · local" chip in the corner. Reuse OpenBot's `/admin/audit` table layout (sortable rows, status pills) — it already has the right visual language for "action + record." ~30 min to restyle for memory blocks instead of audit rows.

**C. Kept/archived/discarded Ledger.** Three-column board (green/gray/red), one card per memory item, with a `reason` subtitle ("promoted: nimble high-confidence," "archived: sub-task resolved," "discarded: scratch at boundary"). A pinned top lane for RULES styled distinctly (locked icon, never moves columns) — visually borrow OpenBot's `/admin/boundaries` policy-rule list styling, since a RULE behaves like a policy rule: always evaluated, never summarized. ~45 min: three `<Column>` components + a `PinnedLane` variant.

## 5. Sponsor moments

- **Tinybird / RawTree:** a live SQL query typed on stage against the `agent_events`/`agent_state_patches` tables (§3, 1:50–2:10), plus a SQL trigger that fires a webhook toast on stage the moment context crosses budget — the "agent reacts to its own telemetry" moment.
- **Nimble:** confidence-graded claims (`high`/`medium`/`low`) shown inline with citations at 1:00–1:25; effort explicitly set to `low`/`medium` on stage (not the 5–15 min `high` default) so the run finishes in seconds, not minutes.
- **Liquid:** the always-visible "curator: LFM2.5-1.2B-Instruct · N tok/s · local" chip in the Proprioception Panel (running via `llama-server --jinja`), plus one explicit line in the close: "the memory manager never left the laptop."

## 6. Demo video plan (≤2 min, recorded by 16:00)

1. **0:00–0:10** Cold open on the goal card and the pinned RULE — establish the stakes in one sentence.
2. **0:10–0:35** Split-screen naive-vs-DR token chart racing across 5 simulated days (sped 4x from the live run).
3. **0:35–0:55** The gotcha: blocklist update mid-run, Ledger shows FACT changed, RULES lane untouched — rule-survival number on screen.
4. **0:55–1:15** `kill -9` → restart → OpenMuse Activity resumes in under 2 seconds — the killer moment, full length, no cuts (this is the shot judges will remember).
5. **1:15–1:35** RawTree SQL console: type a query, get an exact historical answer — Tinybird moment on screen for at least 8s so it's legible.
6. **1:35–1:55** Judge (or a stand-in during the recorded video) types a new rule live, recommendation updates.
7. **1:55–2:00** Closing card: the three hero numbers (tokens/step flat, 100% rule survival, <2s resume) plus sponsor logos named explicitly.

Record on the actual hardware that will be on stage, in the actual room if possible (network conditions matter for Nimble calls). Export at 1920×1080, captioned for sound-off viewing (Luma/YouTube autoplay muted).

## 7. Failure modes and pre-flight checklist

**Failure modes:**
- Nimble `high`-effort default eats 5–15 min if `effort` isn't explicitly set — silently ruins the live timing.
- RawTree query endpoint has no bind parameters — an unescaped value in a live-typed SQL query could 500 on stage; pre-type the query in a snippet, don't freehand it live.
- `llama-server` cold start / model download mid-demo — must be warm and resident before walking on stage.
- WiFi at the venue drops the Nimble call mid-run — this is the single biggest stage risk (see below).
- `kill -9` targeting the wrong process (or a supervisor that respawns before the crowd sees "resumed from log" happen) undercuts the killer moment — rehearse the exact PID/terminal sequence.
- OpenBot's routine floor (15 min) cannot simulate "5 days" live — confirm the simulated clock is a step-counter inside the agent loop, not a real routine, before the first rehearsal.

**Pre-flight checklist (must be done before walking on stage):**
- [ ] `llama-server -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF --jinja -c 4096` warm and answering on `:8081`; tok/s number sanity-checked live once.
- [ ] Nimble agent run pre-cached for the exact demo query at `effort: low`, with a second cached run showing the blocklist-changed variant, in case live search is slow or offline — **the fallback is the primary rehearsed path, not an afterthought.**
- [ ] RawTree: `rtree query` snippet for the "step 12" recall pre-typed in a text file ready to paste, not typed live from memory.
- [ ] The exact `kill -9 <pid>` command and terminal window pre-positioned; resume verified twice in rehearsal to land under 2s.
- [ ] The full RawTree event log from the best rehearsed run exported and loadable via `run_id=demo-run-1` as the replay fallback.
- [ ] Offline/hotspot fallback network tested — do not rely solely on venue WiFi for the Nimble call.
- [ ] Judge-interaction step (2:35–2:55) rehearsed with a stand-in typing the exact rule sentence, confirmed it parses correctly on the first try.
- [ ] Three hero numbers (tokens/step, rule survival %, resume time) locked from the best rehearsal run and hard-coded as the closing card fallback if live numbers look worse on the day.
