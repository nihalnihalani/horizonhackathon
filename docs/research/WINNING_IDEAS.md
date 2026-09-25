# Winning Ideas: Long-Horizon Agent Architecture (deep research, 2026-09-25)

The theme, restated: *explicit mutable state instead of ever-growing histories · agents that edit their own working context · a clear persist-vs-discard split.*
This file covers what the research says works, what past hackathons in this space rewarded, and the ranked ideas that follow from that. Local full-text copies of the sources are in this folder.

---

## 1. What the field has learned (use these facts in the pitch)

| Finding | Number to quote | Source (local file) |
|---|---|---|
| Performance drops as input grows, even on easy tasks, across **18 frontier models**. One distractor already hurts. | "context rot" | `chroma-context-rot.md` |
| Long runs derail through **forgotten orders, misread schedules and "meltdown loops"** they rarely recover from | Vending-Bench 2: best ≈ $5.5K vs ≈ $63K optimal | `vending-bench.md` |
| Task horizons are doubling fast, so the memory problem keeps getting bigger | Doubling every ~4 months; top model ≈ 14.5 h (Feb 2026) | `metr-time-horizon-1-1.md` |
| **Lossy summaries destroy exact facts.** Keep the raw log and choose what to load at use time. | Scroll: summarize-only 19.9 vs full system 73.1 on BEAM-10M | `programmatic-context-mgmt.md` |
| Agents manage context well **once they can see their own context state** (block sizes, age, budget) | VISTA: Gemini-3-Flash on LOCA-Bench **22.7% → 50.7%**; the dashboard is what drives the gain | `vista-state-proprioception.md` |
| Let the model decide **when** to compact, using a *semantic* rubric (sub-task resolved = compact; mid-derivation or stuck = hold) | SelfCompact: up to +18.1 pts, 30–70% cheaper than fixed intervals | `self-compacting-agents.md` |
| **Compaction deletes rules.** Summarizing instructions the same way as episodes is dangerous. | Claude Code /compact keeps **53% of safety rules after 1 round, 10% after 5**; typed triage keeps 96% | `compaction-cliff.md` |
| Memory as **execution-state tree** (grow / compress / maintain / revise branches), not a similarity search | MAGE: +7.8–20.4 pts success, **−55% tokens** | `mage-execution-state-memory.md` |
| Real production failures are mostly **forgetting failures, not recall failures** | ForgetEval: mutation-time hooks score 91–93% | `forgeteval-control-plane-forgetting.md` |
| Evolving "playbook" context with **delta updates** avoids *context collapse* and *brevity bias* | ACE: +10.6% agents, +8.6% finance (ICLR 2026) | `ace-agentic-context-engineering.md` |
| A model trained to **prune its own context mid-task** | Chroma Context-1: 0.94 prune accuracy, 32K pruned beats 128K noisy | `chroma-context-1-self-editing.md` |
| Agent-triggered focus/compress tools | Focus: −22.7% tokens with the same accuracy (up to −57%) | `focus-active-context-compression.md` |
| **Sleep-time compute:** a background agent rewrites memory while the main agent is idle | Letta sleep-time agents | `letta-sleep-time-compute.md` |
| Production rules | Manus: KV-cache hit rate is **the** metric (cached tokens are 10× cheaper); append-only context; mask tools rather than remove them; **reversible compression** (drop the content, keep the URL or path); recite todo.md; keep errors in context | `manus-context-engineering*.md` |
| Harness thresholds | Offload tool results over 20K tokens to a file plus a 10-line preview; truncate old calls at 85% of the window; structured compaction summaries (intent / artifacts / next steps) | `marktechpost-4-harness-mechanisms.md` |
| Caveat judges may raise | LangChain made todo middleware opt-in after its evals; ETH study: LLM-written memory files **raised** cost 20–23% | same |
| Event sourcing for agents | ESAA: an immutable log of intentions, decisions and effects, with state projected deterministically (CQRS) | `esaa-event-sourcing-agents.md` |

**Themes that recur across sources:**
1. **Remember everything, load little.** Keep a lossless log outside the prompt and a small, curated working view inside it.
2. **Typed memory.** Rules, facts, plans, episodes and scratch each need different retention, and should never share one summarizer.
3. **Make the agent aware of its own context.** Show it its budget, block sizes and ages, and give it tools to pin, evict and recall.
4. **Semantic triggers, not token thresholds.** Compact at task boundaries, not at "90% full".
5. **Forgetting is a feature you have to test.** Measure what survives compaction, not only what can be recalled.

## 2. What past hackathons in this exact space rewarded

- **Agentic Memory & Context Engineering Hackathon** (MongoDB, SF). The 6 **finalists** per the gallery (`hackathon-gallery-mongodb-memory.md`):
  - **ForgetMeNot:** real-time context about the person you're talking to, for patients with dementia
  - **contextScope:** an open-source *evaluation and observability framework* for sharing context between agents
  - **WebBrain:** browser memory that recalls things you read or watched last week
  - **Travel assistant (Airbnb):** personalized stays based on past experiences
  - **KitchenPal:** multi-RAG cooking assistant
  - **MonGOD:** seeded-RAG on-call incident copilot

  Infra-only entries like ReMem ("intelligent forgetting"), Cortext and Capsule Memory did **not** reach the finals. **Lesson: wrap the memory architecture in a concrete use case with a human story, or ship it as an eval/observability tool with numbers.**
- **AI Tinkerers "Agents with Superpowers: Context Engineering"** (Redis + Composio): 2nd place was CyberWarrior, agents coordinating over Redis Streams with durable state, on a real-time security use case.
- **Memories That Last** (MemVerge, Devpost): judged on *memory integration quality, stability/reproducibility, **transparent memory behavior in the UI**, and docs*.

**What the winning pattern looks like:** (a) a **concrete use case** built on a named memory primitive, (b) **visible** memory behavior (users can see what was kept and what was forgotten), (c) **a measurement** (before/after numbers), (d) a human story that makes the stakes obvious. Pure infrastructure with no metric, or a chat app with "memory" bolted on, does not place.

## 3. Ranked ideas for this hackathon

Scoring: **T**heme fit · **S**ponsor stack (Tinybird $3.5K pool, Nimble $2K, Liquid, BFL) · **D**emo-ability · **N**ovelty vs the research. 5 = best.

### #1. **Proprioceptive Ledger**: a typed, event-sourced agent that can see and edit its own context (T5 S5 D5 N5)
Combines the four strongest 2026 results into one visible system:
- **Event log (Scroll/ESAA) → RawTree.** Every observation, action and result is appended, and nothing is lost. The agent's `recall(sql)` tool queries its own history.
- **Typed memory (Compaction Cliff).** Separate `RULES` (never summarized, verbatim), `FACTS` (mutable key/value with provenance and confidence), `PLAN` (state tree, MAGE-style), `EPISODES` (compressible) and `SCRATCH` (discard at task boundaries).
- **Proprioception dashboard in the prompt (VISTA).** A small table of blocks with their token count, age, last use and archived status, plus the remaining budget. Tools: `pin`, `archive`, `recall`, `patch_state`, `compact(scope)`.
- **Semantic compaction (SelfCompact)** fires at sub-task boundaries. A **Liquid LFM2.5** model runs locally as the curator and writes the compressions and state patches (sleep-time style, in the background).
- **Nimble** does the web work. Its confidence-graded claims become FACTS, and only high-confidence claims get promoted.
- **Demo:**
  1. Run the same 200-step research task twice: a naive agent and Ledger.
  2. Live RawTree chart: tokens per step (the naive line climbs, Ledger stays flat) and cost.
  3. **Rule survival** after 5 compactions: naive ~10%, Ledger 100%.
  4. `kill -9` the agent, then resume it.
  5. Ask about a fact from step 12 and get an exact answer via SQL.

  This hits the theme word for word, with numbers. **Frame it as a use case, not infrastructure** (the finalist lesson above), e.g. "an analyst agent that tracks AI funding for a week and never forgets a commitment or a rule".

### #2. **Forget-Test**: a compaction and forgetting benchmark plus a guardrail (T5 S4 D5 N4)
Most teams will build an agent; this builds the **eval**, like finalist contextScope did. It's a harness that runs any agent through N compaction cycles and scores *what survived*: rules, facts, open tasks, and IDs and numbers. Results stream into RawTree, and a Tinybird endpoint gives each agent's forgetting curve. Include the "fix", typed triage, so the demo shows the failure and then the repair. It pairs well with #1: build #1 and use #2 as its scoreboard.

### #3. **Meltdown Detector**: a flight recorder that stops runs from derailing (T4 S5 D4 N4)
Vending-Bench shows that long runs die in loops and on forgotten commitments. `@rawtree/otel` traces every step. SQL triggers detect repeated tool+args, stale-fact reuse, a contradiction between STATE and a new observation, or budget spikes, then fire a **webhook back into the agent**: a "reflex" that forces a re-plan or recall. The Tinybird judges get their product as the agent's nervous system.

### #4. **Watchtower**: a multi-day web monitor with bounded memory (T4 S5 D4 N3)
Built on Nimble. It tracks a changing domain (prices, funding rounds, docs, competitors) for "days" in compressed time, keeps a FACTS table with versions (argMax in RawTree) and re-researches only what's stale or missing. The discard policy is explicit and shown. A strong fit for "Best use of Nimble".

### #5. **Sleep-time Curator on the edge** (T4 S3 D3 N4)
A local Liquid LFM2.5 model runs continuously while the big agent is idle. It consolidates episodes into playbook deltas (ACE), dedupes facts and re-ranks what's pinned. Pitch: memory maintenance costs about $0 and never leaves the device. This is aimed at the Liquid Edge AI Kit prize. It works best as a component inside #1.

### #6. **Continuity Director**: long-horizon visual consistency (T3 S3 (BFL) D5 N3)
A story/brand agent that keeps a typed "bible" STATE (characters, palette, rules) across many sessions and uses FLUX.2 multi-reference editing and FLUX 3 video continuation. Drift is measured shot by shot. Go for this only if the team wants a BFL prize.

**Recommendation:** build **#1**, with **#2's rule-survival metric** and **#3's triggers** as features. One project then covers Tinybird, Nimble and Liquid and has three hard numbers to show on stage.

## 4. Demo and pitch tactics that fit this theme

- **Compress time.** Simulate "3 days" of work in 3 minutes: a step counter, a simulated clock, and a naive baseline running side by side.
- **Always show a baseline line.** Tokens per step, cost per step and accuracy per step. Judges remember charts.
- **Show a crash and resume** with `kill -9` on stage. It proves the state lives outside the process.
- **Make forgetting visible.** Show a live panel of kept, archived and discarded blocks with reasons. ("Transparent memory behavior" was a judging criterion elsewhere.)
- **Quote one research number per claim**, e.g. "Compaction keeps 10% of rules after 5 rounds; ours keeps 100%."
- **Name the primitives:** event log, typed state, proprioception, semantic compaction. Judges from OpenAI, LinkedIn, Airbyte and Gap think in systems.
- **Pre-empt the objection** "don't LLM memory files increase cost?" (ETH study) by showing your cost per step.

## 5. Source index (local files)

manus-context-engineering.md · manus-context-engineering-2.md · cognition-dont-build-multi-agents.md · anthropic-long-running-harnesses.md · anthropic-context-engineering.md · claude-context-editing.md · claude-cookbook-context-engineering.md · chroma-context-rot.md · chroma-context-1-self-editing.md · programmatic-context-mgmt.md (Scroll) · vista-state-proprioception.md · self-compacting-agents.md · compaction-cliff.md · mage-execution-state-memory.md · ace-agentic-context-engineering.md · focus-active-context-compression.md · esaa-event-sourcing-agents.md · forgeteval-control-plane-forgetting.md · horizon-gap-survey.md · onedayagent.md · proactive-memory-agent.md · autonomous-context-curation.md · letta-sleep-time-compute.md · letta-sleeptime-agents-docs.md · vending-bench.md · metr-time-horizon-1-1.md · marktechpost-4-harness-mechanisms.md · compaction-is-a-decision.md · mem0-state-of-agent-memory-2026.md · addy-osmani-long-running-agents.md · hackathon-gallery-mongodb-memory.md · awesome-long-horizon-agents.md

---

## 6. Round 2 deep research (2026-09-25, Firecrawl + last30days)

Local copies are prefixed `r2-` in this folder.

### 6.1 New evidence

| Finding | Number to quote | Source |
|---|---|---|
| **Frontier models don't manage their own context unprompted.** Given `manage_context` and `query_memory` tools, GPT-5.5 made *near-zero* calls. Small models gain most once they are trained or nudged to manage context. | ACM (CMU, Jul 2026): 78 msgs → summary, raw 158K vs actual 2.3K tokens | `r2-acm-agentic-context-mgmt.md` |
| **Git semantics for context work.** COMMIT, BRANCH, MERGE and CONTEXT over a `.GCC/` directory (main.md roadmap, then per-branch commit.md, log.md and metadata). | GCC: >80% on SWE-Bench Verified; BrowseComp-Plus 0.834 vs 0.815 for Context-Folding | `r2-git-context-controller.md` |
| **Writing memory costs more than reading it.** Construction (prefill and embedding) dominates the memory lifecycle. That's the case for a small local curator model. | Stanford characterization of 10 memory systems on MemoryAgentBench | `r2-agent-memory-characterization.md` |
| **Background consolidation is shipping.** Mem0 Dream merges, supersedes and synthesizes memories, deletes nothing, and records every change as a state transition that points to its replacement. Letta calls the same idea "dreaming". | Mem0: "median project carries a few hundred duplicate/contradicting memories" | `r2-mem0-dream.md` |
| **Forgetting as an algorithm.** Value-tagged working memory plus sleep cycles (NREM/REM) plus a forgetting module. | SCM: 90.9% of noise removed, 100% of important facts kept | `r2-scm-sleep-consolidation.md` |
| **Chat-memory benchmarks are saturated.** Dumping everything into a 1M-token window scores competitively on LoCoMo and LongMemEval, so they can't distinguish good architectures. Evaluation has to use agent trajectories *longer than the window*. | Hindsight AMB manifesto; LongMemEval-V2 goes past 100M tokens of web-agent history | `r2-hindsight-manifesto.md`, `r2-longmemeval-v2.md` |
| **Vendor numbers don't reproduce.** | Mem0 claimed 93.4% on LongMemEval; a neutral rerun got 73.8% | `r2-landscape-q3-2026.md` |
| **Only one product can answer "what was true at time T?"** | Zep/Graphiti bi-temporal `valid_at`/`invalid_at` | `r2-landscape-q3-2026.md` |
| **Anthropic ships consolidation as an API.** Claude Managed Agents **Dreams** (`client.beta.dreams.create`) reads a memory store plus 1–100 session transcripts and writes a *new* store with duplicates merged and stale entries replaced. The input is never modified, so you review and then accept or discard. | Async job that takes minutes to hours; a research preview | `r2-claude-dreams-api.md` |
| **An agent's execution as a reversible Git trace.** Stanford **Shepherd** records every LLM call, tool call and environment change as a typed event commit. A meta-agent can observe, intercept, fork and revert a worker. | Revert 5× faster than `docker commit`; CooperBench pair-coding 28.8% → 54.7%; +12.8% over MetaHarness on Terminal-Bench 2 at 58% less wall-clock | `r2-shepherd-reversible-trace.md` |
| **A theoretical limit on compaction.** | "Context Compaction Theory" (arXiv 2608.01326), discussed on HN | `r2-last30days-compaction.md` |

### 6.2 What developers are saying (last 30 days)

Reddit could not be fetched. Firecrawl doesn't support it, ScrapeCreators is out of credit (HTTP 402), and Reddit's public JSON returns 403. The Reddit points below come from search snippets only.

- **HN, "Agent memory as a file format"** (191 pts, 96 comments): skeptical of unstructured markdown memory files ("a whole lot of text to say 'it's markdown'"). A **typed, queryable** state gets past that objection.
- **HN, "OKF Agent Memory: Git-native persistent memory"** (81 pts): Git-style memory is attracting attention.
- **YouTube:** IndyDevDan's *Self-Compact Pi Agent* (Sep 21, 30K views); *Context as a Variable: the fix for context rot (RLMs)* (75K views); PaperLens' *Context Compaction Is Deleting Your Agent's Rules*. The Agentic Enterprise quotes an agent that ended a job with 335K tokens, **96% of them documents it had already read and taken notes on**. That's a good line for the pitch.
- **Reddit snippets:** "context hits 200k, compaction fires, and it asks what timezone you're in again" (r/openclaw); a Codex issue says "compaction loses operational continuity… preserve the last N…" (r/codex); parallel sub-agents run out of context and can't be compacted (r/ClaudeCode); people's workarounds are homemade (a pre-compaction memory flush to files, an orchestrator of short-lived sub-agents).

### 6.3 What 2026 memory hackathons already did (so it won't stand out)

Galleries from Agent Memory Hack Night (Elastic + Mastra), CockroachDB × AWS and Memories That Last (MemMachine + Neo4j):
- **Crowded:** incident-response agents with vector recall (at least 5), travel or shopping agents that remember preferences, health and fitness companions with long-term memory.
- **Already done, so it's now the minimum:** memory that expires when its policy changes (CASCADE); supersession by recency (Superseded); crash-safe resume (RelayGuard, LedgerLoop); Git-inspired immutable state diffs (City-Mind); memory checkpoints you can roll back to (LifeGraph on MemVerge).
- **Not seen in any gallery:** (a) a **measured forgetting curve and rule survival** across compactions, (b) the agent **seeing its own context budget** and deciding when to compact, (c) **typed** memory where rules are never summarized, (d) point-in-time state queries over an event log in a real-time analytics DB.

### 6.4 How this changes the recommendation

The recommendation stays **#1 Proprioceptive Ledger** with #2 (Forget-Test) as its scoreboard. Round 2 suggests five changes:
1. **Add Git verbs to the Ledger:** `commit` at sub-task boundaries, `branch` for risky explorations, `merge` for the outcomes, `checkout @t` for time travel. GCC gives a SOTA citation, Stanford Shepherd shows revert/fork of execution traces (28.8%→54.7% on CooperBench), and HN shows the idea is in demand. In RawTree it's just a query over the event log.
2. **Make the context dashboard the headline.** ACM found strong models don't manage context unprompted, and VISTA found the dashboard is what drives the gain. Pitch line: *"GPT-5.5 had the tools and made ~0 calls. Show it a budget gauge and it starts managing."*
3. **Bi-temporal FACTS:** `valid_from`/`valid_to` plus `superseded_by`, following Mem0 Dream's never-delete supersession and Anthropic Dreams' *propose a new store, then review before accepting* pattern. Show the consolidation diff to the user as a reviewable change. The **"as-of" query** is something only Zep has among funded products, and it's cheap in a ClickHouse-style store.
4. **Benchmark honestly:** run on a trajectory longer than the context window (the lesson from AMB and LME-V2), publish the harness, and report accuracy, tokens, $ and latency together. Pre-empt "vendor numbers don't reproduce" by open-sourcing the harness.
5. **Frame the use case in human terms** (the finalist lesson still holds). Avoid incident response (crowded). Prefer a **week-long analyst or procurement agent**, or anything with *rules plus changing facts plus commitments*.

New idea worth a slot:
### #7. **Git for Agent Minds** (T5 S4 D5 N4)
The agent's working context is a repo. `commit` writes a structured milestone summary, `branch` explores in isolation, `merge` keeps what worked, and `revert` undoes a bad path. The log sits in RawTree and the UI is a commit graph of the agent's thinking, with a diff view that shows exactly what was forgotten at each compaction. The demo moment is `git blame` on a wrong answer, tracing it to the step where a stale fact entered. It works as a standalone project or as the UI layer of #1.
