[Skip to content](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3#VPContent)

On this page

![](https://mnemoverse.com/docs/og/library-ai-memory-solutions-2026-q3.png)

Edward Izgorodin·Published Jul 21, 2026Updated Aug 6, 2026

# Five AI memory systems, five different definitions of memory [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#five-ai-memory-systems-five-different-definitions-of-memory)

> **TL;DR**
>
> - Mem0, Letta, Zep/Graphiti, Cognee, and Supermemory make five different architectural bets on what agent memory is. They are not interchangeable storage layers.
> - The first decision is integration posture: drop-in API, agent runtime, graph library, data pipeline, or managed context engine. Self-host reality is often worse than the license label suggests.
> - Only Zep/Graphiti offers native bi-temporal validity windows, the sharpest technical divider here.
> - Vendor benchmark numbers do not survive reproduction — Mem0's LongMemEval figure fell to 73.8% under Maximem's harness (Maximem is itself a memory vendor). Always ask for the harness, and who runs it.

An agent memory choice starts before retrieval quality. It starts with a boundary question: how much of the application should the memory system own?

Choosing a memory layer for an AI agent in mid-2026 means picking an architecture, not just a feature list. Five funded systems — Mem0, Letta, Zep/Graphiti, Cognee, and Supermemory — each answer the boundary question differently.

Mnemoverse, itself a memory vendor and not one of the five systems compared here, publishes this dated Q3 2026 edition of a recurring comparison. Repository metrics are snapshots from July 20, 2026, and a future edition will supersede it. For the wider market — platform memory from OpenAI, Anthropic, Google, and Microsoft, plus the funding picture — see the parent [AI memory landscape 2026](https://mnemoverse.com/docs/research/ai-memory-landscape-2026).

**Correction, 2026-08-03:** an earlier version of this page said Mem0's self-editing pipeline resolves conflicting facts on write, and that OSS graph memory runs over Neo4j or Memgraph. Both describe the pre-v3 algorithm; Mem0's current OSS extraction is ADD-only and its external graph-store drivers were removed in SDK v2.0.0 ( [migration notes](https://docs.mem0.ai/migration/oss-v2-to-v3), [v2.0.0 release](https://github.com/mem0ai/mem0/releases/tag/v2.0.0)). See [agent memory deduplication](https://mnemoverse.com/docs/library/agent-memory-deduplication) for the code-level reading.

If you are new to the category, [AI agent memory](https://mnemoverse.com/docs/library/ai-agent-memory) explains what these systems actually store and recall.

## Five AI memory systems at a glance [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#five-ai-memory-systems-at-a-glance)

**Agent memory** is persistent knowledge an AI system can store, retrieve, update, and verify across sessions instead of rebuilding context from scratch. These five systems implement it in five different shapes:

- **Mem0** extracts and edits facts across user, session, and agent scopes, then fuses semantic, BM25, and entity signals on retrieval.
- **Letta** (formerly MemGPT) runs an agent with tiered, self-managed memory blocks that the model edits through tools.
- **Zep/Graphiti** stores facts inside a bi-temporal knowledge graph, tagging each with when it became true and when it stopped being true.
- **Cognee** runs an Extract-Cognify-Load pipeline that turns source documents into a persistent knowledge graph.
- **Supermemory** exposes a managed context engine that maintains cross-session profiles behind an automatic, proprietary memory layer.

The rest of this article expands each system, compares them across eight dimensions, and explains why their benchmark numbers cannot be stacked into one ranking.

## Mem0: extracted facts as a memory layer [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#mem0-extracted-facts-as-a-memory-layer)

Mem0 is a memory orchestration layer, not a database. Its extraction pipeline is ADD-only as of the v3 algorithm (Python SDK v2.0.0, released 2026-04-16): `add()` returns only ADD events, with no separate UPDATE/DELETE pass, so conflicting facts accumulate and retrieval ranking — not a write-time resolver — surfaces the current one ( [Mem0 v2→v3 migration](https://docs.mem0.ai/migration/oss-v2-to-v3)). Memories are organized into three scopes — user, session, and agent. [Retrieval fuses semantic search, BM25, and entity linking](https://mnemoverse.com/docs/library/rag-vs-agent-memory). The default library stack uses Qdrant for vectors and SQLite for history; the self-hosted server option swaps in Postgres with pgvector ( [Mem0 overview](https://docs.mem0.ai/open-source/overview)). External graph-store support was removed in Python SDK v2.0.0 — roughly 4,000 lines of Neo4j/Memgraph/Kuzu/AGE driver code — and replaced by built-in graph memory through entity linking in the existing vector store ( [v2.0.0 release notes](https://github.com/mem0ai/mem0/releases/tag/v2.0.0)); managed graph features remain a Platform offering. The open-source core is Apache-2.0 and fully self-hostable; the repository held 61,323 stars as of July 20, 2026 ( [GitHub API](https://api.github.com/repos/mem0ai/mem0)). Mem0 announced a $24 million Series A in October 2025.

This shape fits a team that already has an agent runtime and wants to add memory without adopting a new execution model.

**Weaknesses.** The headline vendor benchmark numbers do not reproduce under a neutral harness — the single most important buyer caveat, covered in the benchmark section below. Mem0 has no native temporal model: it stores timestamps but cannot answer what a fact was on a past date. Its managed graph tier is gated behind the Pro cloud plan at $249 per month, a frustrating middle ground for self-hosters who want the full feature set ( [Vectorize: Mem0 vs Zep](https://vectorize.io/articles/mem0-vs-zep)). The extraction pipeline's logic is also not easily customized.

## Letta: memory inside an agent runtime [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#letta-memory-inside-an-agent-runtime)

Letta is an agent runtime, not a bolt-on memory API. It models memory as three tiers: Core blocks that stay in context, searchable Recall history, and vector-backed Archival storage. The model edits its own memory through tool calls. A sleep-time compute step — Letta calls it "dreaming" — lets background subagents review recent turns and write lessons back to memory ( [Letta memory docs](https://docs.letta.com/letta-agent/memory); [Letta Code](https://github.com/letta-ai/letta-code)). It runs locally with a FastAPI server and Postgres, is Apache-2.0, and held 23,887 stars as of July 20, 2026 ( [GitHub API](https://api.github.com/repos/letta-ai/letta)). Cloud pricing starts free for three agents and moves to 20permonthfortwenty.Lettaraiseda10 million seed in September 2024 at a reported $70 million post-money valuation.

**Weaknesses.** The operating-system-style memory abstractions carry a steep learning curve. There is no built-in knowledge graph, and the debug UI is developer-only. Because Letta is a runtime, adopting it means committing more of the agent's architecture than a drop-in memory API would.

## Zep and Graphiti: native bi-temporal memory [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#zep-and-graphiti-native-bi-temporal-memory)

Zep is the managed memory service built around Graphiti, an open-source temporal-graph library. Every fact in the graph carries a validity window — `valid_at` and `invalid_at`. When a fact is superseded, the prior edge is invalidated rather than deleted, which preserves an audit trail. Retrieval combines embeddings, BM25, and graph traversal over Neo4j or FalkorDB ( [Zep temporal knowledge graph](https://www.getzep.com/ai-agents/temporal-knowledge-graph/)). Graphiti held 28,981 stars as of July 20, 2026 ( [GitHub API](https://api.github.com/repos/getzep/graphiti)); the older Zep Community Edition is deprecated. Zep is YC-backed. Zep Cloud starts with a free tier; the paid Flex plan is priced at 1,250peryearwith50,000monthlycreditsincluded,plus25 per additional 10,000 credits ( [Zep pricing](https://www.getzep.com/pricing/)).

This is the clearest technical divider in the comparison. A timestamp says when a record was stored. A validity window says when the represented fact was true. That distinction matters for changing roles, addresses, plans, permissions, or account states.

**Weaknesses.** With Community Edition deprecated, self-hosting means running Graphiti and operating your own Neo4j instance. The Apache-2.0 license permits that deployment, but the license does not operate Neo4j for you. The self-hosted experience is less mature than the cloud service, and the graph-first design offers less retrieval-strategy diversity than Cognee's fourteen modes. The graph's build, query, and latency costs are treated separately in [the GraphRAG tax](https://mnemoverse.com/docs/library/graphrag-tax).

## Cognee: an ECL graph pipeline [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#cognee-an-ecl-graph-pipeline)

Cognee is a graph-native pipeline built on an Extract-Cognify-Load model. It extracts entities and relations from source material, enriches them with embeddings, and loads the result into a connected knowledge graph. It supports RDF ontologies and offers fourteen retrieval modes, from plain RAG to chain-of-thought graph traversal, with more than thirty integrations ( [Cognee repository](https://github.com/topoteretes/cognee)). Embedded defaults — SQLite, LanceDB, and Kuzu — let a team start with no external infrastructure ( [Cognee guides](https://docs.cognee.ai/)). It is Apache-2.0, held 28,786 stars as of July 20, 2026 ( [GitHub API](https://api.github.com/repos/topoteretes/cognee)), and raised a €7.5 million seed in February 2026.

**Weaknesses.** Cognee publishes no LongMemEval or LoCoMo score, so its case rests on architecture and integration fit rather than a measured outcome. The managed cloud is newer and less battle-tested, the documentation is thin for advanced use, and there is no BM25 or dedicated temporal retrieval strategy.

## Supermemory: a managed context engine [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#supermemory-a-managed-context-engine)

Supermemory is a managed context API built on a proprietary vector-graph engine. It maintains cross-session user profiles and manages memory automatically; the sub-300-millisecond hybrid-recall figure and the vector-graph architecture description come from Supermemory's own materials — vendor claims, not independently verified ( [Supermemory blog](https://supermemory.ai/blog/latency-budgets-memory-retrieval)). The client repository is MIT-licensed and held 28,509 stars as of July 20, 2026 ( [GitHub API](https://api.github.com/repos/supermemoryai/supermemory)). A seed round of about $2.6 million was press-reported in October 2025.

The MIT label covers the clients, plugins, and MCP server, not the engine. Since June 2026 Supermemory ships a free local mode: a prebuilt single-machine server binary (macOS/Linux builds, pre-1.0 release tags on [GitHub Releases](https://github.com/supermemoryai/supermemory/releases)) that runs the core Memory API ( [Supermemory self-hosting docs](https://supermemory.ai/docs/self-hosting/overview)) — but the binary's source is not in the public repository, and the platform's connectors and highest-quality extraction models remain cloud-only ( [local vs enterprise](https://supermemory.ai/docs/self-hosting/local-vs-enterprise)). The distinction still matters during procurement: an open repository, an open client, and an open deployable engine are three different claims.

**Weaknesses.** The local mode is single-machine and pre-1.0, shipped as a prebuilt binary whose source is not public — the MIT open core covers the client, not the engine. Automatic memory management is opaque to the agent, the broad scope means more API surface, and data-sovereignty or air-gapped needs require extra work because the full platform remains cloud-only.

## Why agent memory benchmark scores need a harness [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#why-agent-memory-benchmark-scores-need-a-harness)

The single most important caveat for any buyer is that vendor-published benchmark numbers do not survive independent reproduction.

Mem0's vendor blog reports 92.5 on LoCoMo and 94.4 on LongMemEval, with roughly 73% fewer tokens per query ( [Mem0 benchmark report](https://mem0.ai/blog/state-of-ai-agent-memory-2026), retrieved 2026-08-03); [the parent landscape](https://mnemoverse.com/docs/research/ai-memory-landscape-2026) cites an earlier 68.5 LoCoMo figure for Mem0 from October 2025 reporting — a different vintage under a different harness, which is itself a lesson in how these numbers move. On May 27, 2026, Maximem published a reproduction. Under a gpt-5 answerer and judge, five random seeds, and a customer-style ingestion path, it measured 73.8% on LongMemEval after April 14, up from 57.5% before that date. Maximem frames this result against "the announced 93.4%" figure and attributes the gap to "benchmark-specific prompt engineering… dataset-specific equivalence rules and hidden chain-of-thought," not the memory system itself ( [Maximem reproduction](https://www.maximem.ai/blog/state-of-ai-memory-2026-claimed-vs-observed)). The two vendor-attributed numbers do not even agree with each other: the blog headline is 94.4, while the figure Maximem cites as announced is 93.4%. Both are self-reported claims, not independently confirmed results. One more disclosure belongs next to these numbers: Maximem is itself a memory-system vendor — its own product, Synap, ran on the same harness — so this is a competitor-run reproduction, not a neutral third party. The finding survives the caveat; the caveat still has to be stated.

A third measurement, from Vectorize using GPT-4o, placed Mem0 at 49.0% and Zep at 63.8% on LongMemEval, with Zep stronger on temporal and multi-hop questions ( [Vectorize evaluation](https://vectorize.io/articles/mem0-vs-zep)). That is a single-source result for Zep; only Mem0 has a full independent reproduction so far.

Supermemory reports 81.6% on LongMemEval as a self-measured figure. In a comparison published by Vectorize — which builds the competing system Hindsight — Hindsight scored 94.6% on the same tasks, above Supermemory's self-reported number ( [Vectorize: Hindsight vs Supermemory](https://vectorize.io/articles/hindsight-vs-supermemory)); treat that as a vendor-published comparison, not a neutral measurement. Letta positions itself around 74% on LoCoMo under an agent-autonomy framing ( [Letta benchmarking](https://www.letta.com/blog/benchmarking-ai-agent-memory)), again a vendor claim. Cognee publishes no LongMemEval or LoCoMo result in the reviewed material.

These are not contradictions. They are separate experiments that differ in answer model, judge, ingestion path, prompts, and implementation choices. No single ranking across vendors exists, and none should be asserted. Always ask for the harness, not just the score; when the harness is not public, treat the number as a vendor claim. The broader problems — why judge leniency inflates scores, why benchmark numbers need caveats — are covered in [evaluating agent memory](https://mnemoverse.com/docs/research/evaluation/evaluating-agent-memory) and [LLM-as-judge patterns](https://mnemoverse.com/docs/research/evaluation/llm-as-judge-patterns).

## AI memory solutions compared across eight dimensions [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#ai-memory-solutions-compared-across-eight-dimensions)

The table compares the five systems across eight dimensions. It omits raw benchmark scores on purpose: those are harness-dependent and belong in prose, not in a side-by-side grid.

| Dimension | Mem0 | Letta | Zep/Graphiti | Cognee | Supermemory |
| --- | --- | --- | --- | --- | --- |
| **Memory model** | Extracted facts, ADD-only (v3); vector + entity linking | In-context blocks + archival vector; LLM-managed | Bi-temporal knowledge graph | KG built by ECL pipeline | Vector-graph engine + user profiles |
| **Persistence / scoping** | User, session, and agent scopes | Core, Recall, and Archival tiers | Graph with validity windows | Persistent KG, embedded stores | Project-oriented, cross-session profiles |
| **Retrieval** | Semantic + BM25 + entity fusion | Tool-driven recall + archival search | Embeddings + BM25 + graph traversal | 14 modes incl. graph CoT | Hybrid; sub-300ms (vendor claim) |
| **Temporal handling** | Timestamps, no native "as-of" | Via recall history | **Native bi-temporal (valid/invalid)** | Not a distinct strategy | Not emphasized |
| **Provenance** | Fact-level source on write | Editable, auditable memory blocks | Edges carry time + source episode (no writer identity) | Graph edges / ontology | Automatic, comparatively opaque |
| **Self-host vs cloud** | Both (Apache-2.0) | Both (Apache-2.0) | Graphiti OSS; Zep cloud-practical | Both; embedded defaults | Hosted-first; local single-machine binary since Jun 2026 (engine source closed) |
| **Integration posture** | Drop-in memory API | Full agent runtime | Graph library or managed service | Data-to-graph pipeline | Managed context API |
| **Maturity (stars 2026-07-20; funding)** | 61.3k; $24M Series A | 23.9k; $10M seed | 29.0k (Graphiti); YC-backed seed | 28.8k; €7.5M seed | 28.5k; ~$2.6M seed (reported) |

Star counts come from each project's GitHub API as of July 20, 2026: [Mem0](https://api.github.com/repos/mem0ai/mem0), [Letta](https://api.github.com/repos/letta-ai/letta), [Graphiti](https://api.github.com/repos/getzep/graphiti), [Cognee](https://api.github.com/repos/topoteretes/cognee), and [Supermemory](https://api.github.com/repos/supermemoryai/supermemory).

Integration posture is the axis few comparison pages frame. Mem0 and Supermemory are drop-in APIs with little surface area. Letta is a runtime — adopt it and it manages the agent's context window and sleep-time consolidation. Cognee and Graphiti are library-shaped, embedded and controlled with no cloud dependency. That distinction decides more than any feature checklist.

Self-host reality is where license labels mislead — license statements do not equal self-host reality. Mem0, Letta, and Cognee are Apache-2.0 and run on your own infrastructure with reasonable effort: Mem0 needs a vector store, and Cognee defaults to embedded stores. Graphiti is Apache-2.0, but self-hosting means owning the Neo4j operational burden, and the deprecated Community Edition is not the path. Supermemory's MIT label covers the clients, plugins, and MCP server, not the engine; the June 2026 local mode is a closed-source single-machine binary, so air-gapped deployment means trusting a prebuilt binary you cannot inspect, and connectors stay cloud-only.

Temporal handling is the sharpest divider, and only Zep/Graphiti answers point-in-time queries natively. Mem0 stores timestamps but cannot reconstruct a past state, and Cognee and Supermemory do not emphasize temporal retrieval. For compliance or auditing, that difference is decisive.

## LangMem: the already-on-LangChain option [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#langmem-the-already-on-langchain-option)

If an agent already runs on LangGraph, LangMem is the low-friction choice. LangChain's long-term-memory SDK (MIT, PyPI `0.0.30`, October 2025, pre-1.0) offers episodic, semantic, and procedural memory types ( [LangMem on PyPI](https://pypi.org/project/langmem/)). It is not a peer to the five above: a third-party benchmark reports p95 latency of 59.82 seconds — impractical for interactive agents — with no knowledge graph or temporal model. It is compelling only when leaving the LangChain ecosystem costs more than those limits.

## Choose the integration boundary first [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#choose-the-integration-boundary-first)

The practical decision sequence is short. Choose the integration boundary first, then let temporal and self-host needs narrow the field.

1. Choose **Mem0** when memory must attach to an existing agent stack as a drop-in layer.
2. Choose **Letta** when the runtime itself should make memory management part of agent behavior.
3. Choose **Graphiti or Zep** when historical validity — what was true, and when — is a core query requirement.
4. Choose **Cognee** when the main job is turning heterogeneous source knowledge into a queryable graph.
5. Choose **Supermemory** when a managed context API is acceptable and engine self-hosting is not required.

For MCP-shaped deployments, apply the selection rubric in [how to choose a memory MCP server](https://mnemoverse.com/docs/library/memory-mcp) rather than repeating it here, and see [thirteen memory MCP servers compared](https://mnemoverse.com/docs/library/memory-mcp-servers-compared) for the named side-by-side with pricing and registry presence. Teams that need controlled head-to-head evidence should fix one protocol and one judge configuration and run the comparison themselves — [the judge, not the memory system, often decides the score](https://mnemoverse.com/docs/research/evaluation/llm-as-judge-patterns).

The design space is wider than these five — which raises a fair question this article should not dodge: where does the publisher of this comparison stand in it?

## Where Mnemoverse sits: a vendor's note [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#where-mnemoverse-sits-a-vendor-s-note)

Full disclosure first. This comparison is published on Mnemoverse's documentation site, and Mnemoverse builds a product in the same category. By this article's own rule — ask for the harness, and who runs it — treat every claim in this section as a vendor claim.

Mnemoverse is a hosted memory API built on an associative graph over vector embeddings. The hyperbolic geometry the project is named for (THG, SLoD) is research-stage and **not** in the shipping engine — its own technology pages say so plainly, and that gap belongs in a comparison like this one ( [how it works](https://mnemoverse.com/docs/technology/tensor-hyperbolic-graphs)). In the dimensions above it would sit closest to Supermemory's column: a managed API with an MCP-first integration posture ( [local package](https://mnemoverse.com/docs/api/mcp-server), [remote OAuth connector](https://mnemoverse.com/docs/api/remote-mcp-server)), an open client, and a closed engine — which deserves exactly the open-core scrutiny this article applies to Supermemory. Retrieval blends semantic similarity with association weights that strengthen on use and shift with outcome feedback ( [the Hebbian layer](https://mnemoverse.com/docs/library/hebbian-memory-for-ai-agents)). One capability none of the five systems above offers: [Rooms](https://mnemoverse.com/docs/api/rooms) (beta) — shared, membership-checked memory spaces that several agents under different accounts can write to and read from.

The weaknesses, in the same format as the five systems above: it is a young product with a small user base; the engine is proprietary, so there is no self-host path today; and its benchmark results are self-published — the protocol and judge configuration are disclosed ( [benchmarks](https://mnemoverse.com/docs/technology/benchmarks)), but by this article's own standard you should treat them exactly as skeptically as any other vendor number in this piece.

The comparison table above stays five vendors wide on purpose: we do not grade ourselves in our own table.

## Common questions [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#common-questions)

### Mem0 vs Zep — which memory layer should I use? [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#mem0-vs-zep-%E2%80%94-which-memory-layer-should-i-use)

Choose Mem0 for a drop-in fact-extraction layer with several retrieval signals and full Apache-2.0 self-hosting. Choose Zep or Graphiti when facts must carry native validity windows, at the cost of operating Neo4j yourself.

### What is the best memory layer for AI agents in 2026? [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#what-is-the-best-memory-layer-for-ai-agents-in-2026)

There is no single best layer. The choice depends on integration posture, temporal needs, and self-host reality. This article gives a decision framework, not a winner.

### Do AI memory benchmark scores like Mem0's 93% hold up independently? [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#do-ai-memory-benchmark-scores-like-mem0-s-93-hold-up-independently)

Not so far. Maximem's May 27, 2026 reproduction — run by Maximem, itself a memory-system vendor — measured 73.8% on LongMemEval, against the 93.4% figure it cites, using a gpt-5 answerer and judge across five seeds.

### Self-hosted vs cloud agent memory — what are the trade-offs? [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#self-hosted-vs-cloud-agent-memory-%E2%80%94-what-are-the-trade-offs)

Self-hosting gives control over data and infrastructure but transfers operational work to you. Cloud services reduce that work but can limit engine access and inspection, and a license label alone does not guarantee a practical self-host path.

### Mem0 vs Letta — bolt-on memory layer or agent runtime? [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#mem0-vs-letta-%E2%80%94-bolt-on-memory-layer-or-agent-runtime)

Mem0 adds memory to an existing agent stack. Letta is a full runtime in which the model manages Core, Recall, and Archival memory through tools, so you adopt more of the stack.

### When do I need a temporal knowledge graph (Zep/Cognee) instead of vector memory (Mem0)? [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#when-do-i-need-a-temporal-knowledge-graph-zep-cognee-instead-of-vector-memory-mem0)

Use one when you must answer what a fact was on a past date or audit how knowledge changed. Among these systems, only Zep/Graphiti provides native bi-temporal validity windows; Cognee is graph-native but does not treat time as a distinct strategy, and Mem0 stores timestamps without as-of queries.

### Which AI agent memory tools are open source and can I actually self-host? [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#which-ai-agent-memory-tools-are-open-source-and-can-i-actually-self-host)

Mem0, Letta, and Cognee are Apache-2.0 and genuinely self-hostable, and Cognee defaults to embedded stores. Graphiti is Apache-2.0 but needs a Neo4j backend. Supermemory's clients and MCP server are MIT; since June 2026 it also offers a free single-machine local server, shipped as a prebuilt binary (engine source closed), with connectors remaining cloud-only.

## Sources [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#sources)

All web sources were reviewed July 21, 2026. GitHub metrics were captured July 20, 2026.

- [Mem0 open-source overview](https://docs.mem0.ai/open-source/overview)
- [Mem0 2026 benchmark report](https://mem0.ai/blog/state-of-ai-agent-memory-2026) (2026-04-01)
- [Maximem: claimed vs observed reproduction](https://www.maximem.ai/blog/state-of-ai-memory-2026-claimed-vs-observed) (2026-05-27)
- [Vectorize: Mem0 vs Zep](https://vectorize.io/articles/mem0-vs-zep)
- [Vectorize: Hindsight vs Supermemory](https://vectorize.io/articles/hindsight-vs-supermemory)
- [Vectorize: Supermemory alternatives](https://vectorize.io/articles/supermemory-alternatives)
- [Letta memory documentation](https://docs.letta.com/letta-agent/memory)
- [Letta Code (sleep-time compute)](https://github.com/letta-ai/letta-code)
- [Letta benchmarking post](https://www.letta.com/blog/benchmarking-ai-agent-memory)
- [Zep temporal knowledge graph](https://www.getzep.com/ai-agents/temporal-knowledge-graph/)
- [Zep/Graphiti LongMemEval paper (arXiv:2501.13956)](https://arxiv.org/abs/2501.13956)
- [Cognee repository](https://github.com/topoteretes/cognee)
- [Cognee guides](https://docs.cognee.ai/)
- [LangMem on PyPI](https://pypi.org/project/langmem/)
- GitHub star counts (2026-07-20): [Mem0](https://api.github.com/repos/mem0ai/mem0), [Letta](https://api.github.com/repos/letta-ai/letta), [Graphiti](https://api.github.com/repos/getzep/graphiti), [Cognee](https://api.github.com/repos/topoteretes/cognee), [Supermemory](https://api.github.com/repos/supermemoryai/supermemory)

## Related [​](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3\#related)

- [AI memory landscape 2026](https://mnemoverse.com/docs/research/ai-memory-landscape-2026) — parent landscape with platform memory, the funding table, and academic survey.
- [How to choose a memory MCP server](https://mnemoverse.com/docs/library/memory-mcp) — the 5-question rubric for MCP-shaped memory.
- [The GraphRAG tax](https://mnemoverse.com/docs/library/graphrag-tax) — build, query, and latency costs of graph memory.
- [Evaluating agent memory](https://mnemoverse.com/docs/research/evaluation/evaluating-agent-memory) — why benchmark numbers need caveats.
- [LLM-as-judge patterns](https://mnemoverse.com/docs/research/evaluation/llm-as-judge-patterns) — judge leniency and the Maximem gap.
- [Knowledge graph memory for agents](https://mnemoverse.com/docs/library/knowledge-graph-memory-for-agents) — the graph-memory substrate.
- [Navigating knowledge graphs](https://mnemoverse.com/docs/library/navigating-knowledge-graphs) — traversal policy once the graph pays.
- [AI agent memory](https://mnemoverse.com/docs/library/ai-agent-memory) — the category hub.
- [How Mnemoverse compares](https://mnemoverse.com/compare) — head-to-head pages vs Mem0, Zep, Cognee, and Letta, plus a fair roundup and the market map.
- [Awesome Agent Memory](https://github.com/mnemoverse/awesome-agent-memory) — open CC0 index of the category: managed APIs, open-source engines, MCP memory servers, benchmarks, and papers. Contributions welcome.
- [Best AI agent memory in 2026](https://mnemoverse.com/compare/alternatives) the sales-side version of this comparison, where we name a fair strength for each system and say where we fit

_Edward Izgorodin · Mnemoverse · last updated 2026-08-06_

_— Mnemoverse is a persistent-memory API for AI agents. Free key: [console.mnemoverse.com](https://console.mnemoverse.com/sign-up?utm_source=docs&utm_medium=cta&utm_campaign=library-ai-memory-solutions-2026-q3) · Docs: [Getting Started](https://mnemoverse.com/docs/api/getting-started)_

Mnemo is ready.

MiniFull

![](https://mnemoverse.com/docs/mnemo-wave.png)

📊 This documentation uses analytics to improve user experience.Accept✕