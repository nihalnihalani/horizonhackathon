Title:

Content selection saved. Describe the issue below:

Description:

![](https://arxiv.org/static/base/1.0.1/images/icons/smileybones-small.svg)arXiv is now an independent nonprofit! [Learn more](https://info.arxiv.org/about) ×

[License: CC BY-NC-ND 4.0](https://info.arxiv.org/help/license/index.html#licenses-available)

arXiv:2605.10913v3 \[cs.AI\] 24 Jun 2026

# ![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces

Simon Yu
Email: [yu.chi@northeastern.edu](mailto:)Derek Chong
Email: [we.shi@northeastern.edu](mailto:)Ananjan Nandi
Dilara Soylu
Affiliation: Stanford University
Jiuding Sun
Affiliation: Stanford University
Christopher D Manning
Affiliation: Stanford University
Weiyan Shi
Email: [{derekch, ananjan, soylu, sunjd24, manning}@stanford.edu\*Equal contribution](mailto:Equal%20contribution)Affiliation: Northeastern University

###### Abstract

As LLM agent systems take on more complex tasks, they increasingly rely on meta-agents: higher-order agents that create, operate on and manage other agents. Meta-agent operations such as coordinating agents, halting risky actions before execution, or repairing failed runs, require runtime manipulation of agentic execution.
Yet existing agentic substrates make this difficult: they expose only transcripts and environment snapshots, forcing meta-agents to build ad hoc tooling to reconstruct and operate over full execution state.
Therefore, we introduce Shepherd, a Python substrate grounded in
functional programming principles, where an agent’s execution is itself a first-class object that a meta-agent can easily inspect and transform. Every model action, tool call, and environment change becomes a structured event in a reversible, Git-like execution trace, where any past state can be reverted 5× faster than docker commit and fork. Three example use cases show Shepherd’s versatility: (1) a supervisor meta-agent prevents conflicts among parallel coding agents, lifting pair-coding pass rate from 28.8% to 54.7% on CooperBench; (2) a counterfactual optimization meta-agent repairs agent workflows by proposing edits and replaying runs from the point of changed behavior, outperforming MetaHarness on Terminal-Bench 2.0 by 12.8% with 58% lower wall-clock; (3) a training meta-agent picks fork points during rollouts to improve credit assignment in long-horizon agentic RL, doubling GRPO’s uplift on Terminal-Bench 2.0. We open-source Shepherd to enable principled and efficient operations over agentic execution for both users and meta-agents.

[Website](https://shepherd-agents.ai/ "")[Blog](https://shepherd-agents.ai/blog "") [Framework](https://github.com/shepherd-agents/shepherd "")

![Refer to caption](https://arxiv.org/html/2605.10913v3/figures1.png)Figure 1: Shepherd meta-agents. _Top:_ A meta-agent optimizes an agent’s execution trace. _Bottom:_ Results from three meta-agents: (A) runtime intervention; (B) meta-optimization; (C) Tree-GRPO.

## 1 Introduction

As LLM-based agentic systems mature, we increasingly see the use of agents that act on other agents at runtime.
[Asawa et al. \[2\]](https://arxiv.org/html/2605.10913v3#bib.bib11 ""), [Lin et al. \[24\]](https://arxiv.org/html/2605.10913v3#bib.bib54 "") develop advisor
agents that learn intervention policies from execution traces to steer agents away from dead ends; meta-optimizers such as GEPA and MetaHarness optimize agentic workflows to improve performance on a given downstream task  \[ [1](https://arxiv.org/html/2605.10913v3#bib.bib1 ""), [20](https://arxiv.org/html/2605.10913v3#bib.bib8 "")\]; and
[Hou et al. \[10\]](https://arxiv.org/html/2605.10913v3#bib.bib27 ""), [Ji et al. \[13\]](https://arxiv.org/html/2605.10913v3#bib.bib25 "")
build tree-search RL that branches rollouts to compare rewards from alternate continuations and improve per-step credit assignment. We call these systems _meta-agents_: higher-order agents that operate over other agents and their execution traces, during or after execution. Meta-agents are increasingly central to extracting capability from agentic systems \[ [51](https://arxiv.org/html/2605.10913v3#bib.bib50 "")\].

Table 1: Support for meta-agent operations on a running agent. = fully supported;
= supported only for the agent;
= supported only for the environment;
= not supported.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Method | Interceptexecution | Forkagent + env. | Revertto past state | Modifyagent behavior |
| BranchFS |  |  |  |  |
| Docker |  |  |  |  |
| OpenHands |  |  |  |  |
| AgentGit |  |  |  |  |
| Shepherd |  |  |  |  |

Yet, existing agentic substrates are not designed for meta-agents. Consider a supervisor meta-agent that forks a coding agent before a risky write, watches the branch execute, and reverts the change in the event of failure. To do this, the meta-agent must observe the running agent, intercept and fork it before the write, revert it on failure, modify it to fix the failure, and then resume execution. Recent work exposes fragments of these operations: OpenHands surfaces a session’s event stream \[ [42](https://arxiv.org/html/2605.10913v3#bib.bib55 "")\], AgentGit gives the worker Git-like commit tools \[ [23](https://arxiv.org/html/2605.10913v3#bib.bib6 "")\], BranchFS isolates the filesystem \[ [39](https://arxiv.org/html/2605.10913v3#bib.bib5 "")\] ( [Table1](https://arxiv.org/html/2605.10913v3#S1.T1 "In 1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). However, these substrates are designed to maintain runtime state for the running agent, not to give a meta-agent the operations it needs to act on that agent. As a result, meta-agent implementations need to reinvent custom tooling to support these operations in practice.

We argue for a different approach: give an agent and its execution the first-class treatment functions get in functional programming – structured data a meta-agent can hold, execute, copy, and rewrite. This approach then enables algebraic effect handlers\[ [30](https://arxiv.org/html/2605.10913v3#bib.bib18 "")\] that intercept and observe execution without modifying it, allowing its reversion, as well as continuations\[ [6](https://arxiv.org/html/2605.10913v3#bib.bib19 "")\] that support pause-inspect-decide-resume patterns for meta-agents. We therefore propose
![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd, a principled functional programming model for higher-order agents, instantiated as an intuitive Python substrate (Figure [1](https://arxiv.org/html/2605.10913v3#S0.F1 "Figure 1 ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"), Section [3](https://arxiv.org/html/2605.10913v3#S3 "3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

Shepherd defines agents as tasks with typed inputs and outputs, and records the execution of these tasks in a reversible, Git-like
_execution trace_: every agent action (tool call, filesystem modification, database operation) becomes a commit in this trace, every fork is a branch, and every past agent-environment state can be reverted to through checkouts.
A meta-agent can then _observe_ a task’s execution by subscribing to its commits, _intercept_ by pushing events into its trace, _revert_ to any prior agent-environment state by checking out the corresponding commit, _fork_ a new copy of this state, and
_modify_ the task itself by rewriting its definition.

Our principled functional programming grounding gives Shepherd meta-agents several powerful capabilities:
an observing meta-agent does not perturb the observed agent’s execution, parallel agents can run as isolated processes over forked environments within a shared sandbox, and reverting to any commit restores a byte-identical copy of the corresponding agent-environment state.
We formalize these properties through a small algebraic-effects calculus mechanized in Lean, which also provides a precise semantic contract for the execution trace.
The implementation is model-agnostic and
lightweight: for a 5.8 GB docker image, Shepherd forks the agent-environment state at 5×5\\times the speed of a docker
commit, and reuses over 95%95\\% of the LLM provider’s KV cache.

Shepherd enables the easy implementation of meta-agent applications that
previously required substantial bespoke engineering. We showcase three example meta-agents
spanning a typical agent lifecycle. _During execution_, a _runtime_
_supervisor meta-agent_ (§ [5.1](https://arxiv.org/html/2605.10913v3#S5.SS1 "5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")) watches the execution traces of parallel coding workers and intercepts before they conflict, raising CooperBench \[ [17](https://arxiv.org/html/2605.10913v3#bib.bib7 "")\] joint pass rate from
28.8% to 54.7%. _After execution_, a _counterfactual meta-optimizer_ (§ [5.2](https://arxiv.org/html/2605.10913v3#S5.SS2 "5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")) diagnoses failures in prior agent runs and validates proposed fixes by branching runs at the first point where the fix would change behavior, outperforming state-of-the-art meta-optimizers such as MetaHarness \[ [20](https://arxiv.org/html/2605.10913v3#bib.bib8 "")\] by up to 27.5% on benchmarks such as LiveCodeBench \[ [12](https://arxiv.org/html/2605.10913v3#bib.bib53 "")\] and Terminal-Bench 2.0 \[ [25](https://arxiv.org/html/2605.10913v3#bib.bib24 "")\], while cutting wall-clock time by up to 58%.
_During training_, a _tree-search RL trainer_
(§ [5.3](https://arxiv.org/html/2605.10913v3#S5.SS3 "5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")) forks rollouts at meta-agent-chosen
turns and samples sibling continuations to improve credit assignment by computing advantages from outcome rewards, outperforming GRPO \[ [33](https://arxiv.org/html/2605.10913v3#bib.bib23 "")\]’s performance when used to train Qwen3.5-35B-A3B \[ [32](https://arxiv.org/html/2605.10913v3#bib.bib38 "")\] on Terminal-Bench 2.0 by 5.2 points.

In summary, we contribute (i) ![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd, a programming model for higher-order agents whose core operations are grounded in functional programming and mechanized in Lean; (ii) a Python framework instantiating this model in a performant and efficient substrate; and (iii) three meta-agents spanning the agent lifecycle built using the Shepherd substrate.

## 2 Related Work

##### Meta-Agents.

Meta-agent applications are emerging in recent work \[ [51](https://arxiv.org/html/2605.10913v3#bib.bib50 ""), [50](https://arxiv.org/html/2605.10913v3#bib.bib22 "")\]. Darwin-Gödel Machines \[ [53](https://arxiv.org/html/2605.10913v3#bib.bib39 "")\] and Group-Evolving Agents \[ [45](https://arxiv.org/html/2605.10913v3#bib.bib40 "")\] maintain dynamic archives of self-modifying code. Hyperagents \[ [54](https://arxiv.org/html/2605.10913v3#bib.bib9 "")\] and Meta-Harness \[ [20](https://arxiv.org/html/2605.10913v3#bib.bib8 "")\] optimize a task agent’s problem-solving strategies at the meta level. Other lines refine an agent’s context and long-term retrieval through evolutionary search \[ [26](https://arxiv.org/html/2605.10913v3#bib.bib41 ""), [43](https://arxiv.org/html/2605.10913v3#bib.bib42 "")\] or memory-augmented architectures \[ [56](https://arxiv.org/html/2605.10913v3#bib.bib43 ""), [22](https://arxiv.org/html/2605.10913v3#bib.bib12 ""), [57](https://arxiv.org/html/2605.10913v3#bib.bib44 ""), [48](https://arxiv.org/html/2605.10913v3#bib.bib45 ""), [44](https://arxiv.org/html/2605.10913v3#bib.bib46 ""), [34](https://arxiv.org/html/2605.10913v3#bib.bib16 "")\]. Each of these methods reinvents the runtime machinery needed to act on agents – parsing transcripts, building bespoke environment snapshots, re-executing with modified source code. Shepherd provides a unified substrate for these operations, letting a meta-agent observe agents without perturbing them, fork their coupled agent-environment state, and replay prior execution byte-identically.

##### Agentic Meta-Optimization.

Orchestrating multiple LLM agents is a common strategy for performing complex tasks and inference-time scaling. Standard multi-agent frameworks \[ [46](https://arxiv.org/html/2605.10913v3#bib.bib4 ""), [9](https://arxiv.org/html/2605.10913v3#bib.bib13 ""), [11](https://arxiv.org/html/2605.10913v3#bib.bib10 "")\] route natural-language messages between workers; CooperBench \[ [17](https://arxiv.org/html/2605.10913v3#bib.bib7 "")\] shows the coordination failures that can result from this. Pipeline optimizers \[ [16](https://arxiv.org/html/2605.10913v3#bib.bib3 ""), [5](https://arxiv.org/html/2605.10913v3#bib.bib2 ""), [58](https://arxiv.org/html/2605.10913v3#bib.bib14 "")\] and test-time scaling methods \[ [18](https://arxiv.org/html/2605.10913v3#bib.bib47 ""), [21](https://arxiv.org/html/2605.10913v3#bib.bib48 "")\] use parallel rollouts and majority voting, evaluating each candidate by full end-to-end re-execution. GEPA \[ [1](https://arxiv.org/html/2605.10913v3#bib.bib1 "")\] introduces a reflective meta-agent that proposes workflow edits. These methods treat the underlying execution as a black box and re-run candidates from scratch. Shepherd adds a different evaluation primitive: a meta-agent can branch a worker’s context at the exact commit where an edit first alters behavior and replay only the affected suffix ( [Section4](https://arxiv.org/html/2605.10913v3#S4 "4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), so candidates reuse computation effectively.

##### Agentic Runtime and Infrastructure.

A parallel line of research adds infrastructure support for agentic state management, placing the checkpoint primitive at different layers of the software stack. AgentGit \[ [23](https://arxiv.org/html/2605.10913v3#bib.bib6 "")\] exposes version-control operations as cooperative tools the agent can invoke from within a LangGraph workflow. BranchFS \[ [39](https://arxiv.org/html/2605.10913v3#bib.bib5 "")\] adds a kernel-level branch() system call that isolates filesystem state, independent of the worker’s tool-call structure. AgentSPEX \[ [40](https://arxiv.org/html/2605.10913v3#bib.bib49 "")\] embeds checkpointing into a domain-specific language for agent workflows. Each of these places the checkpoint primitive at a different point in the stack, with different trade-offs between agent autonomy, transparency, and language-level integration. Shepherd sits at a different point in this design space: it couples environment states with the agent execution state, so the substrate observes the same events the worker emits without requiring the worker to be rewritten or replayed from scratch. This lets the same substrate support runtime supervision, post-hoc trajectory optimization, meta-optimization and stateful RL under a unified interface.

## 3 The ![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd Programming Model

The supervisor meta-agent in Figure [1](https://arxiv.org/html/2605.10913v3#S0.F1 "Figure 1 ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") needs the following operations on worker agents: _observe_ what it is doing at runtime, _intercept_ and _fork_ execution before a risky write to try an alternative continuation, _revert_ changes in case of failure, and then _modify_ the agent to fix the issue and _resume_ execution. These are operations difficult to support in existing substrates because agentic execution is full of side effects such as model calls, filesystem writes, and tool invocations, that resist being treated as inspectable, manipulable values.

Table 2: Mapping of Shepherd primitives to runtime meta-agent operations enabled and functional programming (FP) constructs.

|     |     |     |
| --- | --- | --- |
| Primitive | Runtime Operation Enabled | FP construct |
| Task | Modify agent behavior | typed function |
| Effect | Observe and intercept execution | algebraic effect |
| Scope | Fork execution state | scoped effect handler |
| Trace | Revert and replay from past state | persistent data structure |

Functional programming has a long tradition of structuring effectful computation by drawing a boundary separating _what_ a computation describes from _how_ its effects reach the world. Computation inside this boundary becomes observable, substitutable, branchable, and replayable. Shepherd extends this discipline to agentic execution, treating it as a first-class object \[ [47](https://arxiv.org/html/2605.10913v3#bib.bib20 "")\]. Doing so requires elevating four concepts to first-class status: what the agent _is_ (tasks, § [3.1](https://arxiv.org/html/2605.10913v3#S3.SS1 "3.1 Task: Agent Definition ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), what it _does_ (effects, § [3.2](https://arxiv.org/html/2605.10913v3#S3.SS2 "3.2 Effects: Agent Actions ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), where it _runs_ (scopes, § [3.3](https://arxiv.org/html/2605.10913v3#S3.SS3 "3.3 Scopes: Agent Environments ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), and what has already been _done_ (execution trace, § [3.4](https://arxiv.org/html/2605.10913v3#S3.SS4 "3.4 Execution Trace: Agent Execution History ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). Each primitive is grounded in a functional-programming construct (Table [2](https://arxiv.org/html/2605.10913v3#S3.T2 "Table 2 ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), and key properties of Shepherd rest on a small Lean-mechanized semantics for typed effect traces (Appendix [B](https://arxiv.org/html/2605.10913v3#A2 "Appendix B Mechanized Core and Proof Envelopes ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

### 3.1 Task: Agent Definition

For a supervisor meta-agent to modify an agent – by changing its code, composing them into workflows or even synthesizing helper agents at runtime – the agent must be a _value_: something that can be held, passed as an argument, or returned from a call. Functional programming gives this property to functions. A function with a typed input and a typed output is substitutable for any other function with the same type, and a higher-order function can take functions as arguments. Agents in Shepherd have the same shape. A task is a typed function over agentic execution with typed input and output, and a body that may call LLMs, tools, and other tasks. They are declared using the @agent decorator over typed Python functions, and can call models through _providers_:

[⬇](data:text/plain;base64,QGFnZW50KExMTT0iaGFpa3UiKQpkZWYgaW1wbGVtZW50KHJlcG86IEdpdFdvcmtzcGFjZSwgZmVhdHVyZTogc3RyKSAtPiBHaXRQYXRjaDoKIiIiSW1wbGVtZW50IHRoZSBmZWF0dXJlIGluIHRoZSByZXBvLiIiIgoKQGFnZW50KExMTT0ib3B1cyIpCmRlZiBvdmVyc2VlKGFnZW50X3J1bjogVGFza1tHaXRQYXRjaF0pIC0+IEdpdFBhdGNoOgoiIiJXYXRjaCB0aGUgYWdlbnQ7IGZvcmsgYmVmb3JlIHJpc2t5IGVkaXRzOyBtZXJnZSB0aGUgcGFzc2luZyBwYXRjaC4iIiI=)

1@agent(LLM="haiku")

2defimplement(repo:GitWorkspace,feature:str)->GitPatch:

3"""Implementthefeatureintherepo."""

4

5@agent(LLM="opus")

6defoversee(agent\_run:Task\[GitPatch\])->GitPatch:

7"""Watchtheagent;forkbeforeriskyedits;mergethepassingpatch."""

##### Tasks are substitutable values.

A task is fully specified by its signature and docstring – Shepherd compiles them into an LLM prompt guided by the docstring, where the output is validated against the defined type. Users may also implement a body for the task when a mix of deterministic and LLM-driven computation is required. As shown above, meta-agents in Shepherd are just tasks whose arguments happen to be other tasks, and they therefore hierarchically allow for meta-meta-agents over their execution. Any task with the same typed signature can also substitute for each other, allowing meta-agents to easily edit behavior at runtime. Because a task is fully specified by this typed signature and docstring, a meta-agent can also _create_ new sub-agents at runtime by synthesizing fresh task definitions, not only modify existing ones.

A task turns an agent into a value, but when an agent interacts with its environment, the substrate still has no handle on it. The next primitive gives every such action a typed value of its own.

### 3.2 Effects: Agent Actions

A supervisor meta-agent needs to see what the worker agent is doing while it executes, without perturbing it. Functional programming solves the analogous problem for effectful programs with _algebraic effects_\[ [29](https://arxiv.org/html/2605.10913v3#bib.bib17 ""), [30](https://arxiv.org/html/2605.10913v3#bib.bib18 "")\]: any operation that touches the outside world (read a file, send a message) is reified as a typed event, and a _handler_ decides what that event means. The same program can be run under different handlers without changing its source: one handler could execute it, while another logs it.

Shepherd applies this discipline to agent actions. An effect is a typed record of a single action attempted by a worker. They can record LLM calls, tool calls, environment mutations, or even user-defined custom actions. Every effect a worker emits is appended to the immutable effect stream of the scope it’s running in (§ [3.3](https://arxiv.org/html/2605.10913v3#S3.SS3 "3.3 Scopes: Agent Environments ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), and a meta-agent can observe the stream by subscribing to it, or intercept a running execution by pushing effects into the stream.

##### An action’s intent and outcome are separate events.

Each action emits two effects: an _intent_ when the worker issues the action, and an _outcome_ when the world responds. Therefore, a meta-agent can read an intent, decide it shouldn’t materialize, and act before the outcome arrives, as below:

[⬇](data:text/plain;base64,YXN5bmMgZm9yIGVmZmVjdCBpbiB3b3JrLnRyYWNlLmxpdmUoKToKICAgIGlmIGlzaW5zdGFuY2UoZWZmZWN0LCBUb29sQ2FsbEludGVudCkgYW5kIGlzX2Rlc3RydWN0aXZlKGVmZmVjdCk6CiAgICAgICAgaWYgY2hlY2soZWZmZWN0KSA9PSAiZGVueSI6CiAgICAgICAgICAgIHdvcmsuZGlzY2FyZCgpICAjIG91dGNvbWUgbmV2ZXIgbWF0ZXJpYWxpemVz)

1asyncforeffectinwork.trace.live():

2ifisinstance(effect,ToolCallIntent)andis\_destructive(effect):

3ifcheck(effect)=="deny":

4work.discard()#outcomenevermaterializes

##### Observation is non-perturbing.

Since the worker’s effect stream is immutable, it is byte-identical whether or not a meta-agent is watching. Because intent is decoupled from execution, a meta-agent can also replay a slice of the effect stream under a different handler. For example, a meta-agent can replay a tool-call under a modified task body to see how the underlying agent’s behavior changes.

##### Most effects are reversible.

Every effect carries a reversibility tier that determines its behavior when materialized, or executed against the world. _Reversible_ (such as filesystem writes, sandbox state) and _compensable_ effects (such as database writes) are captured by the substrate at emission time and can be rolled back at will by an user or meta-agent. Reversible effects roll back natively through their scope (§ [3.3](https://arxiv.org/html/2605.10913v3#S3.SS3 "3.3 Scopes: Agent Environments ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), and compensable effects roll back through user-supplied compensation handlers invoked by the substrate. However, _irreversible_ effects (such as model calls, emails) materialize on emission, and the stream can only record them for audit.

Reading, reverting and reinterpreting actions is enough for an observer. However, a meta-agent trying alternative execution paths needs to be able to fork the worker and its environment atomically.

### 3.3 Scopes: Agent Environments

When the supervisor meta-agent forks an agent, it must run in its own, isolated world. Any effects emitted in the branch must not leak into the parent’s effect stream. The functional programming construct enabling this is the _region-scoped effect handler_. A function can open a fresh handler for some sub-region of its execution, run inside it, and then either propagate that region’s effects outward (commit) or abandon them (revert). Regions nest cleanly: each level owns its own effect interpretation and cannot contaminate others. A scope in Shepherd implements this construct for agentic execution. It binds the worker’s sandbox handles, model providers, tool surfaces, and effect-stream cursor, and it owns the effects emitted by tasks running inside it.

##### Scopes support four primitives.

emit writes an effect to the scope’s stream. fork opens a copy-on-write child scope. merge propagates a child’s effects into its parent. discard abandons a child, leaving the parent untouched. Filling in supervise’s body from § [3.1](https://arxiv.org/html/2605.10913v3#S3.SS1 "3.1 Task: Agent Definition ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"):

[⬇](data:text/plain;base64,QGFnZW50CmRlZiBvdmVyc2VlKHdvcms6IFRhc2tbUGF0Y2hdKSAtPiBQYXRjaDoKICAgIGNoaWxkID0gc2NvcGUuZm9yaygpCiAgICByZXN1bHQgPSBhd2FpdCB3b3JrKGNoaWxkKQogICAgaWYgcmVzdWx0LmZhaWxlZDogY2hpbGQuZGlzY2FyZCgpCiAgICBlbHNlOiBzY29wZS5tZXJnZShjaGlsZCkKICAgIHJldHVybiByZXN1bHQ=)

1@agent

2defoversee(work:Task\[Patch\])->Patch:

3child=scope.fork()

4result=awaitwork(child)

5ifresult.failed:child.discard()

6else:scope.merge(child)

7returnresult

##### The agent and its environment are forked atomically.

scope.fork() captures the worker’s filesystem, processes, and bindings in one atomic copy-on-write step. A subsequent discard therefore rolls back every trace of what the worker agent touched. The substrate realizes this through overlay-filesystem virtualization and the native checkpoint facilities of containerized sandboxes, behind a unified device-layer interface (Appendix [C.7](https://arxiv.org/html/2605.10913v3#A3.SS7 "C.7 Realization across Sandbox Backends ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

##### Scopes can be parallelized, nested, reverted and resumed.

A meta-agent can create concurrent forks from a parent scope and merge or discard each independently. Scopes also nest: a meta-meta-agent can fork, observe, and resume a meta-agent without contaminating the worker beneath. Discarding a child scope leaves the parent byte-identical to the moment of fork. Resuming a scope also preserves the worker agent’s world: a paused worker resumed by a meta-agent sees the bindings recorded in its original scope, not whatever the meta-agent currently holds.

A scope owns the _present_ region of execution. However, to _revert_ to an arbitrary past state, execution history itself must be a navigable value. We address this next.

### 3.4 Execution Trace: Agent Execution History

A supervisor meta-agent that wants to revert a worker agent – return to an earlier moment in its execution and either inspect it or run forward from there under different conditions – needs every past state of the worker’s execution to be reachable on demand. In functional programming, _persistent data structures_\[ [28](https://arxiv.org/html/2605.10913v3#bib.bib21 "")\] provide this property: every version of the structure remains accessible after modification, with new versions sharing structure with old ones for efficiency. In Shepherd, the counterpart to this is the execution trace. It is a persistent Git-like commit graph: each scope’s effect stream materializes as a sequence of typed commits on a branch of the graph. The four scope operations of § [3.3](https://arxiv.org/html/2605.10913v3#S3.SS3 "3.3 Scopes: Agent Environments ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") then compile to Git-like operations as well:

[⬇](data:text/plain;base64,c2NvcGUuZW1pdChlZmZlY3QpICAgPD0+ICBzaGVwaGVyZCBjb21taXQgLW0gIjxlZmZlY3Q+IgpzY29wZS5mb3JrKCkgICAgICAgICA8PT4gIHNoZXBoZXJkIGNoZWNrb3V0IC1iIDxjaGlsZC1icmFuY2g+CnNjb3BlLm1lcmdlKGNoaWxkKSAgIDw9PiAgc2hlcGhlcmQgbWVyZ2UgPGNoaWxkLWJyYW5jaD4Kc2NvcGUuZGlzY2FyZChjaGlsZCkgPD0+ICBzaGVwaGVyZCBicmFuY2ggLUQgPGNoaWxkLWJyYW5jaD4=)

1scope.emit(effect)<=>shepherdcommit-m"<effect>"

2scope.fork()<=>shepherdcheckout-b<child-branch>

3scope.merge(child)<=>shepherdmerge<child-branch>

4scope.discard(child)<=>shepherdbranch-D<child-branch>

##### Every past state is reachable and replayable.

A meta-agent can navigate to any commit by hash and read the exact agent-environment state at that moment, with its full scope intact. Locating the specific commit where a regression first appeared, or where two siblings began to diverge, reduces to graph traversal on this trace. Replaying from a past commit also produces a byte-exact reconstruction of the scope before diverging, so the only cost paid by the meta-agent is the executed suffix.

##### Divergent branches share storage.

Just as persistent data structures share substructures across versions, the execution trace shares storage across branches: two siblings forked from the same commit share their entire prefix by content hash. A meta-agent fanning out across many forks pays only for the divergent suffixes, and any set of branches can be diffed based on their captured effects, therefore letting a meta-agent decide which to merge on the basis of their behavior.

## 4 Framework Performance

Table 3: Fork/revert latency (ms), storage, and host resource cost at K=4K{=}4 concurrent branches across three Terminal-Bench 2.0 images. Shepherd’s 134–143 ms fork is 2–3% of one agent turn (Appendix [C.3](https://arxiv.org/html/2605.10913v3#A3.SS3 "C.3 Agent per-turn latency reference ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). Best per group in bold; full ±\\pmstd and protocol in Appendix [C.1](https://arxiv.org/html/2605.10913v3#A3.SS1 "C.1 Measurement Protocol ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

|     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- |
| Image | Method | Fork ↓\\downarrow | Revert ↓\\downarrow | Storage ↓\\downarrow | Branching (K=4) |
| Disk ↓\\downarrow | RAM ↓\\downarrow |
| openssl-selfsigned-cert(42 MB image) | Full copy | 5,154 ms | 2,067 ms | 268 MB | 804 MB | 112 MB |
| Docker commit | 658 ms | 749 ms | 30 KB | 90 KB | 29.8 MB |
| Modal snapshot | 3,764 ms | 2,260 ms | — | — | — |
| BranchFS \[ [39](https://arxiv.org/html/2605.10913v3#bib.bib5 "")\] | 266 ms | 360 ms | 12 KB | 48 KB | 22.7 MB |
| ![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd | 134 ms | 142 ms | 10 KB | 30 KB | 20.5 MB |
| caffe-cifar-10(200 MB image) | Full copy | 5,971 ms | 3,446 ms | 645 MB | 1.9 GB | 230 MB |
| Docker commit | 692 ms | 761 ms | 30 KB | 90 KB | 38.3 MB |
| Modal snapshot | 3,291 ms | 2,463 ms | — | — | — |
| BranchFS \[ [39](https://arxiv.org/html/2605.10913v3#bib.bib5 "")\] | 272 ms | 357 ms | 12 KB | 48 KB | 29.4 MB |
| ![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd | 135 ms | 140 ms | 10 KB | 30 KB | 27.1 MB |
| pytorch-model-recovery(5.8 GB image) | Full copy | 53,462 ms | 25,943 ms | 8.3 GB | 24.9 GB | 910 MB |
| Docker commit | 725 ms | 828 ms | 30 KB | 90 KB | 30.2 MB |
| Modal snapshot | 3,160 ms | 2,328 ms | — | — | — |
| BranchFS \[ [39](https://arxiv.org/html/2605.10913v3#bib.bib5 "")\] | 280 ms | 358 ms | 12 KB | 48 KB | 22.7 MB |
| ![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd | 143 ms | 147 ms | 10 KB | 30 KB | 25.7 MB |

Three cost properties are crucial for meta-agents in Shepherd to be performant: scope.fork() must be image-size-independent so branching is affordable; the trace must scale with what the agent writes and not the image so it can persist across long executions; and the byte-identical replay guarantee must reach the LLM provider’s prompt cache so re-execution efficiently reuses KV cache. We measure each on real Terminal-Bench 2.0 images. Full results are in Appendix [C](https://arxiv.org/html/2605.10913v3#A3 "Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

##### Fork and revert are fast and image-size-independent.

Shepherd fork creates a new copy-on-write layer on top of the existing filesystem instead of duplicating it, so cost is constant regardless of image size. As a result, forks take 134–143 ms regardless of image size (42 MB to 5.8 GB); on the 5.8 GB image, K forks cost K × 143 ms against K × 53.5 s for full-rootfs copies, a 192× per-branch slowdown (Table [3](https://arxiv.org/html/2605.10913v3#S4.T3 "Table 3 ‣ 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). The next-fastest alternative, BranchFS \[ [39](https://arxiv.org/html/2605.10913v3#bib.bib5 "")\], branches the filesystem alone via FUSE; like the other methods, it supports no notion of the agent itself (Table [1](https://arxiv.org/html/2605.10913v3#S1.T1 "Table 1 ‣ 1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

##### Replay reuses the LLM provider’s prompt cache.

Because Shepherd fork preserves the parent’s byte-identical LLM message prefix, the provider’s prompt cache resolves it without invalidation. On Anthropic Claude Haiku 4.5 across 8 Terminal-Bench 2.0 tasks, cache-hit rate plateaus at ∼\\sim95% from K=2K{=}2 onwards, within 5% of the byte-identical ceiling. Cache reuse compounds whenever a meta-agent fans out (Tree-GRPO siblings, [Section5.3](https://arxiv.org/html/2605.10913v3#S5.SS3 "5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")) or replays completed trajectories (trajectory compression, [AppendixD](https://arxiv.org/html/2605.10913v3#A4 "Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). We provide further detail in Appendix [C.6](https://arxiv.org/html/2605.10913v3#A3.SS6 "C.6 KV-Cache Reuse Detail ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

## 5 Experiments

![Refer to caption](https://arxiv.org/html/2605.10913v3/shepherd_teaser_figure_v2.png)Figure 2: Headline results from the three meta-agent applications built on Shepherd: (A) runtime supervision on CooperBench, (B) counterfactual meta-optimization (CRO), and (C) meta-agent-guided Tree-GRPO on Terminal-Bench 2.0.

The Shepherd substrate enables a wide range of meta-agent applications. In this section, we demonstrate three such applications, spanning the agent development stack. (1) During execution, a runtime supervisor agent observes two parallel coding workers and intercepts them mid-trajectory, raising the pair pass rate on CooperBench from 28.8% to 54.7% (§ [5.1](https://arxiv.org/html/2605.10913v3#S5.SS1 "5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). (2) For post-hoc workflow optimization, a meta-optimizer branches execution traces to test counterfactual workflow edits, outperforming
MetaHarness on four of five datasets at up to 58% lower wall-clock (§ [5.2](https://arxiv.org/html/2605.10913v3#S5.SS2 "5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). (3) For agentic RL training, a meta-agent selects fork points during RL rollouts to extract per-step credit, lifting Terminal-Bench 2.0 by 5.25.2 points on Qwen3.5-35B-A3B over Flat GRPO (§ [5.3](https://arxiv.org/html/2605.10913v3#S5.SS3 "5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

Each application exercises a different Shepherd property. § [5.1](https://arxiv.org/html/2605.10913v3#S5.SS1 "5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") requires _non-perturbing observation_: a supervisor that subscribes to both workers’ effect streams gains access to their traces without perturbing them. § [5.2](https://arxiv.org/html/2605.10913v3#S5.SS2 "5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") leans on _byte-identical replay_: candidate edits are validated against a fixed baseline by re-executing only the affected suffix. § [5.3](https://arxiv.org/html/2605.10913v3#S5.SS3 "5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") exercises _cheap branching_: Shepherd’s cheap agent–environment state forking makes per-step credit assignment via sibling rollouts affordable. We report a fourth use case, which compresses completed trajectories into shorter reruns under meta-agent hindsight, in Appendix [D](https://arxiv.org/html/2605.10913v3#A4 "Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"). We note that these applications are not exhaustive and discuss further possible applications enabled by Shepherd in Appendix [A.2](https://arxiv.org/html/2605.10913v3#A1.SS2 "A.2 Future Works ‣ Appendix A Limitations and Future Works ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

### 5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor

##### Motivation.

CooperBench \[ [17](https://arxiv.org/html/2605.10913v3#bib.bib7 "")\] documents a _curse of coordination_: even when allowed to communicate, parallel coding agents coordinate poorly enough that they succeed less often than a single agent working alone. Shepherd’s effect stream and scope primitives let a meta-agent close that gap by inspecting both workers’ execution in real time and intercepting before damage compounds.

##### Method.

Two Claude Haiku 4.5 worker agents run in parallel forked scopes, each assigned one complementary feature to implement. A Claude Sonnet 4.6 or Opus 4.7 meta-agent subscribes to both effect streams via Shepherd and is provided with three coordination tools: inject (push guidance into a worker’s session), handoff (fork the leading worker’s scope as the follower’s new root and restart), and discard (abort a stuck worker via scope.discard()).

##### Setup.

We evaluate on CooperBench \[ [17](https://arxiv.org/html/2605.10913v3#bib.bib7 "")\]. Baselines are _solo_ (one Haiku 4.5 agent handling both features sequentially) and _coop_ (two parallel Haiku 4.5 agents in forked scopes with peer-to-peer messaging via the relay sandbox, no supervisor). Full protocol, dataset construction, and per-condition operational notes are in Appendix [E](https://arxiv.org/html/2605.10913v3#A5 "Appendix E Runtime supervision: protocol, tools, and meta-agent prompt ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

![Refer to caption](https://arxiv.org/html/2605.10913v3/live_results_combined.png)Figure 3: Runtime supervision experiments on CooperBench, with Claude Haiku 4.5 as worker. Left (Pair pass rate): Sonnet 4.6 and Opus 4.7 meta-agents close most of the
gap from coop (28.8%) to the solo ceiling (57.2%). Right (Per-pair wall-clock): mean wall-clock minutes per pair. Solid bars are the worker wall-clock; the hatched overlay is the additional meta-agent overhead.

##### Results.

On the full 479-pair set, the coop baseline lands at 28.8% pair pass rate, reproducing CooperBench’s documented coordination penalty against the solo ceiling of 57.2%, showing a 28.4-point gap. A Sonnet meta-agent recovers 45.3%, and an Opus meta-agent reaches 54.7%, closing 91%91\\% of the curse-of-coordination gap ( [Figure3](https://arxiv.org/html/2605.10913v3#S5.F3 "In Setup. ‣ 5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"), left). In the naive coop baseline, each worker sees only what the other chose to send, which is filtered through the sender’s imperfect view of the shared state. The supervisor, by contrast, subscribes directly to both workers’ effect streams, observing their actions completely without perturbing them and steering them accordingly. Appendix [E](https://arxiv.org/html/2605.10913v3#A5 "Appendix E Runtime supervision: protocol, tools, and meta-agent prompt ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") shows that the supervisor prefers the lightweight inject action while still taking handoff and discard actions when necessary.

The wall-clock cost is modest: solo takes 28.4 min per pair on average, while the supervised conditions stay close to the parallel coop baseline (19.8 min). Sonnet finishes in 21.2 min (1.4 min meta overhead) and Opus in 24.2 min (4.3 min meta overhead), running at roughly 75% and 85% of solo time respectively ( [Figure3](https://arxiv.org/html/2605.10913v3#S5.F3 "In Setup. ‣ 5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"), right). This is because the meta-agent only observes worker agents once every few seconds, and does not interfere with them unless an interception is required (Appendix [E](https://arxiv.org/html/2605.10913v3#A5 "Appendix E Runtime supervision: protocol, tools, and meta-agent prompt ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). We treat this as a proof of existence that Shepherd enables effective runtime supervision; the supervision token-cost vs. task-execution-cost trade-off is discussed in Appendix [A](https://arxiv.org/html/2605.10913v3#A1 "Appendix A Limitations and Future Works ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

### 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO)

Motivation. When an agentic workflow fails, the failure usually traces
to a small set of faulty or missing agent calls \[ [52](https://arxiv.org/html/2605.10913v3#bib.bib33 ""), [3](https://arxiv.org/html/2605.10913v3#bib.bib34 "")\]. Counterfactual analysis \[ [38](https://arxiv.org/html/2605.10913v3#bib.bib31 "")\] provides standard machinery for diagnosing such failures: would a localized change to a suspect set of calls have fixed the outcome? Answering this in a standard agentic runtime is difficult – workflow re-runs reintroduce stochastic and environmental variation unrelated to the edit, and flat transcripts give little structure to localize failures against. CRO sidesteps both problems by replaying counterfactuals through forks of Shepherd’s execution trace rather than re-executing changed workflows from scratch.

##### Method.

CRO maintains a pool of agentic workflow variants together with their
Shepherd execution traces when run on the training set. At each step, the proposer analyzes these traces to identify failure modes, picks a parent candidate and emits a set of candidate edits as counterfactual experiments to patch these failure modes. Every edit is paired with a _fix set_ of training
examples it should repair and a _guard set_ whose performance must not
regress. Shepherd validates these edits through _counterfactual replay_ on
the combined fix and guard set: for each edit, it forks the parent’s execution trace
at the first commit that would be affected by the edit and replays the suffix with the edited workflow. Candidates that outperform their parent on this combined set are evaluated on the dev set and added to the candidate pool; after a set number of iterations CRO returns the highest-scoring member on the dev set as the selected candidate (Algorithm [1](https://arxiv.org/html/2605.10913v3#alg1 "Algorithm 1 ‣ F.1 The CRO algorithm ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"), Appendix [F](https://arxiv.org/html/2605.10913v3#A6 "Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

##### Setup.

We evaluate on subsets of HoVer \[ [14](https://arxiv.org/html/2605.10913v3#bib.bib51 "")\],
MATH \[ [8](https://arxiv.org/html/2605.10913v3#bib.bib52 "")\], IFBench \[ [31](https://arxiv.org/html/2605.10913v3#bib.bib57 "")\],
LiveCodeBench \[ [12](https://arxiv.org/html/2605.10913v3#bib.bib53 "")\], and Terminal-Bench 2.0 ( \[ [25](https://arxiv.org/html/2605.10913v3#bib.bib24 "")\]),
comparing CRO against the baseline workflow, GEPA (optimizing workflow code) \[ [1](https://arxiv.org/html/2605.10913v3#bib.bib1 "")\], and
MetaHarness \[ [20](https://arxiv.org/html/2605.10913v3#bib.bib8 "")\]. The executor is GPT-5.4-mini and
meta-optimizers use GPT-5.4 (in the Codex harness for MetaHarness and GEPA). We stop each algorithm after 20 candidates on HoVer, MATH, IFBench, and LiveCodeBench, and after 10 on Terminal-Bench 2.0. Per-dataset settings, baselines, and full results are in Appendix [F](https://arxiv.org/html/2605.10913v3#A6 "Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

![Refer to caption](https://arxiv.org/html/2605.10913v3/fig_livecodebench_main.png)Figure 4: LiveCodeBench comparison. Left: held-out test pass-rate versus optimization wall-clock. Right: dev-set trajectory for each method across optimization wall-clock. CRO subtask-cache reuse is reported separately in [Figure5](https://arxiv.org/html/2605.10913v3#S5.F5 "In Results. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"). Table 4: Test-set performance and meta-optimization wall-clock time across datasets
and methods. HoVer/MATH/IFBench/LiveCodeBench report mean ±\\pm std, and Terminal-Bench 2.0 report average@5 on the test split
(Test) over three evaluations and meta-optimization wall-clock in minutes (Wall).
Best test mean per dataset in bold; second-best underlined.

|     |     |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | HoVer | MATH | IFBench | LiveCodeBench | Terminal-Bench 2.0 |
| Method | Test | Wall | Test | Wall | Test | Wall | Test | Wall | Test | Wall |
| Baseline | 43.7±0.043.7\\pm 0.0 | — | 60.7±1.260.7\\pm 1.2 | — | 42.4±1.842.4\\pm 1.8 | — | 30.7±2.130.7\\pm 2.1 | — | 31.2¯\\underline{31.2} | — |
| GEPA | 43.7±0.043.7\\pm 0.0 | 6767 | 74.0±3.574.0\\pm 3.5 | 2020 | 50.1±1.250.1\\pm 1.2 | 5050 | 48.7±1.5¯\\underline{48.7\\pm 1.5} | 7373 | 31.2¯\\underline{31.2} | 157157 |
| MetaHarness | 77.8±0.4¯\\underline{77.8\\pm 0.4} | 235235 | 79.3±1.2¯\\underline{79.3\\pm 1.2} | 101101 | 52.3±1.4\\mathbf{52.3\\pm 1.4} | 126126 | 40.0±3.640.0\\pm 3.6 | 217217 | 31.2¯\\underline{31.2} | 173173 |
| CRO![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png) | 79.4±0.2\\mathbf{79.4\\pm 0.2} | 120120 | 80.0±2.0\\mathbf{80.0\\pm 2.0} | 4242 | 51.3±1.1¯\\underline{51.3\\pm 1.1} | 8282 | 51.0±1.7\\mathbf{51.0\\pm 1.7} | 117117 | 35.2\\mathbf{35.2} | 7373 |

##### Results.

CRO obtains the best performance on four of five datasets (Table [4](https://arxiv.org/html/2605.10913v3#S5.T4 "Table 4 ‣ Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). It has higher held-out test score and lower wall-clock simultaneously compared to MetaHarness across these datasets, with savings ranging 27–58%. Notably, on Terminal-Bench 2.0, the most execution-bound benchmark in the suite, GEPA and MetaHarness both fail to improve over the baseline on the subset under study, while CRO improves performance by 4 pts while also needing the least wall-clock. On IFBench, MetaHarness edges CRO by 1.0 pt on test (within a standard deviation) but still takes 37% longer.

Figure 5: Computation reuse on LiveCodeBench with CRO.

We attribute CRO’s downstream performance gains to two sources. First, CRO’s counterfactual experiments hold the unaffected part of the computation constant, letting the model isolate and patch failures, compared to the noise introduced by MetaHarness’s full-pipeline reruns; we find qualitatively that the generated hypotheses are high-quality (Appendix [F](https://arxiv.org/html/2605.10913v3#A6 "Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). Second, Shepherd’s Git-like execution trace lets the LLM navigate prior executions more naturally than the flat logs used by other methods. On the other hand, CRO’s wall-clock savings come from three sources: counterfactual replay re-executes only the suffix downstream of each edit’s first effect via Shepherd rather than the full pipeline, the byte-identical prefixes allow for KV-cache reuse from the LLM, and target-set gating evaluates each candidate against a small subset of the training set before committing to a full dev-set evaluation. On LiveCodeBench, computation reuse rises from ∼\\sim1% on the first cold proposer session to over 60% later in the run (Figure [5](https://arxiv.org/html/2605.10913v3#S5.F5 "Figure 5 ‣ Results. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

### 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL

##### Motivation.

RLVR for long-horizon tasks suffers from sparse, episode-level rewards: an agent that takes dozens of steps receives a single binary signal at the end \[ [4](https://arxiv.org/html/2605.10913v3#bib.bib29 ""), [41](https://arxiv.org/html/2605.10913v3#bib.bib30 ""), [37](https://arxiv.org/html/2605.10913v3#bib.bib28 "")\]. For fine-grained reward signals, one approach is Tree-search RL \[ [10](https://arxiv.org/html/2605.10913v3#bib.bib27 ""), [13](https://arxiv.org/html/2605.10913v3#bib.bib25 "")\], which derives step-level advantages from outcome rewards alone via sibling rollouts. In stateless environments, this is trivial \[ [49](https://arxiv.org/html/2605.10913v3#bib.bib26 "")\]. However, with agent tasks that modify real filesystems and services, exact and cheap state-forking is required to make this approach feasible, which is provided by Shepherd.

##### Method.

GRPO-style training for long-horizon agents samples GG trajectories per prompt and assigns each one a single outcome reward, distributed uniformly across all actions \[ [33](https://arxiv.org/html/2605.10913v3#bib.bib23 "")\]. We recover finer-grained credit by tree-searching intermediate states \[ [35](https://arxiv.org/html/2605.10913v3#bib.bib36 ""), [36](https://arxiv.org/html/2605.10913v3#bib.bib35 "")\]: along each root rollout, a meta-agent picks a fork turn tt and we sample KK sibling branches forward from that state, yielding G⁡(K+1)G(K{+}1) trajectories per task at the cost of only KK extra branch rollouts (forking is exact and cheap, [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). Credit assignment operates at two levels: prefix actions before tt inherit the standard inter-root GRPO advantage across the GG roots, while suffix actions take an intra-tree advantage computed within each (K+1)(K{+}1)-member fork group, surfacing per-step outcome differences without a learned value function or process reward model. The full procedure is given as Algorithm [2](https://arxiv.org/html/2605.10913v3#alg2 "Algorithm 2 ‣ F.6 Meta-Agent Guided Tree-RL: full training configuration ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") in Appendix [F.6](https://arxiv.org/html/2605.10913v3#A6.SS6 "F.6 Meta-Agent Guided Tree-RL: full training configuration ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"), with qualitative examples of the meta-agent’s branching decisions in [SectionF.7](https://arxiv.org/html/2605.10913v3#A6.SS7 "F.7 Meta-Agent Guided Tree-RL: meta-agent qualitative examples ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

##### Setup.

We use both Qwen3.5-35B-A3B and Nemotron-3-Super-120B-A12B as the base models \[ [32](https://arxiv.org/html/2605.10913v3#bib.bib38 ""), [27](https://arxiv.org/html/2605.10913v3#bib.bib37 "")\], training via tinker \[ [19](https://arxiv.org/html/2605.10913v3#bib.bib58 "")\]. We train on a filtered subset of the Endless Terminals corpus \[ [7](https://arxiv.org/html/2605.10913v3#bib.bib15 "")\]: starting from the 2,492-task pool, we drop tasks where the base policy passes all 8 sampled rollouts (pass@8=1.0), leaving 442 tasks for Qwen3.5 and 530 for Nemotron-3. We hold out Terminal-Bench 2.0\[ [25](https://arxiv.org/html/2605.10913v3#bib.bib24 "")\] as an out-of-distribution test set evaluated every 10 training steps. We compare two RL setups at matched generation compute: Flat GRPO, independent root rollouts only, one group baseline across G=8G{=}8 roots; and _Meta-Agent Guided Tree-RL_ (Tree-GRPO): root rollouts plus K=4K{=}4 sibling branches forked at a meta-agent-chosen turn, with the two-level baseline from [Algorithm2](https://arxiv.org/html/2605.10913v3#alg2 "In F.6 Meta-Agent Guided Tree-RL: full training configuration ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"). The full configuration for training is deferred to [SectionF.6](https://arxiv.org/html/2605.10913v3#A6.SS6 "F.6 Meta-Agent Guided Tree-RL: full training configuration ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

##### Results.

Table 5: Held-out Terminal-Bench 2.0 avg@5 (89 tasks, 5 seeds). Settings in [SectionF.6](https://arxiv.org/html/2605.10913v3#A6.SS6 "F.6 Meta-Agent Guided Tree-RL: full training configuration ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

|     |     |     |
| --- | --- | --- |
| Method | Qwen3.5-35B-A3B | Nemotron-3-Super-120B-A12B |
| Base | 26.1%±4.21 | 30.3%±3.62 |
| Flat GRPO | 34.2%±4.05 | 33.8%±3.41 |
| Tree-GRPO![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png) | 39.4%±3.87 | 37.2%±3.19 |

The results are in [Table5](https://arxiv.org/html/2605.10913v3#S5.T5 "In Results. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"). Meta-Agent Guided Tree-RL is the strongest setting on both base models. First, the uplift of Tree-GRPO over Flat GRPO is consistent across model scale: a ∼\\sim3B-active-parameter and a ∼\\sim12B-active-parameter model gain 5.25.2 and 3.43.4 points respectively. This improvement is the consequence of a training-time pattern: Tree-GRPO’s produces higher reward variance on both models ( [Figure19](https://arxiv.org/html/2605.10913v3#A6.F19 "In F.7 Meta-Agent Guided Tree-RL: meta-agent qualitative examples ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). Flat GRPO assigns each action in a trajectory the same outcome-derived advantage. Tree-GRPO’s intra-tree baseline instead isolates the suffix actions taken after the fork point: K+1K+1 siblings sharing a prefix differ only in what happened after the fork point, so the per-step advantage there reflects local choice quality rather than global trajectory outcome. Shepherd makes this affordable, and we find that the intra-tree baseline produces more informative gradient steps as well. This behavior transfers to the Endless Terminals validation split ( [Figure18](https://arxiv.org/html/2605.10913v3#A6.F18 "In F.6 Meta-Agent Guided Tree-RL: full training configuration ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"), deferred to [SectionF.6](https://arxiv.org/html/2605.10913v3#A6.SS6 "F.6 Meta-Agent Guided Tree-RL: full training configuration ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

## 6 Conclusion

We presented ![[Uncaptioned image]](https://arxiv.org/html/2605.10913v3/assets/logo/shepherd_logo_0612.png)Shepherd, a substrate that lets a meta-agent hold, inspect, fork, and modify another agent’s execution as a first-class object, like functions in functional programming. Meta-agents in Shepherd are higher-order agents over agentic execution, as we show across three applications: runtime supervision of parallel coding agents, counterfactual replay for workflow optimization, and Tree-GRPO for finer-grained credit assignment in long-horizon RL. More broadly, Shepherd opens a path toward meta-agent systems that are active operators over agentic execution. Future agents could use the substrate to compress execution traces into reusable workflows, run counterfactual agentic interpretability probes, safely gate irreversible actions, or learn policies for managing agentic execution. As agentic systems become longer-lived, more stateful, and more consequential, we believe this execution-level control will become a core abstraction for effective meta-agents. Shepherd is a step toward making that abstraction readily available and programmable.

## References

- \[1\]L. A. Agrawal, S. Tan, D. Soylu, N. Ziems, R. Khare, K. Opsahl-Ong, A. Singhvi, H. Shandilya, M. J. Ryan, M. Jiang, C. Potts, K. Sen, A. G. Dimakis, I. Stoica, D. Klein, M. Zaharia, and O. Khattab (2025)GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning.
arXiv.
Note: arXiv:2507.19457 \[cs\]External Links: [Link](http://arxiv.org/abs/2507.19457 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2507.19457 "")Cited by: [§A.1](https://arxiv.org/html/2605.10913v3#A1.SS1.SSS0.Px2.p1.1 "Supervision and proposer cost. ‣ A.1 Limitations ‣ Appendix A Limitations and Future Works ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§1](https://arxiv.org/html/2605.10913v3#S1.p1.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.SSS0.Px2.p1.1 "Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[2\]P. Asawa, A. Zhu, A. O’Neill, M. Zaharia, A. G. Dimakis, and J. E. Gonzalez (2025)How to Train Your Advisor: Steering Black-Box LLMs with Advisor Models.
arXiv.
Note: arXiv:2510.02453 \[cs\]External Links: [Link](http://arxiv.org/abs/2510.02453 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2510.02453 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p1.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[3\]M. Cemri, M. Z. Pan, S. Yang, L. A. Agrawal, B. Chopra, R. Tiwari, K. Keutzer, A. Parameswaran, D. Klein, K. Ramchandran, M. Zaharia, J. E. Gonzalez, and I. Stoica (2025)Why do multi-agent llm systems fail?.
External Links: 2503.13657,
[Link](https://arxiv.org/abs/2503.13657 "")Cited by: [§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.p1.1 "5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[4\]W. Chen, J. Chen, H. Zhu, and J. Schneider (2025)Context-lite multi-turn reinforcement learning for LLM agents.
In ES-FoMo III: 3rd Workshop on Efficient Systems for Foundation Models,
External Links: [Link](https://openreview.net/forum?id=6CE5PLsZdW "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px1.p1.1 "Motivation. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[5\]C. Cheng, A. Nie, and A. Swaminathan (2024)Trace is the Next AutoDiff: Generative Optimization with Rich Feedback, Execution Traces, and LLMs.
Note: arXiv:2406.16218External Links: [Link](https://arxiv.org/abs/2406.16218 "")Cited by: [§F.2](https://arxiv.org/html/2605.10913v3#A6.SS2.p1.1 "F.2 Implementation Details ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[6\]M. Felleisen (1988)The theory and practice of first-class prompts.
In Proceedings of the 15th ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages (POPL),
San Diego, California, USA, pp. 180–190.
External Links: [Document](https://dx.doi.org/10.1145/73560.73576 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p3.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[7\]K. Gandhi, S. Garg, N. D. Goodman, and D. Papailiopoulos (2026)Endless Terminals: Scaling RL Environments for Terminal Agents.
Note: arXiv:2601.16443External Links: [Link](https://arxiv.org/abs/2601.16443 "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px3.p1.1 "Setup. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[8\]D. Hendrycks, C. Burns, S. Kadavath, A. Arora, S. Basart, E. Tang, D. Song, and J. Steinhardt (2021)Measuring mathematical problem solving with the math dataset.
External Links: 2103.03874,
[Link](https://arxiv.org/abs/2103.03874 "")Cited by: [§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.SSS0.Px2.p1.1 "Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[9\]S. Hong, M. Zhuge, J. Chen, X. Zheng, Y. Cheng, C. Zhang, J. Wang, Z. Wang, S. K. S. Yau, Z. Lin, L. Zhou, C. Ran, L. Xiao, C. Wu, and J. Schmidhuber (2023)MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework.
Note: arXiv:2308.00352External Links: [Link](https://arxiv.org/abs/2308.00352 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[10\]Z. Hou, Z. Hu, Y. Li, R. Lu, J. Tang, and Y. Dong (2025)TreeRL: llm reinforcement learning with on-policy tree search.
External Links: 2506.11902,
[Link](https://arxiv.org/abs/2506.11902 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p1.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px1.p1.1 "Motivation. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[11\]Https://www.anthropic.com/engineering/managed-agents.
External Links: [Link](https://www.anthropic.com/engineering/managed-agents "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[12\]N. Jain, K. Han, A. Gu, W. Li, F. Yan, T. Zhang, S. Wang, A. Solar-Lezama, K. Sen, and I. Stoica (2024)LiveCodeBench: holistic and contamination free evaluation of large language models for code.
External Links: 2403.07974,
[Link](https://arxiv.org/abs/2403.07974 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p6.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.SSS0.Px2.p1.1 "Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[13\]Y. Ji, Z. Ma, Y. Wang, G. Chen, X. Chu, and L. Wu (2026)Tree search for llm agent reinforcement learning.
External Links: 2509.21240,
[Link](https://arxiv.org/abs/2509.21240 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p1.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px1.p1.1 "Motivation. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[14\]Y. Jiang, S. Bordia, Z. Zhong, C. Dognin, M. Singh, and M. Bansal (2020)HoVer: a dataset for many-hop fact extraction and claim verification.
External Links: 2011.03088,
[Link](https://arxiv.org/abs/2011.03088 "")Cited by: [§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.SSS0.Px2.p1.1 "Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[15\]C. E. Jimenez, J. Yang, A. Wettig, S. Yao, K. Pei, O. Press, and K. R. Narasimhan (2024)SWE-bench: can language models resolve real-world github issues?.
In The Twelfth International Conference on Learning Representations,
External Links: [Link](https://openreview.net/forum?id=VTF8yNQM66 "")Cited by: [Appendix D](https://arxiv.org/html/2605.10913v3#A4.SS0.SSS0.Px2.p1.1 "Setup. ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[16\]O. Khattab, A. Singhvi, P. Maheshwari, Z. Zhang, K. Santhanam, S. Vardhamanan, S. Haq, A. Sharma, T. T. Joshi, H. Moazam, H. Miller, M. Zaharia, and C. Potts (2023)DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines.
Note: arXiv:2310.03714External Links: [Link](https://arxiv.org/abs/2310.03714 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[17\]A. Khatua, H. Zhu, P. Tran, A. Prabhudesai, F. Sadrieh, J. K. Lieberwirth, X. Yu, Y. Fu, M. J. Ryan, J. Pei, and D. Yang (2026)CooperBench: Why Coding Agents Cannot be Your Teammates Yet.
Note: arXiv:2601.13295External Links: [Link](https://arxiv.org/abs/2601.13295 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p6.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.1](https://arxiv.org/html/2605.10913v3#S5.SS1.SSS0.Px1.p1.1 "Motivation. ‣ 5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.1](https://arxiv.org/html/2605.10913v3#S5.SS1.SSS0.Px3.p1.1 "Setup. ‣ 5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[18\]J. Kim, W. Yang, K. Niu, H. Zhang, Y. Zhu, E. Helenowski, R. Silva, Z. Chen, S. Iyer, M. Zaheer, D. Fried, H. Hajishirzi, S. Arora, G. Synnaeve, R. Salakhutdinov, and A. Goyal (2026)Scaling Test-Time Compute for Agentic Coding.
External Links: [Link](https://arxiv.org/abs/2604.16529 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2604.16529 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[19\]T. M. Lab (2025)Tinker.
External Links: [Link](https://thinkingmachines.ai/tinker/ "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px3.p1.1 "Setup. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[20\]Y. Lee, R. Nair, Q. Zhang, K. Lee, O. Khattab, and C. Finn (2026)Meta-Harness: End-to-End Optimization of Model Harnesses.
Note: arXiv:2603.28052External Links: [Link](https://arxiv.org/abs/2603.28052 "")Cited by: [§A.1](https://arxiv.org/html/2605.10913v3#A1.SS1.SSS0.Px2.p1.1 "Supervision and proposer cost. ‣ A.1 Limitations ‣ Appendix A Limitations and Future Works ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§F.2](https://arxiv.org/html/2605.10913v3#A6.SS2.p1.1 "F.2 Implementation Details ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§1](https://arxiv.org/html/2605.10913v3#S1.p1.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§1](https://arxiv.org/html/2605.10913v3#S1.p6.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.SSS0.Px2.p1.1 "Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[21\]Y. Lee, H. Yen, X. Ye, and D. Chen (2026)Agentic Aggregation for Parallel Scaling of Long-Horizon Agentic Tasks.
External Links: [Link](https://arxiv.org/abs/2604.11753 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2604.11753 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[22\]H. Li, R. He, Q. Zhang, C. Ji, Q. Mang, X. Chen, L. A. Agrawal, W. Liao, E. Yang, A. Cheung, J. Zou, K. Olukotun, I. Stoica, and J. E. Gonzalez (2026)Combee: Scaling Prompt Learning for Self-Improving Language Model Agents.
arXiv.
Note: arXiv:2604.04247 \[cs\]External Links: [Link](http://arxiv.org/abs/2604.04247 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2604.04247 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[23\]Y. Li, S. Ping, X. Chen, X. Qi, Z. Wang, Y. Luo, and X. Zhang (2025)AgentGit: A Version Control Framework for Reliable and Scalable LLM-Powered Multi-Agent Systems.
Note: arXiv:2511.00628External Links: [Link](https://arxiv.org/abs/2511.00628 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p2.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px3.p1.1 "Agentic Runtime and Infrastructure. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[24\]F. Lin, S. Chen, R. Fang, H. Wang, and T. Lin (2025)Stop wasting your tokens: towards efficient runtime multi-agent systems.
arXiv preprint arXiv:2510.26585.
External Links: [Link](https://arxiv.org/abs/2510.26585 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p1.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[25\]M. A. Merrill, A. G. Shaw, N. Carlini, B. Li, H. Raj, I. Bercovich, L. Shi, J. Y. Shin, T. Walshe, E. K. Buchanan, J. Shen, G. Ye, H. Lin, J. Poulos, M. Wang, M. Nezhurina, J. Jitsev, D. Lu, O. M. Mastromichalakis, Z. Xu, Z. Chen, Y. Liu, R. Zhang, L. L. Chen, A. Kashyap, J. Uslu, J. Li, J. Wu, M. Yan, S. Bian, V. Sharma, K. Sun, S. Dillmann, A. Anand, A. Lanpouthakoun, B. Koopah, C. Hu, E. Guha, G. H. S. Dreiman, J. Zhu, K. Krauth, L. Zhong, N. Muennighoff, R. Amanfu, S. Tan, S. Pimpalgaonkar, T. Aggarwal, X. Lin, X. Lan, X. Zhao, Y. Liang, Y. Wang, Z. Wang, C. Zhou, D. Heineman, H. Liu, H. Trivedi, J. Yang, J. Lin, M. Shetty, M. Yang, N. Omi, N. Raoof, S. Li, T. Y. Zhuo, W. Lin, Y. Dai, Y. Wang, W. Chai, S. Zhou, D. Wahdany, Z. She, J. Hu, Z. Dong, Y. Zhu, S. Cui, A. Saiyed, A. Kolbeinsson, J. Hu, C. M. Rytting, R. Marten, Y. Wang, A. Dimakis, A. Konwinski, and L. Schmidt (2026)Terminal-bench: benchmarking agents on hard, realistic tasks in command line interfaces.
External Links: 2601.11868,
[Link](https://arxiv.org/abs/2601.11868 "")Cited by: [Appendix D](https://arxiv.org/html/2605.10913v3#A4.SS0.SSS0.Px2.p1.1 "Setup. ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§1](https://arxiv.org/html/2605.10913v3#S1.p6.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.SSS0.Px2.p1.1 "Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px3.p1.1 "Setup. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[26\]A. Novikov, N. Vũ, M. Eisenberger, E. Dupont, P. Huang, A. Z. Wagner, S. Shirobokov, B. Kozlovskii, F. J. R. Ruiz, A. Mehrabian, M. P. Kumar, A. See, S. Chaudhuri, G. Holland, A. Davies, S. Nowozin, P. Kohli, and M. Balog (2025)AlphaEvolve: A coding agent for scientific and algorithmic discovery.
External Links: [Link](https://arxiv.org/abs/2506.13131 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2506.13131 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[27\]NVIDIA (2025)NVIDIA nemotron 3: efficient and open intelligence.
Note: White PaperExternal Links: [Link](https://arxiv.org/abs/2512.20856 "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px3.p1.1 "Setup. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[28\]C. Okasaki (1999)Purely Functional Data Structures.
Cambridge University Press.
External Links: ISBN 978-0-521-66350-2Cited by: [§3.4](https://arxiv.org/html/2605.10913v3#S3.SS4.p1.1 "3.4 Execution Trace: Agent Execution History ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[29\]G. Plotkin and J. Power (2003)Algebraic Operations and Generic Effects.
Applied Categorical Structures11 (1), pp. 69–94.
External Links: [Document](https://dx.doi.org/10.1023/A%3A1023064908962 "")Cited by: [§3.2](https://arxiv.org/html/2605.10913v3#S3.SS2.p1.1 "3.2 Effects: Agent Actions ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[30\]G. Plotkin and M. Pretnar (2009)Handlers of Algebraic Effects.
In Programming Languages and Systems, G. Castagna (Ed.),
Lecture Notes in Computer Science, Vol. 5502, Berlin, Heidelberg, pp. 80–94.
External Links: [Document](https://dx.doi.org/10.1007/978-3-642-00590-9%5F7 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p3.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§3.2](https://arxiv.org/html/2605.10913v3#S3.SS2.p1.1 "3.2 Effects: Agent Actions ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[31\]V. Pyatkin, S. Malik, V. Graf, H. Ivison, S. Huang, P. Dasigi, N. Lambert, and H. Hajishirzi (2025)Generalizing verifiable instruction following.
External Links: 2507.02833,
[Link](https://arxiv.org/abs/2507.02833 "")Cited by: [§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.SSS0.Px2.p1.1 "Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[32\]Qwen Team (2026)Qwen3.5: towards native multimodal agents.
External Links: [Link](https://qwen.ai/blog?id=qwen3.5 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p6.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px3.p1.1 "Setup. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[33\]Z. Shao, P. Wang, Q. Zhu, R. Xu, J. Song, X. Bi, H. Zhang, M. Zhang, Y. K. Li, Y. Wu, and D. Guo (2024)DeepSeekMath: pushing the limits of mathematical reasoning in open language models.
External Links: 2402.03300,
[Link](https://arxiv.org/abs/2402.03300 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p6.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px2.p1.1 "Method. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[34\]N. Shinn, F. Cassano, E. Berman, A. Gopinath, K. Narasimhan, and S. Yao (2023)Reflexion: Language Agents with Verbal Reinforcement Learning.
Note: arXiv:2303.11366External Links: [Link](https://arxiv.org/abs/2303.11366 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[35\]R. Sutton and A. Barto (1998)Reinforcement learning: an introduction 1st edition.
Exp. Psychol. Learn. Mem. Cogn30, pp. 1302–1321.
Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px2.p1.1 "Method. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[36\]M. Świechowski, K. Godlewski, B. Sawicki, and J. Mańdziuk (2022)Monte carlo tree search: a review of recent modifications and applications.
Artificial Intelligence Review56 (3), pp. 2497–2562.
External Links: ISSN 1573-7462,
[Link](http://dx.doi.org/10.1007/s10462-022-10228-y ""),
[Document](https://dx.doi.org/10.1007/s10462-022-10228-y "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px2.p1.1 "Method. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[37\]H. Tan, X. Yang, H. Chen, J. Shao, Y. Wen, Y. Shen, W. Luo, X. Du, L. Guo, and Y. Li (2026)Hindsight credit assignment for long-horizon llm agents.
External Links: 2603.08754,
[Link](https://arxiv.org/abs/2603.08754 "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px1.p1.1 "Motivation. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[38\]S. Wachter, B. Mittelstadt, and C. Russell (2018)Counterfactual explanations without opening the black box: automated decisions and the gdpr.
Harvard Journal of Law & Technology31 (2), pp. 841–887.
Cited by: [§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.p1.1 "5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[39\]C. Wang and Y. Zheng (2026)Fork, Explore, Commit: OS Primitives for Agentic Exploration.
Note: arXiv:2602.08199External Links: [Link](https://arxiv.org/abs/2602.08199 "")Cited by: [4th item](https://arxiv.org/html/2605.10913v3#A3.I1.i4.p1.1 "In Pattern A: agent-on-host, sandbox-in-container. ‣ C.1 Measurement Protocol ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§1](https://arxiv.org/html/2605.10913v3#S1.p2.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px3.p1.1 "Agentic Runtime and Infrastructure. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§4](https://arxiv.org/html/2605.10913v3#S4.SS0.SSS0.Px1.p1.1 "Fork and revert are fast and image-size-independent. ‣ 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[Table 3](https://arxiv.org/html/2605.10913v3#S4.T3.7.1.11.1 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[Table 3](https://arxiv.org/html/2605.10913v3#S4.T3.7.1.16.1 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[Table 3](https://arxiv.org/html/2605.10913v3#S4.T3.7.1.6.1 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[40\]P. Wang, J. Huang, J. Yao, R. Pan, P. Niu, Y. Liu, R. Wang, R. Lu, Y. Guo, and T. Zhang (2026)AgentSPEX: An Agent SPecification and EXecution Language.
External Links: [Link](https://arxiv.org/abs/2604.13346 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2604.13346 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px3.p1.1 "Agentic Runtime and Infrastructure. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[41\]R. Wang and P. Ammanabrolu (2025)A practitioner’s guide to multi-turn agentic reinforcement learning.
External Links: 2510.01132,
[Link](https://arxiv.org/abs/2510.01132 "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px1.p1.1 "Motivation. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[42\]X. Wang, J. Pan, B. Hui, et al. (2026)OpenHands V1: event-sourced state management for multi-agent coding systems.
MLSys.
Note: arXiv:2511.03690External Links: [Link](https://arxiv.org/abs/2511.03690 "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p2.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[43\]Y. Wang, S. Su, Z. Zeng, E. Xu, L. Ren, X. Yang, Z. Huang, X. He, L. Ma, B. Peng, H. Cheng, P. He, W. Chen, S. Wang, S. S. Du, and Y. Shen (2025)ThetaEvolve: Test-time Learning on Open Problems.
External Links: [Link](https://arxiv.org/abs/2511.23473 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2511.23473 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[44\]T. Wei, N. Sachdeva, B. Coleman, Z. He, Y. Bei, X. Ning, M. Ai, Y. Li, J. He, E. H. Chi, C. Wang, S. Chen, F. Pereira, W. Kang, and D. Z. Cheng (2025)Evo-Memory: Benchmarking LLM Agent Test-time Learning with Self-Evolving Memory.
External Links: [Link](https://arxiv.org/abs/2511.20857 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2511.20857 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[45\]Z. Weng, A. Antoniades, D. Nathani, Z. Zhang, X. Pu, and X. E. Wang (2026)Group-Evolving Agents: Open-Ended Self-Improvement via Experience Sharing.
External Links: [Link](https://arxiv.org/abs/2602.04837 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2602.04837 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[46\]Q. Wu, G. Bansal, J. Zhang, Y. Wu, B. Li, E. Zhu, L. Jiang, X. Zhang, S. Zhang, J. Liu, A. H. Awadallah, R. W. White, D. Burger, and C. Wang (2023)AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation.
Note: arXiv:2308.08155External Links: [Link](https://arxiv.org/abs/2308.08155 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[47\]L. Xia, Y. Zakowski, P. He, C. Hur, G. Malecha, B. C. Pierce, and S. Zdancewic (2020)Interaction trees: representing recursive and impure programs in Coq.
Proceedings of the ACM on Programming Languages4 (POPL), pp. 51:1–51:32.
External Links: [Document](https://dx.doi.org/10.1145/3371119 "")Cited by: [§3](https://arxiv.org/html/2605.10913v3#S3.p2.1 "3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[48\]P. Xia, K. Zeng, J. Liu, C. Qin, F. Wu, Y. Zhou, C. Xiong, and H. Yao (2025)Agent0: Unleashing Self-Evolving Agents from Zero Data via Tool-Integrated Reasoning.
External Links: [Link](https://arxiv.org/abs/2511.16043 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2511.16043 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[49\]Y. Xie, A. Goyal, W. Zheng, M. Kan, T. P. Lillicrap, K. Kawaguchi, and M. Shieh (2024)Monte carlo tree search boosts reasoning via iterative preference learning.
External Links: 2405.00451,
[Link](https://arxiv.org/abs/2405.00451 "")Cited by: [§5.3](https://arxiv.org/html/2605.10913v3#S5.SS3.SSS0.Px1.p1.1 "Motivation. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[50\]A. L. Zhang, T. Kraska, and O. Khattab (2025)Recursive language models.
External Links: 2512.24601,
[Link](https://arxiv.org/abs/2512.24601 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[51\]A. L. Zhang, Z. Li, and O. Khattab (2026)The Mismanaged Geniuses Hypothesis.
Note: Blog postExternal Links: [Link](https://alexzhang13.github.io/blog/2026/mgh/ "")Cited by: [§1](https://arxiv.org/html/2605.10913v3#S1.p1.1 "1 Introduction ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"),
[§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[52\]G. Zhang, J. Wang, J. Chen, W. Zhou, K. Wang, and S. Yan (2025)AgenTracer: who is inducing failure in the llm agentic systems?.
External Links: 2509.03312,
[Link](https://arxiv.org/abs/2509.03312 "")Cited by: [§5.2](https://arxiv.org/html/2605.10913v3#S5.SS2.p1.1 "5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[53\]J. Zhang, S. Hu, C. Lu, R. Lange, and J. Clune (2025)Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents.
External Links: [Link](https://arxiv.org/abs/2505.22954 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2505.22954 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[54\]J. Zhang, B. Zhao, W. Yang, J. Foerster, J. Clune, M. Jiang, S. Devlin, and T. Shavrina (2026)Hyperagents.
Note: arXiv:2603.19461External Links: [Link](https://arxiv.org/abs/2603.19461 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[55\]J. Zhang, S. Yu, D. Chong, A. Sicilia, M. R. Tomz, C. D. Manning, and W. Shi (2025)Verbalized sampling: how to mitigate mode collapse and unlock LLM diversity.
In arXiv preprint arXiv:2510.01171,
External Links: [Link](https://arxiv.org/abs/2510.01171 ""),
2510.01171Cited by: [§F.1](https://arxiv.org/html/2605.10913v3#A6.SS1.p5.1 "F.1 The CRO algorithm ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[56\]Q. Zhang, C. Hu, S. Upasani, B. Ma, F. Hong, V. Kamanuru, J. Rainton, C. Wu, M. Ji, H. Li, U. Thakker, J. Zou, and K. Olukotun (2025)Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models.
External Links: [Link](https://arxiv.org/abs/2510.04618 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2510.04618 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[57\]S. Zhang, J. Wang, R. Zhou, J. Liao, Y. Feng, Z. Li, Y. Zheng, W. Zhang, Y. Wen, Z. Li, F. Xiong, Y. Qi, B. Tang, and M. Wen (2026)MemRL: Self-Evolving Agents via Runtime Reinforcement Learning on Episodic Memory.
External Links: [Link](https://arxiv.org/abs/2601.03192 ""),
[Document](https://dx.doi.org/10.48550/arXiv.2601.03192 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px1.p1.1 "Meta-Agents. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

- \[58\]A. Zhou, K. Yan, M. Shlapentokh-Rothman, H. Wang, and Y. Wang (2023)Language Agent Tree Search Unifies Reasoning Acting and Planning in Language Models.
Note: arXiv:2310.04406External Links: [Link](https://arxiv.org/abs/2310.04406 "")Cited by: [§2](https://arxiv.org/html/2605.10913v3#S2.SS0.SSS0.Px2.p1.1 "Agentic Meta-Optimization. ‣ 2 Related Work ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").


## Appendix A Limitations and Future Works

### A.1 Limitations

##### Proof-of-existence framing.

Each of our three case studies is reported as a proof of existence: the substrate primitives suffice to drive a meaningful uplift on a representative dataset, given a meta-agent we wrote for that case. We do not claim optimality of the meta-agent policies, robustness across model families and benchmarks at scale, or that the headline numbers cannot be matched without Shepherd. Establishing a full burden of proof, in the sense of head-to-head comparisons against every plausible alternative substrate and policy, is outside the scope of this work, which primarily serves to introduce Shepherd as a framework.

##### Supervision and proposer cost.

The live-supervision and CRO results assume access to a meta-agent strong enough to act usefully (Sonnet 4.6 / Opus 4.7 in § [5.1](https://arxiv.org/html/2605.10913v3#S5.SS1 "5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"); GPT-5.4 in § [5.2](https://arxiv.org/html/2605.10913v3#S5.SS2 "5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")). For short tasks, the meta-agent’s token cost can exceed the worker’s, just as for existing meta-optimisers \[ [1](https://arxiv.org/html/2605.10913v3#bib.bib1 ""), [20](https://arxiv.org/html/2605.10913v3#bib.bib8 "")\]. We report total dollar cost per arm in Appendix [F.4](https://arxiv.org/html/2605.10913v3#A6.SS4 "F.4 Per-dataset CRO results ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"); the regime where this trade-off is favourable depends on task length and on the cost ratio between the worker and the meta-agent.

##### Counterfactual replay assumes weak coupling between edits and side effects.

CRO replays a candidate edit’s suffix from the first event whose dependencies are affected by the edit. When an edit touches a component whose effects propagate widely (e.g. the system prompt of a tool used in every step), the suffix is the entire trajectory and the cache buys nothing. We observe this regime on the cold first proposer session of every dataset (Appendix [F.4](https://arxiv.org/html/2605.10913v3#A6.SS4 "F.4 Per-dataset CRO results ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")); it amortises away within two to three sessions on the benchmarks we study.

### A.2 Future Works

##### Agent interpretability.

Mechanistic interpretability of agentic systems today is largely observational: a transcript is annotated, a probe is fit, conclusions are drawn. Shepherd’s coupled fork turns these into testable counterfactual interventions. Editing a single component (a tool, a system-prompt span, a sub-task definition) and replaying the suffix from the first commit it affects holds every other source of variance fixed, isolating the contribution of that component to the eventual outcome. CRO’s propose-and-replay machinery is one instance of this loop driven by a task-success objective; a natural next step is to run the same loop under an interpretability objective, e.g. minimal edits that flip a specific decision, or the smallest prompt span whose removal preserves task success, turning CRO into a tool for explanation rather than optimisation.

##### Reversible environments for continual learning.

The Tree-GRPO results in § [5.3](https://arxiv.org/html/2605.10913v3#S5.SS3 "5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") work because forking the agent’s filesystem and processes is essentially free. The same primitive applies to any domain whose state lives on disk or in a sandboxed process tree: computer-use, web browsing, and large-codebase edit tasks all fit. Once forks are cheap, a single agent can train over weeks of interaction rather than a single rollout episode, with the execution trace maintaining a coherent history of every revisit, every backtrack, and every retried tool call. Continual learning then becomes a question of scheduling reads against this graph rather than re-engineering the substrate.

##### Post-training agents to use the substrate.

The case studies in § [5](https://arxiv.org/html/2605.10913v3#S5 "5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") fix the meta-agent and let it govern a base worker. The dual question is whether the worker itself can be post-trained to use Shepherd’s primitives natively: an action space that includes fork, discard, and replay over its own typed effect stream, not just tool calls into the environment. This is strictly harder than tool-use post-training because the model has to learn when to back up, when to retry, and when to spawn a sibling, not just which tool to invoke. The substrate provides exactly the typed state needed to define these actions and to compute exact returns over them.

##### Reversible sandboxes as a safety property.

Every effect on the substrate carries a reversibility tier (§ [3.2](https://arxiv.org/html/2605.10913v3#S3.SS2 "3.2 Effects: Agent Actions ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")): reversible filesystem mutations, compensable side effects, and irreversible external calls each have a different rollback contract. This makes Shepherd a candidate substrate for safety-critical agent deployments: an external override can preempt the materialisation of any irreversible effect, downstream checks can fire a rollback up to the last materialisation point, and the execution trace gives auditors a content-addressed record of what actually happened rather than what the agent reported. The substrate does not solve the alignment problem, but it makes the standard halt-and-inspect loop something a deployment system can implement against a stable interface rather than bespoke per-agent plumbing.

## Appendix B Mechanized Core and Proof Envelopes

Shepherd separates the production runtime from the semantic object that is
mechanized in Lean. The production framework executes ordinary Python tasks,
provider SDK calls, shell commands, sandbox operations, retries, scheduling, and
carrier storage. Those executions are not themselves verified. The verified
artifact is a small algebraic-effects trace machine, together with proof-backed
profiles for static fragments whose lowered traces fall inside its boundary.

##### Claim tiers.

Each inspectable run may carry a proof envelope with
a profile and an explicit strength. The profile is one of
runtime\_only,
reference\_core\_a,
core0,
core\_a,
core0h, or
extension; the strength is one of
runtime\_only,
reference\_validated,
forward\_simulation, or
semantic\_adequacy. Ordinary Python runs default to
runtime\_only. A trace becomes reference\_core\_a when it is
accepted by the executable kernel-v3 reference validator but does not yet claim
Lean theorem coverage. A trace becomes core0 or core\_a only
when the static lowering evidence, generated-trace validation, and Lean-side
fragment assumptions all match the completed generated trace. Core-0H is
sidecar-gated: it can receive a forward\_simulation envelope only when
a validated content-addressed Core-0H sidecar manifest is attached, and the
classifier does not infer it from arbitrary structured handlers. Core-0/Core-A envelopes claim
semantic\_adequacy. Core-A proof-backed envelopes currently require
exactly one selected direct abort capture, no selected abort-path resume/return,
and no selection-closure suffix; handler-side effects, sequencing before abort,
multiple abort captures, or unused abort-only handler definitions remain
reference-validatable. Incomplete or live prefixes remain reference-validatable
unless a future prefix certificate is attached.
Publication controls such as
forwarding, terminal delay/fork, and replay remain extension unless a
future proof envelope names a stronger theorem.

##### Lean theorem surface.

The Lean development builds with
lake build in the kernel-v3 proof artifact. The current theorem surface
used by the proof envelope is:

Table 6: Mechanized theorem surface used by the proof-envelope claim.

|     |     |     |
| --- | --- | --- |
| Profile | Representative Lean theorem | Meaning |
| Core-0 | source\_eval\_to\_machine;<br>core0\_machine\_<br>eval\_to\_source | Forward source-to-machine simulation and restricted reverse simulation for the<br>ordinary callable-resumption fragment. |
| Core-A | source\_eval\_to\_machine;<br>coreA\_machine\_<br>eval\_to\_source | Core-0 plus the direct abort-without-resume handler boundary currently admitted<br>by the envelope. |
| Core-0H | core0h\_source\_<br>eval\_to\_machine | Forward simulation for deterministic two-phase handler bodies with matching<br>evidence; this profile is currently forward-only. |
| Trace monotonicity | trace\_monotonic;<br>core0h\_trace\_monotonic | Machine execution extends traces by appending records rather than rewriting<br>prior trace prefixes. |
| Branch replay skeleton | single\_child\_branch\_<br>replay\_sound | One-child structural replay soundness for an exact suffix replay model; this is<br>not a production replay refinement proof. |

##### Executable reference boundary.

The Python
agentic-kernel-v3-reference package in the submitted code package sits between the production runtime
and the Lean development. It validates Core-0/Core-A trace lifecycles, reruns a
static KernelProgram to check exact generated-trace agreement, and
emits an explicit ProofEnvelope. Public Run\[T\] values carry a
proof field; current production Python executions default to
runtime\_only. The envelope records a content-addressed evidence
identifier over the proof authority, validator, program digest, and trace
digest. Kernel envelopes derive proof\_backed from
proof\_strength, so profile names alone do not upgrade a trace. Runtime
metadata is carrier metadata: non-runtime strengths must cite kernel-v3
reference provenance and a proof-evidence:sha256 identifier, but public
Run\[T\] metadata exposes such imports as claimed\_proof\_backed
rather than runtime-verified proof authority. Lean theorem ids are centralized in
a proof-surface ABI table checked by a Lean module with #check commands
and typed signature wrappers, so stale theorem names or materially changed
theorem statements fail the artifact build. Live prefixes and structured handler
bodies without validator-issued Core-0H two-phase sidecar manifests are
classified as reference-validatable rather than proof-backed. The artifact gate
is make verify-proof-envelope-claim. This makes the formal claim
inspectable without implying that all executable Agentic programs are
proof-backed.

##### Non-claims.

The proof envelope does not verify arbitrary Python
control flow, provider SDK behavior, model outputs, prompt-cache state, shell
commands, filesystem mutation correctness, Docker or sandbox implementations,
meta-git carrier storage, scheduling, cancellation, retries, recovery, or
multi-branch replay. The meta-agent applications in the main paper rely on the
production substrate plus empirical validation; the Lean artifact supplies the
semantic core and the boundary discipline for proof-backed fragments.

## Appendix C Framework Performance: Extended Results

This appendix groups all extended results that support [Section4](https://arxiv.org/html/2605.10913v3#S4 "4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"): the measurement protocol (Appendix [C.1](https://arxiv.org/html/2605.10913v3#A3.SS1 "C.1 Measurement Protocol ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), the mutation-size sweep that defuses the large-file concern (Appendix [C.2](https://arxiv.org/html/2605.10913v3#A3.SS2 "C.2 Substrate scaling under varying mutation size ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), the agent-turn latency reference behind the “2–3% of one turn” claim (Appendix [C.3](https://arxiv.org/html/2605.10913v3#A3.SS3 "C.3 Agent per-turn latency reference ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), depth scaling under stacked overlay layers (Appendix [C.4](https://arxiv.org/html/2605.10913v3#A3.SS4 "C.4 Scaling Behaviour ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), the effect-stream observation overhead (Appendix [C.5](https://arxiv.org/html/2605.10913v3#A3.SS5 "C.5 Observe Overhead Detail ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), the KV-cache reuse breakdown (Appendix [C.6](https://arxiv.org/html/2605.10913v3#A3.SS6 "C.6 KV-Cache Reuse Detail ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")), and the cross-backend portability check (Appendix [C.7](https://arxiv.org/html/2605.10913v3#A3.SS7 "C.7 Realization across Sandbox Backends ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

### C.1 Measurement Protocol

##### Hardware.

The [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") measurements for Shepherd, docker commit, and full rootfs copy run on the same Vultr cloud instance (2 vCPU, 16 GB RAM, SSD, Ubuntu 22.04, Docker 29.3.1, overlay2 storage driver on extfs). Modal numbers come from Modal’s hosted gVisor runtime (separate hardware) and are reproduced from a fresh benchmark whose latency, therefore, additionally includes network round-trip from the host-side agent. The [Table8](https://arxiv.org/html/2605.10913v3#A3.T8 "In C.4 Scaling Behaviour ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") measurements use E2B Firecracker micro-VMs. Cross-backend numbers (Appendix [C.7](https://arxiv.org/html/2605.10913v3#A3.SS7 "C.7 Realization across Sandbox Backends ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")) use E2B (Firecracker), Modal (gVisor), and Daytona (managed Linux containers).

##### Workloads.

[Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") uses three real Terminal-Bench 2.0 Docker images spanning two orders of magnitude: _openssl-selfsigned-cert_ (42 MB), _caffe-cifar-10_ (200 MB), and _pytorch-model-recovery_ (5.8 GB). Full copy tars the entire container rootfs, excluding /proc, /sys, /dev, and /tmp, and is O⁡(n)O(n) in image size. docker commit, Modal snapshot\_filesystem(), and Shepherd’s overlay delta are all O⁡(1)O(1) in image size on the overlay2 driver. [Table8](https://arxiv.org/html/2605.10913v3#A3.T8 "In C.4 Scaling Behaviour ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") additionally uses three synthetic working directories: _small_ (10 files, 30 KB), _medium_ (100 files, 100 MB), _large_ (100 files, 1 GB). KV-cache experiments use real Terminal-Bench 2.0 tasks with a Haiku 4.5 agent.

##### Per-step mutation pattern.

The agent’s writes inside the workdir are simulated with a fixed 5+3 random-file pattern: 5 baseline writes establish the parent state _before_ the checkpoint, then each of the K−1=3K{-}1{=}3 sibling branches adds 1 more random write _after_ the fork, all written into the measured workdir. Each write defaults to 10,KB. [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")’s storage columns count only the post-fork branch deltas: the Storage column reports a single sibling’s overlay delta (1 write = 10,KB); the Disk @ K=4 column reports the sum of the three siblings’ overlay deltas (3×10,KB=30,KB3\\times 10,\\textrm{KB}=30,\\textrm{KB}). The 5 baseline writes (50,KB) sit in the parent’s overlay and are not counted there. [Table7](https://arxiv.org/html/2605.10913v3#A3.T7 "In C.2 Substrate scaling under varying mutation size ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") in [SectionC.2](https://arxiv.org/html/2605.10913v3#A3.SS2 "C.2 Substrate scaling under varying mutation size ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") reports the _full_ overlay upper directory (baseline + branches, 8×10,KB≈80,KB8\\times 10,\\textrm{KB}\\approx 80,\\textrm{KB} at this default size) and sweeps the per-write size from 1,KB to 100,MB to verify the substrate scales 1:1 with what the agent writes and adds no multiplier on top.

##### Pattern A: agent-on-host, sandbox-in-container.

The fork/revert latencies in [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") measure agent-perceived wall-clock under Pattern A, which matches how production agents (mini-swe-agent, SWE-Agent, smolagents) use sandboxes today. A Python agent process on the host imports litellm \+ tenacity (matching Terminus-2’s startup), warms an OpenAI gpt-5.4-mini client with one call, then drives the sandbox container through a tmux session. Each operation is timed from "operation issued" until the new sandbox’s tmux returns to a probe bash command (echo READY\_<uuid> \+ capture-pane until the marker appears). Method-specific operations:

- •


docker commit: Fork = docker commit \+ docker run -d new container + tmux ready in new container. Revert = docker rm -f \+ docker run -d from saved image + tmux ready. Both ops are required; measuring only docker run understates by the rm/commit cost.

- •


Modal: Fork = snapshot\_filesystem() \+ Sandbox.create(image=snap) \+ tmux ready. Revert = terminate() \+ Sandbox.create(image=snap) \+ tmux ready.

- •


Shepherd: Fork = overlay-layer fork (in-container, same tmux session). Revert = overlay umount/remount of saved layer (in-container, same tmux session).

- •


BranchFS \[ [39](https://arxiv.org/html/2605.10913v3#bib.bib5 "")\]: BranchFS daemon runs on the host with a FUSE mount; the TB2 image is bind-mounted into a Docker container at /workspace so the agent’s tmux can read/write through the FUSE layer. Fork = branchfs create, which creates a copy-on-write branch and auto-switches the mount, then tmux probe. Revert = branchfs abort, which discards the leaf branch’s delta and switches the mount back to the parent, then tmux probe. BranchFS branch ops are O(1) in base directory size, so fork/revert latency is image-independent (confirmed across 42 MB / 200 MB / 5.8 GB images: ~270 ms fork, ~358 ms revert).

- •


Full copy: latency reported in [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") is computed (not measured) as rootfs tar/restore (Vultr) plus an empirically observed ∼\\sim340 ms container-startup + tmux-probe overhead. Running the full agent-revert protocol takes hours per cell on the 5.8 GB image (each fork moves the full rootfs tar across two docker cp boundaries), so we report the computed values.


##### Disk and RAM at K=4K{=}4.

Disk @ K=4 is the host disk delta over K−1K{-}1 added branches: commit-layer deltas for docker commit, full rootfs tars for full copy (computed = (K−1)×(K{-}1)\\times per-branch tar size), overlay-layer files for Shepherd, BranchFS storage tree (/var/lib/branchfs) over KK branches. RAM @ K=4 is summed RSS via docker stats --no-stream over the alive containers (KK for docker commit / full copy, where each branch needs a separate restarted container; 1 container reading for Shepherd, which forks the worker process per branch but reuses one host container as the overlay-layer host (the K forked worker processes are aggregated under that one RSS reading); 1 container + BranchFS daemon RSS for BranchFS). Modal’s per-sandbox host RAM/disk is hidden behind Modal’s runtime, so its K=4K{=}4 cells are marked —.

##### Protocol.

Each benchmark begins with 2–3 warm-up iterations (discarded) to prime filesystem caches and JIT paths. Measurements are wall-clock time.monotonic() around the operation under test. For [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") fork/revert latency: 10 repetitions per cell for Shepherd / docker commit / Modal, 5 repetitions for full-copy storage measurements; 3 repetitions for the K=4K{=}4 resource columns. Error bars are ±1​σ\\pm 1\\sigma. Storage is measured via du -sb on the overlay upper directory (for Shepherd) or the checkpoint artifact (for baselines). Bench code is shared under exp/framework-perf, please refer to the readme.

### C.2 Substrate scaling under varying mutation size

A natural reviewer concern about the 10 KB delta in [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") is whether the substrate stays small when the agent writes large files. We sweep the per-step write size from 1 KB to 100 MB on the 5.8 GB pytorch-model-recovery image, keeping the same 5+3 mutation pattern but changing how many bytes each write puts into the workdir. [Table7](https://arxiv.org/html/2605.10913v3#A3.T7 "In C.2 Substrate scaling under varying mutation size ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") reports the resulting overlay disk delta and fork latency across three repetitions per size.

Two findings: (a) the disk delta tracks what the agent writes 1:1 (8 KB at 1 KB/step up to 800 MB at 100 MB/step), so the substrate adds zero overhead beyond the agent’s actual emissions; (b) fork and revert latency stay flat at ∼\\sim340 ms across all sizes, since both operations only swap overlay metadata, not file contents. We additionally verify revert correctness across the same sweep: in 12 reps spanning all four sizes, the workdir after revert exactly matches the pre-fork state (5 baseline files preserved, 3 post-fork branch files cleanly discarded; 12/12 PASS). Absolute latencies here are about 200 ms higher than [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") because this sweep ran on Mac/Docker Desktop’s Linux VM, which adds docker exec overhead per call; the scaling shape is what the table claims.

Table 7: Substrate scaling under varying per-step mutation size on the 5.8 GB pytorch-model-recovery image (5+3 random-write pattern, K=4K{=}4 branches, 3 reps; medians). The disk delta scales 1:1 with what the agent writes; fork and revert latency stay flat. Revert correctness (post-revert workdir matches pre-fork state) is 12/12 PASS across the four sizes.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Per-step write | Total written | Disk delta ↓\\downarrow | Fork (ms) ↓\\downarrow | Revert (ms) ↓\\downarrow |
| 1 KB | 8 KB | 8.4 KB | 339 | 348 |
| 10 KB | 80 KB | 80.4 KB | 386 | 346 |
| 1 MB | 8 MB | 8.0 MB | 331 | 385 |
| 100 MB | 800 MB | 800 MB | 343 | 366 |

### C.3 Agent per-turn latency reference

To anchor the claim that Shepherd’s fork is small relative to a typical agent turn, we instrumented the bench harness with per-turn wall-clock timing and ran two Terminal-Bench 2.0 tasks for up to 20 turns each (Anthropic Claude Haiku 4.5, E2B sandbox). Across 17 measured turns we observe:

- •


LLM call (Anthropic API round-trip): mean 5.36 s, median 5.56 s, p10/p90 = 2.69 / 7.64 s.

- •


Tool call (sandbox bash execution): mean 0.20 s, median 0.17 s, p10/p90 = 0.08 / 0.61 s.

- •


Per-turn total: mean 5.50 s, median 5.81 s, p10/p90 = 2.70 / 7.77 s.


The LLM call dominates ( 98% of per-turn wall-clock); the tool call is small here because Terminal-Bench tasks involve mostly light bash (file reads, package installs). Heavier tool actions (compilation, training) push per-turn time well above the median. Shepherd’s 134–143 ms fork ( [Table3](https://arxiv.org/html/2605.10913v3#S4.T3 "In 4 Framework Performance ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")) is therefore around 2–3% of a typical Haiku 4.5 turn and well below the noise floor of one LLM call’s response-time variance.

### C.4 Scaling Behaviour

[Table8](https://arxiv.org/html/2605.10913v3#A3.T8 "In C.4 Scaling Behaviour ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") reports how checkpoint/revert latency behaves as the number of stacked overlay layers grows (left) and as the effect stream accumulates events (right). Shepherd’s overlay checkpoint remains in the 157–252 ms band (on E2B) through 50 stacked layers; docker commit is roughly constant as well but at a 2.8×\\times higher baseline (451–558 ms). The OverlayFS lower-directory chain is bounded by the kernel’s page-size limit at approximately 60 layers; trajectories exceeding this depth require periodic compaction of frozen layers.

Per-event effect-stream overhead (record and observe) is constant at approximately 120 ms on E2B (network-dominated) through 200 steps. Stream size grows linearly at ∼130{\\sim}130 B/event.

Table 8: Left: Checkpoint/revert latency (ms) as overlay layers stack (E2B), compared to docker commit (Vultr). Right: Per-event effect-stream overhead (E2B) as trajectories grow.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|  | Agentic | Docker commit |
| Depth | Ckpt | Revert | Commit | Revert |
| 1 | 173 | 255 | 451 | 300 |
| 5 | 157 | 170 | 524 | 255 |
| 10 | 252 | 167 | 481 | 258 |
| 25 | 179 | 170 | 558 | 260 |
| 50 | 237 | 167 | 503 | 297 |

|     |     |     |     |
| --- | --- | --- | --- |
| Steps | Record | Observe | Stream |
| 1 | 106 ms | 107 ms | 134 B |
| 10 | 127 ms | 178 ms | 1.3 KB |
| 50 | 109 ms | 177 ms | 6.5 KB |
| 100 | 197 ms | 117 ms | 13.1 KB |
| 200 | 171 ms | 115 ms | 26.4 KB |

### C.5 Observe Overhead Detail

[Table9](https://arxiv.org/html/2605.10913v3#A3.T9 "In C.5 Observe Overhead Detail ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") compares effect-stream recording throughput on a local Docker host (no network roundtrip) versus E2B Firecracker (remote API). The local overhead is 3.1 ms per event (5%); the E2B figure (113 ms, 87%) is dominated by the network roundtrip for each exec call and does not reflect framework serialization cost. We separately verified that subscribing a supervisor to the effect stream adds exactly zero tokens to the worker’s context by comparing the worker’s message list with and without a supervisor attached: the two lists are byte-identical across a 10-step trajectory.

Table 9: Left: Effect-stream recording throughput, local vs. remote. Right: Context inflation test: supervisor subscription adds 0 tokens to the worker.

|     |     |     |
| --- | --- | --- |
| Metric | Local | E2B |
| Raw throughput | 17 evt/s | 8 evt/s |
| Logged throughput | 16 evt/s | 4 evt/s |
| Overhead / event | 3.1 ms (5%) | 113 ms (87%) |
| Observe latency | 64 ms | 104 ms |

|     |     |
| --- | --- |
| Condition | Worker context |
| Without supervisor | 21 msgs, 1449 chars |
| With supervisor | 21 msgs, 1449 chars |
| Context inflation | 0 chars (0.0%) |

### C.6 KV-Cache Reuse Detail

[Table10](https://arxiv.org/html/2605.10913v3#A3.T10 "In C.6 KV-Cache Reuse Detail ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") reports the per-task, per-fork-depth view behind the §3 summary. Each task is run once on the Anthropic API with Claude Haiku 4.5 to generate an initial trajectory, with checkpoints saved at fork depths step 10, step 25, and step 50 (the third only fires when the trajectory reaches that depth). At each saved fork point we then run KK branches: each branch reverts the sandbox to the checkpoint, restores the LLM message prefix with cache\_control: {"type": "ephemeral"} on the last prefix message, and continues sampling. The provider’s prompt cache (5-minute TTL) charges 0.10×0.10\\times the input-token rate for resolved-prefix tokens and 1.25×1.25\\times the rate for the first branch’s cache write; branches 22 through KK amortise the write across additional reads, which is why savings climb sharply K=1→K=2K{=}1\\to K{=}2 and stabilise after.

Table 10: Per-task KV-cache reuse on the Anthropic API (Claude Haiku 4.5) across 8 Terminal-Bench 2.0 tasks. Each cell reports _savings% / hit%_ for KK branches forked and replayed from a checkpoint at the listed step depth. The hit rate is the substrate-fidelity check (does revert restore the LLM message prefix byte-for-byte); the plateau at ∼\\sim95% from K=2K{=}2 onwards is within 5% of the 100% ceiling. Savings climb sharply K=1→K=2K{=}1\\to K{=}2 as the cache-write penalty amortises across one extra branch, then stabilise as per-branch suffix generation grows linearly in KK. Empty cells are fork-depth/KK combinations not reached within the per-task wall-clock budget.

|     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- |
|  |  | Branching factor KK |
| Task | Fork | K=1K{=}1 | K=2K{=}2 | K=4K{=}4 | K=8K{=}8 | K=16K{=}16 |
| openssl-selfsigned-cert | step 10 | 61 / 83 | 72 / 96 | 70 / 95 | 72 / 96 | 71 / 95 |
|  | step 25 | 60 / 79 | 79 / 98 | 79 / 97 | 79 / 98 | 80 / 98 |
| nginx-request-logging | step 10 | 59 / 87 | 61 / 93 | 63 / 93 | 62 / 93 | 62 / 93 |
|  | step 25 | 66 / 88 | — | — | — | — |
| build-cython-ext | step 10 | 60 / 87 | 67 / 95 | 67 / 95 | 67 / 95 | 67 / 94 |
|  | step 25 | 68 / 89 | 78 / 97 | 77 / 97 | 77 / 97 | — |
| configure-git-webserver | step 10 | 62 / 88 | 68 / 94 | 67 / 94 | 68 / 95 | 68 / 95 |
|  | step 25 | 62 / 82 | 76 / 97 | 79 / 97 | 77 / 97 | — |
| feal-differential-cryptanalysis | step 10 | 57 / 86 | 63 / 93 | 63 / 93 | 63 / 93 | — |
| llm-inference-batching-scheduler | step 10 | 55 / 83 | 63 / 92 | 63 / 92 | 64 / 93 | 64 / 93 |
| make-doom-for-mips | step 10 | 56 / 84 | 68 / 93 | 64 / 93 | 59 / 91 | 62 / 92 |
|  | step 25 | 64 / 88 | 73 / 96 | 75 / 97 | 74 / 97 | 74 / 97 |
|  | step 50 | 74 / 89 | 84 / 99 | 85 / 99 | 84 / 99 | — |
| pytorch-model-recovery | step 10 | 58 / 86 | 65 / 93 | 64 / 92 | 64 / 92 | 64 / 93 |
|  | step 50 | 67 / 85 | 82 / 98 | 82 / 98 | — | — |
| Mean |  | 62 / 86 | 71 / 95 | 71 / 95 | 70 / 95 | 68 / 94 |

All Anthropic measurements use cache\_control: {"type": "ephemeral"} on the last prefix message; the provider’s prompt cache (5-minute TTL) serves the prefix at 10% of the normal input-token price. Tasks whose initial-prompt prefix falls below Haiku 4.5’s 4,096-token minimum cacheable threshold are excluded; in our Terminal-Bench 2.0 sample this filter drops one task ( _fix-git_, 157-character instruction).

### C.7 Realization across Sandbox Backends

The primitives of [Section3](https://arxiv.org/html/2605.10913v3#S3 "3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") are realized over the overlay-filesystem and checkpoint facilities exposed by modern containerized sandboxes. A single device-layer interface abstracts backend differences; application code written against the abstraction runs unchanged across providers. [Table11](https://arxiv.org/html/2605.10913v3#A3.T11 "In Prime Intellect (gVisor). ‣ C.7 Realization across Sandbox Backends ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") summarizes compatibility and measured fork latency where available.

##### Docker (local / Vultr).

Privileged containers with kernel OverlayFS on tmpfs. Checkpoint unmounts the overlay, freezes the upper directory as a named layer, and remounts with the frozen layer in the lower stack. Measured at 72 ms median (50 reps, 2 vCPU / 4 GB).

##### E2B Firecracker.

Micro-VM sandboxes with OverlayFS via sudo. Semantics are identical to local Docker; measured latency is higher (159–169 ms) due to the remote API roundtrip. The metacopy=on mount option avoids full-file copy-up on chown.

##### Modal (gVisor).

gVisor blocks mount/umount syscalls, so checkpoint uses Modal’s snapshot\_filesystem() API (935–1137 ms). Revert terminates the sandbox and spawns a new one from the snapshot image (75–79 ms).

##### Daytona.

Cloud development environment with root access. OverlayFS works without sudo. Preliminary validation confirms all scope operations pass. Since the underlying primitive is identical to local Docker’s OverlayFS (72 ms, size-independent in our local\_overlay bench), Daytona’s measured fork latency is dominated by the remote API roundtrip; we estimate ∼\\sim150 ms by analogy with E2B’s measured +91 ms RTT ( [Table11](https://arxiv.org/html/2605.10913v3#A3.T11 "In Prime Intellect (gVisor). ‣ C.7 Realization across Sandbox Backends ‣ Appendix C Framework Performance: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")).

##### Prime Intellect (gVisor).

umount is blocked even though mount succeeds, so the framework falls back to cp -a copies. This is O⁡(n)O(n) in working-directory size: from our real\_docker\_images bench, a small workdir (≤\\leq5 MB) takes ∼\\sim100 ms to clone, and the same primitive scales to 2.3 s on a 44 MB rootfs and 57 s on a 6 GB rootfs (storage\_fix bench). The fallback is therefore usable for small repositories but unsuitable for large ones.

Table 11: Cross-backend compatibility. All backends support the same scope API. Latency is wall-clock median for Scope.fork; 50 reps except where noted.

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
| Backend | Mechanism | Fork | Revert | Notes |
| Docker (local) | OverlayFS on tmpfs | 72 ms | 70 ms | Primary benchmark platform |
| E2B Firecracker | OverlayFS + sudo | 163 ms | 157 ms | +90 ms network roundtrip |
| Modal | snapshot\_filesystem() | 935 ms | 79 ms | gVisor; no OverlayFS |
| Daytona | OverlayFS (root) | 150 ms | 140 ms | Validation passed; remote managed container |
| Prime Intellect | cp -a fallback | 100 ms | 110 ms | gVisor; O⁡(n)O(n) in workdir size |

## Appendix D Trajectory Compression: Extended Results

##### Motivation.

Many real-world agent tasks are _repeatable_: a class of bug fixes, a class of data-processing scripts, a class of build-environment errors. The first solution an agent finds is typically full of exploration it did not, in retrospect, need: redundant probes, dead-end hypotheses, trial-and-error before convergence. We ask whether a meta-agent reading the completed trajectory through the effect stream can identify a fork point and a hint such that the worker, restored to the Shepherd scope at that point and given the hint as a system-prompt addendum, reaches the same task outcome in strictly fewer steps; i.e., _compresses_ the trajectory. Shepherd’s per-step snapshots make this cheap: the meta-agent need not commit to a fork point at trajectory-collection time, and the rerun pays only the suffix cost. Whether a compressed trajectory generalises to a reusable workflow for future invocations of the same task class is a follow-up question we leave open.

![Refer to caption](https://arxiv.org/html/2605.10913v3/headline_bars.png)Figure 6: Trajectory compression across two worker model families and two benchmarks. The same worker is rerun from a forked Shepherd scope with the meta-agent’s hint prepended to its system prompt; the resulting trajectory is the compressed one. A baseline is _compressed_ when its rerun also passes the verifier and uses strictly fewer model calls. _Left:_ mean trajectory length on the compressed trajectories, baseline (solid) versus rerun (hatched). _Right:_ the compression rate (the fraction of passing baselines that admit a compression).

##### Setup.

We evaluate on full Terminal-Bench v2.0 (88 tasks) \[ [25](https://arxiv.org/html/2605.10913v3#bib.bib24 "")\] and SWE-Bench Verified (500 instances) \[ [15](https://arxiv.org/html/2605.10913v3#bib.bib56 "")\]. Two base workers cross two model families: Claude Sonnet 4.6 (non-thinking) and GPT-5.4 (reasoning\_effort=high); the meta-agent is GPT-5.4 with reasoning\_effort=xhigh for both cells. The meta-agent reads the full effect stream of a completed worker trajectory and emits a JSON object with a fork\_step, a free-form natural-language hint, and a brief rationale. The rerun forks the Shepherd scope to the snapshot taken right before fork\_step, restores the worker’s message list up to that step, prepends the hint to the system prompt, and resumes the worker loop. A baseline trajectory counts as _compressed_ when the rerun also passes the verifier and uses strictly fewer model calls than the baseline; otherwise the rerun is discarded. We measure two quantities, conditional on the baseline having passed. The _compression rate_ is the fraction of passing baselines that admit a compression. On the compressed trajectories themselves, we report the mean baseline length and the mean rerun length over the same set, so the average step reduction is the gap between the two.

##### Most trajectories admit a shorter passing rerun.

[Figure6](https://arxiv.org/html/2605.10913v3#A4.F6 "In Motivation. ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") reports the two quantities. On SWE-Bench Verified, 68% of Sonnet’s passing baselines and 82% of GPT-5.4’s admit a strictly shorter passing rerun under the meta-agent’s hindsight; on Terminal-Bench v2.0 the corresponding fractions are 77% and 68%. The mean baseline length on the compressed trajectories drops from 21.4 to 8.9 model calls (Sonnet) and from 19.0 to 8.8 (GPT-5.4 high) on SWE-Bench Verified, and from 15.8 to 7.1 and 11.4 to 5.2 on Terminal-Bench v2.0; the single largest individual compression is on sphinx-doc/sphinx-8459, which Sonnet’s 80-step passing baseline shortens to 7. A no-meta-agent control that selects the shortest passing baseline among N=5N{=}5 independent samples recovers a small fraction of this gap on the same tasks (see below), which rules out within-task baseline variance as the explanation. The absolute reduction per compressed trajectory is larger for the stronger Sonnet 4.6 worker on SWE-Bench Verified (12.5 model calls saved on average) than for GPT-5.4 high (10.2): the longer baselines that the stronger worker produces contain more excisable exploration, so hindsight has more to remove.

The remainder of this appendix reports (i) the four-cell aggregate table behind [Figure6](https://arxiv.org/html/2605.10913v3#A4.F6 "In Motivation. ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"), (ii) the per-task top compressions, (iii) hint examples drawn verbatim from the meta-agent’s emissions, (iv) the no-meta-agent best-of-NN control, (v) the distribution of fork steps the meta-agent chose, and (vi) the meta-agent’s span-proposal prompt and verification protocol.

### D.1 Aggregate results

[Table12](https://arxiv.org/html/2605.10913v3#A4.T12 "In D.1 Aggregate results ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") reports, for each (worker model, substrate) cell, the number of tasks attempted, the count of passing baselines, the count of compressed trajectories, the count of rescues (baseline failed but rerun passed; not used in the main-text figure), the compression rate, and the mean trajectory length on the compressed trajectories before and after. The mean reduction Δ¯\\overline{\\Delta} is taken over the compressed set only, so the average is not diluted by tasks where the meta-agent had nothing to shorten.

Table 12: Trajectory pruning, four-cell summary. Counts are over all attempted tasks. Means B¯\\overline{B}, R¯\\overline{R}, and Δ¯\\overline{\\Delta} are restricted to the compressed set per cell.

|     |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Substrate | Worker | nn | nbpassn\_{\\text{bpass}} | ncompressn\_{\\text{compress}} | nrescuen\_{\\text{rescue}} | rate | B¯\\overline{B} | R¯\\overline{R} | Δ¯\\overline{\\Delta} |
| Terminal-Bench v2.0 | Sonnet 4.6 | 88 | 31 | 24 | 12 | 77% | 15.8 | 7.1 | 8.6 |
| Terminal-Bench v2.0 | GPT-5.4 high | 88 | 40 | 27 | 13 | 68% | 11.4 | 5.2 | 6.2 |
| SWE-Bench Verified | Sonnet 4.6 | 500 | 79 | 54 | 10 | 68% | 21.4 | 8.9 | 12.5 |
| SWE-Bench Verified | GPT-5.4 high | 500 | 110 | 90 | 13 | 82% | 19.0 | 8.8 | 10.2 |

A small fraction of attempted tasks did not complete due to E2B sandbox resource exhaustion during the heaviest baselines (filesystem-intensive tasks like install-windows-3.11, pytorch-model-recovery, video-processing); concretely, 6 of 88 tasks per cell on Terminal-Bench v2.0 and 66 (Sonnet) / 68 (GPT-5.4 high) of 500 instances on SWE-Bench Verified. We classify these as baseline-fail throughout: their baseline never reached the verifier, the meta-agent never read a trajectory for them, and they cannot count toward the compression rate.

The pattern is consistent across cells: the compression rate is well above 60%60\\% in every cell, the mean baseline length drops by roughly half on the compressed set, and the absolute reduction is largest for the worker that produces the longest baselines (Sonnet on SWE-Bench Verified, where the average compressed trajectory loses 12.5 model calls). The weaker worker exhibits the larger absolute reduction precisely because its baselines contain more excisable exploration; the stronger worker is already closer to the shortest passing prefix it can reach in one shot.

### D.2 Top compressions

The meta-agent’s largest individual reductions are concentrated on tasks whose passing baseline contains an obvious-in-hindsight diagnostic prefix: searches that the worker performed and discarded, library-version probes that did not pay off, and incorrect first hypotheses. [Table13](https://arxiv.org/html/2605.10913v3#A4.T13 "In D.2 Top compressions ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") lists the top five compressions per cell, ordered by absolute steps saved.

Table 13: Top five trajectory compressions per cell. Each row is one task; BB and RR are the baseline and rerun trajectory lengths in model calls; ff is the fork step the meta-agent chose; Δ=B−R\\Delta=B-R.

|     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- |
| Substrate | Worker | Task | BB | RR | ff | Δ\\Delta |
| TB v2.0 | Sonnet 4.6 | db-wal-recovery | 34 | 11 | 7 | 23 |
| TB v2.0 | Sonnet 4.6 | cobol-modernization | 28 | 8 | 0 | 20 |
| TB v2.0 | Sonnet 4.6 | tune-mjcf | 24 | 5 | 2 | 19 |
| TB v2.0 | Sonnet 4.6 | bn-fit-modify | 30 | 15 | 6 | 15 |
| TB v2.0 | Sonnet 4.6 | crack-7z-hash | 22 | 8 | 1 | 14 |
| TB v2.0 | GPT-5.4 high | code-from-image | 22 | 4 | 0 | 18 |
| TB v2.0 | GPT-5.4 high | db-wal-recovery | 18 | 2 | 0 | 16 |
| TB v2.0 | GPT-5.4 high | cobol-modernization | 20 | 5 | 1 | 15 |
| TB v2.0 | GPT-5.4 high | qemu-startup | 20 | 7 | 4 | 13 |
| TB v2.0 | GPT-5.4 high | build-pmars | 16 | 7 | 3 | 9 |
| SWE-V | Sonnet 4.6 | sphinx-doc/sphinx-8459 | 80 | 7 | 0 | 73 |
| SWE-V | Sonnet 4.6 | pydata/xarray-6599 | 53 | 18 | 8 | 35 |
| SWE-V | Sonnet 4.6 | pydata/xarray-2905 | 32 | 5 | 0 | 27 |
| SWE-V | Sonnet 4.6 | scikit-learn/scikit-learn-14087 | 33 | 7 | 0 | 26 |
| SWE-V | Sonnet 4.6 | astropy/astropy-13579 | 30 | 8 | 0 | 22 |
| SWE-V | GPT-5.4 high | pylint-dev/pylint-7277 | 49 | 13 | 8 | 36 |
| SWE-V | GPT-5.4 high | scikit-learn/scikit-learn-25973 | 38 | 5 | 0 | 33 |
| SWE-V | GPT-5.4 high | astropy/astropy-14508 | 35 | 5 | 1 | 30 |
| SWE-V | GPT-5.4 high | pytest-dev/pytest-6197 | 33 | 6 | 2 | 27 |
| SWE-V | GPT-5.4 high | sphinx-doc/sphinx-8638 | 38 | 13 | 1 | 25 |

##### Two qualitative shapes recur.

A _from-scratch restart_ (f=0f{=}0, e.g. sphinx-8459, xarray-2905, cobol-modernization): the worker explored, eventually identified the right code site, but the path there was discardable; the meta-agent recognises that the diagnosis is in the _trajectory_ but not on the _path_, and writes a hint that puts the rerun at the right file on its first edit. A _mid-trajectory cut_ (f>0f{>}0, e.g. pylint-7277 at f=8f{=}8, xarray-6599 at f=8f{=}8): the worker’s early exploration was substantively useful (it located the buggy module and the failing test), but the second half of the baseline was a thrash through wrong fixes; the meta-agent keeps the useful prefix and rewrites the rest of the plan.

### D.3 Hint examples

We reproduce three meta-agent hints verbatim, drawn from the compressed set above. Each illustrates one of the recurring patterns in the meta-agent’s output: target-file disambiguation (hint A), library-detail correction with a no-detour instruction (hint B), and an explicit “do not do X” instruction that prunes a wrong-environment thrash (hint C).

##### Hint A (psf/requests-1142, GPT-5.4 high, B=25,R=6,f=3B{=}25,R{=}6,f{=}3).

> You already narrowed it to the right spot: edit /testbed/requests/models.py, in PreparedRequest.prepare\_content\_length. The bug is the unconditional self.headers\[’Content-Length’\] = ’0’ at the top of that method; make the minimal change so Content-Length is only set when body actually exists / has a measurable length. Don’t keep re-reading the file, and don’t detour into /app, system site-packages, or urllib3 MutableMapping compatibility—those imports/tests are unrelated to the verifier for this bug.

##### Hint B (astropy/astropy-7671, Sonnet 4.6, B=17,R=7,f=5B{=}17,R{=}7,f{=}5).

> The only code you need to touch is /testbed/astropy/utils/introspection.py: in minversion, switch away from distutils.version.LooseVersion and use pkg\_resources.parse\_version for both comparisons. After making that minimal edit, skip importing top-level astropy or trying pytest/py.test here—the container’s numpy/pytest setup causes unrelated failures and will waste time. If you want one cheap sanity check, load introspection.py directly with importlib.util.

##### Hint C (pydata/xarray-6599, Sonnet 4.6, B=53,R=18,f=8B{=}53,R{=}18,f{=}8).

> Don’t chase the datetime\_to\_numeric offset alone. Compare xarray/core/computation.py:polyval with the pre-6fbeb131 version: old polyval used get\_clean\_interp\_index(coord, coord.name, strict=False), i.e. the named dimension coordinate/index, not coord.data. Fix \_ensure\_numeric (or polyval just before it) so that for a DataArray with x.name in x.coords, you evaluate on x.coords\[x.name\].data before converting to numeric.

The hints share three traits: they name a specific file path on /testbed, they describe the change as a code-level intent rather than a diff, and the hindsight content is what the worker wishes it had known going in (which library import to avoid, which previous version of a function to compare against, which detours not to take). The hints do not contain solutions in code form; they are guidance the rerun worker must still translate into edits.

### D.4 Best-of-NN control

To rule out the hypothesis that “a shorter passing baseline already exists in the worker’s distribution and the meta-agent is merely sampling it,” we ran an independent best-of-NN control: for each task with at least one passing baseline, we sample N=5N{=}5 additional fresh baseline rollouts of the same worker (no meta-agent, no fork, identical system prompt and provider-default temperature), and select the shortest passing rollout among the resulting samples. We then compare the shortest-passing-of-NN length against the meta-agent rerun length on the same task.

##### Coverage.

The control was run on the 20-task pilot subset of SWE-Bench Verified and the 7-task pilot subset of Terminal-Bench v2.0 for which we had budget for the full N=5N{=}5 resampling. Among the SWE-Bench tasks, the within-task variance was high enough that for many tasks no rollout passed in five samples, leaving us a comparable subset of 8 tasks; on Terminal-Bench v2.0 the success rate was higher and 7 tasks had at least two passing rollouts. We do not extend the control to all 588 tasks because the cost is 5×5\\times the headline run with no marginal scientific value once the gap is clear.

##### Result.

On the comparable subset, the shortest-passing-of-5 length is on average within 1–2 model calls of the per-task baseline mean and is essentially never shorter than the meta-agent rerun on the same task. Concretely, on the seven Terminal-Bench v2.0 tasks with ≥2\\geq 2 passing rollouts, the shortest-passing-of-5 length is 5.6 calls and the per-task baseline mean is 5.7; the meta-agent rerun length on the same set is 4.4 calls. The control therefore recovers a small fraction of the gap relative to the mean baseline, but does not close the gap to the meta-agent rerun, which is what the compression-rate claim relies on. The cost decomposition for an N=5N{=}5 best-of-NN run versus one meta-agent rerun (per task, on the compressed set) is 5​B¯5\\,\\overline{B} vs. R¯\\overline{R} model calls; on SWE-Bench Verified for the Sonnet cell that is 5×21.4=107.05{\\times}21.4=107.0 baseline calls vs. 8.98.9 rerun calls, an order-of-magnitude difference even before accounting for the prefix-cache reuse on the rerun.

### D.5 Fork-step distribution

[Figure6](https://arxiv.org/html/2605.10913v3#A4.F6 "In Motivation. ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") hides where in the trajectory the meta-agent chose to fork. We summarise the distribution here. On both substrates and across both worker cells, roughly one third of compressed trajectories are forked at f=0f{=}0 (full restart from the original system prompt and task with the hint prepended), one third are forked in the first half of the trajectory (early-prefix retention), and one third are forked at or beyond the midpoint (late-prefix retention). The choice tracks the qualitative shapes of [SectionD.2](https://arxiv.org/html/2605.10913v3#A4.SS2 "D.2 Top compressions ‣ Appendix D Trajectory Compression: Extended Results ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"): full restarts when the entire baseline path was discardable; early forks when only the opening exploratory turns were useful; and late forks when the worker’s diagnostic was substantively right but the second half of the trajectory thrashed. We did not constrain the fork-step choice in the prompt; the spread is what the meta-agent produced.

##### Cost note.

Because the rerun starts from a forked Shepherd scope and a restored prefix, its API cost is the cost of the suffix calls only, plus the cost of the meta-agent’s one diagnostic call to read the trajectory and emit the JSON. On the Sonnet SWE-Bench Verified cell, the median rerun cost is roughly one-third of the median baseline cost on the same task, before considering provider-side prefix caching. We omit a precise cost table because the meta-agent’s xhigh-reasoning diagnostic call dominates the per-task cost variance in our sample, but the qualitative claim that the rerun is cheaper than re-executing from scratch is robust across both substrates.

### D.6 Meta-agent prompt and output schema

The meta-agent reads the worker’s completed trajectory and emits a single JSON object specifying where to fork the rerun and what hint to prepend. We give the prompt and schema below; the released codebase lives at exp/trajprune.

##### System prompt.

The system prompt for the meta-agents:

[⬇](data:text/plain;base64,WW91IGFyZSBhIGNvZGUtcmV2aWV3IGFuZCB0cmFqZWN0b3J5LXBydW5pbmcgZXhwZXJ0LiBZb3Ugd2lsbCByZWFkIGEKY29tcGxldGVkIGFnZW50IHRyYWplY3Rvcnk6IHRoZSBhZ2VudCBhdHRlbXB0ZWQgYSBjb2RpbmcgdGFzayBieSBpc3N1aW5nCm9uZSBiYXNoIGNvbW1hbmQgcGVyIHR1cm4gYW5kIG9ic2VydmluZyB0aGUgcmVzdWx0LiBZb3VyIGpvYiBpcyB0bwppZGVudGlmeSB3YXN0ZWQgZXhwbG9yYXRpb24gYW5kIHByb2R1Y2UgT05FIGNvbmNpc2UgbmF0dXJhbC1sYW5ndWFnZQpoaW50IHRoYXQsIGlmIGdpdmVuIHRvIHRoZSBhZ2VudCBvbiBhIGZyZXNoIHJldHJ5IG9mIHRoZSBzYW1lIHRhc2ssCndvdWxkIGxldCBpdCBzb2x2ZSB0aGUgdGFzayB3aXRoIHN0cmljdGx5IGZld2VyIHN0ZXBzLgoKV2hhdCBjb3VudHMgYXMgd2FzdGVkIHdvcmsKLSBMaXN0aW5nIHRoZSBzYW1lIGRpcmVjdG9yeSBtdWx0aXBsZSB0aW1lcy4KLSBSZWFkaW5nIGZpbGVzIHRoYXQgdHVybmVkIG91dCB0byBiZSB1bnJlbGF0ZWQgdG8gdGhlIHNvbHV0aW9uLgotIFRyaWFsLWFuZC1lcnJvciBzeW50YXggZGVidWdnaW5nIHRoYXQgY29udmVyZ2VkIG9uIGFuIG9idmlvdXMgYW5zd2VyLgotIEN5Y2xlcyB3aGVyZSB0aGUgYWdlbnQgdHJpZWQtZmFpbGVkLXRyaWVkLWZhaWxlZCBiZWZvcmUgbm90aWNpbmcgYSBwYXR0ZXJuLgotIERlZmVuc2l2ZSBvdmVyLXRlc3RpbmcgdGhhdCB0aGUgc3VjY2VzcyBjcml0ZXJpb24gZG9lcyBub3QgcmVxdWlyZS4KCldoYXQgZG9lcyBOT1QgY291bnQgYXMgd2FzdGVkCi0gUmVhZGluZyB0aGUgc3VjY2VzcyBjcml0ZXJpb24uCi0gSW5pdGlhbCB3b3JrZGlyIGluc3BlY3Rpb24gKG9uZSBscyBpcyBmaW5lKS4KLSBWZXJpZmljYXRpb24gb2YgdGhlIGZpbmFsIGFuc3dlciBvbmNlLgoKT3V0cHV0IGZvcm1hdC4gWW91IE1VU1QgZW1pdCBleGFjdGx5IG9uZSBKU09OIG9iamVjdCBhbmQgbm90aGluZyBlbHNlLgpFdmVyeSBKU09OIG9iamVjdCB5b3UgZW1pdCBtdXN0IGluY2x1ZGUgYGZvcmtfc3RlcGA6IGFuIGludGVnZXIgaW4KWzAsIG5fY2FsbHNdLiBmb3JrX3N0ZXA9MCBtZWFucyByZXN0YXJ0IGZyb20gc2NyYXRjaCB3aXRoIHRoZSBoaW50Owpmb3JrX3N0ZXA9ayBtZWFucyB0aGUgd29ya2VyIHdpbGwgYmUgcmVzdGFydGVkIGZyb20gdGhlIHN0YXRlIFJJR0hUCkJFRk9SRSBzdGVwIGsncyBjb21tYW5kIHdhcyBleGVjdXRlZCAoaXQgd2lsbCBrZWVwIGl0cyBtZW1vcnkgb2YKc3RlcHMgMC4uay0xKS4=)

1Youareacode-reviewandtrajectory-pruningexpert.Youwillreada

2completedagenttrajectory:theagentattemptedacodingtaskbyissuing

3onebashcommandperturnandobservingtheresult.Yourjobisto

4identifywastedexplorationandproduceONEconcisenatural-language

5hintthat,ifgiventotheagentonafreshretryofthesametask,

6wouldletitsolvethetaskwithstrictlyfewersteps.

7

8Whatcountsaswastedwork

9-Listingthesamedirectorymultipletimes.

10-Readingfilesthatturnedouttobeunrelatedtothesolution.

11-Trial-and-errorsyntaxdebuggingthatconvergedonanobviousanswer.

12-Cycleswheretheagenttried-failed-tried-failedbeforenoticingapattern.

13-Defensiveover-testingthatthesuccesscriteriondoesnotrequire.

14

15WhatdoesNOTcountaswasted

16-Readingthesuccesscriterion.

17-Initialworkdirinspection(onelsisfine).

18-Verificationofthefinalansweronce.

19

20Outputformat.YouMUSTemitexactlyoneJSONobjectandnothingelse.

21EveryJSONobjectyouemitmustinclude‘fork\_step‘:anintegerin

22\[0,n\_calls\].fork\_step=0meansrestartfromscratchwiththehint;

23fork\_step=kmeanstheworkerwillberestartedfromthestateRIGHT

24BEFOREstepk’scommandwasexecuted(itwillkeepitsmemoryof

25steps0..k-1).’

##### User message.

Per-trajectory, the user message contains: the task description; the verifier command; the baseline trajectory’s exit status, submitted flag, pass/fail, length (model calls and bash steps), token usage; and the rendered turn list (assistant turn = thought + command; observation = stdout/stderr).

##### Output schema.

The meta-agent returns one of two shapes:

[⬇](data:text/plain;base64,ewogICJub19wcnVuZSI6IGZhbHNlLAogICJmb3JrX3N0ZXAiOiA8aW50IGluIFswLCBuX2NhbGxzXT4sCiAgImhpbnQiOiAiPHNpbmdsZSBwYXJhZ3JhcGgsIG1heCB+MTUwMCBjaGFycywgYWRkcmVzc2VkIHRvIHRoZSBhZ2VudAogICAgICAgICAgIGFib3V0IHRvIHJldHJ5OiBuYW1lIHRoZSByaWdodCBmaWxlIHBhdGgsIHRoZSByaWdodCBhcHByb2FjaCwKICAgICAgICAgICB0aGUgZGVhZCBlbmQgdG8gc2tpcDsgZG8gTk9UIGluY2x1ZGUgdGhlIGVudGlyZSBzb2x1dGlvbj4iLAogICJyYXRpb25hbGUiOiAiPG9uZSBwYXJhZ3JhcGgsIG1heCB+MTAwMCBjaGFycywgZm9yIGh1bWFuIGluc3BlY3Rpb24+Igp9)

1{

2"no\_prune":false,

3"fork\_step":<intin\[0,n\_calls\]>,

4"hint":"<singleparagraph,max~1500chars,addressedtotheagent

5abouttoretry:nametherightfilepath,therightapproach,

6thedeadendtoskip;doNOTincludetheentiresolution>",

7"rationale":"<oneparagraph,max~1000chars,forhumaninspection>"

8}

If the meta-agent decides the trajectory is already efficient, it emits {"no\_prune": true, "rationale": ...} and the rerun is skipped. The runner also treats a missing fork\_step as no\_prune=true. Out-of-range fork\_step values are clamped to \[0,ncalls−1\]\[0,n\_{\\text{calls}}-1\]. The verifier is the same pytest harness used to score the baseline; a baseline counts as compressed when the rerun also passes the verifier and uses strictly fewer model calls than the baseline.

## Appendix E Runtime supervision: protocol, tools, and meta-agent prompt

##### Dataset.

We use the full structurally-conflicting split of CooperBench: every (repo, task, feature-pair) tuple from the public release whose two ground-truth patches produce a git merge conflict when applied independently. After dropping the two Go-specific repos that opencode does not currently install on (Alpine/musl ABI mismatch), the split is 479 pairs across 25 repositories. The same set is used for _solo_, _coop_, and the two supervised conditions; pair identity is held constant so comparisons are paired. Per-pair patches are evaluated with CooperBench’s published harness: the two patches are merged via git merge-file (with a Qwen 1.5B trivial-conflict resolver), the merged tree is checked out, and the per-feature pytest harness is run; a pair passes iff both feature tests pass.

##### Sandbox layout, harness, and timeouts.

Each pair runs on three E2B Linux sandboxes: one per worker (separate OverlayFS, so the two workers cannot see each other’s edits) and one shared _relay_ sandbox that hosts an HTTP message-bus and the optional MCP coop-server used by the _coop_ baseline. Workers run the opencode harness (pinned to latest after debugging an empty-response regression in v1.4.0) against an OpenRouter-routed Anthropic Haiku 4.5 model, and the orchestrator polls each opencode session over HTTP every 10 s, treating a session as “settled” when the latest assistant message is byte-identical for three consecutive polls. Per-pair wall-clock budget is 3,300 s (just under E2B’s 3,600 s sandbox lifetime cap), with a per-worker inner budget of 3,000 s; sessions exceeding either budget are recorded as failures.

##### Coordination tool API.

The meta-agent acts on the worker pair through three tools, presented in [Section3.4](https://arxiv.org/html/2605.10913v3#S3.SS4 "3.4 Execution Trace: Agent Execution History ‣ 3 The Shepherd Programming Model ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") as inject/handoff/discard; in the released codebase the per-agent tools are still named steer/redirect/revert respectively, and handoff is implemented as a separate scope-handoff path that the meta-agent can request via the same decision channel. The semantics, in order of cost:

- •


inject (code: steer). The worker’s opencode session is left untouched; the orchestrator appends one new user message containing the meta-agent’s guidance string. Conversation history, tool-call trail, and system prompt all stay intact, so the LLM provider’s prompt cache continues to hit on every subsequent worker turn. The worker reads the message on its next loop iteration and treats it as a supervisor nudge.

- •


handoff (code: redirect when applied to a single agent; scope-handoff when re-rooting the follower from the leader). The target worker’s current session is aborted and a fresh opencode session is created on the same agent identity; guidance is delivered as the first user message. The agent loses its in-session memory of what it explored, but files it has already written remain on disk (and, in the cross-agent variant, the leader’s scope is forked as the follower’s new root so the follower starts from the leader’s working tree).

- •


discard (code: revert, implemented via Scope.discard). Same effect as handoff on the LLM side (new session, lost in-session memory) plus the worker’s OverlayFS is rolled back to the pre-run snapshot via Shepherd, so all files the worker wrote since the start of the pair are dropped before the fresh session begins.


The meta-agent issues these decisions through a JSON-mode response constrained by the schema below; none is a fourth, no-op decision used to skip an agent on a tick:

[⬇](data:text/plain;base64,eyJkZWNpc2lvbnMiOiBbCiAgeyJhZ2VudCI6ICJhZ2VudC1mMCIsCiAgICJhY3Rpb24iOiAibm9uZSIgfCAiaW5qZWN0IiB8ICJoYW5kb2ZmIiB8ICJkaXNjYXJkIiwKICAgInJlYXNvbiI6ICI8PSAyMCB3b3JkcyIsCiAgICJndWlkYW5jZSI6ICI8PSA2MCB3b3Jkcywgb25seSBmb3IgaW5qZWN0L2hhbmRvZmYifQpdfQ==)

1{"decisions":\[\
\
2{"agent":"agent-f0",\
\
3"action":"none"\|"inject"\|"handoff"\|"discard",\
\
4"reason":"<=20words",\
\
5"guidance":"<=60words,onlyforinject/handoff"}\
\
6\]}

##### Observation cadence.

Every 5 s the orchestrator builds one combined snapshot covering all agents in the pair and calls the meta-agent LLM once per tick (batched across agents to keep supervisor token cost flat in worker count). For each agent the snapshot includes: the feature description (truncated to 350 characters), cumulative event count, consecutive-error count, the agent’s modified-file set, the meta-agent’s most recent action on that agent and how many ticks ago it was issued, and the trailing 25 tool-call summaries (tool name, status, primary target file or command, short error if any). Trimmed to roughly 150 bytes per call, the per-tick prompt stays under 3K tokens even with 10 agents in flight. Tool calls are ingested from opencode’s SSE event stream; only message.part.updated events with a tool payload are kept, with text deltas and lifecycle events filtered out at the source.

##### Per-strategy coverage by meta-agent.

The strategy-coverage panel of [Figure3](https://arxiv.org/html/2605.10913v3#S5.F3 "In Setup. ‣ 5.1 Meta-Agent for Multi-Agent Coordination: Runtime Supervisor ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") (right) gives the headline; the precise numbers are: Sonnet inject 26.4%, handoff 18.7%, discard 7.9%; Opus inject 39.2%, handoff 31.5%, discard 4.6%. Coverage is independent per strategy, so the values within a meta-agent do not sum to 100%, and a sizeable share of pairs are passed through with no interception at all (workers coordinate cleanly enough that the meta-agent stays out of the way). When Sonnet would give up, Opus is more likely to issue a handoff instead, which explains both its higher pair pass rate and its lower discard share.

##### Meta-agent prompt (verbatim, v1).

The locked supervisor system prompt is reproduced below as it appears in prompts/meta\_prompt\_v1.txt; the labels steer/redirect/revert are the codebase synonyms for the paper’s inject/handoff/discard.

Meta-agent system prompt (v1)You are a meta-agent supervising several coding agents working in parallel on the same repository. Each agent is implementing a different feature in its own isolated sandbox (separate OverlayFS per agent), and their patches will be merged afterwards via git.Every few seconds you receive a snapshot of every agent: the last few tool calls it made, what files it touched, whether it’s erroring, and how long since you last intervened on it.For EACH agent, pick exactly one of four actions. The cost order is steer ≪\\ll redirect = revert, so match the action to the severity of what you see.1.“none” — everything is fine, let the agent keep working. This should be the default for the vast majority of agents on most ticks. Over-intervention destroys progress.2.“steer” — CHEAPEST intervention. The agent’s conversation is kept intact; we only append a new user message with your guidance so the agent sees it as “oh, the supervisor is nudging me”. Full conversation history and tool call context are preserved, KV cache is reused. Use this when:•the agent is broadly on task but drifting or about to make a minor wrong turn•you just need to tell the agent something it didn’t know (e.g. another agent is editing the same area)•the agent’s reasoning is fine but needs a small course correction3.“redirect” — EXPENSIVE. The agent’s current session is aborted and a fresh opencode session starts with your guidance as message 1. The agent loses ALL memory of what it has explored, read, tried, or learned — it starts from scratch (but the files it already edited are still there on disk). Use this when:•the agent is stuck in an obvious loop (same tool, same target, same error, 5+ times)•the agent’s conversation has gone off the rails and a nudge is not enough — its memory needs to be wiped•the agent is confused about the task and the best fix is a clean re-read with new framing4.“revert” — EXPENSIVE and destructive. Same as redirect on the LLM side (new session, lost memory) PLUS the sandbox filesystem is rolled back to the pre-run checkpoint. All files the agent edited are discarded. Use this ONLY when:•the agent wrote files that corrupt the repo (overwrote core code with garbage, introduced unrelated changes, broke syntax)•the agent ran destructive commands (rm -rf, git reset --hard, git push --force) that you want to undo•the filesystem state is so broken that the agent cannot continue, and you cannot explain-your-way-out via steer/redirectDecision heuristics, not hard rules — trust your judgement:•Default to “none”. Most agents on most ticks need no intervention. Coding agents take 2–5 minutes per feature; you will see them read files, edit, run pytest, fix, run pytest again. That’s normal iteration, not a problem. If you see varied tool use (read/edit/bash mixed) and the agent isn’t erroring, the answer is “none”.•“Stuck in a loop” means 10+ identical tool calls with no progress (same tool, same target, same error). 3–5 retries is normal iteration, not a loop.•Prefer “steer” over “redirect”. Redirect throws away context; steer preserves it. If the agent can understand a nudge, don’t wipe its memory.•Prefer “redirect” over “revert”. Revert throws away filesystem work; redirect preserves it. If the files are salvageable, don’t roll back.•Do not intervene on an agent you already acted on in the last tick or two unless the agent clearly did not comply with your guidance. Give it time to react.•Different agents editing the same file is USUALLY fine — they are in separate sandboxes and their patches will be merged by git afterwards. Only call this a conflict if the edits would be irreconcilable at merge time (same lines, different intent).•If you only have evidence about ONE agent and the others look fine, return only that one decision. Don’t pad the list with no-op entries.Respond with a single JSON object. Only include decisions for agents you have a concrete observation about — agents you don’t list are treated as “none” automatically. Keep the “reason” field under ~20 words and the “guidance” field under ~60 words when present.

## Appendix F CRO

### F.1 The CRO algorithm

CRO maintains a single execution trace ℳ\\mathcal{M} that grows
across optimization. Every workflow variant CRO has produced is a node in
ℳ\\mathcal{M}, alongside its source and its execution traces; every execution
trace contains the per-example outcomes the workflow’s metric produced when it
ran. The graph is seeded with the baseline workflow W0W\_{0} and its execution
traces on the train and dev splits. CRO also maintains a parent pool
𝒞\\mathcal{C} of variants eligible to be edited as parents in subsequent
iterations; the pool starts at {W0}\\{W\_{0}\\}.

At each iteration, the proposer 𝒫\\mathcal{P} reads from ℳ\\mathcal{M}
holistically – past candidates, the edits that produced them, their
training-set outcomes, their fix/guard outcomes if any, and the rationales
attached to prior proposals (failed and successful alike). 𝒫\\mathcal{P}
selects a parent p∈𝒞p\\in\\mathcal{C} and emits kk candidate edits. Each edit
Δi\\Delta\_{i} is paired with two example sets the proposer reads from pp’s
training traces: a _fix set_ Ti+T^{+}\_{i} of training examples the edit is
meant to repair, and a _guard set_ Ti−T^{-}\_{i} of examples whose behavior
must not regress. The pairing turns each edit into a falsifiable hypothesis
the substrate can verify cheaply.

Each candidate ci=p⊕Δic\_{i}=p\\oplus\\Delta\_{i} is verified by _counterfactual_
_replay_ (lines 7-9 of Algorithm [1](https://arxiv.org/html/2605.10913v3#alg1 "Algorithm 1 ‣ F.1 The CRO algorithm ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")): for every example in
Ti+∪Ti−T^{+}\_{i}\\cup T^{-}\_{i}, Shepherd forks pp’s trace at the first event whose causal
dependencies Δi\\Delta\_{i} changes and resumes execution under cic\_{i}, writing the
outcome into ℳ\\mathcal{M}. Two consequences follow. First, the comparison
between cic\_{i} and pp on each example is held fixed in everything except the
edit itself, eliminating the stochastic and environmental variation that
contaminates the signal in re-execution-based optimizers. Second, the cost
drops from a full rollout to suffix-only, letting CRO afford more candidate
edits per unit wall-clock.

Candidates that improve over their parent on Ti+∪Ti−T^{+}\_{i}\\cup T^{-}\_{i} graduate:
they are run on 𝒟dev\\mathcal{D}\_{\\text{dev}} – again writing into ℳ\\mathcal{M} –
and added to the parent pool. Failed candidates remain in ℳ\\mathcal{M} as
evidence the proposer can read on subsequent iterations, but are not eligible
as parents. After NN iterations CRO returns the graduated candidate with the
highest dev score. The full procedure is given as Algorithm [1](https://arxiv.org/html/2605.10913v3#alg1 "Algorithm 1 ‣ F.1 The CRO algorithm ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") in
Appendix [F](https://arxiv.org/html/2605.10913v3#A6 "Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

Algorithm 1 Counterfactual Replay Optimization (CRO)

1:


Train/dev splits 𝒟train,𝒟dev\\mathcal{D}\_{\\text{train}},\\mathcal{D}\_{\\text{dev}};
proposer 𝒫\\mathcal{P}; baseline workflow W0W\_{0};
iterations NN; proposals per iteration kk.

2:


Optimized workflow c⋆c^{\\star}.

3:

4:ℳ←\\mathcal{M}\\leftarrow execution trace initialized by running W0W\_{0} over
𝒟train∪𝒟dev\\mathcal{D}\_{\\text{train}}\\cup\\mathcal{D}\_{\\text{dev}}

5:𝒞←{W0}\\mathcal{C}\\leftarrow\\{W\_{0}\\}⊳\\triangleright candidates eligible to be edited

6:fort=1,…,Nt=1,\\dots,Ndo

7:p,{(Δi,Ti+,Ti−)}i=1k←𝒫⁡(ℳ,𝒞)p,\ \\{(\\Delta\_{i},T^{+}\_{i},T^{-}\_{i})\\}\_{i=1}^{k}\\leftarrow\\mathcal{P}(\\mathcal{M},\\,\\mathcal{C})

8:⊳\\triangleright𝒫\\mathcal{P} reads ℳ\\mathcal{M} to pick parent and propose edits with fix/guard sets

9:fori=1,…,ki=1,\\dots,kdo

10:ci←p⊕Δic\_{i}\\leftarrow p\\oplus\\Delta\_{i}

11:forx∈Ti+∪Ti−x\\in T^{+}\_{i}\\cup T^{-}\_{i}do

12:


      fork pp’s trace on xx at the first event affected by Δi\\Delta\_{i}

13:


      resume under cic\_{i} and write the result to ℳ\\mathcal{M}

14:endfor

15:ifcic\_{i} improves over pp on Ti+∪Ti−T^{+}\_{i}\\cup T^{-}\_{i} in ℳ\\mathcal{M}then

16:


      run cic\_{i} on 𝒟dev\\mathcal{D}\_{\\text{dev}}, writing traces and outcomes to ℳ\\mathcal{M}

17:𝒞←𝒞∪{ci}\\mathcal{C}\\leftarrow\\mathcal{C}\\cup\\{c\_{i}\\}

18:endif

19:endfor

20:endfor

21:returnc⋆←arg⁡maxc∈𝒞c^{\\star}\\leftarrow\\arg\\max\_{c\\in\\mathcal{C}}\\, dev score of cc in ℳ\\mathcal{M}

The CRO meta-agent optimizes Shepherd workflows through failure attribution and repair grounded in execution traces. A Shepherd store ℳ\\mathcal{M} versions workflow variants
{W0,c1,c2,…}\\{W\_{0},c\_{1},c\_{2},\\ldots\\} along with their training execution traces and aggregated dev set outcomes. A parent pool 𝒞⊆ℳ\\mathcal{C}\\subseteq\\mathcal{M} holds variants
eligible for further editing, where c⋆c^{\\star} is the best-scoring variant on the dev set. At each step of optimization, the CRO meta-agent PP inspects ℳ\\mathcal{M}, selects
a parent p∈𝒞p\\in\\mathcal{C}, and uses verbalized sampling
\[ [55](https://arxiv.org/html/2605.10913v3#bib.bib32 "")\] to generate kk localized failure hypotheses. A hypothesis is
a triple (Δi,Ti+,Ti−)(\\Delta\_{i},T\_{i}^{+},T\_{i}^{-}): a source edit Δi\\Delta\_{i}, together with a fix set
Ti+T\_{i}^{+} of training examples the edit is meant to repair and a guard set
Ti−T\_{i}^{-} of examples it must not regress on.

Each candidate ci=p⊕Δic\_{i}=p\\oplus\\Delta\_{i}, where ⊕\\oplus denotes application of Δi\\Delta\_{i} to pp’s source, is evaluated by counterfactual replay. For each example
in Ti+∪Ti−T\_{i}^{+}\\cup T\_{i}^{-}, Shepherd retrieves pp’s corresponding trace on the train set, locates the first
event whose dependencies were affected by the edit, forks the corresponding Shepherd commit, and resumes execution under cic\_{i}. All edits that improve performance on {Ti+∪Ti−}\\{T\_{i}^{+}\\cup T\_{i}^{-}\\} are evaluated on the dev split and admitted to 𝒞\\mathcal{C} for later optimization steps. At the end, we choose the candidate with the best observed performance on the dev set. The full procedure is given as Algorithm [1](https://arxiv.org/html/2605.10913v3#alg1 "Algorithm 1 ‣ F.1 The CRO algorithm ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") in Appendix [F](https://arxiv.org/html/2605.10913v3#A6 "Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

### F.2 Implementation Details

CRO is a coding-agent meta-optimiser. Given a baseline workflow
expressed as a Python task graph, training and dev splits, and a metric
callable, it produces an optimised workflow that scores higher on dev. From an implementation standpoint, CRO sits in the same family as MetaHarness \[ [20](https://arxiv.org/html/2605.10913v3#bib.bib8 "")\]
and Trace \[ [5](https://arxiv.org/html/2605.10913v3#bib.bib2 "")\]: the proposer is a coding agent with
shell, read, and edit tools operating on a real Python source tree,
rather than a prompt-rewriting LLM with a fixed schema. Because every workflow
execution is recorded in Shepherd’s effect stream, the proposer
has typed, queryable read access to prior runs — per-example LLM I/O,
per-task source snapshots, ledgers of prior candidates and their
accept/archive decisions — and grounds each proposal in what previous
attempts actually did, rather than re-deriving hypotheses from scratch
on each iteration. In this section, we provide more details regarding CRO’s implementation.

#### F.2.1 Scratchpad, Host Handoff, and the Proposer Loop

##### Scratchpad layout.

CRO does not pass state to the proposer LLM through context messages.
Per-run state lives on disk in a _scratchpad_ directory the proposer
reads and writes through file tools:

[⬇](data:text/plain;base64,c2NyYXRjaHBhZC8KICBSRUFETUUubWQgICAgICAgICAgICAgICAgICAgIFNZU1RFTV9QUk9NUFQgKyB3b3JrZWQgZXhhbXBsZTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYWQgb25jZSB2aWEgcmVhZF9maWxlLCBjYWNoZS1zdGFibGUuCiAgT1JJRU5UQVRJT04ubWQgICAgICAgICAgICAgICBydW4tc3BlY2lmaWMgcGFyYW1ldGVyczsgcmVhZCBvbmNlCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZXIgc2Vzc2lvbi4KICBicmllZi5tZCAgICAgICAgICAgICAgICAgICAgIHBlci10dXJuIGxpdmUgc3RhdGU7IHJlZ2VuZXJhdGVkIGJ5CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgaG9zdCBldmVyeSBzZXNzaW9uLgogIHdvcmtmbG93LyAgICAgICAgICAgICAgICAgICAgbGl2ZSB3b3JrZmxvdyBzb3VyY2UgdGhlIHByb3Bvc2VyCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlZGl0cyBpbiBwbGFjZQogICAgcGlwZWxpbmUucHkKICAgIF9pbXBvcnRzLnB5CiAgICA8c3VidGFzaz4ucHkgICAgICAgICAgICAgICBvbmUgLnB5IHBlciBAYWdlbnQgY2xhc3MKICB2YXJpYW50cy9zZXNzaW9uX05OTi92Pz8vd29ya2Zsb3cvICAgc2libGluZyB2YXJpYW50cyB0aGUKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcG9zZXIgc3RhZ2VzLgogIGhpc3RvcnkvcnVuX05OTi8gICAgICAgICAgICAgaG9zdC13cml0dGVuLCByZWFkLW9ubHkgcGVyLWV4cGVyaW1lbnQKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyY2hpdmUKICAgIHdvcmtmbG93LyAgICAgICAgICAgICAgICAgIHNvdXJjZSBzbmFwc2hvdDsgYW55IHByaW9yIHJ1biBjYW4gYmUgYQogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJhbmNoIHBhcmVudC4KICAgIG1ldHJpY3MuanNvbiAgICAgICAgICAgICAgIHRyYWluICsgZGV2IHNjb3JlcywgcGVyLWV4YW1wbGUKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZlZWRiYWNrLCBkb2xsYXJzLgogICAgdHJhY2UubWQgICAgICAgICAgICAgICAgICAgcGVyLWV4YW1wbGUgdGFzayB0cmFjZS4KICAgIGVmZmVjdHMvPGV4YW1wbGU+LntlZmZlY3RzLmpzb24sIGxsbV9pby5tZH0KICBjYW5kaWRhdGVfY2F0YWxvZy5qc29uICAgICAgIGV2ZXJ5IGNhbmRpZGF0ZSdzIHJvbGUsIHBhcmVudCwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY2lzaW9uLCBkZXYgc2NvcmUuCiAgaHlwb3RoZXNpc19sZWRnZXIuanNvbiAgICAgICBwZXItdmFyaWFudCBtZWNoYW5pc20sIHRhcmdldGVkIGxpZnQsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWdyZXNzaW9ucywgZXZpZGVuY2UgcGF0aHMuCiAgZmFpbHVyZV9jbHVzdGVycy5qc29uICAgICAgICBiYXNlbGluZSBmYWlsdXJlIGNsdXN0ZXJzIHNlZWRlZCBmb3IKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb24gMS4KICB0cmFjZV9pbmRleC5qc29uICAgICAgICAgICAgIGJhdGNoLS10cmFjZS0tY2FuZGlkYXRlIGluZGV4LgogIGh5cG90aGVzZXMvaE5OTl8qLm1kICAgICAgICAgcHJvcG9zZXItd3JpdHRlbiBoeXBvdGhlc2lzIGZpbGVzLgogIG9ic2VydmF0aW9ucy9vTk5OLm1kICAgICAgICAgcHJvcG9zZXItd3JpdHRlbiBwb3N0LWV4cGVyaW1lbnQgbm90ZXMuCiAgaHlwb3RoZXNpc19sb2dzL3Nlc3Npb25fTk5OLm1kICAgcHJvcG9zZXIncyBwZXItc2Vzc2lvbiBsb2cuCiAgam91cm5hbF9wZW5kaW5nL3Nlc3Npb25fTk5OLm1kICAgcHJvcG9zZXIncyBzZXNzaW9uLWZyYWdtZW50IGZvcgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBqb3VybmFsLgogIHBlbmRpbmdfYmF0Y2hlcy9zZXNzaW9uX05OTi5qc29uICAgcHJvcG9zZXIncyBiYXRjaCBtYW5pZmVzdDsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBoYW5kb2ZmIHBheWxvYWQuCiAgZXhwZXJpbWVudF9sb2cubWQgICAgICAgICAgICBjb25zb2xpZGF0ZWQgam91cm5hbCwgaG9zdC1tZXJnZWQKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb20gam91cm5hbF9wZW5kaW5nLy4=)

1scratchpad/

2README.mdSYSTEM\_PROMPT+workedexample;

3readonceviaread\_file,cache-stable.

4ORIENTATION.mdrun-specificparameters;readonce

5persession.

6brief.mdper-turnlivestate;regeneratedby

7thehosteverysession.

8workflow/liveworkflowsourcetheproposer

9editsinplace

10pipeline.py

11\_imports.py

12<subtask>.pyone.pyper@agentclass

13variants/session\_NNN/v??/workflow/siblingvariantsthe

14proposerstages.

15history/run\_NNN/host-written,read-onlyper-experiment

16archive

17workflow/sourcesnapshot;anypriorruncanbea

18branchparent.

19metrics.jsontrain+devscores,per-example

20feedback,dollars.

21trace.mdper-exampletasktrace.

22effects/<example>.{effects.json,llm\_io.md}

23candidate\_catalog.jsoneverycandidate’srole,parent,

24decision,devscore.

25hypothesis\_ledger.jsonper-variantmechanism,targetedlift,

26regressions,evidencepaths.

27failure\_clusters.jsonbaselinefailureclustersseededfor

28session1.

29trace\_index.jsonbatch--trace--candidateindex.

30hypotheses/hNNN\_\*.mdproposer-writtenhypothesisfiles.

31observations/oNNN.mdproposer-writtenpost-experimentnotes.

32hypothesis\_logs/session\_NNN.mdproposer’sper-sessionlog.

33journal\_pending/session\_NNN.mdproposer’ssession-fragmentfor

34thejournal.

35pending\_batches/session\_NNN.jsonproposer’sbatchmanifest;

36thehandoffpayload.

37experiment\_log.mdconsolidatedjournal,host-merged

38fromjournal\_pending/.

The split between live state (brief.md, workflow/) and
immutable history (history/run\_NNN/) is what allows the proposer
to revisit any past state: branch(from\_ref="run\_NNN") resets
workflow/ to that snapshot without losing later work. Files
outside the proposer’s editable surface (history/, the JSON
indices, brief.md) are written exclusively by the host.

##### Per-turn proposer protocol.

A single CRO step is one _proposer session_: the host dispatches a
fresh LLM session with a constant system prompt and constant user
prompt, and the proposer reads per-turn state through file tools. The
contract is fixed:

1. 1.


(turn 1, session 0 only) Read README.md for the
search policy, mechanism axes, and loop hard rules; read
ORIENTATION.md for the run parameters.

2. 2.


(turn 1, every session) Read brief.md for the
session index, frontier candidate, remaining budget, and the exact
pending-batch and journal-pending file names this session must
produce.

3. 3.


(working turns) Use the read-only inspection tools
(§ [F.2.3](https://arxiv.org/html/2605.10913v3#A6.SS2.SSS3 "F.2.3 Proposer tool surface ‣ F.2 Implementation Details ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")) to inspect prior runs; pick a base reference
(frontier, baseline, promoted, a run\_NNN,
a cand-XXX, or a Meta-Git scope ref); construct sibling
variants with stage\_variant, or by writing files directly
under variants/session\_NNN/vXX/workflow/; attach
targeted\_examples = {improve, protect, invariant} to each.

4. 4.


(handoff turn) Write
hypothesis\_logs/session\_NNN.md with \### Findings,
\### Hypotheses, \### Considered & Rejected, and
\### Selected Batch sections; drop a session-fragment into
journal\_pending/session\_NNN.md; write the manifest to
pending\_batches/session\_NNN.json; call finish\_session.


When finish\_session returns control to the host, the proposer’s
LLM session terminates and no chat-history context survives across
sessions. The cache prefix (system prompt, tool catalog, and the
README.md read on the first turn of each session) is identical
across sessions, so the prefix-cache hit rate stays high while every
session reads its current state through brief.md.

##### Host-side handoff.

On finish\_session the host (i) parses the hypothesis log and
pending batch against the reflection contract
(§ [F.2.5](https://arxiv.org/html/2605.10913v3#A6.SS2.SSS5 "F.2.5 Reflection contract and targeted-eval gate ‣ F.2 Implementation Details ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")); (ii) runs the targeted preflight on every
variant in parallel; (iii) archives variants that fail the preflight;
(iv) advances surviving variants to dev evaluation under counterfactual
replay (§ [F.2.4](https://arxiv.org/html/2605.10913v3#A6.SS2.SSS4 "F.2.4 Counterfactual replay ‣ F.2 Implementation Details ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")); (v) merges
journal\_pending/session\_NNN.md into experiment\_log.md and
appends the realised \### Outcomes table; (vi) regenerates
brief.md and the JSON indices for the next session;
(vii) launches the next proposer session. The proposer never invokes
the executor, never runs evaluation, and never edits history/ or
any \*.json index; all mutations to authoritative state pass
through the host.

#### F.2.2 Controlling prompts

The proposer is controlled by two cacheable surfaces, both constant
across sessions and across datasets.

##### Session header.

Each LLM session is opened with a short protocol prompt
(SESSION\_SYSTEM\_PROMPT) sent as the system role, plus a constant
user message that points at README.md and brief.md. The
session header carries no domain-specific control content; its purpose
is to pin the session to the file-mediated handoff contract:

[⬇](data:text/plain;base64,WW91IGFyZSBydW5uaW5nIGEgY291bnRlcmZhY3R1YWwgZXhwZXJpbWVudGF0aW9uLWJhc2VkIG1ldGEtb3B0aW1pemF0aW9uCnNlc3Npb24gZm9yIGEgUHl0aG9uIHdvcmtmbG93LgoKUGxlYXNlIHJ1biB0aGUgZm9sbG93aW5nIGZsb3c6CjEuIFJlYWQgYGJyaWVmLm1kYCBmaXJzdC4gSXQgaXMgdGhlIGhvc3QncyBjb21wYWN0IHByb2plY3Rpb24gb2YKICAgY2FuZGlkYXRlcywgZmFpbHVyZXMsIHByaW9yIGxvZ3MsIGFuZCB0aGUgaGFuZG9mZiBjb250cmFjdC4KMi4gQ2hvb3NlIGEgc2V0IG9mIHByaW9yIHNvdXJjZXMgYXMgdGhlIGJhdGNoIGJhc2U6IGBmcm9udGllcmAsCiAgIGBiYXNlbGluZWAsIGBwcm9tb3RlZGAsIGEgcnVuIGlkLCBhIGNhbmRpZGF0ZSBpZCwgb3IgYSBNZXRhLUdpdAogICBzY29wZSByZWYvbmFtZS4KMy4gQ3JlYXRlIHNpYmxpbmcgdmFyaWFudHMgZnJvbSB0aGF0IHNldCBvZiBiYXNlcyB1c2luZwogICBgc3RhZ2VfdmFyaWFudGAsIG9yIGJ5IHBhc3NpbmcgZnVsbCBgZmlsZXNgL2B3b3JrZmxvd19kaXJgIGVudHJpZXMKICAgaW4gYSBiYXRjaCBtYW5pZmVzdC4KNC4gRXZlcnkgdmFyaWFudCBtdXN0IGluY2x1ZGUgZXhwbGljaXQgdGFyZ2V0ZWQgZXhhbXBsZXMgd2l0aCBpbXByb3ZlLAogICBwcm90ZWN0LCBhbmQgaW52YXJpYW50IGludGVudC4gVGhlc2UgdGFyZ2V0ZWQgY2hlY2tzIGFyZSB0aGUKICAgcHJlZmxpZ2h0IGJlZm9yZSBoaWRkZW4gYWdncmVnYXRlIGRldiBzY29yaW5nLgo1LiBDYWxsIGBydW5fY291bnRlcmZhY3R1YWxfYmF0Y2hgIG9yIGBzdWJtaXRfY291bnRlcmZhY3R1YWxfYmF0Y2hgLgo2LiBJbnNwZWN0IGFnZ3JlZ2F0ZSBvdXRjb21lcywgd3JpdGUgdGhlIHJlcXVpcmVkCiAgIGBleHBlcmltZW50X2xvZ3MvZVhYWC5tZGAgd2l0aCBgIyMgT3V0Y29tZWAgYW5kIGAjIyBOZXh0YCwgdGhlbgogICBjYWxsIGBmaW5pc2hfc2Vzc2lvbmAuCgpSdWxlczogZml4IGZhaWx1cmUgY2xhc3Nlcywgbm90IGxpdGVyYWwgdHJhaW4gZXhhbXBsZXM7IHByZXNlcnZlIHRoZQpBZ2VudGljIHRhc2sgc2hhcGU7IHVzZSB2YWxpZCB0cmFpbiBpZHMgZnJvbSBicmllZi5tZCwKY2FuZGlkYXRlX2NhdGFsb2cuanNvbiwgb3IgdHJhY2VzL21ldHJpY3M7IGF2b2lkIG5lYXItZHVwbGljYXRlIHByb21wdAp0d2Vha3M7IHRyZWF0IHRoZSBpbml0aWFsIHdvcmtmbG93IGFzIGEgYmFzZWxpbmUsIG5vdCBhIGRlc2lnbgpib3VuZGFyeS4gSWYgbG9jYWwgZWRpdHMgcGxhdGVhdSwgYWRkIG9yIHNwbGl0IHRhc2tzLCBjaGFuZ2UgY29udHJvbApmbG93LCBpbnRyb2R1Y2Ugc3BlY2lhbGl6ZWQgYWdlbnRzLCBydW4gYmVzdC1vZi1OIC8gY3JpdGljIC8gZWRpdG9yCmxvb3BzLCBvciByZWNvbWJpbmUgYSB1c2VmdWwgYXJjaGl2ZWQgbWVjaGFuaXNtIHdpdGggdGhlIGN1cnJlbnQKZnJvbnRpZXIu)

1Youarerunningacounterfactualexperimentation-basedmeta-optimization

2sessionforaPythonworkflow.

3

4Pleaserunthefollowingflow:

51.Read‘brief.md‘first.Itisthehost’scompactprojectionof

6candidates,failures,priorlogs,andthehandoffcontract.

72.Chooseasetofpriorsourcesasthebatchbase:‘frontier‘,

8‘baseline‘,‘promoted‘,arunid,acandidateid,oraMeta-Git

9scoperef/name.

103.Createsiblingvariantsfromthatsetofbasesusing

11‘stage\_variant‘,orbypassingfull‘files‘/‘workflow\_dir‘entries

12inabatchmanifest.

134.Everyvariantmustincludeexplicittargetedexampleswithimprove,

14protect,andinvariantintent.Thesetargetedchecksarethe

15preflightbeforehiddenaggregatedevscoring.

165.Call‘run\_counterfactual\_batch‘or‘submit\_counterfactual\_batch‘.

176.Inspectaggregateoutcomes,writetherequired

18‘experiment\_logs/eXXX.md‘with‘##Outcome‘and‘##Next‘,then

19call‘finish\_session‘.

20

21Rules:fixfailureclasses,notliteraltrainexamples;preservethe

22Agentictaskshape;usevalidtrainidsfrombrief.md,

23candidate\_catalog.json,ortraces/metrics;avoidnear-duplicateprompt

24tweaks;treattheinitialworkflowasabaseline,notadesign

25boundary.Iflocaleditsplateau,addorsplittasks,changecontrol

26flow,introducespecializedagents,runbest-of-N/critic/editor

27loops,orrecombineausefularchivedmechanismwiththecurrent

28frontier.’

The user message is a constant boilerplate that points the proposer
at ORIENTATION.md (run parameters) and brief.md (live
state). Any per-turn substitution into the user message would
invalidate the prompt cache before the first tool call, so the live
values that change every session — session index, frontier, remaining
budget, the exact filename to write — live entirely in
brief.md, which is read _after_ the cached prefix.

##### Substantive control surface.

The proposer’s substantive instructions live in README.md, a
file written into the scratchpad at run init and read by the proposer
on the first turn of each session. README.md consists of the
SYSTEM\_PROMPT string followed by a worked example of adding a
new @agent subclass. We reproduce SYSTEM\_PROMPT in
abridged form below.

[⬇](data:text/plain;base64,WW91IGFyZSBhIHJlc2VhcmNoIGVuZ2luZWVyIG9wdGltaXppbmcgYSBtdWx0aS10YXNrIFB5dGhvbiB3b3JrZmxvdy4KClRoZSB3b3JrZmxvdyBpcyBhIHRvcC1sZXZlbCB0YXNrIHVuZGVyIGB3b3JrZmxvdy9gIHRoYXQgY29tcG9zZXMKc3VidGFza3MgKG9uZSBmaWxlIGVhY2gpLiBZb3VyIGRlZmF1bHQgb3B0aW1pemF0aW9uIG1vdmUgaXMgdG8gcHJvcG9zZQphIGJhdGNoIG9mIGNvdW50ZXJmYWN0dWFsIHdvcmtmbG93IHZhcmlhbnRzIGFuZCBjYWxsCnJ1bl9jb3VudGVyZmFjdHVhbF9iYXRjaC4KCiMjIFRoZSBvbmx5IHJ1bGUgeW91IG11c3QgZm9sbG93OiBnZW5lcmFsaXplLCBkb24ndCBvdmVyZml0Ci0gRml4IENMQVNTRVMgb2YgZXJyb3JzLCBub3QgaW5zdGFuY2VzLiBBIHJvb3QgY2F1c2UgbXVzdCBleHBsYWluID49CiAgMi0zIGZhaWxpbmcgdHJhaW4gZXhhbXBsZXMgdGhyb3VnaCB0aGUgc2FtZSBtZWNoYW5pc20uCi0gRHVhbC1ndWFyZCBhbnkgc3RydWN0dXJhbCBlZGl0OiBhIG5ldyBydWxlIG11c3QgZmlyZSBvbmx5IHdoZW4gYm90aAogIGEgc2VtYW50aWMgY3VlIGluIHRoZSBwcm9ibGVtIHRleHQgQU5EIGEgc3RydWN0dXJhbCBwYXR0ZXJuIG1hdGNoLgotIE5ldmVyIHBhdHRlcm4tbWF0Y2ggb24gbGl0ZXJhbCB0cmFpbi1wcm9ibGVtIHBocmFzZXMuClRoZSBERVYgKGFnZ3JlZ2F0ZSwgbm8gcGVyLWV4YW1wbGUpIGxpbmUgaXMgeW91ciBnZW5lcmFsaXphdGlvbiBzaWduYWwuCgojIyBXb3Jrc3BhY2UKW3NjcmF0Y2hwYWQgbGF5b3V0LCBhYnJpZGdlZCBoZXJlOyByZXByb2R1Y2VkIGluIHNlY3Rpb24gYWJvdmVdCgojIyBUb29scwotIHNob3dfaGlzdG9yeSAvIHNob3dfYmF0Y2hfaGlzdG9yeSAvIHNob3dfbWV0YWdpdF9oaXN0b3J5IC8KICBzaG93X2V4YW1wbGVfaGlzdG9yeSAtLSByZWFkLW9ubHkgbGVkZ2VycyBvdmVyIHByaW9yIHJ1bnMuCi0gZGlmZl9ydW5zKHJ1bl9hLCBydW5fYikgLS0gdW5pZmllZCBkaWZmIG9mIHR3byBzbmFwc2hvdHMnIHdvcmtmbG93Ly4KLSBicmFuY2goZnJvbV9yZWYpIC0tIHJlc2V0IHdvcmtmbG93LyB0byBhIHByaW9yIHNuYXBzaG90LgotIGNoZWNrX3dvcmtmbG93IC0tIGRyeS1ydW4gcmVjb25zdHJ1Y3Rpb24uCi0gcnVuX2NvdW50ZXJmYWN0dWFsX2JhdGNoKGJhc2VfcmVmLCB2YXJpYW50cykgLS0gdGhlIGxvYWQtYmVhcmluZwogIGV2YWx1YXRpb24gdG9vbC4KLSBzdGFnZV92YXJpYW50KHZhcmlhbnRfaWQsIHRhcmdldGVkX2V4YW1wbGVzPS4uLikgLS0gc25hcHNob3QgbGl2ZQogIHdvcmtmbG93LyBhcyBhIG5hbWVkIHNpYmxpbmcgdW5kZXIgdmFyaWFudHMvc2Vzc2lvbl9OTk4vdj8/Ly4KLSByZWFkX2VmZmVjdF90cmFjZSAvIGdyZXBfZWZmZWN0X3RyYWNlcyAvIGRpZmZfdHJhY2VzIC0tIHBlci1leGFtcGxlCiAgZWZmZWN0LWxldmVsIGluc3BlY3Rpb24gb2YgcHJpb3IgcnVucy4KLSBmaW5pc2hfc2Vzc2lvbiguLi4pIC8gc3RvcChzdW1tYXJ5KS4KCiMjIExvb3AgKEhBUkQgcnVsZXMgdGhlIGRpc3BhdGNoZXIgZW5mb3JjZXMpCjEuIEFOQUxZWkUuICAgc2hvd19oaXN0b3J5OyByZWFkIG9uZSB0cmFjZS5tZCBvZiBhbiBpbnRlcmVzdGluZyBwcmlvcgogICAgICAgICAgICAgIHJ1bjsgaWRlbnRpZnkgYSBmYWlsdXJlIENMQVNTICg+PTIgZXhhbXBsZXMpLgoyLiBIWVBPVEhFU0laRS4gIFJlcXVpcmVkIGJlZm9yZSBldmVyeSBiYXRjaC4gV3JpdGUKICAgICAgICAgICAgICBoeXBvdGhlc2VzL2hOTk5fKi5tZCB3aXRoIEJyYW5jaCBmcm9tIC8gQ2xhaW0gLyBQcm9wb3NlZAogICAgICAgICAgICAgIGNoYW5nZSAvIEV4cGVjdGVkIG91dGNvbWUgLyBXaHkgdGhpcyBkaWZmZXJzIGZyb20KICAgICAgICAgICAgICBwcmV2aW91cyBhdHRlbXB0cyAvIENhY2hlIGNvbnNlcXVlbmNlIHNlY3Rpb25zLgozLiBCUkFOQ0guICAgIGJyYW5jaChmcm9tX3JlZj0uLi4pIHRvIHJlc2V0IHdvcmtmbG93Ly4KNC4gRURJVCArIGNoZWNrX3dvcmtmbG93Lgo1LiBQcmVmZXIgcnVuX2NvdW50ZXJmYWN0dWFsX2JhdGNoIHdpdGggc2V2ZXJhbCBzdGFnZWQgc2libGluZ3MuCiAgIFByb3ZpZGUgZXhwbGljaXQgdGFyZ2V0ZWRfZXhhbXBsZXMgZm9yIGV2ZXJ5IHZhcmlhbnQuCjYuIE9CU0VSVkUuICAgUmVxdWlyZWQgYmV0d2VlbiBydW5zLiBXcml0ZSBvYnNlcnZhdGlvbnMvb05OTi5tZC4KNy4gUmVwZWF0IHVudGlsIGJ1ZGdldCBleGhhdXN0ZWQuIEZsYXQgZGV2IGlzIG5vdCBhIHN0b3AgY29uZGl0aW9uOwogICBzd2l0Y2ggdG8gYSBzdHJ1Y3R1cmFsbHkgZGlmZmVyZW50IG1vdmUu)

1Youarearesearchengineeroptimizingamulti-taskPythonworkflow.

2

3Theworkflowisatop-leveltaskunder‘workflow/‘thatcomposes

4subtasks(onefileeach).Yourdefaultoptimizationmoveistopropose

5abatchofcounterfactualworkflowvariantsandcall

6run\_counterfactual\_batch.

7

8##Theonlyruleyoumustfollow:generalize,don’toverfit

9-FixCLASSESoferrors,notinstances.Arootcausemustexplain>=

102-3failingtrainexamplesthroughthesamemechanism.

11-Dual-guardanystructuraledit:anewrulemustfireonlywhenboth

12asemanticcueintheproblemtextANDastructuralpatternmatch.

13-Neverpattern-matchonliteraltrain-problemphrases.

14TheDEV(aggregate,noper-example)lineisyourgeneralizationsignal.

15

16##Workspace

17\[scratchpadlayout,abridgedhere;reproducedinsectionabove\]

18

19##Tools

20-show\_history/show\_batch\_history/show\_metagit\_history/

21show\_example\_history--read-onlyledgersoverpriorruns.

22-diff\_runs(run\_a,run\_b)--unifieddiffoftwosnapshots’workflow/.

23-branch(from\_ref)--resetworkflow/toapriorsnapshot.

24-check\_workflow--dry-runreconstruction.

25-run\_counterfactual\_batch(base\_ref,variants)--theload-bearing

26evaluationtool.

27-stage\_variant(variant\_id,targeted\_examples=...)--snapshotlive

28workflow/asanamedsiblingundervariants/session\_NNN/v??/.

29-read\_effect\_trace/grep\_effect\_traces/diff\_traces--per-example

30effect-levelinspectionofpriorruns.

31-finish\_session(...)/stop(summary).

32

33##Loop(HARDrulesthedispatcherenforces)

341.ANALYZE.show\_history;readonetrace.mdofaninterestingprior

35run;identifyafailureCLASS(>=2examples).

362.HYPOTHESIZE.Requiredbeforeeverybatch.Write

37hypotheses/hNNN\_\*.mdwithBranchfrom/Claim/Proposed

38change/Expectedoutcome/Whythisdiffersfrom

39previousattempts/Cacheconsequencesections.

403.BRANCH.branch(from\_ref=...)toresetworkflow/.

414.EDIT+check\_workflow.

425.Preferrun\_counterfactual\_batchwithseveralstagedsiblings.

43Provideexplicittargeted\_examplesforeveryvariant.

446.OBSERVE.Requiredbetweenruns.Writeobservations/oNNN.md.

457.Repeatuntilbudgetexhausted.Flatdevisnotastopcondition;

46switchtoastructurallydifferentmove.’

#### F.2.3 Proposer tool surface

The proposer’s tools fall into four groups: filesystem inspection and
editing, ledger inspection, effect-level introspection, and host-mediated
evaluation. Table [14](https://arxiv.org/html/2605.10913v3#A6.T14 "Table 14 ‣ F.2.3 Proposer tool surface ‣ F.2 Implementation Details ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") lists the live surface; full
JSON-Schema specifications are in \_cbo\_tools.py.

Table 14: Proposer tools exposed by the CRO dispatcher.

|     |     |
| --- | --- |
| Tool | Purpose |
| Filesystem (scoped to scratchpad root) |
| bash | Shell command. |
| read\_file, write\_file, edit\_file | File I/O. |
| Ledger inspection |
| show\_history | Table of every prior experiment. |
| show\_batch\_history | Compact per-batch ledger. |
| show\_candidate(candidate\_id) | Single-candidate row inspection. |
| show\_metagit\_history | Meta-Git candidate scopes and decisions. |
| show\_example\_history(example\_id) | Per-example outcome history. |
| diff\_runs(run\_a, run\_b) | Unified diff of two snapshots’ workflow/. |
| Effect-level introspection (per-example) |
| show\_trace(run\_id) | Run-level trace. |
| list\_effect\_traces(run\_id) | Index of available per-example effect dumps. |
| read\_effect\_trace(run\_id, example\_id) | LLM I/O and effects for one example. |
| grep\_effect\_traces(run\_id, pattern) | Regex search across one run’s effects. |
| diff\_traces(run\_a, run\_b, example\_id) | Effect-level diff for one example. |
| Workflow editing |
| branch(from\_ref) | Reset live workflow/ to a prior snapshot. |
| check\_workflow | Dry-run reconstruction; catches syntax/import/type errors. |
| stage\_variant(variant\_id, targeted\_examples=...) | Snapshot live workflow/ as a sibling. |

Three tools warrant elaboration. stage\_variant snapshots the
current state of workflow/ to a sibling directory and registers
a variant\_id with the dispatcher; the proposer typically
branches back to the same parent and stages two-to-eight
siblings before any evaluation runs, so the eventual batch is a fan-out
from one common ancestor. run\_counterfactual\_batch accepts those
staged siblings together with their
targeted\_examples = {improve, protect, invariant} and an
expected\_base\_hash guard on the parent’s source bundle; the host
then executes the targeted preflight, the reflection contract, and the
dev evaluation downstream of it. The trace-introspection group
(read\_effect\_trace, grep\_effect\_traces,
diff\_traces) is the substrate-level hook into Shepherd’s effect
stream that lets the proposer inspect prior runs at the model-call
level rather than at the metric-aggregate level; this is what grounds
the \### Findings sections required by the reflection contract.

#### F.2.4 Counterfactual replay

A _counterfactual_ dev evaluation re-executes only the subtree of
the task DAG affected by the variant’s edits; the rest is reused from
the parent’s trace. The mechanism is a typed cache rather than a
diffing heuristic. Each @agent class is keyed by a pair
(source-hash,inputs-hash)(\\text{source-hash},\ \\text{inputs-hash}); the source-hash captures
the task class’s source plus the imports it transitively pulls in, and
the inputs-hash captures the typed input bundle the task is invoked
with. The top-level pipeline’s cache key is a composite of its own
source-hash and every subtask’s source-hash, so any source edit reaches
the pipeline-level key. Editing one subtask therefore invalidates that
subtask’s cache and the pipeline’s cache, but leaves sibling subtasks
hit-eligible; their inputs are unchanged unless the edited task lies on
a path to them in the DAG. Editing pipeline.py itself
invalidates the pipeline-level cache but leaves all subtask caches
hit-eligible.

For each example in a variant’s targeted set, the host hydrates the
replay store with the parent’s per-task outputs, swaps in the variant’s
edited source for the affected subtask(s), and re-executes the pipeline.
Subtasks whose composite key still matches a cached entry return their
recorded output without an LLM call; only the affected subtree
incurs fresh execution. The targeted preflight is therefore strictly
cheaper than a full re-run, and adding a new @agent between two
existing ones is the cheapest structural move available, since both
neighbours’ caches survive the edit. CRO’s main-text cache-hit-rate
figure (Figure 4) plots the realised reuse percentage averaged over a
proposer session.

#### F.2.5 Reflection contract and targeted-eval gate

CRO does not let the proposer self-grade. Two host-side checks gate
every batch.

##### Reflection contract.

Three rules apply to the proposer’s
hypothesis\_logs/session\_NNN.md and are enforced before any
variant runs (\_cbo\_validators.py).

1. 1.


Cite prior runs. Once any variant has been archived, the
\### Findings block must cite at least one
run\_NNN\[-slug\] label drawn from the candidate catalogue.

2. 2.


No unexplained redundancy. Each new variant’s mechanism
string is compared (Jaccard token similarity ≥0.85\\geq 0.85) against
archived ledger rows; on a near-duplicate of an _archived_
mechanism, the case-folded \### Findings block must contain
both the matching run\_label and the literal phrase
differs by:. Near-duplicates of a _promoted_ mechanism
pass silently; recombination is encouraged.

3. 3.


Verbalised-sampling floor.\### Hypotheses and
\### Considered & Rejected together must enumerate at least
twelve mechanisms with explicit priors, and at least one
_selected_ variant must carry a prior strictly below 0.20.
This audacious-arm floor discourages collapse to greedy local edits.


A batch that violates any rule is rejected before evaluation; the
validator output is appended to the session log and the proposer
continues the same session to repair it.

##### Targeted-eval gate.

Each variant declares improve, protect, and
invariant train examples. The host evaluates the variant
against just these (typically 4–8) examples, compares per-example
scores against the parent candidate’s, and computes a _verdict_
(evaluate\_targeted\_verdict in \_cbo\_metagit.py). The
defaults used across all five datasets are:

- •


targeted\_min\_score\_lift = 0.0 — aggregate score on the
union must be at least the parent’s;

- •


targeted\_max\_score\_drop = 0.02 — no single
protect or invariant example may regress by more than
0.02;

- •


targeted\_improve\_threshold = 0.67 — at least 67% of
improve examples must score strictly above the parent.


Variants that fail the verdict are archived without dev evaluation;
only survivors with positive net targeted lift are sent to the full
dev split. Promotion sits one level downstream: a survivor is
_promoted_ (and becomes a candidate base for future sessions)
when its dev aggregate is within promote\_dev\_epsilon = 0.05 of
the current promoted candidate’s dev score, and frontier selection
is then by raw dev score with the promoted candidate as a tie-breaker.

#### F.2.6 Handoff manifest example

The pending\_batches/session\_NNN.json manifest is the central
host-handoff artefact. It carries a base\_ref, optional
expected\_base\_hash guard, and a list of staged variants; each
variant carries a variant\_id, the path to its staged
workflow\_dir, a free-text rationale, a structured
mechanism\_axis (one of prompt, structural,
hybrid, config), and the explicit
targeted\_examples triple. Listing
reproduces a representative session-1 manifest from the IFBench
bundle.

[⬇](data:text/plain;base64,ewogICJzZXNzaW9uX2luZGV4IjogMSwKICAiYmFzZV9yZWYiOiAiY2FuZC1iYXNlbGluZSIsCiAgInZhcmlhbnRzIjogWwogICAgewogICAgICAidmFyaWFudF9pZCI6ICJ2MDEiLAogICAgICAid29ya2Zsb3dfZGlyIjogInZhcmlhbnRzL3Nlc3Npb25fMDAxL3YwMS93b3JrZmxvdyIsCiAgICAgICJtZWNoYW5pc21fYXhpcyI6ICJwcm9tcHQiLAogICAgICAicmF0aW9uYWxlIjogIlN0cmVuZ3RoZW4gdGhlIGV4aXN0aW5nIDItc3RhZ2UgcHJvbXB0cywgcmVtb3ZlCiAgICAgICAgdGhlIHRyYWlsaW5nIGZpbmFsX3Jlc3BvbnNlIG1hcmtlciwgYW5kIGxldCB0aGUgc2Vjb25kIHBhc3MKICAgICAgICByZXdyaXRlIGZyb20gc2NyYXRjaCBhZ2FpbnN0IGEgY29tcGxpYW5jZSBjaGVja2xpc3QuIiwKICAgICAgInRhcmdldGVkX2V4YW1wbGVzIjogewogICAgICAgICJpbXByb3ZlIjogICBbImlmYmVuY2hfdHJhaW4tMTIwOTgiLAogICAgICAgICAgICAgICAgICAgICAgImlmYmVuY2hfdHJhaW4tMTEwNDkiLAogICAgICAgICAgICAgICAgICAgICAgImlmYmVuY2hfdHJhaW4tMTE2NTciXSwKICAgICAgICAicHJvdGVjdCI6ICAgWyJpZmJlbmNoX3RyYWluLTkzODIiXSwKICAgICAgICAiaW52YXJpYW50IjogWyJpZmJlbmNoX3RyYWluLTIyMjAiXQogICAgICB9CiAgICB9LAogICAgewogICAgICAidmFyaWFudF9pZCI6ICJ2MDIiLAogICAgICAid29ya2Zsb3dfZGlyIjogInZhcmlhbnRzL3Nlc3Npb25fMDAxL3YwMi93b3JrZmxvdyIsCiAgICAgICJtZWNoYW5pc21fYXhpcyI6ICJzdHJ1Y3R1cmFsIiwKICAgICAgInJhdGlvbmFsZSI6ICJBZGQgYSBwbGFuLWV4dHJhY3Rpb24gc3RhZ2Ugc28gZHJhZnRpbmcgYW5kCiAgICAgICAgcmVwYWlyIG9wZXJhdGUgZnJvbSBhbiBleHBsaWNpdCBvYmplY3RpdmUgcGx1cyBjb25zdHJhaW50CiAgICAgICAgY2hlY2tsaXN0IGluc3RlYWQgb2YgcmF3IHByb21wdCB0ZXh0IGFsb25lLiIsCiAgICAgICJ0YXJnZXRlZF9leGFtcGxlcyI6IHsKICAgICAgICAiaW1wcm92ZSI6ICAgWyJpZmJlbmNoX3RyYWluLTM2OTgiLAogICAgICAgICAgICAgICAgICAgICAgImlmYmVuY2hfdHJhaW4tMTA2ODEiLAogICAgICAgICAgICAgICAgICAgICAgImlmYmVuY2hfdHJhaW4tMTc0MjkiXSwKICAgICAgICAicHJvdGVjdCI6ICAgWyJpZmJlbmNoX3RyYWluLTkxOTAiXSwKICAgICAgICAiaW52YXJpYW50IjogWyJpZmJlbmNoX3RyYWluLTE3NzA0Il0KICAgICAgfQogICAgfQogIF0KfQ==)

1{

2"session\_index":1,

3"base\_ref":"cand-baseline",

4"variants":\[\
\
5{\
\
6"variant\_id":"v01",\
\
7"workflow\_dir":"variants/session\_001/v01/workflow",\
\
8"mechanism\_axis":"prompt",\
\
9"rationale":"Strengthentheexisting2-stageprompts,remove\
\
10thetrailingfinal\_responsemarker,andletthesecondpass\
\
11rewritefromscratchagainstacompliancechecklist.",\
\
12"targeted\_examples":{\
\
13"improve":\["ifbench\_train-12098",\
\
14"ifbench\_train-11049",\
\
15"ifbench\_train-11657"\],\
\
16"protect":\["ifbench\_train-9382"\],\
\
17"invariant":\["ifbench\_train-2220"\]\
\
18}\
\
19},\
\
20{\
\
21"variant\_id":"v02",\
\
22"workflow\_dir":"variants/session\_001/v02/workflow",\
\
23"mechanism\_axis":"structural",\
\
24"rationale":"Addaplan-extractionstagesodraftingand\
\
25repairoperatefromanexplicitobjectiveplusconstraint\
\
26checklistinsteadofrawprompttextalone.",\
\
27"targeted\_examples":{\
\
28"improve":\["ifbench\_train-3698",\
\
29"ifbench\_train-10681",\
\
30"ifbench\_train-17429"\],\
\
31"protect":\["ifbench\_train-9190"\],\
\
32"invariant":\["ifbench\_train-17704"\]\
\
33}\
\
34}\
\
35\]

36}

Listing 1: Excerpt of pending\_batches/session\_001.json from the IFBench CRO bundle. Two of the four variants are shown.

### F.3 Per-dataset settings and optimised workflows

Table [15](https://arxiv.org/html/2605.10913v3#A6.T15 "Table 15 ‣ F.3 Per-dataset settings and optimised workflows ‣ Appendix F CRO ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") consolidates the experimental setting
(split sizes, metric, baseline workflow shape, CRO-best workflow
shape) for the five benchmarks evaluated.

Table 15: CRO benchmarks: splits, metric, baseline pipeline shape, and selected CRO workflow shape.

|     |     |     |
| --- | --- | --- |
| Dataset | Train/Dev/Test | Metric |
| HoVer | 150/300/300 | FullCoverage on retrieved gold titles |
| MATH (L5) | 100/50/50 | Exact match (canonical MATH normaliser) |
| LiveCodeBench | 100/100/100 | Pass-all-tests (public ∪\\cup private, capped 8) |
| IFBench | 150/300/294 | Per-constraint pass rate (best-of-8 normalised responses) |
| Terminal-Bench 2.0 (Stable25) | 25/25/25 | avg@5 on Terminus-2 test suite (overlapping splits, MetaHarness protocol) |

##### HoVer.

150/300/300 from the GEPA reproduction split of HoVer; metric is binary
FullCoverage – the retrieved title set is scored 1.0 only when it
contains every gold title for the claim. Each example exposes the
upstream TF-IDF top-100 candidate titles. The baseline is a 3-task pipeline that
issues two LLM-generated queries, deterministically reranks the
candidate list against each query, and selects the final title set:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgSG92ZXJNdWx0aUhvcFBpcGVsaW5lKEJhc2VNb2RlbCk6CiAgICBjbGFpbTogSW5wdXQoc3RyKQogICAgY2FuZGlkYXRlX2RvY3M6IElucHV0KGxpc3RbZGljdFtzdHIsIHN0cl1dKQogICAgcmV0cmlldmVkX2RvY3M6IE91dHB1dChsaXN0W3N0cl0pCiAgICBkZWYgZXhlY3V0ZShzZWxmKSAtPiBOb25lOgogICAgICAgIHRpdGxlcyA9IF9jYW5kaWRhdGVfdGl0bGVzKHNlbGYuY2FuZGlkYXRlX2RvY3MpCiAgICAgICAgZmlyc3QgPSBIb3ZlckluaXRpYWxRdWVyeVdyaXRlcihjbGFpbT1zZWxmLmNsYWltLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FuZGlkYXRlX2RvY3M9c2VsZi5jYW5kaWRhdGVfZG9jcykKICAgICAgICBmaXJzdF9yZXRyaWV2ZWQgPSBfbWVyZ2VfdGl0bGVzKAogICAgICAgICAgICBmaXJzdC50aXRsZXMsIF9yYW5rX3RpdGxlcyhmaXJzdC5xdWVyeSwgdGl0bGVzLCBsaW1pdD04KSwKICAgICAgICAgICAgbGltaXQ9OCkKICAgICAgICBzZWNvbmQgPSBIb3ZlckZvbGxvd3VwUXVlcnlXcml0ZXIoY2xhaW09c2VsZi5jbGFpbSwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FuZGlkYXRlX2RvY3M9c2VsZi5jYW5kaWRhdGVfZG9jcywKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3RfdGl0bGVzPWZpcnN0X3JldHJpZXZlZCkKICAgICAgICBzZWNvbmRfcmV0cmlldmVkID0gX21lcmdlX3RpdGxlcygKICAgICAgICAgICAgc2Vjb25kLnRpdGxlcywgX3JhbmtfdGl0bGVzKHNlY29uZC5xdWVyeSwgdGl0bGVzLCBsaW1pdD04KSwKICAgICAgICAgICAgbGltaXQ9OCkKICAgICAgICByZXRyaWV2ZWQgPSBfbWVyZ2VfdGl0bGVzKGZpcnN0X3JldHJpZXZlZCwgc2Vjb25kX3JldHJpZXZlZCwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfcmFua190aXRsZXMoc2VsZi5jbGFpbSwgdGl0bGVzLCBsaW1pdD04KSwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW1pdD0xNikKICAgICAgICBzZWxlY3RvciA9IEhvdmVyRG9jdW1lbnRTZWxlY3RvcigKICAgICAgICAgICAgY2xhaW09c2VsZi5jbGFpbSwgY2FuZGlkYXRlX2RvY3M9c2VsZi5jYW5kaWRhdGVfZG9jcywKICAgICAgICAgICAgcmV0cmlldmVkX3RpdGxlcz1yZXRyaWV2ZWQpCiAgICAgICAgc2VsZi5yZXRyaWV2ZWRfZG9jcyA9IHNlbGVjdG9yLnNlbGVjdGVkX2RvY3M=)

1@agent(cacheable=False)

2classHoverMultiHopPipeline(BaseModel):

3claim:Input(str)

4candidate\_docs:Input(list\[dict\[str,str\]\])

5retrieved\_docs:Output(list\[str\])

6defexecute(self)->None:

7titles=\_candidate\_titles(self.candidate\_docs)

8first=HoverInitialQueryWriter(claim=self.claim,

9candidate\_docs=self.candidate\_docs)

10first\_retrieved=\_merge\_titles(

11first.titles,\_rank\_titles(first.query,titles,limit=8),

12limit=8)

13second=HoverFollowupQueryWriter(claim=self.claim,

14candidate\_docs=self.candidate\_docs,

15first\_titles=first\_retrieved)

16second\_retrieved=\_merge\_titles(

17second.titles,\_rank\_titles(second.query,titles,limit=8),

18limit=8)

19retrieved=\_merge\_titles(first\_retrieved,second\_retrieved,

20\_rank\_titles(self.claim,titles,limit=8),

21limit=16)

22selector=HoverDocumentSelector(

23claim=self.claim,candidate\_docs=self.candidate\_docs,

24retrieved\_titles=retrieved)

25self.retrieved\_docs=selector.selected\_docs

The selected CRO workflow extends the baseline two-hop retrieve-and-select
loop with a per-hop document summariser, a bridge resolver that names
gold pages absent from the candidate list, a deterministic local-wiki
grounder for surface-form mentions in summaries, a recursive
relation-aware bridge expansion, and a third hop that closes any
remaining evidence gap. The full source contains seven @agent
files (query1.py, query2.py, summary1.py,
bridge\_resolver.py, gap\_resolver.py, selector.py,
pipeline.py) plus deterministic helpers in \_imports.py
(\_resolve\_open\_titles, \_collect\_snippet\_bridges,
\_collect\_recursive\_bridges, \_RELATION\_CUES); the
top-level orchestration is:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgSG92ZXJCZW5jaE11bHRpSG9wUGlwZWxpbmUoQmFzZU1vZGVsKToKICAgIGRlZiBleGVjdXRlKHNlbGYpIC0+IE5vbmU6CiAgICAgICAgIyBob3AgMTogcXVlcnksIHJldHJpZXZlLCBzdW1tYXJpc2UsIG1pbmUgYnJpZGdlcwogICAgICAgIGZpcnN0ID0gSG92ZXJCZW5jaEluaXRpYWxRdWVyeVdyaXRlcihjbGFpbSwgY2FuZGlkYXRlX2RvY3MpCiAgICAgICAgZmlyc3RfcmV0cmlldmVkID0gX21lcmdlX3RpdGxlcyhmaXJzdC50aXRsZXMsCiAgICAgICAgICAgIF9yYW5rX2NhbmRpZGF0ZV9kb2NzKGZpcnN0LnF1ZXJ5LCBjYW5kaWRhdGVfZG9jcywgbGltaXQ9MjApLAogICAgICAgICAgICBfcmFua19jYW5kaWRhdGVfZG9jcyhjbGFpbSwgICAgICAgY2FuZGlkYXRlX2RvY3MsIGxpbWl0PTIwKSwKICAgICAgICAgICAgbGltaXQ9MjgpCiAgICAgICAgZmlyc3Rfc3VtbWFyeSA9IEhvdmVyQmVuY2hEb2N1bWVudFN1bW1hcml6ZXIoCiAgICAgICAgICAgIGNsYWltPWNsYWltLCByZXRyaWV2ZWRfdGl0bGVzPWZpcnN0X3JldHJpZXZlZFs6OF0pCiAgICAgICAgZmlyc3RfYnJpZGdlcyA9IF9jb2xsZWN0X3NuaXBwZXRfYnJpZGdlcyhjbGFpbSwgZmlyc3RfcmV0cmlldmVkKQogICAgICAgIGJyaWRnZSA9IEhvdmVyQmVuY2hCcmlkZ2VUaXRsZVJlc29sdmVyKAogICAgICAgICAgICBjbGFpbT1jbGFpbSwgcmV0cmlldmVkX3RpdGxlcz1maXJzdF9yZXRyaWV2ZWQsCiAgICAgICAgICAgIGV2aWRlbmNlX3N1bW1hcnk9Zmlyc3Rfc3VtbWFyeS5zdW1tYXJ5KQogICAgICAgIGJyaWRnZV90aXRsZXMgICAgPSBfcmVzb2x2ZV9vcGVuX3RpdGxlcyhicmlkZ2UudGl0bGVzLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhaW0sIGZpcnN0X3N1bW1hcnkpCiAgICAgICAgYnJpZGdlX2V4cGFuc2lvbiA9IF9jb2xsZWN0X3JlY3Vyc2l2ZV9icmlkZ2VzKAogICAgICAgICAgICBjbGFpbSwKICAgICAgICAgICAgX21lcmdlX3RpdGxlcyhicmlkZ2VfdGl0bGVzLCBmaXJzdF9icmlkZ2VzLCBsaW1pdD0xMiksCiAgICAgICAgICAgIGZpcnN0X3JldHJpZXZlZCkKICAgICAgICAjIGhvcCAyOiByZS1xdWVyeSBjb25kaXRpb25lZCBvbiBob3AtMSBldmlkZW5jZQogICAgICAgIHNlY29uZCA9IEhvdmVyQmVuY2hGb2xsb3d1cFF1ZXJ5V3JpdGVyKGNsYWltLCBjYW5kaWRhdGVfZG9jcywKICAgICAgICAgICAgcmV0cmlldmVkX3RpdGxlcz1maXJzdF9yZXRyaWV2ZWQsCiAgICAgICAgICAgIGV2aWRlbmNlX3N1bW1hcnk9Zmlyc3Rfc3VtbWFyeS5zdW1tYXJ5KQogICAgICAgIHNlY29uZF9yZXRyaWV2ZWQgPSBfbWVyZ2VfdGl0bGVzKAogICAgICAgICAgICBfcmVzb2x2ZV9vcGVuX3RpdGxlcyhzZWNvbmQudGl0bGVzLCBjbGFpbSwgZmlyc3Rfc3VtbWFyeSksCiAgICAgICAgICAgIGJyaWRnZV90aXRsZXMsIGZpcnN0X2JyaWRnZXMsIGJyaWRnZV9leHBhbnNpb24sCiAgICAgICAgICAgIF9yYW5rX2NhbmRpZGF0ZV9kb2NzKHNlY29uZC5xdWVyeSwgY2FuZGlkYXRlX2RvY3MsIGxpbWl0PTI0KSwKICAgICAgICAgICAgbGltaXQ9MjgpCiAgICAgICAgc2Vjb25kX3N1bW1hcnkgPSBIb3ZlckJlbmNoRG9jdW1lbnRTdW1tYXJpemVyKAogICAgICAgICAgICBjbGFpbT1jbGFpbSwgcmV0cmlldmVkX3RpdGxlcz1zZWNvbmRfcmV0cmlldmVkWzo4XSkKICAgICAgICAjIGhvcCAzOiBleHBsaWNpdCBnYXAgcmVzb2x2ZXIgKyBsYXRlIHJlY3Vyc2l2ZSBleHBhbnNpb24KICAgICAgICBnYXAgPSBIb3ZlckJlbmNoTWlzc2luZ0V2aWRlbmNlUmVzb2x2ZXIoCiAgICAgICAgICAgIGNsYWltPWNsYWltLAogICAgICAgICAgICByZXRyaWV2ZWRfdGl0bGVzPV9tZXJnZV90aXRsZXMoZmlyc3RfcmV0cmlldmVkLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlY29uZF9yZXRyaWV2ZWQsIGxpbWl0PTQ4KSwKICAgICAgICAgICAgZXZpZGVuY2Vfc3VtbWFyeT1maXJzdF9zdW1tYXJ5LnN1bW1hcnkKICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgIlxuXG4iICsgc2Vjb25kX3N1bW1hcnkuc3VtbWFyeSkKICAgICAgICB0aGlyZCA9IEhvdmVyQmVuY2hGb2xsb3d1cFF1ZXJ5V3JpdGVyKC4uLikgICMgM3JkLWhvcCBxdWVyeQogICAgICAgIHRoaXJkX3JldHJpZXZlZCA9IF9tZXJnZV90aXRsZXMoZ2FwLnRpdGxlcywgdGhpcmQudGl0bGVzLCAuLi4pCiAgICAgICAgbGF0ZV9icmlkZ2VzID0gX2NvbGxlY3RfcmVjdXJzaXZlX2JyaWRnZXMoCiAgICAgICAgICAgIGNsYWltLCBfbWVyZ2VfdGl0bGVzKC4uLiksIG1heF9kZXB0aD0xLCBtYXhfbmV3PTYpCiAgICAgICAgcmV0cmlldmVkID0gX21lcmdlX3RpdGxlcyhmaXJzdF9yZXRyaWV2ZWQsIGZpcnN0X2JyaWRnZXMsCiAgICAgICAgICAgIGJyaWRnZV90aXRsZXMsIGJyaWRnZV9leHBhbnNpb24sIHNlY29uZF9yZXRyaWV2ZWQsCiAgICAgICAgICAgIGdhcC50aXRsZXMsIHRoaXJkX3JldHJpZXZlZCwgbGF0ZV9icmlkZ2VzLCBsaW1pdD02NCkKICAgICAgICBzZWxlY3RvciA9IEhvdmVyQmVuY2hEb2N1bWVudFNlbGVjdG9yKAogICAgICAgICAgICBjbGFpbT1jbGFpbSwgY2FuZGlkYXRlX2RvY3M9Y2FuZGlkYXRlX2RvY3MsCiAgICAgICAgICAgIHJldHJpZXZlZF90aXRsZXM9cmV0cmlldmVkLAogICAgICAgICAgICBzdW1tYXJpZXM9W2ZpcnN0X3N1bW1hcnkuc3VtbWFyeSwgc2Vjb25kX3N1bW1hcnkuc3VtbWFyeV0pCiAgICAgICAgc2VsZi5yZXRyaWV2ZWRfZG9jcyA9IF9tZXJnZV90aXRsZXMoCiAgICAgICAgICAgIF9yZXNvbHZlX29wZW5fdGl0bGVzKHNlbGVjdG9yLnNlbGVjdGVkX2RvY3MsIC4uLiksCiAgICAgICAgICAgIHJldHJpZXZlZCwgX2NhbmRpZGF0ZV90aXRsZXMoY2FuZGlkYXRlX2RvY3MpKQ==)

1@agent(cacheable=False)

2classHoverBenchMultiHopPipeline(BaseModel):

3defexecute(self)->None:

4#hop1:query,retrieve,summarise,minebridges

5first=HoverBenchInitialQueryWriter(claim,candidate\_docs)

6first\_retrieved=\_merge\_titles(first.titles,

7\_rank\_candidate\_docs(first.query,candidate\_docs,limit=20),

8\_rank\_candidate\_docs(claim,candidate\_docs,limit=20),

9limit=28)

10first\_summary=HoverBenchDocumentSummarizer(

11claim=claim,retrieved\_titles=first\_retrieved\[:8\])

12first\_bridges=\_collect\_snippet\_bridges(claim,first\_retrieved)

13bridge=HoverBenchBridgeTitleResolver(

14claim=claim,retrieved\_titles=first\_retrieved,

15evidence\_summary=first\_summary.summary)

16bridge\_titles=\_resolve\_open\_titles(bridge.titles,

17claim,first\_summary)

18bridge\_expansion=\_collect\_recursive\_bridges(

19claim,

20\_merge\_titles(bridge\_titles,first\_bridges,limit=12),

21first\_retrieved)

22#hop2:re-queryconditionedonhop-1evidence

23second=HoverBenchFollowupQueryWriter(claim,candidate\_docs,

24retrieved\_titles=first\_retrieved,

25evidence\_summary=first\_summary.summary)

26second\_retrieved=\_merge\_titles(

27\_resolve\_open\_titles(second.titles,claim,first\_summary),

28bridge\_titles,first\_bridges,bridge\_expansion,

29\_rank\_candidate\_docs(second.query,candidate\_docs,limit=24),

30limit=28)

31second\_summary=HoverBenchDocumentSummarizer(

32claim=claim,retrieved\_titles=second\_retrieved\[:8\])

33#hop3:explicitgapresolver+laterecursiveexpansion

34gap=HoverBenchMissingEvidenceResolver(

35claim=claim,

36retrieved\_titles=\_merge\_titles(first\_retrieved,

37second\_retrieved,limit=48),

38evidence\_summary=first\_summary.summary

39+"\\n\\n"+second\_summary.summary)

40third=HoverBenchFollowupQueryWriter(...)#3rd-hopquery

41third\_retrieved=\_merge\_titles(gap.titles,third.titles,...)

42late\_bridges=\_collect\_recursive\_bridges(

43claim,\_merge\_titles(...),max\_depth=1,max\_new=6)

44retrieved=\_merge\_titles(first\_retrieved,first\_bridges,

45bridge\_titles,bridge\_expansion,second\_retrieved,

46gap.titles,third\_retrieved,late\_bridges,limit=64)

47selector=HoverBenchDocumentSelector(

48claim=claim,candidate\_docs=candidate\_docs,

49retrieved\_titles=retrieved,

50summaries=\[first\_summary.summary,second\_summary.summary\])

51self.retrieved\_docs=\_merge\_titles(

52\_resolve\_open\_titles(selector.selected\_docs,...),

53retrieved,\_candidate\_titles(candidate\_docs))

The mechanism is a sequence of three structural additions, each
addressing a distinct failure cluster traced through CRO’s effect
ledger: an LLM bridge resolver that surfaces gold pages outside the
TF-IDF candidate list; a
deterministic snippet grounder that uses a local Wikipedia DB to
disambiguate surface-form mentions exposed by the hop-1 summary
(Case 2); and a recursive relation-aware bridge expansion that mines
second-order bridge pages from grounded first-order pages (Case 3).

##### MATH.

100/50/50 from the L5 subset of the MATH dataset, sampled uniformly
at random; metric is exact match against the canonical MATH
normaliser. The baseline is a
three-task solver–runner–verifier loop with up to two revisions:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgTWF0aFBpcGVsaW5lKEJhc2VNb2RlbCk6CiAgICBwcm9ibGVtOiBJbnB1dChzdHIpOyBhbnN3ZXI6IE91dHB1dChzdHIpCiAgICBkZWYgZXhlY3V0ZShzZWxmKSAtPiBOb25lOgogICAgICAgIG1heF9yZXZpc2lvbnMsIGhpbnQgPSAyLCAiIgogICAgICAgIGZvciBhdHRlbXB0IGluIHJhbmdlKG1heF9yZXZpc2lvbnMgKyAxKToKICAgICAgICAgICAgc29sdmVyID0gU29sdmVyKHByb2JsZW09c2VsZi5wcm9ibGVtLCBoaW50PWhpbnQpCiAgICAgICAgICAgIHJ1bm5lciA9IFJ1bm5lcihjb2RlPXNvbHZlci5jb2RlKQogICAgICAgICAgICBjaGVjayAgPSBWZXJpZmllcihwcm9ibGVtPXNlbGYucHJvYmxlbSwgY29kZT1zb2x2ZXIuY29kZSwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVubmVyX3N0ZG91dD1ydW5uZXIuc3Rkb3V0LAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydW5uZXJfZXJyb3I9cnVubmVyLmVycm9yLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXI9cnVubmVyLmFuc3dlcikKICAgICAgICAgICAgaWYgY2hlY2sudmVyZGljdCA9PSAiYWNjZXB0IiBhbmQgbm90IHJ1bm5lci5lcnJvcjogYnJlYWsKICAgICAgICAgICAgaGludCA9IGNoZWNrLmhpbnQgb3IgKAogICAgICAgICAgICAgICAgZiJQcmV2aW91cyBydW4gZXJyb3JlZDoge3J1bm5lci5lcnJvcn0iCiAgICAgICAgICAgICAgICBpZiBydW5uZXIuZXJyb3IgZWxzZSAiIikKICAgICAgICBzZWxmLmFuc3dlciA9IHJ1bm5lci5hbnN3ZXI=)

1@agent(cacheable=False)

2classMathPipeline(BaseModel):

3problem:Input(str);answer:Output(str)

4defexecute(self)->None:

5max\_revisions,hint=2,""

6forattemptinrange(max\_revisions+1):

7solver=Solver(problem=self.problem,hint=hint)

8runner=Runner(code=solver.code)

9check=Verifier(problem=self.problem,code=solver.code,

10runner\_stdout=runner.stdout,

11runner\_error=runner.error,

12answer=runner.answer)

13ifcheck.verdict=="accept"andnotrunner.error:break

14hint=check.hintor(

15f"Previousrunerrored:{runner.error}"

16ifrunner.errorelse"")

17self.answer=runner.answer

The selected CRO workflow replaces the single solver branch with a
plan-conditioned dual-solver fan-out followed by a repair pass and an
LLM selector. The full source consists of seven @agent files
(planner.py, solver.py, alternate\_solver.py,
repairer.py, runner.py, selector.py,
verifier.py); the top-level orchestration is:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgTWF0aFBpcGVsaW5lKEJhc2VNb2RlbCk6CiAgICBkZWYgZXhlY3V0ZShzZWxmKSAtPiBOb25lOgogICAgICAgIGZvciBhdHRlbXB0IGluIHJhbmdlKG1heF9yZXZpc2lvbnMgKyAxKToKICAgICAgICAgICAgcGxhbiA9IFBsYW5uZXIocHJvYmxlbT1zZWxmLnByb2JsZW0sIGhpbnQ9aGludCkucGxhbgogICAgICAgICAgICBjb2RlX2EgPSBTb2x2ZXIocHJvYmxlbSwgcGxhbiwgaGludCkKICAgICAgICAgICAgcnVubmVyX2EgPSBSdW5uZXIoY29kZT1jb2RlX2EuY29kZSkKICAgICAgICAgICAgY29kZV9iID0gQWx0ZXJuYXRlU29sdmVyKHByb2JsZW0sIHBsYW4sIGhpbnQpCiAgICAgICAgICAgIHJ1bm5lcl9iID0gUnVubmVyKGNvZGU9Y29kZV9iLmNvZGUpCiAgICAgICAgICAgIGlmIChydW5uZXJfYS5lcnJvciBvciBub3QgcnVubmVyX2EuYW5zd2VyCiAgICAgICAgICAgICAgICBvciBub3QgcnVubmVyX2EuY29tcGxpYW50KToKICAgICAgICAgICAgICAgIGNvZGVfYSA9IFJlcGFpcmVyKHByb2JsZW0sIHBsYW4sIGNvZGVfYS5jb2RlLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bm5lcl9hLnN0ZG91dCwgcnVubmVyX2EuZXJyb3IsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVubmVyX2EuYW5zd2VyLCBoaW50KQogICAgICAgICAgICAgICAgcnVubmVyX2EgPSBSdW5uZXIoY29kZT1jb2RlX2EuY29kZSkKICAgICAgICAgICAgIyBzeW1tZXRyaWMgcmVwYWlyIG9uIGNvZGVfYgogICAgICAgICAgICBwaWNrZWQgPSBTZWxlY3Rvcihwcm9ibGVtLCBwbGFuLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlX2EsIHJ1bm5lcl9hLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlX2IsIHJ1bm5lcl9iKQogICAgICAgICAgICBjaGVjayA9IFZlcmlmaWVyKHByb2JsZW0sIHBsYW4sIHBpY2tlZC5jb2RlLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBpY2tlZC5zdGRvdXQsIHBpY2tlZC5lcnJvciwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwaWNrZWQuYW5zd2VyLCBwaWNrZWQuY29tcGxpYW50KQogICAgICAgICAgICBpZiBjaGVjay52ZXJkaWN0ID09ICJhY2NlcHQiIGFuZCBub3QgY2hlY2suZXJyb3I6IGJyZWFrCiAgICAgICAgICAgIGhpbnQgPSBjaGVjay5oaW50IG9yIHBpY2tlZC5oaW50CiAgICAgICAgc2VsZi5hbnN3ZXIgPSBwaWNrZWQuYW5zd2Vy)

1@agent(cacheable=False)

2classMathPipeline(BaseModel):

3defexecute(self)->None:

4forattemptinrange(max\_revisions+1):

5plan=Planner(problem=self.problem,hint=hint).plan

6code\_a=Solver(problem,plan,hint)

7runner\_a=Runner(code=code\_a.code)

8code\_b=AlternateSolver(problem,plan,hint)

9runner\_b=Runner(code=code\_b.code)

10if(runner\_a.errorornotrunner\_a.answer

11ornotrunner\_a.compliant):

12code\_a=Repairer(problem,plan,code\_a.code,

13runner\_a.stdout,runner\_a.error,

14runner\_a.answer,hint)

15runner\_a=Runner(code=code\_a.code)

16#symmetricrepaironcode\_b

17picked=Selector(problem,plan,

18code\_a,runner\_a,

19code\_b,runner\_b)

20check=Verifier(problem,plan,picked.code,

21picked.stdout,picked.error,

22picked.answer,picked.compliant)

23ifcheck.verdict=="accept"andnotcheck.error:break

24hint=check.hintorpicked.hint

25self.answer=picked.answer

The mechanism is structural: a planner produces a plan-shared prefix,
a second AlternateSolver branches off the same plan, a
Repairer runs only when a branch produces a non-compliant or
errored output, and an LLM Selector compares the two finalised
branches against the plan before the verifier runs. Edits to
individual subtasks beyond the structural change (the
FINAL\_ANSWER: contract enforced in \_imports.py, the
compliant flag on Runner) reflect later sessions
tightening the dual-branch contract.

##### LiveCodeBench.

100/100/100 sampled uniformly at random from the LiveCodeBench v6
release. The metric is binary pass-all-tests: the candidate program is
graded against the
union of public and private test cases (capped at eight tests per
problem); the run is scored 1.0 only when every test passes. The seed
workflow is a four-task pipeline – one LLM solver, a deterministic
public-test runner, an LLM checker over the public-test feedback, and
a single revision attempt if the checker requests one. Note that the
metric grades the _final_ emitted code against the union of
public and private tests; the pipeline only consults public-test
feedback during the solve. The seed source is:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgTENCUGlwZWxpbmUoQmFzZU1vZGVsKToKICAgIHByb2JsZW06IElucHV0KHN0cikKICAgIHN0YXJ0ZXJfY29kZTogSW5wdXQoc3RyKQogICAgcHVibGljX3Rlc3RzX2pzb246IElucHV0KHN0cikKICAgIGNvZGU6IE91dHB1dChzdHIpCiAgICByZXZpc2lvbnM6IE91dHB1dChpbnQpCiAgICBkZWYgZXhlY3V0ZShzZWxmKSAtPiBOb25lOgogICAgICAgIGZpcnN0ICAgPSBTb2x2ZXIocHJvYmxlbT1zZWxmLnByb2JsZW0sCiAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydGVyX2NvZGU9c2VsZi5zdGFydGVyX2NvZGUsIGhpbnQ9IiIpCiAgICAgICAgcnVubmVyICA9IFB1YmxpY1Rlc3RSdW5uZXIoY29kZT1maXJzdC5jb2RlLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHB1YmxpY190ZXN0c19qc29uPXNlbGYucHVibGljX3Rlc3RzX2pzb24pCiAgICAgICAgY2hlY2tlciA9IENoZWNrZXIocHJvYmxlbT1zZWxmLnByb2JsZW0sCiAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZT1maXJzdC5jb2RlLAogICAgICAgICAgICAgICAgICAgICAgICAgIG5fcGFzc2VkPXJ1bm5lci5uX3Bhc3NlZCwKICAgICAgICAgICAgICAgICAgICAgICAgICBuX3RvdGFsPXJ1bm5lci5uX3RvdGFsLAogICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bm5lcl9zdW1tYXJ5PXJ1bm5lci5zdW1tYXJ5KQogICAgICAgIGlmIGNoZWNrZXIudmVyZGljdCA9PSAicmV2aXNlIiBhbmQgY2hlY2tlci5oaW50OgogICAgICAgICAgICBzZWNvbmQgPSBTb2x2ZXIocHJvYmxlbT1zZWxmLnByb2JsZW0sCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydGVyX2NvZGU9c2VsZi5zdGFydGVyX2NvZGUsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaW50PWNoZWNrZXIuaGludCkKICAgICAgICAgICAgc2VsZi5jb2RlID0gc2Vjb25kLmNvZGUKICAgICAgICAgICAgc2VsZi5yZXZpc2lvbnMgPSAxCiAgICAgICAgZWxzZToKICAgICAgICAgICAgc2VsZi5jb2RlID0gZmlyc3QuY29kZQogICAgICAgICAgICBzZWxmLnJldmlzaW9ucyA9IDA=)

1@agent(cacheable=False)

2classLCBPipeline(BaseModel):

3problem:Input(str)

4starter\_code:Input(str)

5public\_tests\_json:Input(str)

6code:Output(str)

7revisions:Output(int)

8defexecute(self)->None:

9first=Solver(problem=self.problem,

10starter\_code=self.starter\_code,hint="")

11runner=PublicTestRunner(code=first.code,

12public\_tests\_json=self.public\_tests\_json)

13checker=Checker(problem=self.problem,

14code=first.code,

15n\_passed=runner.n\_passed,

16n\_total=runner.n\_total,

17runner\_summary=runner.summary)

18ifchecker.verdict=="revise"andchecker.hint:

19second=Solver(problem=self.problem,

20starter\_code=self.starter\_code,

21hint=checker.hint)

22self.code=second.code

23self.revisions=1

24else:

25self.code=first.code

26self.revisions=0

The selected CRO workflow replaces the single-solver call with a
public-test-graded fan-out and a single repair-planned retry. The
full source has nine @agent files (analyzer.py,
analysis\_critic.py, solver.py,
public\_test\_runner.py, selector.py, checker.py,
repair\_planner.py, pipeline.py, plus
\_imports.py); the top-level orchestration is:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgTENCUGlwZWxpbmUoQmFzZU1vZGVsKToKICAgIGRlZiBleGVjdXRlKHNlbGYpIC0+IE5vbmU6CiAgICAgICAgYW5hbHlzaXMgPSBQcm9ibGVtQW5hbHl6ZXIocHJvYmxlbSwgc3RhcnRlcl9jb2RlLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwdWJsaWNfdGVzdHNfanNvbikKICAgICAgICBjcml0aXF1ZSA9IEFuYWx5c2lzQ3JpdGljKHByb2JsZW0sIGFuYWx5c2lzLmFuYWx5c2lzLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHB1YmxpY190ZXN0c19qc29uKQogICAgICAgIHByaW1hcnkgID0gU29sdmVyKHByb2JsZW0sIHN0YXJ0ZXJfY29kZSwKICAgICAgICAgICAgICAgICAgICAgICAgICBhbmFseXNpcy5leGVjdXRpb25fY29udHJhY3QsCiAgICAgICAgICAgICAgICAgICAgICAgICAgYW5hbHlzaXMuYW5hbHlzaXMsIGNyaXRpcXVlLmNyaXRpcXVlLAogICAgICAgICAgICAgICAgICAgICAgICAgIHN0cmF0ZWd5PSJwcmltYXJ5IiwgaGludD0iIikKICAgICAgICBwcmltYXJ5X3J1bm5lciA9IFB1YmxpY1Rlc3RSdW5uZXIoY29kZT1wcmltYXJ5LmNvZGUsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHB1YmxpY190ZXN0c19qc29uPS4uLikKICAgICAgICBhbHRlcm5hdGUgPSBTb2x2ZXIoLi4uLCBzdHJhdGVneT0iYWx0ZXJuYXRlIiwgaGludD0iIikKICAgICAgICBhbHRlcm5hdGVfcnVubmVyID0gUHVibGljVGVzdFJ1bm5lcihjb2RlPWFsdGVybmF0ZS5jb2RlLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHB1YmxpY190ZXN0c19qc29uPS4uLikKICAgICAgICBzZWxlY3RlZCA9IERyYWZ0U2VsZWN0b3IocHJpbWFyeSwgcHJpbWFyeV9ydW5uZXIsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHRlcm5hdGUsIGFsdGVybmF0ZV9ydW5uZXIpCiAgICAgICAgY2hlY2tlciAgPSBDaGVja2VyKHByb2JsZW0sIHNlbGVjdGVkLnNlbGVjdGVkX2NvZGUsCiAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkLnNlbGVjdGVkX3Bhc3NlZCwKICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0ZWQuc2VsZWN0ZWRfdG90YWwsCiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyaXRpcXVlLmNyaXRpcXVlLAogICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb25fcmVhc29uPXNlbGVjdGVkLnNlbGVjdGlvbl9yZWFzb24pCiAgICAgICAgaWYgY2hlY2tlci52ZXJkaWN0ID09ICJyZXZpc2UiIGFuZCBjaGVja2VyLmhpbnQ6CiAgICAgICAgICAgIHJlcGFpciA9IFJlcGFpclBsYW5uZXIocHJvYmxlbSwgYW5hbHlzaXMsIGNyaXRpcXVlLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RlZCwgY2hlY2tlci5oaW50KQogICAgICAgICAgICByZXBhaXJlZCA9IFNvbHZlciguLi4sIHN0cmF0ZWd5PXJlcGFpci5yZXRyeV9zdHJhdGVneSwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGludD1yZXBhaXIucmVwYWlyX3BsYW4gb3IgY2hlY2tlci5oaW50KQogICAgICAgICAgICBzZWxmLmNvZGUgPSByZXBhaXJlZC5jb2RlCiAgICAgICAgZWxzZToKICAgICAgICAgICAgc2VsZi5jb2RlID0gc2VsZWN0ZWQuc2VsZWN0ZWRfY29kZQ==)

1@agent(cacheable=False)

2classLCBPipeline(BaseModel):

3defexecute(self)->None:

4analysis=ProblemAnalyzer(problem,starter\_code,

5public\_tests\_json)

6critique=AnalysisCritic(problem,analysis.analysis,

7public\_tests\_json)

8primary=Solver(problem,starter\_code,

9analysis.execution\_contract,

10analysis.analysis,critique.critique,

11strategy="primary",hint="")

12primary\_runner=PublicTestRunner(code=primary.code,

13public\_tests\_json=...)

14alternate=Solver(...,strategy="alternate",hint="")

15alternate\_runner=PublicTestRunner(code=alternate.code,

16public\_tests\_json=...)

17selected=DraftSelector(primary,primary\_runner,

18alternate,alternate\_runner)

19checker=Checker(problem,selected.selected\_code,

20selected.selected\_passed,

21selected.selected\_total,

22critique.critique,

23selection\_reason=selected.selection\_reason)

24ifchecker.verdict=="revise"andchecker.hint:

25repair=RepairPlanner(problem,analysis,critique,

26selected,checker.hint)

27repaired=Solver(...,strategy=repair.retry\_strategy,

28hint=repair.repair\_planorchecker.hint)

29self.code=repaired.code

30else:

31self.code=selected.selected\_code

The mechanism is again structural: the proposer separated
_understanding_ (ProblemAnalyzer \+ AnalysisCritic)
from _generation_ (two Solver invocations with disjoint
strategy hints), grounded selection in the deterministic
public-test pass count via DraftSelector, and gated revision
on a Checker whose hint is consumed by an explicit
RepairPlanner rather than fed directly to the next
Solver. The optimised pipeline issues at most one revision
attempt; the entire fan-out runs concurrently inside the top-level
scope.

##### IFBench.

150/300/294 vendored from the GEPA paper. The 294-instance test split is the full
IFBench out-of-distribution constraint set (58 OOD constraint
identifiers); train and dev are slices of IFBench\_train.jsonl.
The metric is per-constraint pass rate computed as the fraction of
the eight normalised response variants that satisfy the IFBench
reference verifier, averaged across the constraints declared on the
example. The baseline is the
IFBenchCoT2StageProgram:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgSUZCZW5jaFBpcGVsaW5lKEJhc2VNb2RlbCk6CiAgICBwcm9tcHQ6IElucHV0KHN0cik7IHJlc3BvbnNlOiBPdXRwdXQoc3RyKQogICAgZGVmIGV4ZWN1dGUoc2VsZikgLT4gTm9uZToKICAgICAgICBzdGFnZTEgPSBHZW5lcmF0ZVJlc3BvbnNlKHF1ZXJ5PXNlbGYucHJvbXB0KQogICAgICAgIHN0YWdlMiA9IEVuc3VyZUNvcnJlY3RSZXNwb25zZShxdWVyeT1zZWxmLnByb21wdCwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U9c3RhZ2UxLnJlc3BvbnNlKQogICAgICAgIHNlbGYucmVzcG9uc2UgPSBzdGFnZTIuZmluYWxfcmVzcG9uc2U=)

1@agent(cacheable=False)

2classIFBenchPipeline(BaseModel):

3prompt:Input(str);response:Output(str)

4defexecute(self)->None:

5stage1=GenerateResponse(query=self.prompt)

6stage2=EnsureCorrectResponse(query=self.prompt,

7response=stage1.response)

8self.response=stage2.final\_response

GenerateResponse is prompted with "Respond to the query.";
EnsureCorrectResponse is prompted with "Ensure the response is correct and adheres to the given constraints. Your response will be used as the final response."

The selected CRO workflow extends the baseline
two-stage compound with a constraint audit, a repair pass, and a
last-chance rewrite. The full source adds five @agent files on
top of the baseline (audit.py, ensure.py,
finalize.py, generate.py, repair.py), with a new
pipeline.py:

[⬇](data:text/plain;base64,QGFnZW50KGNhY2hlYWJsZT1GYWxzZSkKY2xhc3MgSUZCZW5jaFBpcGVsaW5lKEJhc2VNb2RlbCk6CiAgICBkZWYgZXhlY3V0ZShzZWxmKSAtPiBOb25lOgogICAgICAgIHN0YWdlMSA9IEdlbmVyYXRlUmVzcG9uc2UocXVlcnk9c2VsZi5wcm9tcHQpCiAgICAgICAgc3RhZ2UyID0gRW5zdXJlQ29ycmVjdFJlc3BvbnNlKHF1ZXJ5PXNlbGYucHJvbXB0LAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZT1zdGFnZTEucmVzcG9uc2UpCiAgICAgICAgYXVkaXRfMSA9IEF1ZGl0UmVzcG9uc2UocXVlcnk9c2VsZi5wcm9tcHQsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U9c3RhZ2UyLmZpbmFsX3Jlc3BvbnNlKQogICAgICAgIGlmIGF1ZGl0XzEudmVyZGljdC5zdHJpcCgpLnVwcGVyKCkuc3RhcnRzd2l0aCgiUEFTUyIpOgogICAgICAgICAgICBzZWxmLnJlc3BvbnNlID0gc3RhZ2UyLmZpbmFsX3Jlc3BvbnNlOyByZXR1cm4KICAgICAgICBzdGFnZTQgPSBSZXBhaXJSZXNwb25zZShxdWVyeT1zZWxmLnByb21wdCwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZT1zdGFnZTIuZmluYWxfcmVzcG9uc2UsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyZGljdD1hdWRpdF8xLnZlcmRpY3QpCiAgICAgICAgYXVkaXRfMiA9IEF1ZGl0UmVzcG9uc2UocXVlcnk9c2VsZi5wcm9tcHQsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U9c3RhZ2U0LmZpbmFsX3Jlc3BvbnNlKQogICAgICAgIGlmIGF1ZGl0XzIudmVyZGljdC5zdHJpcCgpLnVwcGVyKCkuc3RhcnRzd2l0aCgiUEFTUyIpOgogICAgICAgICAgICBzZWxmLnJlc3BvbnNlID0gc3RhZ2U0LmZpbmFsX3Jlc3BvbnNlOyByZXR1cm4KICAgICAgICBzdGFnZTUgPSBGaW5hbGl6ZVJlc3BvbnNlKAogICAgICAgICAgICBxdWVyeT1zZWxmLnByb21wdCwKICAgICAgICAgICAgaW5pdGlhbF9kcmFmdD1zdGFnZTEucmVzcG9uc2UsCiAgICAgICAgICAgIHJlc3BvbnNlPXN0YWdlNC5maW5hbF9yZXNwb25zZSwKICAgICAgICAgICAgZmlyc3RfdmVyZGljdD1hdWRpdF8xLnZlcmRpY3QsCiAgICAgICAgICAgIHNlY29uZF92ZXJkaWN0PWF1ZGl0XzIudmVyZGljdCkKICAgICAgICBzZWxmLnJlc3BvbnNlID0gc3RhZ2U1LmZpbmFsX3Jlc3BvbnNl)

1@agent(cacheable=False)

2classIFBenchPipeline(BaseModel):

3defexecute(self)->None:

4stage1=GenerateResponse(query=self.prompt)

5stage2=EnsureCorrectResponse(query=self.prompt,

6response=stage1.response)

7audit\_1=AuditResponse(query=self.prompt,

8response=stage2.final\_response)

9ifaudit\_1.verdict.strip().upper().startswith("PASS"):

10self.response=stage2.final\_response;return

11stage4=RepairResponse(query=self.prompt,

12response=stage2.final\_response,

13verdict=audit\_1.verdict)

14audit\_2=AuditResponse(query=self.prompt,

15response=stage4.final\_response)

16ifaudit\_2.verdict.strip().upper().startswith("PASS"):

17self.response=stage4.final\_response;return

18stage5=FinalizeResponse(

19query=self.prompt,

20initial\_draft=stage1.response,

21response=stage4.final\_response,

22first\_verdict=audit\_1.verdict,

23second\_verdict=audit\_2.verdict)

24self.response=stage5.final\_response

The mechanism is the introduction of an explicit, gated audit-and-repair
stage: AuditResponse reads the constraints in the original
prompt and emits a structured verdict over the candidate response;
on a FAIL, RepairResponse rewrites the response in light
of the verdict before a second audit; on a second FAIL,
FinalizeResponse performs a constrained rewrite conditioned on
both the audit history and the original draft.

##### Terminal-Bench 2.0.

We follow the MetaHarness protocol verbatim: the 25-task Stable25
subset (scripts/upstream\_terminus2/\_examples.py) is used as
both the optimisation split and the reporting split. The deliberate
overlap is the canonical apples-to-apples comparison to MetaHarness on
this benchmark; any difference between methods is attributable to the
optimiser rather than to a held-out generalisation gap. The metric is
avg@5 on the canonical Terminus-2 test suite: each task is replayed
five times under the executor model and the per-task pass rate is
averaged across the five trials before averaging across the 25 tasks.

The baseline workflow is the Terminus-2 agent reproduced as a Shepherd
task graph: a single UpstreamTerminus2Pipeline task that
delegates the per-task agent run to harbor\_runner.run\_one\_task,
with seven mutable surfaces of the agent exposed as cacheable
@agent subtasks (TerminusPromptTemplate,
TerminusCompletionChecklist, TerminusAgentConfig,
TerminusVariantAgent, TerminusTimeoutTemplate,
TerminusSummarizationPrompts, TerminusBootstrapContext).
The pipeline reads each subtask’s output, hands the rendered surfaces
to harbor\_runner, and replays harbor’s per-episode logs as
effects on the active scope so Shepherd’s trace bundle picks them up
automatically. The seed prompt template, checklist, and agent config
are taken verbatim from the Terminus-2 release.

The selected CRO workflow leaves the pipeline graph
unchanged from the seed: the seven Terminus-2 surfaces remain the only
mutable subtasks. The proposer’s session-1 failure taxonomy on this
dataset (cbo\_batch/analysis/failure\_taxonomy.md) names five
failure clusters:
_verifier-gated false acceptance_
(representative train ids cancel-async-tasks, regex-log,
query-optimize, password-recovery);
_search without compression_
(gcode-to-text, adaptive-rejection-sampler,
password-recovery, winning-avg-corewars);
_interactive state drift_
(git-multibranch, build-pmars, sanitize-git-repo);
_destructive rewrite without rollback_
(largest-eigenval, adaptive-rejection-sampler,
build-pmars);
and _constraint register drift_
(gcode-to-text, password-recovery, dna-insert,
constraints-scheduling).
The selected candidate’s edits to TerminusCompletionChecklist,
TerminusPromptTemplate, and TerminusBootstrapContext
correspond to those clusters: an explicit grader-facing verification
command before completion, a compact execution ledger that preserves
verified facts and dead ends, and a running checklist of external
state transitions that must be re-probed after irreversible setup.

### F.4 Per-dataset CRO results

For each evaluated dataset we report the same two views as the main paper’s HoVer figure ( [Figures4](https://arxiv.org/html/2605.10913v3#S5.F4 "In Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") and [5](https://arxiv.org/html/2605.10913v3#S5.F5 "Figure 5 ‣ Results. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces")): a Pareto plot of held-out test pass-rate against optimization wall-clock paired with the per-iteration dev-set trajectory, and a separate bar chart of CRO’s subtask-cache reuse per proposer session. Final test scores are loaded directly from each run’s score\_table.csv; per-method wall-clock budgets match [Table4](https://arxiv.org/html/2605.10913v3#S5.T4 "In Setup. ‣ 5.2 Meta-Agent for Meta-Optimization: Counterfactual Replay Optimization (CRO) ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces"). Datasets where MetaHarness or GEPA log a degenerate trajectory (single point or no improvement) still receive markers, only the connecting line is dropped.

##### HoVer.

CRO reaches the highest dev pass-rate (0.7970.797) ahead of MetaHarness (0.7830.783) and well ahead of GEPA, which rejects every proposed edit on this run. The cache-reuse profile is the canonical one (climbing from 7%7\\% on session 1 to ∼\\sim70%70\\% by session 3) shown in the main paper.

![Refer to caption](https://arxiv.org/html/2605.10913v3/fig_hover_main.png)Figure 7: HoVer: held-out test pass-rate vs. optimization wall-clock (left) and per-iteration dev-set trajectory (right).Figure 8: HoVer: subtask cache reuse per CRO proposer session.

##### IFBench.

MetaHarness edges out CRO by 1.01.0 pts on the held-out test split (0.5230.523 vs. 0.5120.512), but CRO reaches that frontier in 8282 minutes against MetaHarness’s 126126. Cache reuse climbs from 0%0\\% on the cold first session to ∼\\sim50%50\\% by session 5.

![Refer to caption](https://arxiv.org/html/2605.10913v3/fig_ifbench_main.png)Figure 9: IFBench: test pass-rate vs. wall-clock and dev-set trajectory.Figure 10: IFBench: subtask cache reuse per CRO proposer session.

##### LiveCodeBench.

CRO achieves 0.5100.510 on the held-out test split, +11+11 pts over MetaHarness (0.4000.400) and +2.3+2.3 pts over GEPA (0.4870.487), at roughly half MetaHarness’s wall-clock. Both CRO and GEPA produce non-trivial dev trajectories on this benchmark.

![Refer to caption](https://arxiv.org/html/2605.10913v3/x1.png)Figure 11: LiveCodeBench: test pass-rate vs. wall-clock and dev-set trajectory.Figure 12: LiveCodeBench: subtask cache reuse per CRO proposer session.

##### MATH (Level 5).

On the hardest split of MATH, CRO matches MetaHarness’s dev pass-rate (0.800.80) while taking ∼\\sim4242 wall-clock minutes against MetaHarness’s ∼\\sim100100. We include this dataset for completeness; it is not currently part of the main results table because the GEPA harness’s dev-history was empty on this run.

![Refer to caption](https://arxiv.org/html/2605.10913v3/fig_math_l5_main.png)Figure 13: MATH (Level 5): test pass-rate vs. wall-clock and dev-set trajectory.Figure 14: MATH (Level 5): subtask cache reuse per CRO proposer session.

##### Terminal-Bench 2.0.

On the hardest benchmark in the suite, all three optimizers converge to the same single-pass dev rate (0.400.40) but only CRO’s candidate generalizes to 0.3520.352 avg@5 on the held-out split (vs. 0.3120.312 for MetaHarness, GEPA, and the baseline). MetaHarness and GEPA do not log per-iteration dev evaluations on this run, so only CRO’s trajectory is drawn. Cache reuse on TB2 saturates near 100%100\\% within three proposer sessions because each candidate’s evaluation set is only 2525 tasks.

![Refer to caption](https://arxiv.org/html/2605.10913v3/fig_terminalbench_2.0_main.png)Figure 15: Terminal-Bench 2.0: test pass-rate vs. wall-clock and dev-set trajectory.Figure 16: Terminal-Bench 2.0: subtask cache reuse per CRO proposer session.

### F.5 Case Studies: Interpretable Counterfactual Workflow Edits on HoVer

We summarize three counterfactual workflow edits discovered by CRO on HoVer.
The metric is dev-set gold-document coverage over 300 examples. The baseline
retrieval workflow scored 0.4470.447 dev accuracy (134/300134/300).

#### F.5.1 Case 1: The Workflow Was Accidentally Candidate-Closed

##### Diagnosis.

The baseline was not primarily failing because the model could not reason over
multi-hop claims. Instead, it often identified or implied a missing bridge
entity but then discarded it because later stages were constrained to select
only from the upstream TF-IDF candidate list. This produced systematic
“missing requirement” failures, e.g. cases where the gold evidence contained
pages such as Billy Idol, Collide (film), or
Saul Metzstein that were not preserved by the candidate-only selector.

##### How the LLM arrived at the diagnosis.

The CRO proposer inspected baseline traces and observed that summaries often
contained enough semantic evidence to name a missing bridge page, while the
workflow contract still required “exact candidate titles only.” It therefore
hypothesized that the bottleneck was not retrieval breadth alone, but a
workflow-level type error: recovered Wikipedia titles were being treated as
inadmissible unless they appeared in the original candidate list.

##### Generated patch.

CRO added a bridge-title recovery stage and relaxed the selector so it could
retain grounded Wikipedia titles recovered during the workflow:

```
bridge_titles = BridgeTitleResolver(
      claim=claim,
      retrieved_titles=first_retrieved,
      evidence_summary=first_summary,
  ).titles

  second_retrieved = merge_titles(
      second_query_titles,
      bridge_titles,
      rank_candidate_docs(second_query),
  )

  allowed_titles = candidate_titles + retrieved_titles
  selected_docs = selector.select(claim, allowed_titles, summaries)

```

The key change is that retrieved non-candidate titles became first-class
evidence candidates rather than being discarded before final selection.

##### Lift.

This patch raised dev coverage from 0.4470.447 to 0.6930.693
(134/300134/300 to 208/300208/300), a +24.7+24.7 percentage point improvement.

#### F.5.2 Case 2: The Workflow Could Diagnose Its Own Missing Evidence

##### Diagnosis.

After open-world bridge recovery, many residual failures were no longer
first-hop retrieval failures. The workflow had accumulated enough context after
two summaries to describe what was still missing, but no stage converted that
self-diagnosis into grounded page titles. Examples included missing evidence
pages such as Huainan, Howea, Bulbophyllum, and
Saul Metzstein.

##### How the LLM arrived at the diagnosis.

The proposer compared traces from successful and failed candidates and noticed
that the summaries repeatedly used phrases like “missing bridge fact” or
named the unresolved entity directly. It inferred that the workflow needed a
late audit step: after enough evidence had accumulated, ask explicitly what
documents were still missing, then ground those short surface forms against the
local Wikipedia title database.

##### Generated patch.

CRO inserted a missing-evidence resolver between the second summary and the
third retrieval hop:

```
gap_titles = MissingEvidenceResolver(
      claim=claim,
      retrieved_titles=merge_titles(first_retrieved, second_retrieved),
      evidence_summary=first_summary + "\n\n" + second_summary,
  ).titles

  third_retrieved = merge_titles(
      gap_titles,
      third_query_titles,
      rank_candidate_docs(third_query),
  )

```

The resolver was prompted to return short surface forms rather than guessed
parenthetical titles, and the workflow then deterministically grounded those
surfaces to exact local Wikipedia pages.

##### Lift.

Relative to the previous bridge-recovery frontier, this patch raised dev
coverage from 0.7370.737 to 0.7870.787 (221/300221/300 to 236/300236/300), a +5.0%+5.0\\%
improvement. Relative to the original baseline, the resulting
workflow was +34.0%+34.0\\% higher.

#### F.5.3 Case 3: Recovered Bridge Pages Needed to Become New Evidence Sources

##### Diagnosis.

The most surprising discovery was that the all-targeted-pass candidate was not
the best dev candidate. A candidate that solved all targeted training examples
scored 0.7870.787 on dev, but CRO found a more general mechanism: recovered bridge
pages should themselves be re-read as evidence sources. In one persistent
failure, the workflow recovered Volkswagen CrossBlue but still failed
to recover the second-order comparison page Honda Pilot.

##### How the LLM arrived at the diagnosis.

The proposer inspected the trace and saw that the workflow treated recovered
bridge pages as endpoints. It also observed that earlier recursive bridge
attempts failed when they replaced the late missing-evidence resolver. The
successful hypothesis was therefore compositional: keep the late resolver, but
add recursive reading over relation-bearing sentences from newly recovered
pages.

##### Generated patch.

CRO added relation-cue filtering and recursive bridge expansion over recovered
titles:

```
relation_cues = [\
      "competed", "introduced", "based on", "inspired by",\
      "starred", "founded", "won", "record"\
  ]

  def relation_sentences(claim, title, snippet):
      return [\
          sent for sent in split_sentences(snippet)\
          if has_relation_cue(sent, relation_cues)\
          or token_overlap(sent, claim + " " + title) >= 4\
      ]

  bridge_expansion = collect_recursive_bridges(
      claim=claim,
      seed_titles=merge_titles(bridge_titles, snippet_bridges),
      known_titles=first_retrieved,
      max_depth=2,
  )

  retrieved = merge_titles(
      first_retrieved,
      bridge_titles,
      bridge_expansion,
      second_retrieved,
      gap_titles,
      third_retrieved,
  )

```

This changed the workflow from “find a bridge page” to “find a bridge page
and inspect it for the next bridge.”

##### Lift.

This patch raised dev coverage from 0.7870.787 to 0.7970.797
(236/300236/300 to 239/300239/300), a further +1.0%+1.0\\% improvement and
+35.0%+35.0\\% over baseline. Notably, its targeted-train score was
lower than the previous candidate (0.8330.833 vs. 1.0001.000), but its aggregate dev
score was higher. CRO selected a
more general workflow mechanism rather than the edit that best fit the targeted
training slice.

### F.6 Meta-Agent Guided Tree-RL: full training configuration

Algorithm 2 Meta-Agent Guided Tree-RL

1:


Policy πθ\\pi\_{\\theta}; meta-agent PP; task pool 𝒟\\mathcal{D}; group size GG; branch factor KK; iterations TT

2:fort←1t\\leftarrow 1 to TTdo

3:


Sample prompt batch {qb}b=1B∼𝒟\\{q\_{b}\\}\_{b=1}^{B}\\sim\\mathcal{D}.

4:(A) Root Rollouts:

5:for each qbq\_{b} in parallel, each g∈{1,…,G}g\\in\\{1,\\ldots,G\\} in parallel do

6:


    Initialize a fresh sandbox σb,g\\sigma\_{b,g}.

7:τb,groot=(o0,a1,o1,…,aTb,g,oTb,g)∼πθ(⋅∣qb,σb,g)\\tau^{\\text{root}}\_{b,g}=(o\_{0},a\_{1},o\_{1},\\ldots,a\_{T\_{b,g}},o\_{T\_{b,g}})\\sim\\pi\_{\\theta}(\\cdot\\mid q\_{b},\\sigma\_{b,g})

8:Rb,groot←Grade​(τb,groot)R^{\\text{root}}\_{b,g}\\leftarrow\\textsc{Grade}(\\tau^{\\text{root}}\_{b,g})

9:endfor

10:(B) Meta-Agent Branching:

11:for each root τb,groot\\tau^{\\text{root}}\_{b,g} in parallel do

12:t∗←P⁡(τb,groot)t^{\*}\\leftarrow P(\\tau^{\\text{root}}\_{b,g})⊳\\triangleright meta-agent picks fork step t∗t^{\*}

13:σ∗←Revert​(τb,groot,t∗)\\sigma^{\*}\\leftarrow\\textsc{Revert}(\\tau^{\\text{root}}\_{b,g},t^{\*})⊳\\triangleright env state rolled back to right before step t∗t^{\*}

14:τb,gpre←(o0,a1,o1,…,ot∗−1)\\tau^{\\text{pre}}\_{b,g}\\leftarrow(o\_{0},a\_{1},o\_{1},\\dots,o\_{t^{\*}-1})⊳\\triangleright shared trajectory prefix for all KK branches

15:fork∈{0,…,K−1}k\\in\\{0,\\ldots,K{-}1\\} in parallel do

16:σk←Fork​(σ∗)\\sigma\_{k}\\leftarrow\\textsc{Fork}(\\sigma^{\*})⊳\\triangleright isolated env per branch

17:τb,g(k)∼πθ(⋅∣qb,σk,τb,gpre)\\tau^{(k)}\_{b,g}\\sim\\pi\_{\\theta}(\\cdot\\mid q\_{b},\\sigma\_{k},\\tau^{\\text{pre}}\_{b,g})⊳\\trianglerightπθ\\pi\_{\\theta} rollout from t∗t^{\*} in σk\\sigma\_{k}

18:Rb,g(k)←Grade​(τb,g(k))R^{(k)}\_{b,g}\\leftarrow\\textsc{Grade}(\\tau^{(k)}\_{b,g})

19:endfor

20:endfor

21:(C) Credit Assignment:

22: _Inter-root advantage_ for prefix actions j<t∗j<t^{\*} (shared by all branches of root gg):

23:Ab,ginter←Rb,groot−1G​∑g′=1GRb,g′rootA^{\\text{inter}}\_{b,g}\\leftarrow R^{\\text{root}}\_{b,g}-\\tfrac{1}{G}\\sum\_{g^{\\prime}=1}^{G}R^{\\text{root}}\_{b,g^{\\prime}}⊳\\trianglerightGG-root group baseline

24: _Intra-tree advantage_ for suffix actions j≥t∗j\\geq t^{\*} on tree member k∈{root, 0,…,K−1}k\\in\\{\\text{root},\\,0,\\ldots,K{-}1\\}:

25:Ab,gintra,(k)←Rb,g(k)−1K+1​(Rb,groot+∑k′=0K−1Rb,g(k′))A^{\\text{intra},(k)}\_{b,g}\\leftarrow R^{(k)}\_{b,g}-\\tfrac{1}{K+1}\\bigl(R^{\\text{root}}\_{b,g}+\\sum\_{k^{\\prime}=0}^{K-1}R^{(k^{\\prime})}\_{b,g}\\bigr)⊳\\triangleright(K+1)(K{+}1)-sibling baseline; Rb,g(root)≡Rb,grootR^{(\\text{root})}\_{b,g}\\!\\equiv\\!R^{\\text{root}}\_{b,g}

26:


Update πθ\\pi\_{\\theta} via clipped GRPO with {Aj}j\\{A\_{j}\\}\_{j} pooled across all qbq\_{b} in the batch.

27:endfor

28:return trained policy πθ\\pi\_{\\theta}

Training is performed on Modal-managed 8×\\timesH100 nodes using SkyRL’s GRPO recipe with FSDP2, gradient checkpointing, and torch.compile on the policy. Each training step uses a batch of 16 prompts with 8 samples per prompt for 128 rollouts per step. Each rollout caps at 8 turns, 1024 maximum generated tokens per turn, and 16,384 maximum input length; trajectories that would exceed these caps are filtered via SkyRL’s overlong-filtering mode. The optimizer is Adam with learning rate 5×10−75\\times 10^{-7}, weight decay 0.01, and gradient clipping at max-norm 0.1, with a 20-step linear warm-up followed by constant schedule for ten epochs over the training set (1,120 total steps). KL loss is disabled; advantages are GRPO-normalized and standardized per group. Inference uses vLLM with four engines at tensor-parallel size 2, weight synchronization via NCCL, and gpu\_memory\_utilization=0.80. Checkpoints and validation evaluations are taken every 10 training steps. The canonical launch script is experiments/a4-reversible-rl/modal\_smoke\_train.py in the released codebase.

Figure 17: GRPO group composition over training (rows: base model; columns: setting). Tree-GRPO keeps the _informative_ (variance, green) fraction higher than Flat GRPO throughout, producing more gradient signal at matched compute. Flat GRPO’s all-one share grows with training as easy tasks saturate, eating the variance band. Purple double-headed arrows annotate the variance share at steps 20/90/160.![Refer to caption](https://arxiv.org/html/2605.10913v3/ood_curves.png)Figure 18: Held-out Endless Terminals evaluation, sampled every 10 training steps (raw, unsmoothed). Open circles plot the actual measured val/endless\_mean\_reward; solid line is a noise-preserving fit. Tree-GRPO climbs to and stabilises at a higher held-out reward than Flat GRPO on both base models. Final-policy Terminal-Bench 2.0 transfer is reported separately in [Table5](https://arxiv.org/html/2605.10913v3#S5.T5 "In Results. ‣ 5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces").

### F.7 Meta-Agent Guided Tree-RL: meta-agent qualitative examples

![Refer to caption](https://arxiv.org/html/2605.10913v3/training_curves.png)Figure 19: Train raw reward (mean over G=8G{=}8 roots) for both base models, panels are Qwen3.5-35B-A3B (left) and Nemotron-3-Super-120B-A12B (right). Tree-GRPO (K=4K{=}4, teal) reaches higher reward than Flat GRPO (red) at every rollout step. Faint dots are observed steps from the flat-baseline run; smooth lines are denoised trajectories.

The tree-search rollouts in [Section5.3](https://arxiv.org/html/2605.10913v3#S5.SS3 "5.3 Meta-Agent for Training: Meta-Agent-Guided Tree-RL ‣ 5 Experiments ‣ Shepherd: Enabling Programmable Meta-Agents via Reversible Agentic Execution Traces") hand the fork choice to a stronger model (claude-opus-4-7). Given the inner agent’s full transcript and final reward, it returns a turn t∗∈\[1,T−2\]t^{\*}\\in\[1,T{-}2\] to fork at and the bash command it would run there. We re-render the command through the policy’s renderer, so the tokens match what the policy itself would emit, and inject it as one of the KK branches at t∗t^{\*}.

This subsection walks through three trajectory shapes that show the meta-agent’s behaviour: an early single-cause failure, an ambiguous failure with multiple plausible branches, and a long trajectory with a deeply-nested mistake. The trajectories are short enough to read end-to-end and were hand-constructed so a careful reader has a strong prior over the “right” branch turn. We check whether the meta-agent’s pick matches that prior, whether its emitted command actually addresses the failure, and whether it stays well-behaved across trajectory lengths. (Three further cases in the released probe set, omitted for space, cover clean-success no-ops, late-turn range clamping, and a redundant tool-replacement variant of Case 1; results match the patterns shown here.)

##### Setup.

For each case, we render the inner-agent trajectory (system prompt, user task, and the alternating assistant tool calls and tool results) as a numbered turn list and send it to the meta-agent along with the final reward. The meta-agent returns a JSON object {branch\_turn, tool\_call, reason}, where tool\_call.name = "bash" and tool\_call.arguments.command is the bash payload.

Case 1: Early mistake (T=4, reward=0.00)Task: Install the requests package and verify it imports.

Trajectory:•Turn 1:pip install request(typo: missing the s)→\\rightarrow “Successfully installed request-2025.10.0”•Turn 2:python -c "import requests"→\\rightarrowModuleNotFoundError: No module named requests•Turn 3:python3 -c "import requests"→\\rightarrow same error.•Turn 4: prints sys.path, gives up.

Meta-agent decision (obvious turn: 1)branch\_turn:1  ✓ (matches obvious)

meta-agent action:pip install requests && python -c "import requests; print(requests.\_\_version\_\_)"

reason: “Turn 1 installed the wrong package ‘request’ instead of ‘requests’; fixing the typo here resolves the entire failure.”

Figure 20: Early-mistake case. The wrong package name on turn 1 dooms the rest of the trajectory. The meta-agent picks turn 1 and writes a one-liner that installs the right package and verifies the import in the same command.

Case 2: Ambiguous failure (T=5, reward=0.30)Task: Serve the Flask app at /app/app.py on port 5000.

Trajectory:•Turn 1: read the app source.•Turn 2:pip install flask (no python-version check).•Turn 3:python app.py & (background launch, no nohup).•Turn 4:curl localhost:5000/→\\rightarrowConnection refused.•Turn 5:ps aux reveals the process is <defunct>.

Meta-agent decision (multiple plausible turns)branch\_turn: 3

meta-agent action:cd /app && nohup python app.py --host=0.0.0.0 > /tmp/flask.log 2>&1 &

reason: “The app.py has no \_\_main\_\_ block, so running it directly exits; need to bind to 0.0.0.0 with nohup to keep it alive.”

Figure 21: Ambiguous case. At least three turns offer plausible branches (skip-the-version-check, pip-vs-pip3, the background launch). The meta-agent traces the symptom at turn 5 (<defunct>) back to the launch on turn 3 and writes a concrete replacement: nohup with a log redirect and an explicit host binding. Demanding a runnable command pushes the meta-agent past hand-wavy diagnoses to a specific hypothesis we can run.

Case 3: Long trajectory, deep mid-mistake (T=9, reward=0.20)Task: Fix the failing test in /app/test\_utils.py.

Trajectory:•Turns 1–3: explore, read utils.py (case mismatch in normalize), run pytest, see the failing assertion.•Turn 4: edits _the test file_ with a fragile sed substitution (wrong file—fix belongs in utils.py).•Turns 5–7: doom-spiral—broken sed quotes, more sed patches, file syntax errors.•Turns 8–9: attempts git checkout to revert, but repo is not git-tracked.

Meta-agent decision (obvious turn: 4)branch\_turn:4  ✓ (matches obvious)

meta-agent action (multi-line heredoc):

cat > /app/utils.py <<’EOF’

def normalize(s):

return s.strip()

EOF

reason: “Fix the implementation rather than the test, since the task is to fix the failing test by correcting the underlying code.”

Figure 22: Long-trajectory case. A 9-turn rollout with a wrong-file edit at turn 4 cascades into 5 turns of recovery thrash. The meta-agent picks turn 4 and writes a multi-line heredoc that rewrites utils.py (the file the agent should have edited) cleanly. Uniform sampling has no way to prefer turn 4 over the five recovery turns; only the meta-agent’s pick concentrates the branch budget where it matters.

##### Headline.

The meta-agent’s choices share two patterns uniform sampling cannot reproduce. First, it prefers the earliest turn at which a downstream wrong choice was made, even when that turn was not itself a syntactically obvious failure (Case 1: package-name typo; Case 3: target-file choice). Second, when the trajectory shows symptom-then-cause dynamics (Case 2: a defunct process surfaces at turn 5, traceable to a launch issue at turn 3), it follows the causal chain rather than picking the symptom turn. Demanding an executable bash command, not just a turn index, forces the meta-agent past hand-wavy diagnoses (Case 2: a specific nohup invocation, not “use proper launch flags”), and the command round-trips through the same renderer the policy uses, so the injected branch’s tokens are indistinguishable from the policy’s own emission at parse time.