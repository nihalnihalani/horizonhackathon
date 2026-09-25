# Sponsor feasibility refresh — 2026-09-25

**Recommendation:** build one adaptive mission with **Tinybird/RawTree + Nimble + Liquid AI**. The compelling operation is: a source changes → invalidate only the dependent plan steps → produce a repaired plan → restart the process and continue from a checkpoint. The dependency graph, invalidation rules, context budget and recovery protocol are our software; the sponsors supply complementary capabilities.

Read the three existing sponsor briefs, ASOF proposal and hackathon playbook first. Then freshly scraped six official pages through Firecrawl with `--max-age 0`; inspected all six. The sixth page followed a link on Liquid's main deployment page to confirm the precise JSON interface. No sponsor credentials or runtime were tested, so this is documentation-level feasibility, not a working integration claim.

## Exactly three sponsor roles

| Sponsor | Documented capability | Minimal use in this project | Boundary |
|---|---|---|---|
| **Tinybird / RawTree** | Ingest JSON/JSONL, automatically create tables, query with read-only SQL, recover original payload through `__raw_data` | Store versioned observations, decisions and complete checkpoints; query prior evidence and reconstruct a selected mission version; derive live run metrics | An analytics event store is not a transactional mutable object store. The examined pages do not promise compare-and-swap, multi-row atomic commits or exactly-once effects. |
| **Nimble** | Web Search Agents return per-claim citations, excerpts, source classifications and grades; structured claims use JSON paths | Fetch the initial source bundle and an updated source; preserve URL, fetch time, excerpt and relevant dates alongside each claim | Grades describe evidence rules. A primary source can be outdated; a newer observation can describe a different period or scope. |
| **Liquid AI** | Local `llama-server`, LFM2.5-1.2B-Instruct GGUF, OpenAI-compatible API; JSON-schema/GBNF constrained generation | Given a small observation plus candidate facts, emit typed claim/relationship proposals and a short repair explanation | Grammar controls syntax, not correctness. Validate IDs, allowed paths and business rules in code before committing state. |

Sources: [RawTree ingest](https://rawtree.com/docs/guides/ingest-data), [RawTree query](https://rawtree.com/docs/guides/query-data), [Nimble trust](https://docs.nimbleway.com/nimble-sdk/web-search-agents/trust), [Liquid local inference](https://docs.liquid.ai/deployment/on-device/llama-cpp), [Liquid structured output](https://docs.liquid.ai/deployment/on-device/llama-cpp/structured-output).

## State and recovery that can actually be built

Use a **single-writer runner**. Keep explicit current state locally in SQLite, or one atomically replaced JSON checkpoint, and append versioned evidence/checkpoints to RawTree. RawTree must participate in the agent loop: retrieving the evidence behind a task and loading an acknowledged checkpoint is a real state function, beyond displaying traces.

Use stable `mission_id`, `event_id`, `version`, `schema_version` and `checkpoint_id`. A complete checkpoint contains active constraints, facts, plan nodes, dependency edges and the last committed input cursor. Persist pending Nimble run IDs. An interrupted request may be retried; use the same event ID, deduplicate on read and distinguish requested/completed work. Never claim that a remote side effect happened once merely because its log row exists.

For the demo, verify a complete checkpoint is queryable before showing it as recoverable. Restart from that acknowledged checkpoint, consume only later inputs, and demonstrate no duplicate **committed plan steps** for this controlled single-writer run. A local durable outbox is useful if RawTree writes fail. Do not attempt distributed writers, distributed transactions, arbitrary action retries, or a universal agent framework in five hours.

Represent a fact as a claim with provenance and temporal scope, not merely a scalar overwrite. Match entity + property + scope; keep `observed_at` separate from any source-stated `valid_from`. Missing effective dates remain unknown. A contradiction can remain unresolved. Downstream graph invalidation is a deterministic reachability calculation; the LFM proposes the interpretation, while code controls transitions.

Keep a measured context cap containing mission goal, invariant rules, affected subgraph, a bounded recent observation and pointers to cold evidence. An 8K target is a design choice, not a measured result. Raw archives can grow while the active working context stays bounded.

## Latency and model choices

Nimble documents **typical**, not guaranteed, times: `low` 10–30 seconds, `medium` 1–3 minutes, default `high` 5–15 minutes. Start initial research early. Use one small `low` update live if it succeeds within the demo window, and retain a visibly labelled recorded replay. Do not claim accelerated scenario steps are days of autonomous operation. [Effort levels](https://docs.nimbleway.com/nimble-sdk/web-search-agents/efforts)

Use **one Liquid model**, LFM2.5-1.2B-Instruct via llama-server, with a small response schema. Structured output uses `response_format: {type: "json_schema", json_schema: {name, schema}}`. Liquid notes unsupported schema keywords may be ignored, so run application validation. Establish a working local request in the first 30 minutes and measure P50/P95 on the actual laptop. Skip embeddings, ColBERT, multiple curators and fine-tuning. [Structured output](https://docs.liquid.ai/deployment/on-device/llama-cpp/structured-output)

## Claims to correct in existing proposals

1. **“High confidence = truth / verified fact.”** Nimble's grade follows source rules, including a primary source or secondary sources from different domains. This does not establish temporal validity or actual independence. Replace unconditional `high > medium` overwrite with provenance, freshness and scope checks; preserve conflicting evidence. The existing ASOF and playbook promotion rules overstate what the grade proves.
2. **“Local = free.”** Local inference can avoid a hosted per-token charge; it still consumes hardware, memory, energy and engineering time. The playbook's “~free” / “~$0” wording needs this correction.
3. **“Zero lost work / exactly once.”** Restrict recovery claims to acknowledged checkpoints and observed behavior. Existing RawTree briefs already warn that trigger delivery is at least once. Do not interpret a `query_id` as an idempotency guarantee.
4. **“Milliseconds / 12 ms blame / 8K vs 120K.”** These are targets or illustrative placeholders until measured. RawTree supports the required query shape; that does not establish latency on this run.
5. **Old hardware numbers applied to the chosen model.** Liquid's current llama.cpp page still shows 122 decode tok/s on Mac Mini M4 for **LFM2-1.2B-Q4_0**, selecting best prefill and decode separately. It does not benchmark the proposed LFM2.5 model, constrained output, this laptop, or end-to-end curator latency.
6. **“Only Zep has as-of queries” or fixed paper benchmark numbers as universal facts.** Those are time-sensitive competitor/research assertions outside this sponsor verification. Remove them from the pitch unless another research pass freshly verifies scope and methodology.
7. **Bi-temporal rows with mutable `valid_to` on a read-only query API.** Append a supersession event/new version and derive validity in a projection, or store complete immutable snapshots. Do not imply SQL UPDATE is available through RawTree's query endpoint.

## Five-hour cut

| Time | Deliverable |
|---|---|
| 0:00–0:30 | Three integration smoke tests: RawTree insert/query; local Liquid schema response; one Nimble source bundle. Save actual returned shapes. |
| 0:30–1:30 | Typed mission state and dependency graph; deterministic invalidation; one versioned checkpoint and restore path. |
| 1:30–2:30 | Liquid claim proposal → validation → state commit; Nimble evidence update; bounded context assembler; RawTree recall and version lookup. |
| 2:30–3:30 | Visible mission map: judge changes one constraint; only affected branches turn invalid; agent repairs them with evidence. |
| 3:30–4:15 | Kill/restart at a known checkpoint; duplicate-input check; context count, recovery time and actual local model latency. |
| 4:15–5:00 | Record the 90-second demonstration, clearly mark replay, explain limits, polish submission. |

The success criterion is **correct selective repair and recovery under a changed fact**, with measured bounded working context. This is stronger and more reviewable than a dashboard claiming the agent remembers everything.

## Saved evidence

- `.firecrawl/refresh-rawtree-ingest.md`
- `.firecrawl/refresh-rawtree-query.md`
- `.firecrawl/refresh-liquid-llamacpp.md`
- `.firecrawl/refresh-liquid-structured.md`
- `.firecrawl/refresh-nimble-trust.md`
- `.firecrawl/refresh-nimble-efforts.md`
