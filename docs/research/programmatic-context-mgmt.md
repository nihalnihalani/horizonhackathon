[Abstract](https://www.alphaxiv.org/abs/2608.21690) [Paper](https://www.alphaxiv.org/pdf/2608.21690)

## Abstract

LLM agents increasingly take on long-running tasks whose history grows far beyond a single model context window. Existing approaches compress earlier interactions or extract selected information into fixed memory representations, committing to what to preserve before future needs are known. We present Scroll, a context manager that treats each agent session as an executable Session Environment. The environment is backed by an append-only Event Log and a sandboxed, persistent Python kernel. The kernel maintains a typed namespace across model calls, allowing tool outputs, retrieved history, and derived state to be bound to variables rather than serialized into the prompt at each call. Model-written code searches, materializes, and transforms session state through exec; only explicitly printed projections enter the model's working view for the next call. Context management thus becomes a programming task that inherits the improving coding abilities of LLMs, while the Event Log preserves lossless historical ground truth. As the working view approaches its budget, stale spans are evicted but remain recoverable: an eviction index keeps compact landmarks tied to exact Event Log addresses, so that the agent navigates directly to evicted regions instead of searching the full log. With Qwen3.8-Max as the backbone, Scroll achieves 94.8% on LongMemEval\_S\[p8\]; 73.1% on BEAM\_10M, surpassing the best published memory system by 5.1 points; and 86.7% on LOCA\_256K,\[p8\] exceeding the best published long-horizon agent by 37.4 points.

View more

[View Paper](https://www.alphaxiv.org/pdf/2608.21690)

26

Save

[Comments](https://www.alphaxiv.org/abs/2608.21690#discussion)

Cite

## AI Overview

Copy

Imagine an AI assistant helping you plan a Tokyo trip. It has already searched hundreds of flights, mapped several airport routes, and recalled from earlier sessions that you prefer economy cabins and want to avoid tolls. Keeping all of that text in every prompt is impractical—model calls have a fixed reading budget, and stuffing it with raw tool results leaves little room for reasoning. The usual fix is to compress older interactions into a summary or extract selected facts into a memory store before the next question arrives. But that commits to what matters before the question is known, and anything the summary omits is gone. Scroll, the system this paper introduces, takes a different approach: it keeps the complete record outside the prompt, lets the agent write a small program to find and filter what it needs, and admits only the chosen result to the next model call. Three short code cells expand the two preference events, filter the resident flight and route tables, and print the cheapest economy fare and fastest toll-free route\[p5\]—without any raw table ever entering the prompt.

![Side-by-side diagram contrasting traditional context management with Scroll. The left side funnels session history and retrieved memory into a compressed model context. The right side shows an Event Log, a Python kernel namespace with typed variables, and durable file storage all living outside the prompt; only explicitly printed results cross into the bounded working view.](https://paper-assets.alphaxiv.org/paper-figures/01a03782-f538-7602-95a4-6b2be7f6bd09/01a0bda1-6337-7ba6-888b-f4dc067adfc1.png)Left: existing systems funnel history through summaries or retrieved snippets before future needs are known. Right: Scroll keeps exact events, file payloads, and typed Python variables outside the prompt; model-written code prints only the chosen projection into the next model call.

## [Jump to section](https://www.alphaxiv.org/abs/2608.21690\#the-prompt-becomes-a-programmable-view "Jump to section") The Prompt Becomes a Programmable View

Scroll organizes a session into three persistent layers that all live outside the model's working prompt. First, an **Event Log** records every interaction—user messages, model responses, tool calls, tool results—as an append-only sequence. Each event receives a stable numeric address (`seq`) assigned at write time and never changed, so any past event can be recovered by address regardless of how much has accumulated since. Second, large payloads such as full tool results are stored in files or a database, with the event row keeping a short preview and a pointer; the full content is loaded only when explicitly requested. Third, a sandboxed Python environment—one persistent kernel per session—maintains a typed namespace of variables that survive across model calls. When the agent calls a flight-search tool, the full result binds to a Python variable like `flights`; later calls can filter and rank it without re-running the search or re-reading the raw text.

The model interacts with this environment through four operations: locate candidate events via keyword search, materialize exact events or spans by address, compute over resident variables with ordinary Python, and expose a chosen result with `print`. Retrieved records, tool outputs, and intermediate computations remain in the kernel unless explicitly emitted through print.\[p2\] Everything that stays in the kernel costs no prompt tokens; only what the model explicitly prints enters the next call.

![Three-column flow diagram showing how three exec code cells interact with the Event Log, Python kernel, and model context window for the Tokyo trip example. Step 1 binds full flight and route results to kernel variables and prints three rows. Step 2 searches history for preference keywords and prints twenty matches with their sequence addresses. Step 3 expands the two preference events, filters the resident tables, and prints only the cheapest matching flight and fastest toll-free route.](https://paper-assets.alphaxiv.org/paper-figures/01a03782-f538-7602-95a4-6b2be7f6bd09/01a0bda1-621a-7641-8074-dc18878e7651.png)One task through three code cells: bulky tool results stay resident in the kernel (bottom), matched preferences and sequence addresses cross into the view only as printed output (top), and the final projection contains just two rows—not the full tables.

As the session grows and the working view fills its budget, Scroll evicts older spans from the view without erasing them from the log. Evicted events stay verbatim at their original addresses. A compact eviction index keeps short headline entries—each anchored to an address range—so the agent can navigate to evicted regions directly rather than guessing keywords. Older history is represented more coarsely than recent history, keeping the index size manageable across long sessions.

## [Jump to section](https://www.alphaxiv.org/abs/2608.21690\#which-component-carries-the-weight "Jump to section") Which Component Carries the Weight

The central evaluation is a task called BEAM, which asks questions over coherent histories up to ten million tokens long. Its questions may require collecting non-adjacent evidence, tracking changes over time, deduplicating repeated information, or aggregating facts distributed throughout the history.\[p6\] The overall score is a mean judge rating across ten memory-ability categories, each graded on a 0–1 scale.

To separate which part of Scroll drives performance, the authors run three controlled ablations with the same model (Qwen3.8-Max), same prompts, and same task set. Discarding the original records is the most damaging ablation: the lossy variant falls to 19.9 overall,\[p9\] with near-zero scores wherever an answer requires exact values—temporal ordering, knowledge updates, information extraction. Scroll w/o REPL underperforms full Scroll by 7.3 points,\[p9\] concentrated in categories that require composing evidence from many records, such as knowledge update and instruction following; single-lookup categories are largely unaffected. Removing the eviction index costs 1.8 points overall, but the loss concentrates where evidence is spread across the history: preference following drops from 89.1 to 74.9, summarization from 70.5 to 62.6, and event ordering from 64.1 to 58.1. Full Scroll scores 73.1.

![Grouped bar chart with ten BEAM memory-ability categories plus Overall on the horizontal axis and mean judge score from 0 to 1 on the vertical axis. Four bars per category: dark-blue hatched lossy summarization near zero on several categories, light-blue hatched Scroll without REPL, green hatched Scroll without index, and dark-green solid full Scroll. Overall scores are approximately 0.20, 0.66, 0.71, and 0.73 respectively.](https://paper-assets.alphaxiv.org/paper-figures/01a03782-f538-7602-95a4-6b2be7f6bd09/01a0bda1-6333-7335-85ab-5a47eefab420.png)The ablation shows that preserving original records matters most (lossy summarization collapses to 0.20 overall), the persistent kernel matters for multi-record reasoning (0.66 without it), and the eviction index matters most for scattered evidence like preference following and event ordering.

Preserving access to evidence is not the same as retrieving it correctly. The appendix documents failures with the same record-keeping: one agent searched for mapping-tool preferences but never queried the toll-avoidance axis the question graded; another sampled the head and tail of long sessions positionally and missed habit-related facts sitting in the middle. Both failures occurred even though the needed events remained available in the log.

Across systems that use different backbone models and reader configurations—making a direct controlled comparison impossible—these are reference points from the literature rather than a controlled comparison; reader models differ and can substantially affect scores.\[p8\] With that caveat, Scroll's 73.1 on the ten-million-token variant of BEAM exceeds the best published result in the comparison table by 5.1 points.

On a separate benchmark testing agents that must act and modify an environment as tool-output history grows, Scroll and a plain code-based agent both score 86.7 and 85.3 at the largest context size—a modest difference—while summarization and retrieval agents drop to roughly 65–67. This suggests that binding intermediate results to kernel variables, rather than Scroll's extra history machinery, explains most of the gain on this shorter-trajectory task. Capability also matters: on the same history-heavy acting tasks, results across six backbone models span 64 points at the largest size, and every backbone can use Scroll, but stronger models benefit more.\[p8\]

On BEAM, the median model-facing input is 105K tokens—about 1% of the ten-million-token corpus—with no extra model calls at ingestion. The authors report token counts rather than latency or dollar cost because both depend on serving configuration,\[p10\] and there is no controlled comparison of token use against other systems.

## [Jump to section](https://www.alphaxiv.org/abs/2608.21690\#remember-first-choose-later "Jump to section") Remember First, Choose Later

The Tokyo agent succeeds at booking because it did not have to predict at search time which fare would matter—it retained the full flight table and chose after the booking request named the criterion. The ablation makes that design choice consequential rather than merely principled: replacing originals with ingestion-time summaries cuts the overall score by more than three-quarters on tasks that require reconciling or ordering exact historical values. Deferring context selection to the moment of use, backed by a verbatim and addressable record, is what separates the result from what earlier compression or retrieval systems could recover.

## Audio

The audio failed to load. Reload the page to try again.

Transcript

## Similar papers

[![](https://thumbnails.assets.alphaxiv.org/512/019d641c-b74b-7d53-a525-17f183a65246.png)Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models29 Mar 2026](https://www.alphaxiv.org/abs/2510.04618) [![](https://thumbnails.assets.alphaxiv.org/512/019f97c0-5c85-7e6b-a63f-c7a7011d71cf.png)Agentic Memory: Learning Unified Long-Term and Short-Term Memory Management for Large Language Model Agents23 Jul 2026](https://www.alphaxiv.org/abs/2601.01885) [![](https://thumbnails.assets.alphaxiv.org/512/01a036d5-757d-74b3-8c62-5fb6d590594e.png)Prime Agent: A Self-Improving RLM Harness24 Aug 2026](https://www.alphaxiv.org/abs/2608.23552) [![](https://thumbnails.assets.alphaxiv.org/512/019c0cbe-60fa-73e9-8e5b-dbc28a4be2d9.png)SimpleMem: Efficient Lifelong Memory for LLM Agents29 Jan 2026](https://www.alphaxiv.org/abs/2601.02553) [![](https://thumbnails.assets.alphaxiv.org/512/019f4996-7f52-7215-8a47-794331ded9ff.png)Remember When It Matters: Proactive Memory Agent for Long-Horizon Agents09 Jul 2026](https://www.alphaxiv.org/abs/2607.08716)

Show moreShow less

[![](https://thumbnails.assets.alphaxiv.org/512/019fcb60-0eca-77e7-92ca-0f3c8a0f2ddd.png)LongHorizon-Harness: Advancing Long-Horizon Agents for Real-World Tasks03 Aug 2026](https://www.alphaxiv.org/abs/2608.01964) [![](https://thumbnails.assets.alphaxiv.org/512/0199e5a8-2beb-78d0-b3e9-61638dcfe220.png)Scaling Long-Horizon LLM Agent via Context-Folding13 Oct 2025](https://www.alphaxiv.org/abs/2510.11967) [![](https://thumbnails.assets.alphaxiv.org/512/019e623e-8185-74a1-81b6-40fe56fe3523.png)MemSkill: Learning and Evolving Memory Skills for Self-Evolving Agents24 May 2026](https://www.alphaxiv.org/abs/2602.02474) [![](https://thumbnails.assets.alphaxiv.org/512/019f3aa1-c5c4-7e2d-9226-fec4ce4015cf.png)CompactionRL: Reinforcement Learning with Context Compaction for Long-Horizon Agents06 Jul 2026](https://www.alphaxiv.org/abs/2607.05378) [![](https://thumbnails.assets.alphaxiv.org/512/019a2e55-6f57-70e4-8fed-f3faf29ea35c.png)AgentFold: Long-Horizon Web Agents with Proactive Context Management28 Oct 2025](https://www.alphaxiv.org/abs/2510.24699)

## Discussion

Leave a comment

Comment

Smart

Write notes about this paper...

Sign in to save