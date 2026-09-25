Title:

Content selection saved. Describe the issue below:

Description:

![](https://arxiv.org/static/base/1.0.1/images/icons/smileybones-small.svg)arXiv is now an independent nonprofit! [Learn more](https://info.arxiv.org/about) ×

[License: CC BY 4.0](https://info.arxiv.org/help/license/index.html#licenses-available)

arXiv:2508.00031v3 \[cs.SE\] 24 Jul 2026

# Git Context Controller: Manage the Context of Agents by Agentic Git

Junde Wu
Affiliation: University of Oxford
Correspondence to: [jundewu@ieee.org](mailto:jundewu@ieee.org)Minhao Hu
Affiliation: University of Oxford
Jiayuan Zhu
Affiliation: University of Oxford
Jiazhen Pan
Affiliation: Technical University of Munich
Yuyuan Liu
Affiliation: University of Oxford
Min Xu
Affiliation: Carnegie Mellon University
Yueming Jin
Affiliation: National University of Singapore
Correspondence to: [ymjin@nus.edu.sg](mailto:ymjin@nus.edu.sg)

###### Abstract

Large language model (LLM) agents have demonstrated strong capabilities in long-horizon tasks by interleaving reasoning with tool use. However, as these agents scale to complex workflows such as software engineering and open-ended research, context management becomes a fundamental bottleneck: interaction histories grow unbounded, become costly to maintain, and are difficult to reuse across sessions and agents.
We introduce Git-Context-Controller (GCC), a structured context management framework inspired by software version control systems. GCC elevates agent context from a transient token stream to a persistent, navigable memory workspace with explicit operations—COMMIT, BRANCH, MERGE, and CONTEXT, that enable milestone-based checkpointing, isolated exploration of alternative reasoning paths, and hierarchical retrieval of historical context. By organizing agent memory as a versioned file system, GCC allows agents to manage long-term goals, recover and transfer reasoning across sessions, and coordinate multi-trajectory problem solving in a principled manner.
Empirically, agents equipped with GCC achieve state-of-the-art performance on both SWE-Bench and BrowseComp benchmarks. On SWE-Bench Verified, GCC improves task resolution by over 13% relative to strong long-context baselines and outperforms 26 existing open and commercial systems, reaching over 80% success rate. https://github.com/ImprintLab/git-context-controller.

## 1 Introduction

LLM-based agents have been capable of interleaving internal chain-of-thought reasoning with external tool calls ( [Wu et al., 2025](https://arxiv.org/html/2508.00031v3#bib.bib30 "")). Such architecture has shown strong performance in decision-making tasks, web interaction, and question answering benchmarks, providing a foundation for more sophisticated agents. In software engineering domains, frameworks like SWE-Agent ( [Yang et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib25 "")) used similar paradigm by integrating code generation, execution, and test loops to implement iterative software development (e.g., writing, compiling, debugging). Following this idea, production-grade tools such as Anthropic’s Claude Code and Google’s Gemini CLI bring LLM-based agents to the command line, enabling code completion, debugging, and search within a single session.

However, as LLM agents are increasingly deployed for long-horizon reasoning in complex, large-scale workflows, context management emerges as a fundamental bottleneck. A common issue observed in coding agents is that sessions gradually forget previous context and become increasingly costly as the context grows longer. Starting a new session typically erases the agent’s memory of prior goals, user preferences, and task-specific instructions. As a result, users are forced to repeatedly provide the same context in every new session.
Current solutions rely on several common strategies. A straightforward approach is to truncate older context once the token limit is reached. This risks discarding important historical details—especially problematic when the agent needs to revisit earlier decisions or maintain consistency across multi-step plans. A more balanced approach compresses earlier reasoning into high-level summaries or to-do lists, as seen in systems such as Claude Code and Gemini CLI. These systems use summary-based anchors for future reasoning and persist abstracted task state (e.g., via agent.md file). However, relying on simple compression removes fine-grained details and weakens the agent’s ability to ground its actions in specific prior reasoning. A common and intuitive observation is that agents become “dumber” each time their context is compressed.
In conclusion, context is currently either too verbose to be reusable or too abstract to support concrete continuation and extension.

![Refer to caption](https://arxiv.org/html/2508.00031v3/performance.png)Figure 1: Results on BrowseComp-Plus and SWE-Bench Verified comparing baseline model performance with improvements achieved by equipping models with GCC.

These limitations highlight the need for a more principled and structured approach to how AI agents log, manage, and retrieve context. Our key insight is that the challenges faced by long-horizon agents closely mirror those encountered by software engineers managing complex, evolving codebases. Inspired by the success of Git in software version control, we propose Git-Context-Controller (GCC), an agentic context control mechanism that elevates context management to an explicit abstraction layer. It organizes contextual information as a structured, version-controlled file system, and introduces a set of specialized commands designed to support logging, managing, and retrieving context across agentic workflows.

We implement this design through a standalone Git-Context-Controller, which structures agent context as a version-controlled file system under a unified .GCC/ directory. Each project maintains a global roadmap (main.md), while each branch contains its own commit summaries, execution traces, and structured metadata. Agents interact with this controller through a small set of core commands: COMMIT to checkpoint meaningful progress, BRANCH to explore alternate strategies, MERGE to synthesize divergent reasoning paths, and CONTEXT to retrieve historical information at varying resolutions. These commands and data structures are provided to the agent and autonomously invoked to support long-horizon reasoning.

Such a design provides several complementary benefits. It enables multi-level context retrieval, allowing agents to access information at different levels of abstraction, ranging from high-level project plans to fine-grained OTA (Observation–Thought–Action) traces. Agents can flexibly navigate across these layers, starting from a coarse summary and drilling down into detailed execution histories whenever necessary, which makes past reasoning easy to trace and reuse. At the same time, the branching mechanism offers isolated workspaces for exploration, where agents can freely test new ideas or iterate without interfering with the main reasoning trajectory. This preserves focus while still allowing side explorations to be revisited or merged back into the primary workflow. Moreover, the framework naturally supports cross-agent and cross-session continuity: a new agent does not need to be re-instructed from scratch, and even an agent running on a different LLM or machine can seamlessly resume from the exact state left by its predecessor. This design facilitates smooth distribution and handover of agent-generated code and reasoning artifacts, in a manner analogous to how human developers collaborate through Git repositories.

Empirically, agents equipped with GCC achieve state-of-the-art (SOTA) performance on SWE-Bench and BrowseComp, two of the most widely used benchmarks for long-horizon coding and web-browsing reasoning. As shown in Fig. [1](https://arxiv.org/html/2508.00031v3#S1.F1 "Figure 1 ‣ 1 Introduction ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"), on SWE-Bench, simply integrating GCC boosts models such as GPT-4.1 and DeepSeek by over 24%24\\%. Claude-4-Sonnet equipped with GCC further improves by 13.6%13.6\\%, reaching 80.2%80.2\\%, which constitutes the current state-of-the-art result on SWE-Bench. On BrowseComp-Plus, GPT-5 with GCC achieves 83.4%83.4\\%, also establishing a new state-of-the-art performance on this benchmark.

In summary, our contributions are:

- •


We propose a novel view of agent memory as a dynamic, navigable codebase, complete with log files, branching histories, and metadata. This reframes context not just as passive history but as an evolving, queryable interface that supports both recall and structural reasoning.

- •


We introduce GCC, a structured context management framework for LLM agents that integrates version control semantics—such as COMMIT, BRANCH, and MERGE into the reasoning loop. GCC organizes agent memory into persistent, interpretable artifacts that support long-horizon workflows, architectural modularity, and reproducibility.

- •


When equipped with GCC, LLM-based agents achieve state-of-the-art empirical performance on both SWE-Bench and BrowseComp. In particular, on SWE-Bench, our method outperforms 26 existing systems (including both open-source and commercial models), achieving over 80% task resolution rate.


![Refer to caption](https://arxiv.org/html/2508.00031v3/main2.png)Figure 2: Illustration of GCC in action across two workflows: web-search reasoning and software debugging—showing how agents branch, explore, and merge structured context during long-horizon tasks.

## 2 Method

We proposed Git-Context-Controller (GCC) as an abstraction layer for agent memory, consisting of a structured file system paired with a series of callable commands that agents use to externalize, organize, and retrieve their reasoning, as shown in Fig. [2](https://arxiv.org/html/2508.00031v3#S1.F2 "Figure 2 ‣ 1 Introduction ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"). Inspired by version control systems like Git, GCC transforms the agent’s ephemeral context into a persistent and navigable workspace. The core of GCC is a directory-based data structure that systematically organizes all historical context (GCC File System), together with a set of commands that enable agents to interact with and manipulate this structure (GCC Commands). Concretely, agents communicate with the controller via commands such as COMMIT, BRANCH, MERGE, and CONTEXT, which operate over a hierarchical workspace rooted at .GCC/. This workspace contains global planning artifacts (main.md), branch-specific execution traces (log.md), milestone-level summaries (commit.md), and structured metadata (metadata.yaml) that record architectural decisions and project states.
In the following, we provide a detailed introduction to the structured file system and commands of GCC.

### 2.1 GCC File System

GCC organizes agent context into a structured directory rooted at .GCC/, reflecting a three-tiered hierarchy of reasoning: high-level planning, commit-level summaries, and fine-grained execution traces. Each file in this hierarchy plays a distinct role in tracking the agent’s thoughts, progress, and architectural context. All files are plain-text and continuously updated through agent-invoked commands.

The overall layout of the file system is structured as following:

[⬇](data:text/plain;base64,LkdDQy8KfC0tIG1haW4ubWQgICAgICAgICAgICMgYSBnbG9iYWwgcm9hZG1hcCBzdW1tYXJpemluZyBwcm9qZWN0IGhpZ2gtbGV2ZWwgaW50ZW50LCBtaWxlc3RvbmVzLCBhbmQgc2hhcmVkIHBsYW5uaW5nIHN0YXRlIGFjcm9zcyBhbGwgYnJhbmNoZXMKfC0tIGJyYW5jaGVzLwogICAgfC0tIDxicmFuY2gtbmFtZT4vCiAgICAgICAgfC0tIGNvbW1pdC5tZCAgICAgIyByZWNvcmRpbmcgdGhlIHByb2dyZXNzIG9mIGVhY2ggY29tbWl0CiAgICAgICAgfC0tIGxvZy5tZCAgICAgICAgIyBhIGRldGFpbGVkIGV4ZWN1dGlvbiB0cmFjZSBvZiBPVEEgY3ljbGVzLCBjb250aW51b3VzbHkgcmVjb3JkZWQgZHVyaW5nIHRoZSBhZ2VudCByZWFzb25pbmcgbG9vcAogICAgICAgIHwtLSBtZXRhZGF0YS55YW1sICMgYSBzdHJ1Y3R1cmVkIGZpbGUgc3RvcmluZyBicmFuY2gtc3BlY2lmaWMgYXJjaGl0ZWN0dXJhbCBhbmQgY29udGV4dHVhbCBtZXRhZGF0YSAoZmlsZSBzdHJ1Y3R1cmVzLCBkZXBlbmRlbmNpZXMsIGNvbmZpZ3MpCiAgICB8LS0gPGFub3RoZXItYnJhbmNoPi8uLi4=)

.GCC/

\|--main.md#aglobalroadmapsummarizingprojecthigh-levelintent,milestones,andsharedplanningstateacrossallbranches

\|--branches/

\|--<branch-name>/

\|--commit.md#recordingtheprogressofeachcommit

\|--log.md#adetailedexecutiontraceofOTAcycles,continuouslyrecordedduringtheagentreasoningloop

\|--metadata.yaml#astructuredfilestoringbranch-specificarchitecturalandcontextualmetadata(filestructures,dependencies,configs)

\|--<another-branch>/...

In which, main.md sits at the root of the .GCC/ directory and stores the global project roadmap. It records high-level project goals, key milestones, and the to-do list for development. This file is shared across all branches and serves as the canonical source of the project’s overall intent. The agent is prompted to initialize this file with the project goal and initial to-do list at the beginning of the project. It may be revised later when a conclusion is reached, a major outcome is completed, or significant changes to the roadmap occur. Such updates are optionally triggered after COMMIT, MERGE, or BRANCH by the agents.

Each branch has its own directory under branches/, which contains three primary files. The first is commit.md, a structured summary log that captures the evolving progress of the branch. Each time the agent calls COMMIT, the controller appends a new entry to commit.md following a standardized template consisting of three blocks: (1) Branch Purpose – a reiteration of the overall project goal and the specific rationale for creating this branch (as defined at BRANCH); (2) Previous Progress Summary – a coarse-grained summary of the branch’s history, generated by giving the last commit’s Previous Progress Summary and This Commit’s Contribution; and (3) This Commit’s Contribution – a detailed narrative of what was achieved in the current commit.

The second file is log.md, which stores the fine-grained reasoning trace of the agent’s execution. This includes every OTA (Observation–Thought–Action) cycle that occurs between commits. Each reasoning step is appended to log.md in real-time, forming a continuous trace of low-level decision-making. Upon committing, the relevant slice of this log is referenced to construct the summary in commit.md.

Finally, metadata.yaml, captures structured meta-level information. It includes details such as the current file structure of the project, per-file responsibilities, environment configurations, dependency graphs, or module interfaces. By default, commonly useful segments like file\_structure and env\_config are defined, while additional entries can be manually added by human users as needed. This file is updated on demand—typically during or after a COMMIT, when structural or configuration changes are detected.
Together, these files provide a layered, interpretable view of agent reasoning from abstract goals to step-level execution.

### 2.2 GCC Commands

The Git-Context-Controller exposes a set of agent-callable commands that allow reasoning models to manage, structure, and retrieve context in a durable and inspectable way. These commands include COMMIT, BRANCH, MERGE, and CONTEXT.
These commands’ function and usage are given to the agents in the system prompts, then the agents are encouraged to use them when needed. For example, when the agent reflects on its reasoning and detects a shift in direction, it would evaluate whether a BRANCH is warranted. When a reasoning subgoal is achieved, it is encouraged to call COMMIT and summarize the step. Below, we detail the purpose, usage, and implementation of each command.

#### COMMIT <summary>

The COMMIT command is called when the agent identifies that its recent reasoning has resulted in a coherent and meaningful milestone, such as implementing a function, completing a test, or resolving a subgoal. Once invoked, the controller performs a structured update across multiple files within the current branch directory.

Specifically, let the agent’s recent execution trace be denoted as ℋt\\mathcal{H}\_{t}. The COMMIT operation transforms this transient reasoning history into a persistent memory record

|     |     |     |
| --- | --- | --- |
|  | ℳt=(It,St,Dt)=COMMIT​(ℋt,St−1),\\mathcal{M}\_{t}=(I\_{t},S\_{t},D\_{t})=\\texttt{COMMIT}(\\mathcal{H}\_{t},S\_{t-1}), |  |

where ItI\_{t} represents the branch intent, StS\_{t} is a regenerated coarse-grained summary combining the previous commit summary St−1S\_{t-1} with the newly completed work, and DtD\_{t} is a detailed description of the specific progress achieved since the last commit. When the global project plan evolves, COMMIT further induces an update of the global roadmap main.md. Finally, the memory update and code changes are consolidated into a versioned state using a Git commit with message StS\_{t}. Through this transformation, a loose sequence of observation–thought–action steps is converted into a coherent and retrievable memory unit that supports long-horizon progress tracking and rollback.

#### BRANCH <name>

The BRANCH command is called when the agent detects a meaningful divergence in direction, such as exploring an alternative algorithm, implementing a parallel module, or testing a new design hypothesis.

Let the current memory state be represented by the latest committed record ℳt−1\\mathcal{M}\_{t-1}. When the command BRANCH <name> is issued, a new branch-specific execution state is created as:
ℬt(n​a​m​e)=BRANCH​(ℳt−1)\\mathcal{B}\_{t}^{(name)}=\\texttt{BRANCH}(\\mathcal{M}\_{t-1}),
which initializes an empty observation–thought–action trace ℋt(n​a​m​e)\\mathcal{H}\_{t}^{(name)} stored in log.md, together with a new structured memory file commit.md that records the intent and motivation of the branch. This transformation establishes an isolated reasoning trajectory in which alternative hypotheses or experimental workflows can be explored independently from the mainline history, while remaining fully inspectable and reversible through the same commit-based memory mechanism.

#### MERGE <branch>:

The MERGE command is used when a branch has reached a conclusion and its results are ready to be integrated into the main plan. Before merging, the controller automatically calls CONTEXT on the target branch to surface its historical summaries and planning rationale.

Let the current branch memory state be ℳt=(It,St,Dt,ℋt)\\mathcal{M}\_{t}=(I\_{t},S\_{t},D\_{t},\\mathcal{H}\_{t}) and the target branch memory state be ℳt(b)=(It(b),St(b),Dt(b),ℋt(b))\\mathcal{M}\_{t}^{(b)}=(I\_{t}^{(b)},S\_{t}^{(b)},D\_{t}^{(b)},\\mathcal{H}\_{t}^{(b)}). When the command MERGE is issued, a new unified memory state is produced as
ℳt+1=MERGE​(ℳt,ℳt(b)),\\mathcal{M}\_{t+1}=\\texttt{MERGE}(\\mathcal{M}\_{t},\\mathcal{M}\_{t}^{(b)}),
where the updated memory record stored in commit.md is defined by

|     |     |     |
| --- | --- | --- |
|  | (St+1,Dt+1)=ℱmerge​((St,Dt),(St(b),Dt(b))).(S\_{t+1},D\_{t+1})=\\mathcal{F}\_{\\text{merge}}\\big((S\_{t},D\_{t}),(S\_{t}^{(b)},D\_{t}^{(b)})\\big). |  |

Here, ℱmerge​(⋅)\\mathcal{F}\_{\\text{merge}}(\\cdot) denotes a synthesis operator that integrates the branch purpose and progress from both branches into a unified summary St+1S\_{t+1} and a detailed description Dt+1D\_{t+1} explaining the rationale and outcome of the merge. The global planning state main.md is simultaneously updated as
main.mdt+1=𝒢⁡(main.mdt,ℳt(b)),\\texttt{main.md}\_{t+1}=\\mathcal{G}(\\texttt{main.md}\_{t},\\mathcal{M}\_{t}^{(b)}),
reflecting the impact of the merged branch on the overall roadmap and future milestones.

The execution traces stored in log.md are combined as
ℋt+1=ℋt∪ℋt(b),\\mathcal{H}\_{t+1}=\\mathcal{H}\_{t}\\cup\\mathcal{H}\_{t}^{(b)},
with explicit origin annotations to preserve the provenance of observation–thought–action steps. Finally, the unified memory state ℳt+1\\mathcal{M}\_{t+1} is checkpointed through a new Git commit, ensuring that symbolic memory and executable artifacts are synchronized and versioned.

#### CONTEXT <options>:

The CONTEXT command allows agents to retrieve memory at multiple levels of granularity, from global overviews to fine-grained token-level execution traces. This supports both reflective reasoning and task continuation across sessions. Agents are required to call CONTEXT in specific scenarios, such as when a new agent resumes an ongoing task, or before the MERGE command. Besides that, the agent is able to call CONTEXT proactively whenever it finds context retrieval necessary.

When the agent issues the CONTEXT command, the controller returns a structured snapshot of the current project state, analogous to a git status view over the memory directory. This snapshot exposes the global project purpose and milestone progress derived from main.md, together with the set of available branches.

For branch-level inspection, the agent may request CONTEXT --branch <branch>, which retrieves the branch intent and the latest progress summary stored in commit.md, along with a bounded window of recent commit records. Let the ordered commit history of a branch be denoted as {ℳi}i=1T\\{\\mathcal{M}\_{i}\\}\_{i=1}^{T}. The returned view corresponds to a windowed projection
𝒱k={ℳi}i=kk+K,\\mathcal{V}\_{k}=\\{\\mathcal{M}\_{i}\\}\_{i=k}^{k+K},
where KK is a fixed context budget and kk is controlled by scrolling operations. This design ensures that long reasoning histories can be traversed incrementally without exceeding the agent’s context capacity.
More fine-grained retrieval is supported through specialized queries. The command CONTEXT --commit <hash> returns the complete structured memory record associated with a specific commit, while CONTEXT --log exposes a windowed segment of the execution trace ℋ\\mathcal{H} recorded in log.md using the same sliding-window mechanism.
System-level metadata, such as file structure and environment configuration, is accessed through CONTEXT --metadata <segment>, which retrieves the corresponding portion of metadata.yaml.

## 3 Experiment

|     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | BrowseComp-Plus | SWE-Bench Verified |
| Model | Peak Length | Max #Token | Pass1 | Tool Calls | Pass1 | Tool Calls |
| ReAct Agent |
| GPT-5 | 327K | 327K | 0.793 | 14.2 | 0.718 | 42.6 |
| GPT-4.1 | 327K | 327K | 0.640 | 5.6 | 0.486 | 28.7 |
| DeepSeek-V3.1 | 327K | 327K | 0.613 | 10.6 | 0.610 | 53.2 |
| GLM-4.5-Air | 327K | 327K | 0.566 | 11.1 | 0.576 | 51.2 |
| Qwen3-235B-A22B | 327K | 327K | 0.560 | 12.8 | 0.344 | 32.1 |
| Claude 4 Sonnet | 327K | 327K | 0.672 | 13.6 | 0.682 | 48.3 |
| SWE Agent |
| GPT-5 | 327K | 327K | - | - | 0.650 | 70.3 |
| GPT-4.1 | 327K | 327K | - | - | 0.396 | 68.5 |
| DeepSeek-V3.1 | 327K | 327K | - | - | 0.420 | 72.2 |
| GLM-4.5-Air | 327K | 327K | - | - | 0.542 | 71.7 |
| Qwen3-235B-A22B | 327K | 327K | - | - | 0.406 | 60.6 |
| Claude 4 Sonnet | 327K | 327K | - | - | 0.666 | 62.4 |
| Summary Agent |
| GPT-5 | 327K | 327K ×\\times 100 | 0.765 | 16.4 | 0.690 | 52.0 |
| GPT-4.1 | 327K | 327K ×\\times 100 | 0.633 | 12.3 | 0.474 | 49.3 |
| DeepSeek-V3.1 | 327K | 327K ×\\times 100 | 0.592 | 18.6 | 0.626 | 55.6 |
| GLM-4.5-Air | 327K | 327K ×\\times 100 | 0.565 | 14.3 | 0.566 | 51.0 |
| Qwen3-235B-A22B | 327K | 327K ×\\times 100 | 0.578 | 10.4 | 0.378 | 44.6 |
| Claude 4 Sonnet | 327K | 327K ×\\times 100 | 0.685 | 11.8 | 0.666 | 47.1 |
| Folding Agent |
| GPT-5 | 327K | 327K ×\\times 100 | 0.815 | 20.1 | 0.746 | 95.3 |
| GPT-4.1 | 327K | 327K ×\\times 100 | 0.665 | 16.3 | 0.626 | 88.4 |
| DeepSeek-V3.1 | 327K | 327K ×\\times 100 | 0.640 | 18.2 | 0.616 | 96.6 |
| GLM-4.5-Air | 327K | 327K ×\\times 100 | 0.595 | 19.7 | 0.596 | 92.9 |
| Qwen3-235B-A22B | 327K | 327K ×\\times 100 | 0.585 | 20.3 | 0.366 | 82.7 |
| Claude 4 Sonnet | 327K | 327K ×\\times 100 | 0.720 | 22.6 | 0.740 | 84.1 |
| GCC Agent |
| GPT-5 | 327K | 327K ×\\times 100 | 0.834(+1.9) | 24.5 | 0.790(+4.5) | 101.5 |
| GPT-4.1 | 327K | 327K ×\\times 100 | 0.722(+5.7) | 21.0 | 0.644(+1.9) | 98.7 |
| DeepSeek-V3.1 | 327K | 327K ×\\times 100 | 0.693(+5.3) | 19.2 | 0.662(+4.6) | 118.2 |
| GLM-4.5-Air | 327K | 327K ×\\times 100 | 0.655(+6.0) | 26.6 | 0.634(+3.9) | 112.5 |
| Qwen3-235B-A22B | 327K | 327K ×\\times 100 | 0.621(+3.6) | 21.4 | 0.478(+6.3) | 95.4 |
| Claude 4 Sonnet | 327K | 327K ×\\times 100 | 0.786(+6.6) | 28.8 | 0.802(+6.2) | 110.7 |

Table 1: Performance on BrowseComp-Plus (N=150) and SWE-Bench Verified (N=500).

### 3.1 Datasets

Deep Research: BrowseComp-Plus.
For research-oriented tasks, we rely on BrowseComp-Plus (BC-Plus) ( [Chen et al., 2025](https://arxiv.org/html/2508.00031v3#bib.bib32 "")), an extension of BrowseComp enriched with verified targets.
High-quality supervision is particularly important in this domain, yet most existing web-research datasets are not publicly released ( [Qiao et al., 2025](https://arxiv.org/html/2508.00031v3#bib.bib35 ""); [Li et al., 2025](https://arxiv.org/html/2508.00031v3#bib.bib36 "")).
We evaluate GCC on all instances of the dataset.
The agent interacts with two tools, search(query, topk) and open\_page(url).
All retrieval is performed with Qwen3-Embed-8B.

Agentic SWE: SWE-Bench and SWE-Benchlite.
For software engineering, we follow the widely used SWE-Bench benchmark ( [Jimenez et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib24 "")), which tests an agent’s ability to produce correct patches for real-world bugs described in natural-language issue reports.
A task consists of the buggy project snapshot and the patch generation requirement.
In addition, we also report results on SWE-Benchlite ( [swebenchlite, 2024](https://arxiv.org/html/2508.00031v3#bib.bib21 "")), a curated and self-contained subset of 300 higher-quality problems that has become standard in recent evaluations.

### 3.2 Implementation

We set the LLM context window to 32,768 tokens for all comparison models. For the fold agent, summary agent, and GCC, we allow up to 100 active summarized archives/branches, yielding a theoretical maximum accessible context of 3,276,800 tokens. In all experiments, the commit retrieval window of the CONTEXT operation is fixed to K=1K=1, such that only the most recent commit record is revealed to the agent.
When evaluated on SWE-Bench, GCC is integrated on top of the standard SWE-Agent framework.

### 3.3 Baselines

We compare GCC against four standard long-context agent baselines widely adopted in prior work.
Each baseline is instantiated with the same set of backend models as in Table [1](https://arxiv.org/html/2508.00031v3#S3.T1 "Table 1 ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"):
GPT-5, GPT-4.1, DeepSeek-V3.1, GLM-4.5-Air, Qwen3-235B-A22B, and Claude 4 Sonnet.
All agents operate under identical tool APIs, context budgets, and evaluation settings.
ReAct Agent( [Yao et al., 2022](https://arxiv.org/html/2508.00031v3#bib.bib31 "")).
Maintains full interaction history with a ReAct-style reasoning–acting loop.
We evaluate under a fixed 327K token budget (Peak Length and Max#Token).
SWE-Agent( [Jimenez et al., 2023](https://arxiv.org/html/2508.00031v3#bib.bib33 "")).
The default open-source reference system for SWE-Bench.
Iteratively generates patches using execution, editing, and testing tool calls while keeping uncompressed full context.
Following prior work, SWE-Agent is evaluated on SWE-Bench Verified only.
Summary Agent( [Yu et al., 2025](https://arxiv.org/html/2508.00031v3#bib.bib34 "")).
Uses summary-based context compression: when the context approaches the 327K limit, it produces a high-level summary and replaces earlier history.
This represents the standard “summarize-when-full” policy.
Folding Agent.
Implements the Folding paradigm ( [Sun et al., 2025](https://arxiv.org/html/2508.00031v3#bib.bib1 "")), periodically compressing earlier reasoning into structured summaries (“folds”) while maintaining a shorter active window.
This provides a middle ground between pure retention and pure summarization.
All four baselines use the same underlying models, data, tools, and evaluation protocol as GCC.

## 4 Experimental Results

Table [1](https://arxiv.org/html/2508.00031v3#S3.T1 "Table 1 ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git") presents a comprehensive comparison across four long-context agent baselines, ReAct, SWE-Agent, Summary Agent, and Folding Agent—together with our proposed GCC agent, evaluated under identical model backends and tool APIs. Several consistent patterns emerge.

#### GCC surpasses all controlled baselines.

Across all model backbones, GCC achieves the best Pass@1 on both BrowseComp-Plus and SWE-Bench Verified. For instance, on BrowseComp-Plus with GPT-5, GCC reaches a Pass@1 of 0.834, outperforming the next-best Folding Agent (0.815). This trend persists across smaller models: with GPT-4.1, GCC improves Pass@1 from 0.665 (Folding) to 0.722; with DeepSeek-V3.1, from 0.640 to 0.693; and similarly strong gains appear for GLM-4.5-Air, Qwen-235B-A22B, and Claude 4 Sonnet. These results demonstrate that GCC consistently enhances the underlying model’s capability, regardless of backend architecture.

#### GCC yields even larger gains on SWE-Bench Verified.

SWE-Bench Verified presents significantly greater complexity, yet GCC achieves the strongest performance across all backbones. Using GPT-5, GCC attains a Pass@1 of 0.790, exceeding the Folding Agent (0.746) and outperforming the Summary and ReAct agents by even larger margins. Similar improvements appear across other models: for example, GCC improves Claude 4 Sonnet from 0.740 to 0.802, and DeepSeek-V3.1 from 0.616 to 0.662. These uniform improvements on a challenging benchmark confirm GCC’s advantage in handling long-horizon software reasoning.

|     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tool | LLM | % Resolved | Avg.$ Cost | Avg.\# Tokens | % Correct Location |
| Line | Function | File |
| CodeStory Aide ( [codestoryaide, 2024](https://arxiv.org/html/2508.00031v3#bib.bib9 "")) | GPT-4o+ Claude 3.5 S | 129 (43.00%) | - | - | 41.7% | 58.7% | 72.0% |
| Bytedance MarsCode ( [Liu et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib6 "")) | NA | 118 (39.33%) | - | - | 42.7% | 58.0% | 79.7% |
| Honeycomb ( [honeycomb, 2024](https://arxiv.org/html/2508.00031v3#bib.bib10 "")) | NA | 115 (38.33%) | - | - | 44.3% | 57.0% | 69.3% |
| MentatBot ( [mentatbot, 2024](https://arxiv.org/html/2508.00031v3#bib.bib11 "")) | GPT-4o | 114 (38.00%) | - | - | 37.3% | 53.3% | 69.3% |
| Gru ( [gru, 2024](https://arxiv.org/html/2508.00031v3#bib.bib12 "")) | NA | 107 (35.67%) | - | - | 38.3% | 54.3% | 75.0% |
| Isoform ( [isoform, 2024](https://arxiv.org/html/2508.00031v3#bib.bib13 "")) | NA | 105 (35.00%) | - | 41,963 | 38.7% | 55.3% | 72.0% |
| SuperCoder2.0 ( [supercoder, 2024](https://arxiv.org/html/2508.00031v3#bib.bib14 "")) | NA | 102 (34.00%) | - | - | 41.7% | 63.7% | 65.7% |
| Alibaba Lingma Agent ( [lingma, 2024](https://arxiv.org/html/2508.00031v3#bib.bib8 "")) | GPT-4o+ Claude 3.5 S | 99 (33.00%) | - | - | 40.0% | 58.7% | 75.0% |
| Factory Code Droid ( [factorydroid, 2024](https://arxiv.org/html/2508.00031v3#bib.bib22 "")) | NA | 94 (31.33%) | - | - | 36.7% | 55.7% | 72.7% |
| Amazon Q Developer-v2 ( [amazonqdeveloper, 2024](https://arxiv.org/html/2508.00031v3#bib.bib7 "")) | NA | 89 (29.67%) | - | - | 40.3% | 52.0% | 74.3% |
| SpecRover ( [Ruan et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib15 "")) | GPT-4o+ Claude 3.5 S | 93 (31.00%) | $0.65 | - | - | - | - |
| CodeR ( [Chen et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib28 "")) | GPT-4 | 85 (28.33%) | $3.34 | 323,802 | 35.7% | 52.3% | 67.0% |
| MASAI ( [Arora et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib17 "")) | NA | 84 (28.00%) | - | - | 38.7% | 56.3% | 75.0% |
| SIMA ( [sima, 2024](https://arxiv.org/html/2508.00031v3#bib.bib18 "")) | GPT-4o | 83 (27.67%) | $0.82 | - | 37.0% | 54.0% | 79.0% |
| IBM Research Agent-101 ( [ibmagent, 2024](https://arxiv.org/html/2508.00031v3#bib.bib4 "")) | NA | 80 (26.67%) | - | - | 39.7% | 56.7% | 73.3% |
| OpenCSG StarShip ( [opencsgstarship, 2024](https://arxiv.org/html/2508.00031v3#bib.bib5 "")) | GPT-4 | 71 (23.67%) | - | - | 39.0% | 61.7% | 90.7% |
| Amazon Q Developer ( [amazonqdeveloper, 2024](https://arxiv.org/html/2508.00031v3#bib.bib7 "")) | NA | 61 (20.33%) | - | - | 34.0% | 43.7% | 71.7% |
| RepoUnderstander ( [Ma et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib26 "")) | GPT-4 | 64 (21.33%) | - | - | - | - | - |
| AutoCodeRover-v2 ( [autocoderovertwo, 2024](https://arxiv.org/html/2508.00031v3#bib.bib23 "")) | GPT-4o | 92 (30.67%) | - | - | 35.0% | 52.3% | 69.3% |
| RepoGraph ( [repograph, 2024](https://arxiv.org/html/2508.00031v3#bib.bib16 "")) | GPT-4o | 89 (29.67%) | - | - | 36.7% | 51.3% | 71.0% |
| Moatless ( [moatless, 2024](https://arxiv.org/html/2508.00031v3#bib.bib20 "")) | Claude 3.5 S | 80 (26.67%) | $0.17 | - | 38.7% | 54.7% | 78.7% |
|  | GPT-4o | 74 (24.67%) | $0.14 | - | 36.0% | 52.0% | 73.0% |
| OpenDevin+CodeAct v1.8 ( [opendevin, 2024](https://arxiv.org/html/2508.00031v3#bib.bib27 "")) | Claude 3.5 S | 80 (26.67%) | $1.14 | - | 38.0% | 49.7% | 67.3% |
| Aider ( [Gauthier, 2024](https://arxiv.org/html/2508.00031v3#bib.bib2 "")) | GPT-4o+ Claude 3.5 S | 79 (26.33%) | - | - | 35.3% | 50.0% | 69.7% |
| SWE-agent ( [Yang et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib25 "")) | Claude 3.5 S | 69 (23.00%) | $1.62 | 521,208 | 40.7% | 54.3% | 72.0% |
|  | GPT-4o | 55 (18.33%) | $2.53 | 498,346 | 29.3% | 42.3% | 58.3% |
|  | GPT-4 | 54 (18.00%) | $2.51 | 245,008 | 30.7% | 45.3% | 61.0% |
| AppMap Navie ( [appmapnavie, 2024](https://arxiv.org/html/2508.00031v3#bib.bib19 "")) | GPT-4o | 65 (21.67%) | - | - | 29.7% | 44.7% | 59.7% |
| AutoCodeRover ( [Zhang et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib3 "")) | GPT-4 | 57 (19.00%) | $0.45 | 38,663 | 29.0% | 42.3% | 62.3% |
| RAG ( [Yang et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib25 "")) | Claude 3 Opus | 13 (4.33%) | $0.25 | - | 22.0% | 30.0% | 57.0% |
|  | GPT-4 | 8 (2.67%) | $0.13 | - | 12.7% | 23.3% | 47.3% |
|  | Claude-3 Opus | 9 (3.00%) | - | - | 16.7% | 24.3% | 46.7% |
|  | GPT-3.5 | 1 (0.33%) | - | - | 6.3% | 11.3% | 27.3% |
| AgentLess ( [Xia et al., 2024](https://arxiv.org/html/2508.00031v3#bib.bib29 "")) | GPT-4o | 96 (32.00%) | $0.70 | 78,166 | 35.3% | 52.0% | 69.7% |
| GCC | GPT-3.5 | 90 (30.00%) | $0.57 | 386,490 | 35.7% | 51.3% | 69.3% |
|  | GPT-4o | 138 (46.00%) | $1.13 | 546,798 | 42.0% | 59.3% | 76.0% |
|  | Claude 3.5 S | 144 (48.00%) | $1.21 | 468,549 | 44.3% | 61.7% | 78.7% |

Table 2: Results on SWEBench-Lite.
The ‘–’ symbol denotes missing / unreleased information needed to compute the corresponding value.
Claude 3.5 S denotes Claude 3.5 Sonnet.

#### GCC allocates substantially more computation and interaction.

A distinguishing characteristic of GCC is its increased tool-call frequency. On BrowseComp-Plus with GPT-5, GCC uses 24.5 tool calls, compared to 20.1 for the Folding Agent and just 14.2 for the long-context ReAct baseline. This trend becomes even more pronounced on SWE-Bench Verified, where GCC increases tool calls from 95.3 (Folding Agent) to 101.5. Similar jumps occur across all model backbones. These results indicate that GCC not only compresses and manages context better but also learns to allocate interaction capacity adaptively—probing deeper, exploring more paths, and conducting more thorough reasoning during thinking.

### 4.1 GCC Performance-Efficiency on Coding

We report an extended analysis of the SWE-Benchlite results in Table [2](https://arxiv.org/html/2508.00031v3#S4.T2 "Table 2 ‣ GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"), comparing GCC against 26 state-of-the-art agentic coding systems spanning open-source methods, commercial closed-source agents, hybrid GPT–Claude ensembles, and retrieval-only baselines. Because these systems differ widely in model backend, memory strategy, and interaction protocol, SWE-Benchlite provides a stress test of \*general-purpose coding competence\* rather than controlled ablations. Several fine-grained patterns emerge.

#### GCC establishes a new state of the art across all competing systems.

GCC achieves a resolution rate of 48.00%, the highest among all 26 systems. The next best performer, CodeStory Aide (43.00%), uses a hybrid GPT-4o + Claude 3.5 Sonnet backend but does not release intermediate reasoning or memory structure. Other top-tier commercial agents: ByteDance MarsCode (39.33%), Honeycomb (38.33%), and MentatBot (38.00%), all fall short by 5–10 percentage points. This margin is remarkable because many of these competing systems rely on fine-tuned internal components or private coding infrastructure, whereas GCC uses a transparent protocol layered onto an off-the-shelf LLM.

![Refer to caption](https://arxiv.org/html/2508.00031v3/analysis.png)Figure 3: Number of context retrieval calling, number of branches, the context length and number of RoadMap updates with the increase of the inference steps

#### GCC closes the gap between proprietary agents and model-agnostic open systems.

A notable trend in Table [2](https://arxiv.org/html/2508.00031v3#S4.T2 "Table 2 ‣ GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git") is that several commercial systems (e.g., MarsCode, SIMA, Lingma, Honeycomb) cluster within a narrow accuracy band of 33–40%. Their performance gains primarily come from heavy engineering, test harness integration, and custom model routing: advantages unavailable to typical open-source agents. In contrast, GCC surpasses all of them while remaining purely protocol-driven. This suggests that structured, versioned memory confers benefits comparable to (or exceeding) architecture-level fine-tuning and proprietary engineering.

#### GCC achieves high performance without excessive inference cost.

Despite the increased structure and deeper exploration that GCC encourages, the cost per task remains modest. For example, on Claude 3.5 Sonnet, the average cost is $1.21—comparable to, and often lower than, many top-performing agents such as SWE-Agent (up to $2.53) or CodeR (up to $3.34). This shows that the performance gain is not merely due to brute-force trial-and-error or excessive tool usage; rather, GCC induces structured tool usage that is cost-efficient relative to the quality of patches produced.

### 4.2 Ablation and Analysis

We perform an ablation study to evaluate the contribution of each component in GCC, including the RoadMap (main.md), Detailed Logs (log.md), Meta Data (metadata.yaml), CONTEXT retrieval, and BRANCH & MERGE, and COMMIT operations. Results on SWE-Bench Verified are reported in Table [3](https://arxiv.org/html/2508.00031v3#S4.T3 "Table 3 ‣ 4.2 Ablation and Analysis ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

Starting from a raw Claude-4-Sonnet without structured memory (67.2%), adding RoadMap and COMMIT improves performance to 69.1%, showing that milestone-based checkpointing alone provides limited gains. Introducing Detailed Logs and CONTEXT retrieval yields a substantial improvement to 75.3%, highlighting the importance of preserving fine-grained reasoning traces and enabling explicit historical access. Further incorporating Meta Data increases performance to 77.8%, suggesting that structured architectural context supports consistency in long-horizon reasoning. The full system with BRANCH and MERGE achieves the best result of 80.2%, demonstrating that isolated exploration and controlled synthesis of alternative reasoning paths are critical for complex tasks.

We further analyze the evolution of internal behaviors during inference in Figure [3](https://arxiv.org/html/2508.00031v3#S4.F3 "Figure 3 ‣ GCC establishes a new state of the art across all competing systems. ‣ 4.1 GCC Performance-Efficiency on Coding ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"), including the number of CONTEXT calls, active branches, context length, and RoadMap updates.
To enable controlled comparison across levels of challenge, we group evaluation tasks into _easy_, _medium_, and _hard_.
For SWE datasets, difficulty is derived from the human time-to-resolution metadata originally provided with SWE-Bench: issues historically fixed within 15 minutes are _easy_ (194 tasks), those requiring 15–60 minutes are _medium_ (261 tasks), and those taking more than an hour are _hard_ (45 tasks).

We find in Figure [3](https://arxiv.org/html/2508.00031v3#S4.F3 "Figure 3 ‣ GCC establishes a new state of the art across all competing systems. ‣ 4.1 GCC Performance-Efficiency on Coding ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"), CONTEXT retrieval increases with inference steps and task difficulty, indicating adaptive reliance on historical memory. The number of branches rises in intermediate stages and decreases as the agent converges, reflecting exploration followed by consolidation. Context length shows non-monotonic variation due to periodic summarization and retrieval, preventing unbounded growth. RoadMap updates increase steadily, especially for harder tasks, revealing continuous refinement of the global plan. These results show that each GCC component contributes incrementally, while the complete system induces structured behaviors of exploration, reflection, and consolidation, leading to more effective long-horizon reasoning.

|     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- |
| RoadMap | Detailed | Meta | CONTEXT | BRANCH & | COMMIT | SWE |
|  | Logs | Data |  | MERGE |  | Verified |
|  |  |  |  |  |  | 67.2 |
| ✓ |  |  |  |  | ✓ | 69.1 |
| ✓ | ✓ |  | ✓ |  | ✓ | 75.3 |
| ✓ | ✓ | ✓ | ✓ |  | ✓ | 77.8 |
| ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 80.2 |

Table 3: Ablation study on GCC File System and Commands.

## 5 Conclusion

We introduced GCC, a structured context management framework that organizes agent memory using version control-inspired operations. GCC enables agents to persist, retrieve, and explore reasoning trajectories through committing, branching, and merging.
Experiments show that GCC yields consistent performance gains and achieves SOTA results, suggesting that structured, Git-style memory is a key ingredient for effective long-horizon reasoning in autonomous agents.

## References

- amazonqdeveloper (2024)Amazon q developer the most capable generative ai–powered assistant for software development.
Note: [https://aws.amazon.com/q/developer//](https://aws.amazon.com/q/developer// "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.12.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"),
[Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.19.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- appmapnavie (2024)AppMap speedruns to the top of the swe bench leaderboard.
Note: [https://appmap.io/blog/2024/06/20/appmap-navie-swe-bench-leader/](https://appmap.io/blog/2024/06/20/appmap-navie-swe-bench-leader/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.30.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Arora et al. (2024)D. Arora, A. Sonwane, N. Wadhwa, A. Mehrotra, S. Utpala, R. Bairi, A. Kanade, and N. NatarajanMASAI: modular architecture for software-engineering ai agents.
arXiv preprint arXiv:2406.11638.
Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.15.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- autocoderovertwo (2024)AutoCodeRover autonomous software engineering.
Note: [https://autocoderover.dev/](https://autocoderover.dev/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.21.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Chen et al. (2024)D. Chen, S. Lin, M. Zeng, D. Zan, J. Wang, A. Cheshkov, J. Sun, H. Yu, G. Dong, A. Aliev, et al.CodeR: issue resolving with multi-agent and task graphs.
arXiv preprint arXiv:2406.01304.
Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.14.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Chen et al. (2025)Z. Chen, X. Ma, S. Zhuang, P. Nie, K. Zou, A. Liu, J. Green, K. Patel, R. Meng, M. Su, S. Sharifymoghaddam, Y. Li, H. Hong, X. Shi, X. Liu, N. Thakur, C. Zhang, L. Gao, W. Chen, and J. LinBrowseComp-plus: a more fair and transparent evaluation benchmark of deep-research agent.
ArXivabs/2508.06600.
Cited by: [§3.1](https://arxiv.org/html/2508.00031v3#S3.SS1.p1.1 "3.1 Datasets ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- codestoryaide (2024)Aide by codestory.
Note: [https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240702\_codestory\_aide\_mixed](https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240702_codestory_aide_mixed "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.3.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- factorydroid (2024)Factory bringing autonomy to software engineering.
Note: [https://www.factory.ai/](https://www.factory.ai/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.11.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Gauthier (2024)P. GauthierAider is ai pair programming in your terminal.
Note: [https://aider.chat/](https://aider.chat/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.26.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- gru (2024)The road to ultimate pull request machine.
Note: [https://gru.ai/blog/road-to-ultimate-pull-request-machine/](https://gru.ai/blog/road-to-ultimate-pull-request-machine/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.7.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- honeycomb (2024)Honeycomb.
Note: [https://honeycomb.sh](https://honeycomb.sh/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.5.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- ibmagent (2024)Agent-101: a software engineering agent for code assistance developed by ibm research..
Note: [https://github.com/swe-bench/experiments/blob/main/evaluation/lite/20240612\_IBM\_Research\_Agent101/README.md/](https://github.com/swe-bench/experiments/blob/main/evaluation/lite/20240612_IBM_Research_Agent101/README.md/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.17.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- isoform (2024)Isoform.
Note: [https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240829\_Isoform](https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240829_Isoform "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.8.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Jimenez et al. (2024)C. E. Jimenez, J. Yang, A. Wettig, S. Yao, K. Pei, O. Press, and K. R. NarasimhanSWE-bench: can language models resolve real-world github issues?.
In The Twelfth International Conference on Learning Representations,
External Links: [Link](https://openreview.net/forum?id=VTF8yNQM66 "")Cited by: [§3.1](https://arxiv.org/html/2508.00031v3#S3.SS1.p2.1 "3.1 Datasets ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Jimenez et al. (2023)C. E. Jimenez, J. Yang, A. Wettig, S. Yao, K. Pei, O. Press, and K. NarasimhanSWE-bench: can language models resolve real-world github issues?.
ArXivabs/2310.06770.
Cited by: [§3.3](https://arxiv.org/html/2508.00031v3#S3.SS3.p1.1 "3.3 Baselines ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Li et al. (2025)K. Li, Z. Zhang, H. Yin, R. Ye, Y. Zhao, L. Zhang, L. Ou, D. Zhang, X. Wu, J. Wu, X. Wang, Z. Qiao, Z. Zhang, Y. Jiang, P. Xie, F. Huang, and J. ZhouWebSailor-v2: bridging the chasm to proprietary agents via synthetic data and scalable reinforcement learning.
In arXiv preprint,
Cited by: [§3.1](https://arxiv.org/html/2508.00031v3#S3.SS1.p1.1 "3.1 Datasets ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- lingma (2024)Lingma agent.
Note: [https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240622\_Lingma\_Agent](https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240622_Lingma_Agent "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.10.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Liu et al. (2024)Y. Liu, P. Gao, X. Wang, C. Peng, and Z. ZhangMarsCode agent: ai-native automated bug fixing.
arXiv preprint arXiv:2409.00899.
Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.4.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Ma et al. (2024)Y. Ma, Q. Yang, R. Cao, B. Li, F. Huang, and Y. LiHow to understand whole software repository?.
arXiv preprint arXiv:2406.01422.
Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.20.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- mentatbot (2024)MentatBot: new sota coding agent, available now.
Note: [https://mentat.ai/blog/mentatbot-sota-coding-agent](https://mentat.ai/blog/mentatbot-sota-coding-agent "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.6.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- moatless (2024)Moatless tools.
Note: [https://github.com/aorwall/moatless-tools](https://github.com/aorwall/moatless-tools "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.23.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- opencsgstarship (2024)OpenCSG starship.
Note: [https://opencsg.com/product?class=StarShip/](https://opencsg.com/product?class=StarShip/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.18.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- opendevin (2024)OpenDevin: code less, make more.
Note: [https://github.com/OpenDevin/OpenDevin/](https://github.com/OpenDevin/OpenDevin/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.25.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Qiao et al. (2025)Z. Qiao, G. Chen, X. Chen, D. Yu, W. Yin, X. Wang, Z. Zhang, B. Li, H. Yin, K. Li, R. Min, M. Liao, Y. Jiang, P. Xie, F. Huang, and J. ZhouWebResearcher: unleashing unbounded reasoning capability in long-horizon agents.
In arXiv preprint,
Cited by: [§3.1](https://arxiv.org/html/2508.00031v3#S3.SS1.p1.1 "3.1 Datasets ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- repograph (2024)RepoGraph: enhancing ai software engineering with repository-level code graph.
Note: [https://github.com/ozyyshr/RepoGraph](https://github.com/ozyyshr/RepoGraph "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.22.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Ruan et al. (2024)H. Ruan, Y. Zhang, and A. RoychoudhurySpecRover: code intent extraction via llms.
arXiv preprint arXiv:2408.02232.
Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.13.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- sima (2024)Alex sima.
Note: [https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240706\_sima\_gpt4o](https://github.com/swe-bench/experiments/tree/main/evaluation/lite/20240706_sima_gpt4o "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.16.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Sun et al. (2025)W. Sun, M. Lu, Z. Ling, K. Liu, X. Yao, Y. Yang, and J. ChenScaling long-horizon llm agent via context-folding.
arXiv preprint arXiv:2510.11967.
Cited by: [§3.3](https://arxiv.org/html/2508.00031v3#S3.SS3.p1.1 "3.3 Baselines ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- supercoder (2024)SuperCoder.
Note: [https://superagi.com/supercoder/](https://superagi.com/supercoder/ "")Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.9.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- swebenchlite (2024)SWE-bench lite.
Note: [https://www.swebench.com/lite.html](https://www.swebench.com/lite.html "")Cited by: [§3.1](https://arxiv.org/html/2508.00031v3#S3.SS1.p2.1 "3.1 Datasets ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Wu et al. (2025)J. Wu, J. Zhu, Y. Liu, M. Xu, and Y. JinAgentic reasoning: a streamlined framework for enhancing llm reasoning with agentic tools.
In Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers),
pp. 28489–28503.
Cited by: [§1](https://arxiv.org/html/2508.00031v3#S1.p1.1 "1 Introduction ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Xia et al. (2024)C. S. Xia, Y. Deng, S. Dunn, and L. ZhangAgentless: demystifying llm-based software engineering agents.
arXiv preprint arXiv:2407.01489.
Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.36.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Yang et al. (2024)J. Yang, C. E. Jimenez, A. Wettig, K. Lieret, S. Yao, K. Narasimhan, and O. PressSwe-agent: agent-computer interfaces enable automated software engineering.
arXiv preprint arXiv:2405.15793.
Cited by: [§1](https://arxiv.org/html/2508.00031v3#S1.p1.1 "1 Introduction ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"),
[Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.27.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git"),
[Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.32.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Yao et al. (2022)S. Yao, J. Zhao, D. Yu, N. Du, I. Shafran, K. Narasimhan, and Y. CaoReAct: synergizing reasoning and acting in language models.
ArXivabs/2210.03629.
Cited by: [§3.3](https://arxiv.org/html/2508.00031v3#S3.SS3.p1.1 "3.3 Baselines ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Yu et al. (2025)H. Yu, T. Chen, J. Feng, J. Chen, W. Dai, Q. Yu, Y. Zhang, W. Ma, J. Liu, M. Wang, and H. ZhouMemAgent: reshaping long-context llm with multi-conv rl-based memory agent.
ArXivabs/2507.02259.
Cited by: [§3.3](https://arxiv.org/html/2508.00031v3#S3.SS3.p1.1 "3.3 Baselines ‣ 3 Experiment ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").

- Zhang et al. (2024)Y. Zhang, H. Ruan, Z. Fan, and A. RoychoudhuryAutoCodeRover: autonomous program improvement.
External Links: 2404.05427Cited by: [Table 2](https://arxiv.org/html/2508.00031v3#S4.T2.3.1.31.1.1 "In GCC yields even larger gains on SWE-Bench Verified. ‣ 4 Experimental Results ‣ Git Context Controller: Manage the Context of Agents by Agentic Git").