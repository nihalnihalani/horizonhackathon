[Blog](https://mem0.ai/blog)

# Dream: Background memory consolidation for AI agents

![](https://framerusercontent.com/images/zx8iAUepBT87Zp3tCbnVQORKF6I.png?width=192&height=192)

[Rudraj Mehta](https://mem0.ai/authors/rudraj-mehta)

•

Aug 4, 2026

•

Updated on

Updated on Sep 3, 2026

Share

![](https://framerusercontent.com/images/PYiecIiZMFz1GBwjHkyl4DZxJWw.png?width=2496&height=1248)

_Mem0 now cleans up agent memory in the background. Duplicates get merged, outdated facts get marked as superseded without losing history, and recurring behavior gets summarized into higher-level memories. Available today on Pro and Enterprise plans._

Human memory depends on sleep. The brain records all day and organizes at night: replays the day's experiences, strengthens the ones that matter, links them to older memories, and fades the rest. Long-running agents do the recording but not the organizing, and over time their memory starts to behave like a human mind with no sleep: recall gets noisier, contradictions accumulate, and old facts crowd out new ones. Dream gives agents the organizing phase, and does for an agent's memory what sleep does for ours.

### How agent memory degrades over time

Agents write memories in the middle of conversations. The write path has to be fast, so each write decision sees only the current conversation and a small set of similar memories retrieved for context. It doesn’t see the rest of the store.

This means some problems are invisible at write time, no matter how good the extraction is:

- The same fact gets stored several times in different words. Exact-match deduplication catches identical text, but "prefers window seats" and "always books window seats on long-haul flights" are different strings.

- A fact changes and the old version stays active. If "lives in Tokyo" was written four months ago and never comes up in the retrieval context when "moved to Osaka" is written, nothing connects them. Both stay in the store, and both come back in search results.

- Related facts stay scattered. A user who mentions yoga classes in January, early wake-ups in March, and sleep questions in May has a routine that no single memory describes.


Stale and duplicate memories occupy retrieval slots, add tokens to every search response, and sometimes cause the agent to state something that stopped being true months ago. In our production data, the median active project carries a few hundred memories that duplicate or contradict other memories in the same project.

Databases solved a similar problem a long time ago by splitting the work: accept writes fast, and run a separate maintenance process in the background. LSM stores run compaction, Postgres runs vacuum, git runs garbage collection. Memory systems for agents have generally shipped the fast write path without the maintenance process.

Dream is the maintenance process.

### What Dream does

Dream runs three operations on your project's memories.

**Merge.** When a newer memory contains all the information of an older one plus more, the older memory is marked as `merged` and points to its replacement. Merged memories are hidden from search results by default. You can still fetch them with `include_merged=true`.

**Supersede.** When a newer memory replaces an older fact, the older memory is marked as `superseded` and points to the memory that replaced it. Superseded memories still appear in search by default, because history is often useful. Pass `latest_only=true` to get only current facts.

**Synthesize.** A background job looks at groups of related memories and writes a new summary memory when several independent observations support one. For example: a user with separate memories about Tuesday and Thursday yoga classes, 6:45 AM wake-ups, and questions about sleep quality gets one new memory describing the morning yoga routine, with the IDs of all source memories stored on it. Synthesis is deliberately conservative. Single observations, one-off events, and repeated questions about a topic do not produce summaries.

Nothing is deleted in any of these operations. Every change is recorded as a state change with a pointer to the newer memory, and you can review each change in the dashboard. Memories marked `immutable` or `exclude_from_dream` are skipped entirely.

### How it works

Merge and supersede decisions happen during extraction, when a new memory clearly relates to an existing one that is present in the write context. The rules are strict. A merge requires the new memory to preserve all the information in the old one. A supersede requires a clear replacement of the same fact. Anything ambiguous results in no action. The updates are applied with conditional writes, so concurrent operations on the same memory cannot conflict.

Synthesis runs separately, on a schedule, off the request path. It groups candidate memories by similarity and evaluates each group. The performance characteristics matter for production use. Add and search latency do not change: consolidation adds no work to either path.

Lifecycle states are stored as an indexed column on each memory, so `latest_only` filtering is a simple indexed query.

### Turning it on

Dream is available for all Pro and enterprise users. On the Pro plan, open the Dream tab in the dashboard and enable it per project. It processes new activity from the moment you enable it and does not touch your existing memories retroactively. Runs happen weekly per project per eligible user\_ids.

In the SDKs (Python and TypeScript), search and get\_all accept `latest_only` and `include_merged`, and memory objects now include `lifecycle_state` and `replacement_memory_id`.

Docs: [https://docs.mem0.ai/platform/features/dream](https://docs.mem0.ai/platform/features/dream)

Enable it from the Dream tab: [https://app.mem0.ai/dashboard/dream](https://app.mem0.ai/dashboard/dream)

Keep it moving **Share this article**

Share article

GET TLDR from:

![](https://framerusercontent.com/images/ZYqYVRWAIUE6bw5NaOdt1XE63Y.png?width=2048&height=2080)

Summarize

Website/Footer

![](https://framerusercontent.com/images/Wz6xdYhapkqAx9yeiBHJc5Z7U.png?width=2048&height=2056)

Summarize

Website/Footer

![](https://framerusercontent.com/images/kXSt4wFeCHyPHguebgxmfvEYtsw.png?width=2048&height=2048)

Summarize

Website/Footer

![](https://framerusercontent.com/images/15BEpCqpayhbBPlvcWy0WOSvWI.png?width=2048&height=2048)

Summarize

Website/Footer

## Read More Mem0 Blogs

[![](https://framerusercontent.com/images/YC0NrYbiAePSIet2jfxs7r0ak.png?width=1200&height=630)\\
\\
**Introducing DolphinBench: Mapping the Pareto Frontier of Agent Memory**\\
\\
Sep 22, 2026\\
\\
·\\
\\
Research](https://mem0.ai/blog/introducing-dolphinbench-mapping-the-pareto-frontier-of-agent-memory)

[![Coding Agents Explained: What They Are and How They Differ from AI Assistants](https://framerusercontent.com/images/fM30mOpFXO4ZLtWBekWnDGHLDbo.png?width=1248&height=624)\\
\\
**Coding Agents Explained: What They Are and How They Differ from AI Assistants**\\
\\
Sep 18, 2026\\
\\
·\\
\\
Library](https://mem0.ai/blog/coding-agents-explained-what-they-are-and-how-they-differ-from-ai-assistants)

[![OpenAI Codex vs Claude Code: Which AI Coding Agent Wins in 2026?](https://framerusercontent.com/images/VA49chhE2MUtHrHEuA7zrjngjg.png?width=2496&height=1248)\\
\\
**OpenAI Codex vs Claude Code: Which AI Coding Agent Wins in 2026?**\\
\\
Sep 17, 2026\\
\\
·\\
\\
Library](https://mem0.ai/blog/openai-codex-vs-claude-code-which-ai-coding-agent-wins-in-2026)

[![I Gave My Claude Code Agent One Gateway Key Instead of 10 API Keys - Here's What Happened](https://framerusercontent.com/images/B1nN3gYQnau4ZUnGUzPxdyIatSs.png?width=1248&height=624)\\
\\
**I Gave My Claude Code Agent One Gateway Key Instead of 10 API Keys - Here's What Happened**\\
\\
Sep 16, 2026\\
\\
·\\
\\
Library](https://mem0.ai/blog/i-gave-my-claude-code-agent-one-gateway-key-instead-of-10-api-keys---here-s-what-happened)

[![Mem0 gateway](https://framerusercontent.com/images/1jgQAfg8V8QsLINpRQyTTr0mbk.png?width=1248&height=624)\\
\\
**Give Every Agent Exactly The Tools It Needs**\\
\\
Sep 18, 2026\\
\\
·\\
\\
Engineering](https://mem0.ai/blog/give-every-agent-exactly-the-tools-it-needs)

[![AI Agent Memory: Build vs. Buy](https://framerusercontent.com/images/eliPH6AZnRCM7kB1pE8BaPwsY2Q.png?width=2496&height=1248)\\
\\
**AI Agent Memory: Build vs. Buy**\\
\\
Sep 15, 2026\\
\\
·\\
\\
Library](https://mem0.ai/blog/ai-agent-memory-build-vs.-buy)

Cookie Settings

We use cookies to personalize content, run ads, and analyze traffic. Read our [Cookie Policy](https://mem0.ai/).