# ASOF: the agent that knows what it knew, and when

**Sponsors (all load-bearing):** Tinybird/RawTree · Nimble · Liquid AI
**Process:** two Fable ideators (one starting from use cases, one from architecture) produced 12 candidates. A Fable devil's advocate checked every API claim against `docs/briefs/`, cut 3 ideas and merged the rest into this one.
(The working name "Hindsight" was dropped because Vectorize already sells a memory product called Hindsight.)

## Pitch (one line)
A long-running research agent whose beliefs are **bi-temporal rows in RawTree**, not a growing transcript. It **updates facts** (supersedes them, never deletes), **never forgets its rules**, and can answer *"why do you believe that, and what did you believe at step 30?"* in milliseconds.

## The story
An analyst gives the agent a week-long brief: *"Track funding for these 12 AI startups, keep a ranked brief current, and follow these 6 rules"* (e.g., "never cite a figure older than 48h", "no unverified rumor in the brief"). Halfway through, the naive agent has compacted away half its rules and still reports a $40M rumor that a primary source has since corrected. ASOF tells you exactly which page introduced the rumor, when it was superseded and by what source.

**The two-sided split between what persists and what's discarded is the pitch:**
- **Rules must never be forgotten.** They live in a typed RULES block that is never summarized.
- **Facts must be updated.** Each one is a bi-temporal row with `valid_from`/`valid_to`/`superseded_by`; nothing is ever deleted.
- **Everything else can be discarded from context** and recovered from the log.

## How each sponsor is load-bearing
| Sponsor | Role | Specific features (verified in briefs) |
|---|---|---|
| **RawTree** | The agent's memory *is* the database | `facts` table (`run_id, step, entity, path, value, valid_from, valid_to, superseded_by, source_url, trust, excerpt`); current belief = `argMax(value, step) GROUP BY entity, path`; time travel = `WHERE step <= N`; blame = one join to `events`; token slope via `simpleLinearRegression`; live scoreboard |
| **Nimble** | The web as a sensor that carries provenance | Web Search Agents with `output_schema` (claims keyed by JSON path), per-claim `trust.claims[]` (`high/medium/low`) with citations and verbatim excerpts, `agent_name` memory. **The trust grade is the persistence policy:** `high` is kept, `medium` is provisional (shown grey), `low` is discarded |
| **Liquid** | A local curator on every claim | LFM2.5-1.2B-Instruct on `llama-server --jinja` with a JSON-schema grammar emits `{decision: supersedes\|contradicts\|same, state_patch}`. It only compares **the same entity and the same path**, and trust breaks ties deterministically (high beats medium), so the model only settles real ties. P50/P95 latency is logged to RawTree |

## The demo (90 seconds, split screen: naive vs ASOF, same cached Nimble task)
1. The chart shows **context tokens per step**: naive climbs to about 120K, ASOF stays flat at about 8K.
2. **Rules alive after N compactions:** probed every 10 steps with a fixed question set, naive shows x/6 and ASOF shows 6/6. Rules are given as mid-conversation turns, so the naive agent loses them honestly and it isn't a straw man.
3. A judge asks *"why $40M?"* → **blame** → step 31, a TechCrunch page graded `medium`, superseded at step 58 by a `high` primary source. **Drag the time slider** and the belief flips on screen.
4. The closing counter reads: **"214 facts · 37 supersessions · 0 deletions · blame in 12 ms · curator P95 __ ms"**. (These numbers are illustrative placeholders; fill in the real ones from your run.)

Research lines to quote: Compaction Cliff (rules drop to 10% after 5 rounds); ACM (GPT-5.5 made about 0 context-management calls unprompted); among funded memory products only Zep supports as-of queries; Mem0 (projects carry hundreds of contradicting memories).

## Scope for 5.5 hours
| Time (PT) | Must-have |
|---|---|
| 11:00–11:30 | RawTree key plus a smoke-test insert and query; `llama-server` running with 1.2B and the grammar; **start 12 Nimble runs at `effort: low` immediately** (the default `high` takes 5–15 min), then cache the results in RawTree and never re-run them live |
| 11:30–1:15 | Fact schema, curator loop, and the argMax, time-travel and blame SQL |
| 1:15–2:30 | Naive and ASOF runners over the cached Nimble results, both writing to RawTree |
| 2:30–3:30 | Split-screen UI: scoreboard, time slider, blame panel |
| 3:30–4:00 | Record the demo video and freeze the code (the video is due by 4:00) |

**Stretch (only if the must-haves are done by 3:15):** a RawTree SQL trigger → webhook → Liquid re-plan (this needs an org-admin token and the trigger service enabled, so ask the Tinybird judges at 11:00; if that fails, fall back to client-side polling of the same SQL); `kill -9` and resume from RawTree.

**Cut on purpose:** the 350M ingest gate, embedding dedupe, Extract-span highlighting, a newsroom variant, a standalone benchmark, a standalone reflex feature.

## Risks and mitigations (from the devil's advocate)
- **The curator gets supersession wrong live** → keep comparisons to the same path, have trust break ties deterministically, and show the confusion matrix honestly.
- **Nimble is slow** → use `effort: low`, pre-warm at 11:15, replay from the RawTree log.
- **"The baseline is rigged"** → give rules as mid-history user turns and use the same compaction the naive agent would really use.
- **The RawTree Query API has no bind parameters** → build blame queries only from enum or whitelisted values.
- **The SDK is experimental** → fall back to the HTTP API.

## Rejected ideas and why
- **WIRE (newsroom):** a weaker version of ASOF; its supersessions would have to be seeded by hand.
- **DRIFT RACE:** an eval with no product. Its split-screen was kept as ASOF's demo layout.
- **REFLEX:** depends on the unverified trigger service. Kept as a stretch goal.
- **CLAUSE:** its RULES block was merged into ASOF. Running 40 vendors through Nimble would have taken too long.
