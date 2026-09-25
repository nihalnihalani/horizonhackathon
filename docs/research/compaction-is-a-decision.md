[Skip to content](https://blakecrosley.com/blog/agent-context-compaction#main)

Dark modeLight mode

[English](https://blakecrosley.com/blog/agent-context-compaction) [简体中文](https://blakecrosley.com/zh-Hans/blog/agent-context-compaction) [繁體中文](https://blakecrosley.com/zh-Hant/blog/agent-context-compaction) [Français](https://blakecrosley.com/fr/blog/agent-context-compaction) [Deutsch](https://blakecrosley.com/de/blog/agent-context-compaction) [日本語](https://blakecrosley.com/ja/blog/agent-context-compaction) [한국어](https://blakecrosley.com/ko/blog/agent-context-compaction) [Polski](https://blakecrosley.com/pl/blog/agent-context-compaction) [Português](https://blakecrosley.com/pt-BR/blog/agent-context-compaction) [Español](https://blakecrosley.com/es/blog/agent-context-compaction)

Listen to article12:34

0:00 / 12:341x

A long agent trajectory hits its context limit, the scaffold summarizes everything so far into a compact note, and the summary lands in the middle of a half-finished proof. The agent had three of four lemmas in hand. Now it has a paragraph that says it was “working on a proof” and four lemmas it has to rediscover. The compaction did not fail because the summary was bad. It fired at the wrong moment.

**Most coding agents compact context on a fixed trigger: when accumulated tokens cross a threshold, summarize and continue. The trigger is numeric, but the cost of compacting is structural. Firing mid-derivation discards partial results the model then has to reconstruct, which is the most expensive moment to forget.** A June 2026 paper, _Self-Compacting Language Model Agents_, makes the case that the model should decide when and how to compact, and shows the decision-based version matches or beats the threshold at a fraction of its token cost.[1](https://blakecrosley.com/blog/agent-context-compaction#fn:1)

The result reframes a problem I have been treating as a plumbing detail. Context compaction is not a memory-management chore that fires on a counter. It is a judgment call about when forgetting is safe, and the agent is in a better position to make that call than a token budget is.

## TL;DR

- Agent scaffolds, [Claude Code](https://blakecrosley.com/guides/claude-code) included, compact context when it approaches the window limit. The trigger is a token count, so it fires without regard to where the agent is in its work.
- Firing mid-derivation or mid-search is the worst case: the summary throws away partial results the model paid to compute and then has to compute again.
- _Self-Compacting Language Model Agents_ (2026) pairs a compaction tool the model can call with a rubric telling it when to fire (a sub-task resolved, the trajectory is converging) and when to hold (mid-derivation, stuck). Neither half works alone.
- The method needs no fine-tuning and no external supervision. Across six benchmarks and seven models it beat a no-summarization baseline by up to 18.1 points on math and 5 to 9 on agentic search, at 30 to 70 percent lower cost per question.
- The lesson generalizes past summarization: the right trigger for forgetting is semantic (is the work at a safe boundary?), not numeric (is the buffer full?).

## The Threshold Is the Wrong Trigger

Compaction exists because long trajectories rot. Chains of thought and tool calls pile up, stale content anchors later generations, and eventually the trace outgrows the window. The standard fix is to summarize at a fixed interval, triggered when the token total crosses a threshold.[1](https://blakecrosley.com/blog/agent-context-compaction#fn:1) It is the obvious engineering move, and it is what production scaffolds do when a session runs long: Claude Code, by its own documentation, “compacts automatically as you approach the limit.”[2](https://blakecrosley.com/blog/agent-context-compaction#fn:2)

The problem is that the threshold knows the size of the context and nothing about its shape. A token counter cannot tell the difference between a trajectory that just closed out a sub-task cleanly and one that is three steps into a five-step derivation. Both look identical to a counter: a number that crossed a line. So the scaffold compacts both the same way, and in the second case it summarizes away the exact intermediate results the agent needs to finish.

I have watched this happen in my own [autonomous loops](https://blakecrosley.com/blog/ralph-agent-architecture). A long run hits the limit during a multi-file refactor, the scaffold compacts, and the agent comes back having forgotten which files it had already edited. The work was not lost in any catastrophic sense. The agent re-derived it. But re-derivation is the cost, and it is a cost the threshold imposes blindly, because the threshold cannot see that the moment was bad.

The failure differs from the one I wrote about in [context compounding](https://blakecrosley.com/blog/compound-context). Compounding is about what a project keeps across sessions: the conventions, hooks, and memories that make session 500 faster than session 1. Compaction is about what a single session discards within itself. The two pull in opposite directions, and compaction is the one nobody tunes, because the threshold makes it feel automatic.

## What SelfCompact Changes

The paper’s proposal, SelfCompact, moves the decision from the scaffold to the model. It pairs two inference-time pieces.[1](https://blakecrosley.com/blog/agent-context-compaction#fn:1)

**A compaction tool.** The model gets a tool it can invoke to summarize its accumulated context, the same way it invokes any other tool. Compaction becomes an action the agent takes, not an interrupt the runtime imposes.

**A rubric for when to fire.** A lightweight instruction tells the model when compacting is appropriate (a sub-task has resolved, or the trajectory is converging) and when to suppress it (the model is mid-derivation, or stuck). The rubric is the judgment the token counter lacks.

The paper is direct that both halves are necessary, and the reason is the interesting part. Open-weight models use the tool unevenly: they invoke it at unhelpful moments or skip it entirely. Left to their own instincts, models are not reliable at noticing their own context rot. The rubric alone cannot do anything, because it is just instructions with no mechanism to act on. Together they produce adaptive compaction without any fine-tuning or external supervision.[1](https://blakecrosley.com/blog/agent-context-compaction#fn:1) The model already has the capability to summarize well; what it lacks is the metacognitive sense of when summarizing is worth the loss. The rubric supplies that sense.

The framing matters because it separates two abilities people tend to conflate. Knowing _how_ to compress a trajectory is a generation skill, and frontier models are good at it. Knowing _when_ compressing is safe is a self-monitoring skill, and models are bad at it unprompted. SelfCompact does not try to make the model smarter at summarizing. It gives the model a checklist for the timing decision it would otherwise get wrong.

## The Numbers

The evaluation covers six benchmarks spanning competitive math and agentic search, across seven models.[1](https://blakecrosley.com/blog/agent-context-compaction#fn:1) The comparison points are a no-summarization baseline and the fixed-interval threshold approach.

Against no summarization, SelfCompact improved results by up to 18.1 points on math and 5 to 9 points on agentic search, at 30 to 70 percent lower cost per question.[1](https://blakecrosley.com/blog/agent-context-compaction#fn:1) That gap is the cost of context rot: a model drowning in its own stale trace does measurably worse, and pays more, than one that prunes intelligently.

Against fixed-interval summarization, the headline is efficiency. SelfCompact matched or exceeded the threshold’s quality at a fraction of its token cost.[1](https://blakecrosley.com/blog/agent-context-compaction#fn:1) Compacting on judgment rather than on a clock means the agent compacts less often and at better moments, so it pays for fewer summarization passes and reconstructs fewer discarded results. The threshold was not occasionally mistimed. It was systematically more expensive for the same or worse quality.

A 30 to 70 percent cost reduction on long-horizon tasks is not a rounding error. For anyone running agents at volume, the compaction policy is a line item, and the paper says the default policy most scaffolds ship is paying for summarization passes it does not need.

## What This Means for People Running Agents

The practical takeaway is not “go implement SelfCompact right now.” Most operators do not control their agent’s compaction trigger directly. The takeaway is that compaction is a tunable policy with real quality and cost consequences, and the threshold default is worth questioning.

**Treat compaction boundaries as semantic, not numeric.** When you structure a long task, give the agent natural stopping points: finish a file, close a sub-task, reach a checkpoint. An agent that compacts at a sub-task boundary loses nothing it needs. An agent that compacts at a token boundary loses whatever it happened to be holding. The [operator’s job](https://blakecrosley.com/blog/agent-operators-handbook) is partly to shape the trajectory so the safe moments and the compaction moments line up.

**Watch for re-derivation as a symptom.** If an agent comes back from a compaction and redoes work it had already done, the trigger fired in the wrong place. Re-derivation is the observable signature of a mistimed compaction, and it is a cost you can see in the trace if you look for it.

**Expect the trigger to move into the model.** SelfCompact needs no fine-tuning, which means it is a prompt-and-tool pattern any scaffold can adopt. The clean result on open-weight models suggests this becomes a default: agents that decide their own compaction rather than waiting for the runtime to force it. The threshold will look, in retrospect, like an artifact of treating context as a buffer to flush instead of a working memory to manage.

The broader pattern is one I keep running into with agents. The hard part is rarely the capability. Frontier models can summarize a trajectory well. The hard part is the metacognition: knowing when to do the thing it already knows how to do. Compaction timing, like [knowing when to ask for confirmation](https://blakecrosley.com/blog/ai-agent-approval-prompts-not-authorization) or [when to stop a research loop](https://blakecrosley.com/blog/ai-agents-need-exploration-checkpoints), is a self-monitoring decision, and self-monitoring is where the current generation is weakest. The fix in every case is the same shape SelfCompact uses: stop hoping the model notices, and hand it an explicit rubric for the judgment.

## Key Takeaways

**For agent operators:**

- Audit when your scaffold compacts. If it fires on a token threshold, it is firing without regard to whether the agent is mid-task.
- Structure long tasks around explicit checkpoints so compaction boundaries fall at safe moments instead of arbitrary ones.
- Treat re-derivation after a compaction as a bug in the trigger, not a quirk of the model.

**For people building scaffolds:**

- A compaction tool plus a fire/suppress rubric beat a fixed interval at lower cost, with no fine-tuning required.
- Separate the two abilities: models summarize well but judge timing poorly. Spend your design effort on the timing rubric, not the summarizer.

**For anyone budgeting agent runs:**

- Compaction policy is a cost line item. A judgment-based trigger cut per-question cost 30 to 70 percent in the study, for equal or better quality.

## FAQ

### What is context compaction?

Context compaction is summarizing an agent’s accumulated trajectory (its chain of thought and tool calls) into a shorter form so the trace does not outgrow the model’s context window. It trades detail for room. Done well, it removes stale content while preserving what the agent still needs. Done at the wrong moment, it discards partial results the agent has to recompute.

### Why is a token threshold a bad compaction trigger?

A token threshold measures the size of the context but not its structure. It cannot tell whether the agent just finished a sub-task or is halfway through a derivation. Firing in the second case throws away intermediate results the model paid to compute, forcing expensive re-derivation. The trigger should reflect where the agent is in its work, which a counter cannot see.

### How does SelfCompact decide when to compact?

It pairs a compaction tool the model can invoke with a rubric that specifies when to fire (a sub-task resolved, the trajectory is converging) and when to suppress (mid-derivation, or stuck). The model already summarizes well; the rubric supplies the timing judgment it lacks unprompted. The approach requires no fine-tuning or external supervision.

### Does this require a special model?

No. The paper evaluated seven models, including open-weight ones, and the pattern works through prompting and tool use alone. That makes it adoptable by any scaffold without retraining.

### How much does judgment-based compaction save?

In the study, SelfCompact matched or exceeded fixed-interval summarization while spending 30 to 70 percent less per question, and beat a no-summarization baseline by up to 18.1 points on math and 5 to 9 on agentic search.

* * *

## Sources

- Tianjian Li, Jingyu Zhang, William Jurayj, Xi Wang, Chuanyang Jin, Mehrdad Farajtabar, Eric Nalisnick, and Daniel Khashabi, “Self-Compacting Language Model Agents,” arXiv, June 22, 2026: [arxiv.org/abs/2606.23525](https://arxiv.org/abs/2606.23525)
- Anthropic, “Explore the context window,” Claude Code documentation, on automatic compaction near the context limit: [code.claude.com/docs/en/context-window](https://code.claude.com/docs/en/context-window)
- Related production experience on autonomous loops and context management: [Ralph agent architecture](https://blakecrosley.com/blog/ralph-agent-architecture), [compound context](https://blakecrosley.com/blog/compound-context), and the [agent operator’s handbook](https://blakecrosley.com/blog/agent-operators-handbook)

* * *

1. Li et al., “Self-Compacting Language Model Agents,” arXiv:2606.23525 (June 22, 2026). The abstract reports the tool-plus-rubric design, the necessity of both components, the no-fine-tuning result, the six-benchmark and seven-model evaluation, and the quantitative gains: over a no-summarization baseline, up to 18.1 points on math and 5 to 9 points on agentic search at 30 to 70 percent lower per-question cost; and matching or exceeding fixed-interval summarization at a fraction of the token cost. [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref:1 "Jump back to footnote 1 in the text") [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref2:1 "Jump back to footnote 1 in the text") [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref3:1 "Jump back to footnote 1 in the text") [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref4:1 "Jump back to footnote 1 in the text") [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref5:1 "Jump back to footnote 1 in the text") [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref6:1 "Jump back to footnote 1 in the text") [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref7:1 "Jump back to footnote 1 in the text")

2. Anthropic, “Explore the context window,” Claude Code documentation: “Claude Code compacts automatically as you approach the limit, so a full context window doesn’t end your session.” [code.claude.com/docs/en/context-window](https://code.claude.com/docs/en/context-window) [↩](https://blakecrosley.com/blog/agent-context-compaction#fnref:2 "Jump back to footnote 2 in the text")


## Related Posts

[**Compound Context: Why AI Projects Improve Over Time** \\
Every problem you solve with an AI agent deposits context that the next session withdraws with interest. This is context…\\
12 min read](https://blakecrosley.com/blog/compound-context) [**The Handoff Document: Agent Memory Across Sessions** \\
A diagnosis survived three corrections over four days and guided a fix that cut page load from 14s to 108ms. Handoffs ca…\\
8 min read](https://blakecrosley.com/blog/the-handoff-document) [**Your Agent Writes Faster Than You Can Read** \\
Five research groups published about the same problem this week: AI agents produce code faster than developers can under…\\
17 min read](https://blakecrosley.com/blog/cognitive-debt-agents)

## More from 941 Apps

[![ResumeGeni icon](https://blakecrosley.com/static/images/family/resumegeni.png)ResumeGeniAI resume builder for ATS optimization](https://resumegeni.com/) [![Ace Citizenship icon](https://blakecrosley.com/static/images/family/ace-citizenship.png)Ace CitizenshipUSCIS test prep with spaced repetition](https://acecitizenship.app/) [![Get Bananas icon](https://blakecrosley.com/static/images/family/get-bananas.png)Get BananasHand-drawn family shopping list](https://941getbananas.com/) [![Return icon](https://blakecrosley.com/static/images/family/return.png)ReturnZen meditation timer for Apple devices](https://941return.com/) [![Ki icon](https://blakecrosley.com/static/images/family/ki.png)KiPrivate iPhone browser](https://941ki.com/) [![Tappy Color icon](https://blakecrosley.com/static/images/family/tappy-color.png)Tappy ColorFast-paced color matching game](https://941apps.com/tappy-color) [![Captain's Log icon](https://blakecrosley.com/static/images/family/captains-log.png)Captain's LogDaily operational journal for builders](https://941apps.com/captains-log) [![941 Tiles icon](https://blakecrosley.com/static/images/family/tile.png)941 TilesOne-click macOS window manager](https://941tiles.com/) [![Learn Materia icon](https://blakecrosley.com/static/images/family/learn-materia.png)Learn MateriaPrint-first kindergarten homework](https://learnmateria.com/) [![Reps icon](https://blakecrosley.com/static/images/family/reps.png)RepsStrength training on every Apple screen](https://941reps.com/) [![Randori icon](https://blakecrosley.com/static/images/family/randori.png)RandoriJiu-jitsu training log for iPhone and Watch](https://randoriapp.com/) [![Cels icon](https://blakecrosley.com/static/images/family/cels.png)CelsFloating glass notes for macOS 26](https://941apps.com/cels)