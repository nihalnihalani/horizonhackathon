# Long Horizon Agents Hack: Winning Playbook

**Fri Sep 25 2026 · AWS Builder Loft, San Francisco · hosted by tokens&**
Submission opens 11:30 AM PT · **Deadline 4:30 PM PT** · Up to 4 people per team · one project per team
Submit at: https://tokensand.com/horizonagentshack/submit (sign in with Google or an email code) · Discord: https://bit.ly/discord-17

---

## 1. The brief, in one sentence

> Long-horizon agents break down because history piles up: observations, actions and stale context. Build the architecture that fixes it: **explicit mutable state instead of ever-growing histories, agents that edit their own working context, and a clear split between what persists and what gets discarded.**

The winning project will **show that split working on screen**: a task that runs long, a context window that stays flat, and state that survives a crash.

## 2. Submission checklist (hard requirements)

- [ ] Public GitHub repo
- [ ] Short demo video with a shareable link (record it by **4:00 PM**; upload it unlisted to YouTube or Loom)
- [ ] What you built and the tools you used (name every sponsor explicitly)
- [ ] Team names and contact emails
- [ ] Optional but welcome: a live website and a project screenshot
- [ ] The project must be built during the event (start the repo after 11:00 AM so the commit history shows that)

Schedule: 9:30 doors · 11:00 kickoff · 1:30 lunch · **4:30 submission** · 5:00 finalist demos and judging · 7:00 awards

## 3. Prizes and who judges them

| Sponsor | Prize | What they want to see | Brief |
|---|---|---|---|
| **Tinybird** (via **RawTree**, their new analytics DB) | 1st **$2,000** · 2nd $1,000 · 3rd $500 (Amazon GC). **Biggest cash pool** | RawTree as the agent's event log / memory / telemetry, queried with SQL | [briefs/rawtree-tinybird.md](docs/briefs/rawtree-tinybird.md) |
| **Nimble** | 1st **$1,500** + 5K Search / 100 agent-run credits · 2nd $500 + credits | Web Search Agents, Search / Extract / Crawl, MCP, Agent Skills | [briefs/nimble.md](docs/briefs/nimble.md) |
| **Liquid AI** | 1st: Edge AI Kit + $250 | LFM models running locally / on the edge, especially small task-specific models | [briefs/liquid.md](docs/briefs/liquid.md) |
| **Black Forest Labs** | $1,000 BFL credits × 3: best FLUX **Video**, **Image** and **Action** | FLUX 3 video, FLUX.2 image editing, FLUX 3 Action (a robot / world-action model) | [briefs/bfl.md](docs/briefs/bfl.md) |
| **AWS** | host / infra | Bedrock, AgentCore Memory, Strands Agents | [aws/](docs/aws/) |
| **OpenAI** | partner (no listed prize); one judge is from OpenAI | Responses API conversation state + compaction | [openai/](docs/openai/) |
| **Broccoli** | partner (no listed prize, no docs linked) | Probably Broccoli AI (YC), which makes AI voice agents for home-service businesses. Not confirmed; ask on-site | none |

**Judges** (from the Luma page):
- Saptarshi Banerjee (Applied AI Architect, **OpenAI**)
- Viviana Márquez and Tianshu Yu (**Liquid AI**)
- Yaniv Markovski (Head of Ecosystem Eng, **Nimble**)
- Enzo Kajiya and Brian Neville-O'Neill (**Tinybird**)
- Mogana Kumaran S. (Gap)
- Amit Panda (LinkedIn)
- Tulika Manek (Razorpay)
- Pedro S. Lopez (Airbyte)

→ 5 of the 10 judges are from Liquid, Nimble or Tinybird. **Stacking those three sponsors in one project** is the highest-expected-value strategy. The judges from Gap, Airbyte, LinkedIn and Razorpay are data and infra engineers, so they will reward a clean event-sourced architecture plus real metrics.

> **Build plan:** the project is now **Dead Reckoning**; the detailed hour-by-hour plan, roles, repo layout, demo script and gates are in [docs/plan/DEAD_RECKONING_PLAN.md](docs/plan/DEAD_RECKONING_PLAN.md) (with four supporting analyses in the same folder).

> **Deep research:** see [docs/research/WINNING_IDEAS.md](docs/research/WINNING_IDEAS.md) for 2026 findings with numbers (VISTA, SelfCompact, Compaction Cliff, MAGE, Scroll), past hackathon winners in this space, and 6 ranked ideas. Its #1 idea, "Proprioceptive Ledger", extends the project below.

## 4. Recommended project: **"Ledger": an event-sourced, self-curating research agent**

A long-running research/monitoring agent whose prompt **never grows**. Everything else lives outside the prompt, is addressable, and can be recovered.

This design follows the **Scroll** paper ([docs/research/programmatic-context-mgmt.md](docs/research/programmatic-context-mgmt.md)): append-only event log + typed persistent state + eviction index. In its ablations, lossy summarization collapsed to **19.9 vs 73.1** on BEAM-10M. It also borrows Anthropic's harness pattern ([docs/research/anthropic-long-running-harnesses.md](docs/research/anthropic-long-running-harnesses.md)): a progress file + structured feature/state list + fresh context each session.

```
                ┌──────────────────────── Working view (bounded, e.g. 8K tokens) ───────────────────────┐
 user goal ──▶  │ goal · STATE.json (mutable facts/tasks/decisions) · eviction index · last N events    │ ──▶ Planner LLM
                └───────────────────────────────────────────────────────────────────────────────────────┘      (Bedrock / Claude / GPT)
                          ▲ projection                         ▲ state patches (JSON-merge)                │ tool calls
                          │                                    │                                           ▼
   ┌──────────────────────┴───────────┐   ┌────────────────────┴───────────────┐   ┌──────────────────────────────┐
   │ RawTree (Tinybird)               │   │ Liquid LFM2.5 (local, llama.cpp)   │   │ Nimble                       │
   │ • events table: append-only log  │◀──│ • "memory curator": keep/discard,  │◀──│ • Web Search Agent runs      │
   │   (every obs / action / result)  │   │   compress episodes, extract facts │   │   (claims + confidence)      │
   │ • traces table via @rawtree/otel │   │ • runs every step, ~free, offline  │   │ • Search / Extract / Crawl   │
   │ • SQL = agent's recall tool      │   │ • Embedding-350M for recall        │   │ • resumable via run_id       │
   │ • triggers → webhook on budget   │   └────────────────────────────────────┘   └──────────────────────────────┘
   └──────────────────────────────────┘
```

**How each sponsor is used:**
- **RawTree:** every step is `capture()`d. The agent's `recall(sql)` tool runs **read-only SQL over its own past**; `argMax` gives the current state out of the append-only log. `@rawtree/otel` traces every LLM call. A SQL **trigger** fires a webhook when the context budget or error rate crosses a threshold, so the agent reacts to its own telemetry. Dashboard: tokens per step (flat) vs a naive baseline (growing).
- **Liquid:** `LFM2.5-1.2B-Instruct` or `LFM2.5-2.6B` (128K) runs locally via `llama-server --jinja` as the **context curator**. After each step it emits a JSON patch: `{keep:[…], discard:[…], state_patch:{…}, headline:"…"}`. Pitch: "the big model thinks, the small model remembers, on-device, for ~$0."
- **Nimble:** the agent's hands on the web. Low/medium-effort agent runs return claims with **confidence grades**. Only `high` claims get promoted into STATE; the rest go to the log only. That is a built-in persist-vs-discard rule. `agent_id + run_id` make runs resumable after a crash.
- **Optional BFL (for a 2nd prize):** turn the agent's final STATE into a FLUX.2 image report card or a FLUX 3 draft-video "episode recap". Multi-reference editing keeps the visuals consistent across sessions. Only add this if the core is done by 3:00.

**Demo script (3 min):**
1. Give it a long task (e.g., "Track every AI-agent funding round this month and keep a ranked brief updated").
2. Show a live chart: **context tokens per step stays flat at ~8K**, while the naive agent's count climbs.
3. **`kill -9` the agent mid-run → restart → it resumes from RawTree + STATE.json** with zero lost work.
4. Ask a question about step 3 from 40 steps ago → the agent writes SQL against its own log → exact answer (no lossy summary).
5. Show the Liquid curator's keep/discard decisions and the Nimble confidence-graded claims.
6. Close on metrics: cost per step, tokens per step, recall accuracy, resume time.

## 5. Alternative ideas (if the team prefers)

1. **Agent Flight Recorder:** a drop-in `@rawtree/otel` harness + dashboard that detects context rot (repeated tool calls, stale-fact reuse, loops) in any agent. Pure Tinybird play.
2. **Watchtower:** a persistent web monitor built on Nimble. It keeps a fact table and re-researches only what changed or what has gaps. Liquid classifies the diffs.
3. **Liquid State Keeper, fully on-device:** a 128K LFM2.5-2.6B that edits its own context with explicit tools (`pin`, `evict`, `summarize_span`, `recall`). Bait for the Edge AI Kit.
4. **FLUX Continuity Director:** a long-horizon storyboard agent that keeps a character/world "bible" STATE and uses FLUX.2 multi-reference + FLUX 3 video continuation to make consistent multi-shot video over many sessions.
5. **FLUX 3 Action:** only if BFL provides a GPU and a robot on-site. A receding-horizon policy with a persistent task-state memory. Ask the BFL booth first.

## 6. Time plan (5 hours)

| Time | Milestone |
|---|---|
| 11:00–11:30 | Keys: Nimble, RawTree (`curl -fsSL https://rawtree.com/install.sh \| bash`; `rtree key create --permission read_write`), AWS/LLM. Start `llama-server -hf LiquidAI/LFM2.5-2.6B-GGUF:Q4_K_M --jinja -c 131072 -fa on -ngl 99`. Repo created. |
| 11:30–1:00 | Core loop: planner + STATE.json + event capture to RawTree + Nimble tool. |
| 1:00–1:30 | Liquid curator (JSON patch) + eviction index + `recall(sql)` tool. |
| 1:30–2:00 | Lunch. Let the agent run a long task in the background to build up history. |
| 2:00–3:15 | Dashboard: tokens/step vs baseline, state diffs, recall demo. Crash/resume path. |
| 3:15–3:45 | Optional BFL add-on. README with architecture diagram and a sponsor-usage section. |
| 3:45–4:15 | Record the demo video. Screenshot. |
| 4:15–4:30 | **Submit.** Don't leave it to 4:29. |

## 7. Gotchas worth knowing in advance

- **Nimble:** agent runs default to `high` effort (5–15 min), so pass `low`/`medium` for the demo. Fetching a result while the run is still going returns 409 (keep polling); 422 means it failed. Structured output schemas allow at most 5 levels / 100 properties. Rate limit is 83 req/s.
- **RawTree:** the query endpoint accepts read-only SQL and has **no bind parameters**, so escape or allowlist any value the agent writes into SQL. Call `shutdown()`/`flush()` before exit or the last batch is lost. The SDK is experimental. Check the real column names with `SELECT * FROM traces LIMIT 1`.
- **Liquid:** llama.cpp needs `--jinja` for tool calls; vLLM needs `--tool-call-parser lfm2`. Ollama 0.17.0 breaks on the MoE models. Use temp 0.1. The LoRA target modules are `w1,w2,w3,q_proj,k_proj,v_proj,out_proj,in_proj` (not the Llama names).
- **BFL:** auth header is `x-key`. The pattern is submit → poll `polling_url`. **Image result URLs expire in 10 min**, so download immediately. FLUX 3 video has no seed; use a draft, then render it at full quality. Video concurrency is 5 per org.

## 8. Files in this repo

```
HACKATHON_PLAYBOOK.md           ← you are here
docs/event/                     event page, Luma page (judges, speakers), gallery, submit page
docs/briefs/                    ★ build-ready briefs: setup, code, gotchas, ideas (read these)
  nimble.md · liquid.md · rawtree-tinybird.md · bfl.md
docs/sponsors/                  full raw docs (llms-full.txt dumps + OpenAPI specs), grep-able
  nimble-docs-full.txt (1.8MB) · nimble-openapi.json · nimble-index.txt
  liquid-docs-full.txt · liquid-models.md · liquid-hf.md · liquid-index.txt
  rawtree-docs-full.txt (2.2MB) · rawtree-openapi.json · rawtree-agent-skill.md · rawtree-auth.md · rawtree-sdk-ts-readme.md
  tinybird-docs-full.txt (1.5MB) · tinybird-index.txt
  bfl-docs-full.txt · bfl-index.txt
docs/event/partners.png         partner logos from Luma (OpenAI, AWS, Nimble, Liquid, Broccoli, Tinybird, BFL)
docs/aws/                       AgentCore overview + Memory (strategies, short-term, blog); Strands state,
                                session persistence, sliding-window + summarizing conversation managers
docs/openai/                    Responses API conversation state + compaction guides
docs/sponsors/bfl-openapi.json  BFL API spec (live)
docs/research/                  Scroll paper, Anthropic harness + context-engineering posts,
                                proactive memory agent, autonomous context curation, awesome list
```

Tip: point your coding agent at `docs/sponsors/*-docs-full.txt` with grep. They are the complete, current docs for each sponsor.
