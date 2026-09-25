Title:

Content selection saved. Describe the issue below:

Description:

![](https://arxiv.org/static/base/1.0.1/images/icons/smileybones-small.svg)arXiv is now an independent nonprofit! [Learn more](https://info.arxiv.org/about) ×

[License: CC BY 4.0](https://info.arxiv.org/help/license/index.html#licenses-available)

arXiv:2606.30005v4 \[cs.CL\] 23 Jul 2026

# LLM Agents Are Latent Context Managers:   Eliciting Self-Managed Context via State Proprioception

Binyan Xu
Affiliation: The Chinese University of Hong Kong
Affiliation: LIGHTSPEED{binyxu, khzhang}@ie.cuhk.edu.hk,
729156675@qq.com\*Work done during an internship at Tencent.
†Corresponding author.
Haitao Li
Affiliation: LIGHTSPEED{binyxu, khzhang}@ie.cuhk.edu.hk,
729156675@qq.com\*Work done during an internship at Tencent.
†Corresponding author.
Kehuan Zhang
Affiliation: The Chinese University of Hong Kong

###### Abstract

Long-horizon tool agents are bottlenecked by how their context grows toward the
limits of the context window. Recent systems make context management agent- or
system-controlled, but they either learn compression policies that discard
evidence or manage context in a layer the agent never sees. We argue that both
miss a more basic gap: frontier language models are proprioceptively blind to
their own context. From the prompt alone they cannot see how large, old, or used
each block is, the signals needed for keep-or-drop decisions. We introduce
VISTA (Visible Internal State for Tool Agents), a training-free,
model-agnostic layer that represents working memory as typed addressable blocks,
surfaces a runtime dashboard of token usage, recency, and access history, and
archives blocks as recoverable full-fidelity payloads. On LOCA-Bench,
BrowseComp-Plus, and GAIA, the same untrained interface transfers across
1M-, 100K-, and 10K-scale trajectories. On LOCA-Bench it lifts
Gemini-3-Flash from 22.7 to 50.7%, reaches 58.0% on BrowseComp-Plus, and
remains competitive on GAIA. Gains grow with context pressure and transfer
across backbones, while ablations confirm that the dashboard matters beyond
archive and recovery tools.

![Refer to caption](https://arxiv.org/html/2606.30005v4/fig_intro_teaser.png)Figure 1: Who manages context, and on what information. Fixed rules
compact context the agent cannot see, and blind self-management guesses without
state. VISTA surfaces per-block metadata, so the agent archives the large
block losslessly.

## 1 Introduction

Language agents operate over stateful tasks such as filling spreadsheets from
web and email evidence, modifying databases, preparing application materials,
debugging code, and coordinating business workflows \[ [43](https://arxiv.org/html/2606.30005v4#bib.bib1 ""), [16](https://arxiv.org/html/2606.30005v4#bib.bib17 "")\].
Their context is working memory. It accumulates tool evidence, stale
observations, failed attempts, user constraints, hypotheses, file paths, and
action contracts that must remain correct many steps later
\[ [22](https://arxiv.org/html/2606.30005v4#bib.bib5 ""), [25](https://arxiv.org/html/2606.30005v4#bib.bib16 ""), [30](https://arxiv.org/html/2606.30005v4#bib.bib15 "")\]. As the task runs,
working memory grows until it crowds or overflows the context window, a pressure
also studied in long reasoning systems that summarize or carry state across
computation \[ [11](https://arxiv.org/html/2606.30005v4#bib.bib28 ""), [28](https://arxiv.org/html/2606.30005v4#bib.bib29 ""), [2](https://arxiv.org/html/2606.30005v4#bib.bib30 "")\]. The
agent must decide what to keep visible, what to set aside, and what to recover.
How this growing context is managed determines whether long-horizon agents
succeed.

Existing approaches differ in who makes these decisions. One family keeps the
decision outside the agent. Stale-observation masking hides old tool outputs by
rule \[ [44](https://arxiv.org/html/2606.30005v4#bib.bib14 "")\], and OS-style layers page or evict context beneath the
agent. These layers track statistics such as size, age, and usage, but only
inside the runtime. The agent cannot inspect them, and a fixed rule cannot know
which evidence will matter later. A second family moves the decision into the
agent and learns it from data. Context-as-a-tool fine-tunes a compressor, and
budget-aware methods train compression policies with reinforcement
learning \[ [16](https://arxiv.org/html/2606.30005v4#bib.bib17 ""), [25](https://arxiv.org/html/2606.30005v4#bib.bib16 ""), [30](https://arxiv.org/html/2606.30005v4#bib.bib15 ""), [24](https://arxiv.org/html/2606.30005v4#bib.bib8 "")\].
These methods can improve performance, but they often discard evidence through
summarization or deletion and are tied to the training setting. Across both
families, the agent can read block contents but cannot perceive the state needed
for a keep-or-archive decision, including block size, recency, access history,
and remaining budget. Figure [1](https://arxiv.org/html/2606.30005v4#S0.F1 "Figure 1 ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") contrasts these families with our
approach on one task.

Figure 2: RL implicitly learns self-management. Across training, task
performance and dashboard-free self-perception improve together, while
dashboard-aided perception remains high. This gap suggests that the missing
ingredient is observable state, motivating us to expose it explicitly rather than
learn it implicitly.

We take an elicitation view. We hypothesize that capable models already contain
context-management competence from pretraining on note-taking, retrieval, and
reorganization traces, and that the bottleneck is a missing interface rather
than a missing policy. Context management is a meta-tool decision over the
agent’s own working memory, made under partial observability. The agent must
choose what to keep or externalize while the prompt omits the runtime state that
governs the choice. Learned policies can compensate through training, but this
entangles what information should be exposed with what policy should act on it.
Figure [2](https://arxiv.org/html/2606.30005v4#S1.F2 "Figure 2 ‣ 1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") makes this motivation concrete: RL-based
self-management implicitly improves both task performance and the model’s
ability to recognize when its context needs management, whereas supplying the
state dashboard makes that judgment easy even before adaptation. We therefore
make the state explicit and express when-to-manage criteria as a rubric-style
instruction. VISTA elicits these latent capabilities without requiring
training or model-specific adaptation, while remaining compatible with RL.

This proprioceptive view implies three requirements. The interface must expose per-block token
cost, recency, access history, and remaining budget. It must be reversible,
because one-way deletion or summarization can remove evidence needed later. It
must be model-agnostic, so gains reflect elicitation through the interface
rather than a policy trained for one backbone or domain.

We introduce VISTA (Visible Internal State for Tool Agents), a context layer
that represents working memory as typed, addressable blocks and surfaces a
dashboard with per-block token usage, recency, access history, and budget. The
dashboard is a proprioceptive view of the agent’s context state. The
agent can archive bulky blocks as external payloads with stable handles and
recover exact bytes on demand. Archived payloads are exact transcripts, so
removing a block from the prompt does not destroy it. We show both are necessary:
recovery, because discarded evidence cannot otherwise be restored; and the
dashboard, because a size-blind manager over-archives or under-recovers even
given recovery (Proposition [1](https://arxiv.org/html/2606.30005v4#Thmproposition1 "Proposition 1 (Recovery is necessary under budget pressure). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") and Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")).
VISTA requires no training and wraps any backbone.

Empirically, Table [1](https://arxiv.org/html/2606.30005v4#S3.T1 "Table 1 ‣ 3.2 Main Results Across Scales ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") tests VISTA across million-,
100K-, and 10K-token trajectories in LOCA-Bench, BrowseComp-Plus, and GAIA. In
LOCA-Bench \[ [43](https://arxiv.org/html/2606.30005v4#bib.bib1 "")\], it solves 38/75 tasks versus 17 for ReAct and 32
for Claude Code, with lower trajectory cost than Claude Code. On
BrowseComp-Plus, it reaches 58.0% versus 52.0% for the strongest baseline, and
remains competitive on GAIA. Pressure sweeps show that the advantage grows on
long trajectories, where VISTA cuts active-context overhead while improving
accuracy. The same untrained layer improves all four tested backbones, and
ablations show that the dashboard matters beyond archive and recovery tools. In
transfer, VISTA also reaches higher F1 than the specialized AMA-Bench agent
without memory tuning.

This paper makes three contributions.

- •


We frame context management as a meta-tool decision under partial
observability and identify context proprioception as the missing interface,
since LLM agents cannot read their own context state from the prompt.

- •


We introduce VISTA, a training-free context layer
whose dashboard exposes per-block metadata and pairs it with lossless
archive and recovery. Two matched separations prove both are necessary:
recovery to preserve evicted evidence, the dashboard to use it
efficiently.

- •


We show across LOCA-Bench, BrowseComp-Plus, and GAIA that VISTA
elicits self-management across trajectory scales and backbones, isolate the
dashboard with ablations, and demonstrate transfer on AMA-Bench.


## 2 Methodology

VISTA treats context management as a meta-tool decision over the agent’s own
working memory. Figure [3](https://arxiv.org/html/2606.30005v4#S2.F3 "Figure 3 ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") shows the three-stage loop: a context
stream, a refreshed dashboard, and archive/recovery tools. The goal is to make
context state perceptible to an unmodified model without fine-tuning,
model-specific changes, or destroyed evidence.

![Refer to caption](https://arxiv.org/html/2606.30005v4/fig_system_overview.png)Figure 3: VISTA architecture. Messages and tool outputs become
addressable blocks. The dashboard exposes budget and handles to the agent, while
archived payloads remain recoverable outside the active prompt.

### 2.1 Problem Setup

At step tt, a tool agent has a task goal gg, raw interaction history HtH\_{t},
environment tools 𝒯env\\mathcal{T}\_{\\mathrm{env}}, and a context budget BB. We
write the history as action-observation pairs
Ht=(a1,o1,…,at−1,ot−1)H\_{t}=(a\_{1},o\_{1},\\ldots,a\_{t-1},o\_{t-1}). A standard ReAct-style harness
serializes this append-only history into the next model input. Once the
serialized history exceeds BB, the harness must truncate, clear, mask, or
summarize prior content. These interventions conflate what remains visible,
what is preserved exactly, and what can be recovered later.

VISTA separates these choices through a workspace
Wt=(Vt,At,Pt)W\_{t}=(V\_{t},A\_{t},P\_{t}): visible blocks, archived payloads, and blocked large
results. The model does not act on the raw transcript directly; it acts on the
workspace rendering

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|  | Ct\\displaystyle C\_{t} | =render⁡(Vt)⊕handles⁡(At)⊕notices⁡(Pt)⊕Dt,\\displaystyle=\\operatorname{render}(V\_{t})\\oplus\\operatorname{handles}(A\_{t})\\oplus\\operatorname{notices}(P\_{t})\\oplus D\_{t}, |  | (1) |
|  | at\\displaystyle a\_{t} | ∼πθ(⋅∣Ct),\|Ct\|≤B.\\displaystyle\\sim\\pi\_{\\theta}(\\cdot\\mid C\_{t}),\\qquad\|C\_{t}\|\\leq B. |  |

Here DtD\_{t} is the dashboard: a factual ledger of block IDs, token estimates,
recency, access history, archive levels, and remaining budget.
The raw transcript is still logged for evaluation, but the agent’s working
memory is the workspace, not the append-only history.

Workspace invariants.
The harness enforces a budget constraint, \|Ct\|≤B\|C\_{t}\|\\leq B, after preflight and
final assembly; every actionable unit must have a stable block ID or handle; and
archived payload bytes remain recoverable unless the agent explicitly deletes
them. The dashboard reports the same token estimates used by these checks, so
the agent sees the state that the harness will enforce.

### 2.2 Context Stream

The left panel of Figure [3](https://arxiv.org/html/2606.30005v4#S2.F3 "Figure 3 ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") shows how VISTA rewrites the
transcript as a block stream. The state space is deliberately small and aligned
with the three storage regimes:

1. (i)


visible blocks appear in the active prompt with exact content;
pinned blocks are a protocol-required subset of this state.

2. (ii)


archived blocks are replaced by compact handles and summaries,
while their original bytes are stored externally.

3. (iii)


blocked blocks are oversized tool results that would exceed the
budget if inserted; deleted blocks are intentionally unrecoverable.


This stream gives the agent an address space for context decisions. When a
bundle of evidence becomes too large, the stream keeps a compact handle while
the exact payload remains in the hidden trajectory. New observations enter only
if space remains; otherwise, the workspace enters overflow mode.

Structure preservation.
The visible stream is the next-call working set, while the hidden trajectory
stores exact payloads that may be needed later. Tool results remain linked to their
assistant tool calls, and archived results are rendered in protocol-valid form.
If a parent call is also archived, the placeholder becomes ordinary context
rather than an orphaned tool response.

### 2.3 LLM Policy

Dashboard input.
The middle panel shows what the model receives: the visible context stream plus
a dashboard. The dashboard is regenerated after every tool result is registered,
so the agent acts on the current workspace state. It is a ledger over blocks
rather than a memory oracle: it exposes runtime state created by the harness or
by the agent’s earlier actions and does not add hidden task evidence.

Unified action space.
The same model policy chooses ordinary environment actions and context actions:

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|  | 𝒯ctx\\displaystyle\\mathcal{T}\_{\\mathrm{ctx}} | ={archive⁡(𝒮,ρ),read⁡(h,q),delete⁡(𝒮)},\\displaystyle=\\{\\operatorname{archive}(\\mathcal{S},\\rho),\ \\operatorname{read}(h,q),\ \\operatorname{delete}(\\mathcal{S})\\}, |  | (2) |
|  | at\\displaystyle a\_{t} | ∈𝒯env∪𝒯ctx.\\displaystyle\\in\\mathcal{T}\_{\\mathrm{env}}\\cup\\mathcal{T}\_{\\mathrm{ctx}}. |  |

Thus context management is not a separate post-hoc controller. It is part of the
model’s action space, conditioned on the dashboard and task evidence still
visible in CtC\_{t}.

Mode switch.
The dashboard is the proprioceptive channel of the meta-tool. From prompt text
alone, a model cannot reliably infer how costly a block is, how recent it is, or
whether it has been used again. These signals determine whether a block should
stay visible, be archived, or be recovered. In normal mode, the agent may call
environment tools, continue the task, archive blocks, or read archived payloads.
In overflow mode, ordinary tool calls are disabled until the agent reduces the
visible context. The allowed action set is therefore

|     |     |     |     |
| --- | --- | --- | --- |
|  | 𝒜t={𝒯env∪𝒯ctx,\|Ct\|≤B,𝒯ctx,\|Ct\|>B.\\mathcal{A}\_{t}=\\begin{cases}\\mathcal{T}\_{\\mathrm{env}}\\cup\\mathcal{T}\_{\\mathrm{ctx}},&\|C\_{t}\|\\leq B,\\\<br>\\mathcal{T}\_{\\mathrm{ctx}},&\|C\_{t}\|>B.\\end{cases} |  | (3) |

The hard budget is enforced by the harness, but the agent chooses what to move.
A final preflight guard may externalize large raw tool-result blocks near the
hard limit to prevent API failure; the policy-facing decision remains with the
agent.

Access history.
The dashboard also records access history. When an archived payload is read or a
block handle is used, the corresponding row can be updated in the next
dashboard. This gives the agent a compact trace of active blocks without keeping
the full transcript in the prompt.

Algorithm 1 Self-managed context loop

0:


task block btaskb\_{\\mathrm{task}}, budget BB, environment tools
𝒯env\\mathcal{T}\_{\\mathrm{env}}, context tools 𝒯ctx\\mathcal{T}\_{\\mathrm{ctx}}

0:


final answer and workspace trajectory W1:TW\_{1:T}

0:VtV\_{t} visible stream; AtA\_{t} archived byte store;
PtP\_{t} blocked payloads; DtD\_{t} dashboard; CtmgmtC\_{t}^{\\mathrm{mgmt}} disables task tools

1:V0←{btask}V\_{0}\\leftarrow\\{b\_{\\mathrm{task}}\\}; A0,P0←∅A\_{0},P\_{0}\\leftarrow\\varnothing

2:while the task is unfinished do

2:⊳\\trianglerightPerceive: expose runtime context state

3:


Admit new messages into VtV\_{t}; oversized payloads enter PtP\_{t} with visible stubs

4:Dt←Dashboard⁡(Vt,At,Pt,B)D\_{t}\\leftarrow\\mathrm{Dashboard}(V\_{t},A\_{t},P\_{t},B)

5:Ct←Assemble⁡(Vt,At,Pt)∪{Dt}C\_{t}\\leftarrow\\mathrm{Assemble}(V\_{t},A\_{t},P\_{t})\\cup\\{D\_{t}\\}

5:⊳\\trianglerightMake room: preserve bytes while shrinking the prompt

6:


If \|Ct\|>β​B\|C\_{t}\|>\\beta B, choose eligible blocks 𝒮⊂Vt\\mathcal{S}\\subset V\_{t} to archive

7:


Replace 𝒮\\mathcal{S} by handles h⁡(𝒮,ρ)h(\\mathcal{S},\\rho) and store exact payloads in AtA\_{t}

7:⊳\\trianglerightAct: management-only under overflow, otherwise normal tool use

8:𝒰t←𝒯ctx\\mathcal{U}\_{t}\\leftarrow\\mathcal{T}\_{\\mathrm{ctx}} if \|Ct\|>B\|C\_{t}\|>B; else
𝒯env∪𝒯ctx\\mathcal{T}\_{\\mathrm{env}}\\cup\\mathcal{T}\_{\\mathrm{ctx}}

9:at←LLM⁡(Ctmgmt,𝒰t)a\_{t}\\leftarrow\\mathrm{LLM}(C\_{t}^{\\mathrm{mgmt}},\\mathcal{U}\_{t}) if \|Ct\|>B\|C\_{t}\|>B; else
LLM⁡(Ct,𝒰t)\\mathrm{LLM}(C\_{t},\\mathcal{U}\_{t})

10:


If at=read⁡(h)a\_{t}=\\mathrm{read}(h), recover the exact payload and add it to VtV\_{t}

11:


If at=archive⁡(𝒮,ρ)a\_{t}=\\mathrm{archive}(\\mathcal{S},\\rho), update handles and AtA\_{t} as above

12:


If at∈𝒯enva\_{t}\\in\\mathcal{T}\_{\\mathrm{env}}, execute it and admit the result

13:


If at=answera\_{t}=\\mathrm{answer}, return final answer

14:Wt+1←(Vt,At,Pt)W\_{t+1}\\leftarrow(V\_{t},A\_{t},P\_{t})

15:endwhile

### 2.4 Meta Context Tool

Archive interface.
The right panel shows the meta-context tool. Archiving takes a selected block
set 𝒮\\mathcal{S} and a short replacement summary ρ\\rho:

|     |     |     |     |     |
| --- | --- | --- | --- | --- |
|  | h\\displaystyle h | =archive⁡(𝒮,ρ),\\displaystyle=\\operatorname{archive}(\\mathcal{S},\\rho), |  | (4) |
|  | read⁡(h)\\displaystyle\\operatorname{read}(h) | ≡payload⁡(𝒮).\\displaystyle\\equiv\\operatorname{payload}(\\mathcal{S}). |  |

The first line creates a compact handle in the visible stream; the second is the
lossless contract. The exact payload moves to the external archive, while hh
keeps the path, level, size, and checksum metadata visible.
Recovery is performed through ordinary file or terminal access to the stored
payload path. There is no task-specific retrieval oracle. If the payload is too
large, the agent may read bounded chunks or rerun the original source tool with
narrower arguments.

The stored payload is a transcript of what the model saw, not a guarantee that
the source was complete. If a source response was paginated or truncated, the
archive preserves that result exactly and leaves re-querying to the agent.

Hierarchical recovery.
Archiving is hierarchical. A first archive level may group several raw blocks
into a bundle, as B6-9 does in the figure. Later, groups can themselves be
archived into coarser handles when context pressure grows. The visible stream
therefore stores a small summary and retrieval guide, while the hidden
trajectory stores the exact evidence. This is why VISTA differs from
summarization. Summaries guide navigation, but they are not the only
representation of the evidence.

Recovery follows the hierarchy in reverse. The agent may inspect a coarse
handle, recover the payload, and then decide whether a narrower
piece of evidence should return to active context. It need not reload a long
transcript when one row or identifier is needed. It can recover the file, search
or read a bounded part, and continue with a smaller block.

### 2.5 Theory: Recovery and Proprioception Are Both Necessary

VISTA couples two mechanisms: lossless archive/recovery and a
proprioceptive dashboard. We show that these mechanisms are necessary for two
_distinct_ reasons, and that neither substitutes for the other. A single
instrument drives both arguments: _Fano’s inequality_, relating the
information an agent holds to the error it cannot avoid. We apply it in two
modes. In its classical form it bounds how faithfully a budget-limited prompt can
_reconstruct_ an evicted block, giving recovery necessity
(Proposition [1](https://arxiv.org/html/2606.30005v4#Thmproposition1 "Proposition 1 (Recovery is necessary under budget pressure). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")). In its list form it bounds how sharply a
rate-limited interface can _localize_ the block worth evicting, giving
proprioception necessity (Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")); the only extra step is to
measure how many bits each interface supplies, which for a dashboard-free agent
is a short channel calculation (Proposition [2](https://arxiv.org/html/2606.30005v4#Thmproposition2 "Proposition 2 (The dashboard-free endpoint is 𝑛-independent). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")). Reconstruction
and localization are the two faces of one inequality, and they map directly onto
the two component ablations in Section [4](https://arxiv.org/html/2606.30005v4#S4 "4 Analysis ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"): removing recovery and
removing the dashboard each disable exactly one face. We isolate each mechanism
on the task family that stresses it, so the separations are clean rather than
average-case; this is exactly the regime our ablations reproduce. Full proofs are
in Appendix [A](https://arxiv.org/html/2606.30005v4#A1 "Appendix A Proof of Proposition ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

Recovery is necessary under budget pressure.
Consider a task family
𝒯N,k\\mathcal{T}\_{N,k} in which the history contains NN evidence blocks
X1,…,XNX\_{1},\\dots,X\_{N}, each an independent string of kk uniformly random bits. These
blocks model exact identifiers, table rows, links, or file snippets. The prompt
admits at most BB bits and N​k>BNk>B, so the blocks cannot all remain visible. At
the final step, the task reveals an index i⋆i^{\\star} drawn uniformly and
independently of the blocks, and requires the agent to emit Xi⋆X\_{i^{\\star}}
exactly.

A recovering method may move blocks to external storage and reload the required
block after i⋆i^{\\star} is known. A non-recovering method keeps only an in-prompt
representation RR of size at most BB bits and cannot reload discarded content.
Deletion, masking, summarization, and skeleton compression are non-recovering.
Here Fano acts in its _reconstruction_ mode: a state of entropy ≤B\\leq B can
faithfully reproduce only about B/kB/k of the blocks, so an unknown query is
likely to land on one it has already lost.

###### Proposition 1(Recovery is necessary under budget pressure).

For any non-recovering method whose pre-reveal in-prompt state RR satisfies
H⁡(R)≤BH(R)\\leq B,

|     |     |     |
| --- | --- | --- |
|  | Pr⁡\[correct on ​𝒯N,k\]≤BN​k+1k.\\Pr\\!\\left\[\\text{correct on }\\mathcal{T}\_{N,k}\\right\]\\leq\\frac{B}{Nk}+\\frac{1}{k}. |  |

VISTA is correct with probability 11 whenever the instruction, the NN
handles, and one recovered block fit within BB. In particular, take any regime
in which VISTA stays feasible while the raw evidence dwarfs the budget, for
instance k=⌈N⌉k=\\lceil\\sqrt{N}\\rceil and B=c​N​log2⁡NB=cN\\log\_{2}N with a constant cc large
enough to hold the handles, so that N​k/B→∞Nk/B\\to\\infty. There the lossy bound tends
to 00 while VISTA stays at 11, and the success gap tends to 11 as
N→∞N\\to\\infty.

The intuition is that a bounded lossy representation retains exact bits for only
about B/kB/k blocks; when the future query is unknown it must discard evidence it
may later need. VISTA does not reduce the information in archived blocks. It
relocates them at handle cost O⁡(N​log⁡N)O(N\\log N) and pays byte recovery only for the
evidence that matters. Choosing _which_ block to recover is exactly where the
same inequality strikes again, now in list form.

Proprioception is necessary to use recovery efficiently.
Recovery removes the losslessness barrier but not the _control_ problem: the
agent must still decide _which_ blocks to move. We therefore give both
compared agents the full lossless archive and recovery tools and isolate a single
question, namely how sharply the interface can point at the block worth evicting.
The answer will turn the binary “dashboard vs. no dashboard” contrast into one
continuous law, with the two ablations as its endpoints and Fano’s list form as
the only tool.

###### Definition 1(Make-room instance ℳn,L,ℓ\\mathcal{M}\_{n,L,\\ell}).

The working set holds nn blocks. A hidden index J⋆J^{\\star}, uniform on
{1,…,n}\\{1,\\dots,n\\}, marks one _bulky_ block of size LL; the other n−1n-1 _load-bearing_ blocks each have size ℓ<L\\ell<L, with κ:=L/ℓ≥2\\kappa:=L/\\ell\\geq 2 an
integer and κ≤n−1\\kappa\\leq n-1. The prompt is over budget by exactly LL tokens, so
the harness disables task tools until the agent has archived a set with total
size ≥L\\geq L. The bulky block is not needed again; every load-bearing block is
queried later and, if archived, must be recovered (one round-trip) to answer
correctly. After each archive the agent observes only the _binary_ overflow
flag, never numeric freed sizes.

Making room _is_ localization.
To exit overflow the agent archives blocks in some order until the freed size
reaches LL. Let τ\\tau be the position at which J⋆J^{\\star} is archived: archiving
J⋆J^{\\star} frees LL at once, while each load-bearing block frees only ℓ\\ell, so
κ\\kappa of them are needed otherwise. The agent stops the moment it hits
J⋆J^{\\star} or has freed LL the slow way, so the number of archived load-bearing
blocks, which are exactly the ones that must later be recovered, is

|     |     |     |     |
| --- | --- | --- | --- |
|  | Z=min⁡(τ−1,κ).Z\\;=\\;\\min(\\tau-1,\ \\kappa). |  | (5) |

Thus every recovery round-trip is a load-bearing block the agent archived
_before_ finding J⋆J^{\\star}: making room efficiently is exactly the problem of
ranking J⋆J^{\\star} early. The only lever on that ranking is how much the interface
reveals about which block is bulky.

###### Definition 2(Proprioceptive interface of rate II).

Before acting, the agent receives an observation YY and archives in some
YY-measurable order, using private randomness U⟂(J⋆,Y)U\\!\\perp\\!(J^{\\star},Y). The
_rate_ of the interface is the information it carries about the bulky block,
I:=I⁡(J⋆,Y)I:=I(J^{\\star};Y) (in bits). Two endpoints anchor the scale. The
_size-aware_ agent (full ledger) observes the exact vector
(s1,…,sn)(s\_{1},\\dots,s\_{n}), which pins down the unique block of size LL, so I=log2⁡nI=\\log\_{2}n.
The _dashboard-free_ agent perceives size only through content: it observes
Wj=ln⁡sj+εjW\_{j}=\\ln s\_{j}+\\varepsilon\_{j} for each block, with i.i.d. noise
εj∼𝒩⁡(0,σ2)\\varepsilon\_{j}\\sim\\mathcal{N}(0,\\sigma^{2}), where σ\\sigma is the model’s relative
size-estimation error (Appendix [H](https://arxiv.org/html/2606.30005v4#A8 "Appendix H Proprioceptive-Blindness Diagnostic ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"), median 0.430.43–0.840.84).
Its rate is I=IcontentI=I\_{\\mathrm{content}}, located next.

###### Proposition 2(The dashboard-free endpoint is nn-independent).

For the content channel of Def. [2](https://arxiv.org/html/2606.30005v4#Thmdefinition2 "Definition 2 (Proprioceptive interface of rate 𝐼). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),

|     |     |     |
| --- | --- | --- |
|  | Icontent=I⁡(J⋆,W)≤(log2⁡κ)2σ2​ln⁡2​bits.I\_{\\mathrm{content}}\\;=\\;I(J^{\\star};W)\\;\\leq\\;\\frac{(\\log\_{2}\\kappa)^{2}}{\\sigma^{2}}\\,\\ln 2\ \\text{bits}. |  |

A grossly oversized block is genuinely visible, so content is informative, yet
its rate scales with the log size- _ratio_ log2⁡κ\\log\_{2}\\kappa, not the
_number_ of blocks. Since ranking J⋆J^{\\star} among nn candidates is worth up
to log2⁡n\\log\_{2}n bits, for any fixed perception quality σ\\sigma the content channel
sits at a bounded rate while the full ledger sits at log2⁡n\\log\_{2}n, so the two
ablations are two points on one interface curve rather than two different worlds.
(Proof: Appendix [B](https://arxiv.org/html/2606.30005v4#A2 "Appendix B Proof of Proposition ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").)

The recovery cost is now governed by a single quantity, the rate II, and one
inequality converts rate into cost. We state it and then the law it yields.

###### Lemma 1(Fano, list form).

Let J⋆J^{\\star} be uniform on {1,…,n}\\{1,\\dots,n\\} and let ℒ⁡(Y,U)\\mathcal{L}(Y,U) be any
(Y,U)(Y,U)-measurable list of size mm. With Pc=Pr\[J⋆∈ℒ\]P\_{c}=\\Pr\[J^{\\star}\\in\\mathcal{L}\],

|     |     |     |
| --- | --- | --- |
|  | log2⁡n−I=H⁡(J⋆∣Y,U)≤ 1+Pc​log2​m+(1−Pc)​log2⁡(n−m).\\log\_{2}n-I\\;=\\;H(J^{\\star}\\mid Y,U)\\;\\leq\\;1+P\_{c}\\log\_{2}m+(1-P\_{c})\\log\_{2}(n-m). |  |

###### Theorem 1(Information–recovery tradeoff).

Let ν:=log2⁡n−κκ=(1+o⁡(1))​log2​nκ\\nu:=\\log\_{2}\\frac{n-\\kappa}{\\kappa}=(1+o(1))\\log\_{2}\\frac{n}{\\kappa}. On
ℳn,L,ℓ\\mathcal{M}\_{n,L,\\ell} under an interface of rate II
(Def. [2](https://arxiv.org/html/2606.30005v4#Thmdefinition2 "Definition 2 (Proprioceptive interface of rate 𝐼). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")), the expected number of recovered load-bearing blocks
obeys

|     |     |     |
| --- | --- | --- |
|  | 𝔼⁡\[Z\]≥κ⁡(1−I+1ν).\\mathbb{E}\[Z\]\\;\\geq\\;\\kappa\\left(1-\\frac{I+1}{\\nu}\\right). |  |

Consequently, along the single interface curve of rate II:
(i, endpoints) the size-aware agent (I=log2⁡nI=\\log\_{2}n) archives {J⋆}\\{J^{\\star}\\}
and attains Z=0Z=0, hence 00 recoveries and 00 recall errors; the dashboard-free
agent sits at I=IcontentI=I\_{\\mathrm{content}}, bounded in nn by
Prop. [2](https://arxiv.org/html/2606.30005v4#Thmproposition2 "Proposition 2 (The dashboard-free endpoint is 𝑛-independent). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"), so 𝔼⁡\[Z\]≥κ⁡(1−Icontent+1ν)→κ\\mathbb{E}\[Z\]\\geq\\kappa\\big(1-\\tfrac{I\_{\\mathrm{content}}+1}{\\nu}\\big)\\to\\kappa
as n/κ→∞n/\\kappa\\to\\infty (the numerator stays bounded while ν→∞\\nu\\to\\infty).
(ii, threshold) holding 𝔼⁡\[Z\]≤δ​κ\\mathbb{E}\[Z\]\\leq\\delta\\kappa _requires_ I≥(1−δ)​ν−1I\\geq(1-\\delta)\\nu-1 bits. (iii, price) the floor is affine in II with
slope −κ/ν-\\kappa/\\nu, so saving Δ\\Delta round-trips costs at least
Δ​ν/κ\\Delta\\nu/\\kappa bits of proprioception. (iv, achievability) an II-bit
bucket ledger with uniform probing inside the indicated bucket attains
𝔼⁡\[Z\]≤12​(n​ 2−I−1)\\mathbb{E}\[Z\]\\leq\\tfrac{1}{2}(n\\,2^{-I}-1), so I≥log2⁡n2​δ​κ+1I\\geq\\log\_{2}\\frac{n}{2\\delta\\kappa+1}
bits _suffice_ for 𝔼⁡\[Z\]≤δ​κ\\mathbb{E}\[Z\]\\leq\\delta\\kappa, and Z=0Z=0 at I=log2⁡nI=\\log\_{2}n.

Because the necessary rate (1−δ)​ν−1(1-\\delta)\\nu-1 of (ii) and the sufficient rate
log2⁡n2​δ​κ+1\\log\_{2}\\frac{n}{2\\delta\\kappa+1} of (iv) both equal (1+o⁡(1))​log2⁡(n/κ)(1+o(1))\\log\_{2}(n/\\kappa),
the law is two-sided: the recovery cost falls sharply from Θ⁡(κ)\\Theta(\\kappa) to
o⁡(κ)o(\\kappa) at I⋆=(1+o⁡(1))​log2⁡(n/κ)I^{\\star}=(1+o(1))\\log\_{2}(n/\\kappa) bits, the point where the
interface finally localizes the bulky block to a κ/n\\kappa/n fraction of the
workspace and recovery tools stop being wasted. The dashboard-free agent reads a genuine, noisy size
signal, which Prop. [2](https://arxiv.org/html/2606.30005v4#Thmproposition2 "Proposition 2 (The dashboard-free endpoint is 𝑛-independent). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") places at a bounded rate; it therefore
lands on the costly side of I⋆I^{\\star} once the workspace is large. The ledger is
necessary not because content hides size, but because content localizes J⋆J^{\\star}
only to a κ\\kappa-scale confusion set while a large workspace demands nn-scale
localization. The empirical signature follows: with a ledger the agent pinpoints
the block to evict and archives narrowly; without it it over-archives yet
retrieves far less (255/57255/57 vs. 69/10569/105 archive/retrieve events,
Figure [8](https://arxiv.org/html/2606.30005v4#S3.F8 "Figure 8 ‣ 3.7 Mechanism Ablations ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") b), and the proxy for IcontentI\_{\\mathrm{content}} is the
model’s size- _ranking_ accuracy, which the dashboard drives toward the
I=log2⁡nI=\\log\_{2}n endpoint (Appendix [H](https://arxiv.org/html/2606.30005v4#A8 "Appendix H Proprioceptive-Blindness Diagnostic ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")). Both results are one
inequality read two ways: Fano in reconstruction mode makes recovery necessary
(Proposition [1](https://arxiv.org/html/2606.30005v4#Thmproposition1 "Proposition 1 (Recovery is necessary under budget pressure). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")); Fano in list mode makes recovery tools useless
below Θ⁡(log⁡(n/κ))\\Theta(\\log(n/\\kappa)) bits of proprioception and prices the exchange
between bits observed and round-trips saved (Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")). Proofs are in
Appendix [C](https://arxiv.org/html/2606.30005v4#A3 "Appendix C Proof of Theorem ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

## 3 Experiments

### 3.1 Experiment Setup

#### Benchmarks.

We evaluate across three online regimes with different trajectory scales:
LOCA-Bench \[ [43](https://arxiv.org/html/2606.30005v4#bib.bib1 "")\] as the primary million-token stress test,
BrowseComp-Plus \[ [3](https://arxiv.org/html/2606.30005v4#bib.bib3 "")\] as a 100K-scale deep-research
retrieval transfer, and GAIA \[ [21](https://arxiv.org/html/2606.30005v4#bib.bib2 "")\] on a fixed 165-question validation
subset as a shorter general-assistant setting. We additionally use AMA-Bench as a
long-memory generalization benchmark: completed agent histories are replayed
through the VISTA workspace before question answering, testing whether the
same mechanism can operate as trajectory memory. LOCA-Bench is external to this
work; we adopt its public 75-configuration suite and scoring protocol, counting
errors and timeouts as failures. Full benchmark protocols, subsets, scoring
rules, and budget settings are in the evaluation-details appendix.

#### Baselines and configuration.

We compare against fixed external policies, agent-mediated compression, and
production-agent baselines. The fixed-policy group includes ReAct, Tool-result
Clearing, and stale-observation masking \[ [44](https://arxiv.org/html/2606.30005v4#bib.bib14 "")\]. The
agent-mediated group includes SLIM \[ [40](https://arxiv.org/html/2606.30005v4#bib.bib10 "")\], Active Context
Compression \[ [25](https://arxiv.org/html/2606.30005v4#bib.bib16 "")\], and a structured Skeleton Compression
baseline following context-as-a-tool compressors \[ [16](https://arxiv.org/html/2606.30005v4#bib.bib17 "")\]. We
also include Context-Folding \[ [24](https://arxiv.org/html/2606.30005v4#bib.bib8 "")\], Auto-Archive + Recover,
and Claude Code (CLI release May 6, 2026). On AMA-Bench, we compare with the
benchmark AMA agent and retrieval-style memory baselines. Appendix
Table [5](https://arxiv.org/html/2606.30005v4#A4.T5 "Table 5 ‣ Appendix D Method Capability Comparison ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") and the implementation appendix give the full
capability matrix, prompts, flags, dashboard format, and tool definitions.
Learned context managers whose released artifacts do not match this setting are
discussed as complementary systems rather than treated as direct empirical
rankings.

VISTA is training-free and uses the same strategy across backbones. On
LOCA-Bench, the main runs use Gemini-3-Flash with a 128K budget. At each turn, the
agent sees per-block context metadata and may archive or recover exact
transcript payloads; the task tools are unchanged.
Across all LOCA-Bench baselines we hold fixed the agent loop, task tools, backbone,
context budget, prompt assembly, and scoring; only the context-management policy
changes. SLIM and Active Context Compression are reproduced as training-free
inference-time baselines, while Skeleton Compression is a structured compression
baseline inspired by context-as-a-tool compressors rather than a trained CAT
policy. VISTA uses no task-specific retrieval oracle: archived payloads are
stored as exact transcripts, and recovery is performed through ordinary file or
terminal reads from the returned archive path.

### 3.2 Main Results Across Scales

|  | Mechanism | LOCA-Bench | BrowseComp-Plus | GAIA |
| Method | State | Ctrl | Recov | Acc↑\\uparrow | Traj↓\\downarrow | Acc↑\\uparrow | Traj↓\\downarrow | Acc↑\\uparrow | Traj↓\\downarrow |
| Fixed external policy |
| ReAct | ✗ | ✗ | ✗ | 22.7 | 3.51M | 39.3 | 163K | 61.2 | 23K |
| Tool-result Clearing | ✗ | ✗ | ✗ | 26.7 | 2.60M | 42.7 | 161K | 65.5 | 24K |
| Stale-obs. Masking | ✗ | ✗ | ✗ | 28.0 | 3.32M | 38.0 | 112K | 61.8 | 24K |
| Skeleton Compression | ✗ | ✗ | ✗ | 33.3 | 2.84M | 40.0 | 139K | 70.3 | 28K |
| Agent-mediated / lossy |
| SLIM (summary) | ✗ | ∼\\sim | ✗ | 29.3 | 3.76M | 49.3 | 162K | 67.9 | 30K |
| Active Ctx. Compression | ✗ | ✓ | ✗ | 36.0 | 3.20M | 42.7 | 162K | 71.5 | 39K |
| Context-Folding | ✗ | ✓ | ✗ | 34.7 | 3.41M | 43.3 | 166K | 64.8 | 39K |
| Lossless external store |
| Auto-Archive + Recover | ✗ | ✗ | ✓ | 44.0 | 2.73M | 45.3 | 133K | 63.6 | 20K |
| Claude Code | ✗ | ✓ | ∼\\sim | 42.7 | 6.72M | 52.0 | 247K | 73.9 | 44K |
| Ours and ablations |
| VISTA w/o dashboard | ✗ | ✓ | ✓ | 37.3 | 5.25M | 50.0 | 423K | 68.5 | 24K |
| VISTA w/o recovery | ✓ | ✓ | ✗ | 45.3 | 2.99M | 43.3 | 161K | 72.1 | 28K |
| VISTA (full) | ✓ | ✓ | ✓ | 50.7 | 2.86M | 58.0 | 135K | 73.3 | 33K |

Table 1: Main results across scales. The three benchmarks span
million-, 100K-, and 10K-token trajectories, testing whether context management
transfers across operating regimes. The pattern supports our central claim:
long-horizon gains require not just compression or storage, but an agent-visible
state interface paired with controllable, lossless recovery.

Table [1](https://arxiv.org/html/2606.30005v4#S3.T1 "Table 1 ‣ 3.2 Main Results Across Scales ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") compares VISTA across million-token LOCA-Bench
trajectories, 100K-scale BrowseComp-Plus retrieval, and shorter GAIA
trajectories. On LOCA-Bench, VISTA solves 50.7% of tasks, versus 22.7% for
ReAct and 42.7% for Claude Code, while using less trajectory than Claude Code.
On BrowseComp-Plus it reaches 58.0%, above the strongest baseline at 52.0%.
On GAIA it remains competitive in the shorter setting, reaching 73.3% versus
73.9% for Claude Code. The mechanism columns separate state visibility,
decision maker, and recovery; methods missing one of these pieces do not match
the full interface consistently. The gain is largest in the settings where
evidence must survive long trajectories: LOCA-Bench stresses repeated tool
interaction, while BrowseComp-Plus stresses retrieval followed by delayed
synthesis. GAIA is shorter, so the interface mainly avoids hurting a strong
agent rather than opening the larger long-context gap. The LOCA-Bench cost ledger
also rules out a spend-more explanation: VISTA uses 2.86M tokens and 36.4
steps per task, compared with 6.72M tokens and 171.5 steps for Claude Code
(Appendix Table [6](https://arxiv.org/html/2606.30005v4#A6.T6 "Table 6 ‣ Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")).

### 3.3 Implicit Competence and RL Adaptation

| Method | ID ↑\\uparrow\[-1pt\]BC+ →\\rightarrow BC+ | OOD ↑\\uparrow\[-1pt\]GAIA →\\rightarrow BC+ |
| --- | --- | --- |
| Zero-shot baselines |
| --- |
| Base | 13.3 | 13.3 |
| Ours (zero-shot) | 20.0 (+6.7) | 20.0(+6.7) |
| RL adaptation |
| Context-tool GRPO | 27.3(+14.0) | 17.3 (+4.0) |
| Ours (RL) | 31.3(+18.0) | 21.3(+8.0) |

Table 2: Post-training and zero-shot transfer. Our RL variant exceeds
context-tool GRPO in both regimes. Zero-shot trails ID post-training but nearly
matches OOD post-training, motivating its use in our main large-scale
experiments. Green: gain over Base.

Table [2](https://arxiv.org/html/2606.30005v4#S3.T2 "Table 2 ‣ 3.3 Implicit Competence and RL Adaptation ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") asks whether explicit state and a rubric for when to
manage merely replace learning, or also provide a better substrate for it. They
do both. The interface addresses the observability bottleneck, while RL can
still refine the management policy acting on the exposed state. Here
In-Distribution (ID) trains and evaluates on BrowseComp-Plus (BC+), whereas
Out-Of-Distribution (OOD) trains on GAIA and evaluates on BC+. In
distribution, the zero-shot variant improves substantially over the
Base model, while our RL variant improves further and exceeds our context-tool
GRPO baseline. For these post-training runs, we use Qwen3-8B and retain only
nonzero-advantage samples. The same ordering persists when training moves to GAIA and evaluation
remains on BrowseComp-Plus: the GAIA-trained policy transfers across search
tasks, with our method retaining the best result. Thus the gain does not require
RL: zero-shot nearly matches OOD post-training before any large-scale training,
which motivates its use in our main experiments. Explicit state and
rubric-guided decisions can also be combined with GRPO, while OOD transfer shows
that the improvement is not solely training-set fit.

Figure [4](https://arxiv.org/html/2606.30005v4#S3.F4 "Figure 4 ‣ 3.3 Implicit Competence and RL Adaptation ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") localizes the implicit behavior exposed by
Figure [2](https://arxiv.org/html/2606.30005v4#S1.F2 "Figure 2 ‣ 1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"). Hard examples use more context-tool calls
than easy ones throughout training, and tool use becomes more active as
validation reward and self-perception improve. The stratification indicates that the
learned policy does not apply one fixed management rate: it allocates more
context-management actions to harder tasks and fewer to easier ones. Because
these quantities are observed along the same training trajectory, we interpret
their co-movement as correlational mechanism evidence rather than evidence that
increasing the number of context-tool calls itself causes reward gains.

Figure 4: Context-tool GRPO learns when to manage. Dashboard-free
perception improves with reward,
while dashboard-aided perception remains high. Harder tasks consistently invoke
more context tools. These trends support implicit, difficulty-adaptive
management, not a causal effect of tool use on reward.

### 3.4 Pressure Regimes

#### LOCA-Bench million-token pressure.

Figure 5: Pressure sweep. Across 8K–256K context growth, VISTA
degrades more gracefully than ReAct; the right panel reports average API tokens
per task.

LOCA-Bench creates the failure mode VISTA targets: useful observations arrive
early, bulky tool results accumulate, and the agent must still act correctly many
steps later. Figure [5](https://arxiv.org/html/2606.30005v4#S3.F5 "Figure 5 ‣ LOCA-Bench million-token pressure. ‣ 3.4 Pressure Regimes ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") sweeps 8K to 256K context growth on the
full 75-task LOCA-Bench suite; exact counts are in Appendix
Table [8](https://arxiv.org/html/2606.30005v4#A6.T8 "Table 8 ‣ Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"). The methods are close at low pressure, but the
gap opens as distractor volume grows: one-way truncation degrades while
recoverable externalization remains usable. At 8K the methods are essentially
tied (82.7 versus 84.0), but by 128K the gap is 50.7 versus 22.7, and VISTA
also spends fewer average tokens (2.86M versus 3.51M). This is the expected
signature of recoverable working memory.

Figure 6: BrowseComp-Plus window sweep. With task set fixed, VISTA
peaks at intermediate windows: tiny windows make management overhead costly,
while large windows make ReAct truncation less damaging.

Figure 7: Cross-backbone results. The same untrained VISTA layer is
best on all four backbones against ReAct, SLIM, Active Context Compression, and
Claude Code.

#### BrowseComp-Plus retrieval pressure.

BrowseComp-Plus tests whether the interface helps outside the workflow-heavy
LOCA-Bench setting. Here the bottleneck is whether early retrieved evidence
survives until synthesis.
We set W=12W{=}12K below the median first-retrieval
depth of the gold document (≈17\\approx 17K tokens), so ReAct often loses early
evidence while VISTA continues under budget. This is a transfer result
rather than a leaderboard setting: loose windows usually keep the decisive
document visible, so the methods are much closer.
Figure [7](https://arxiv.org/html/2606.30005v4#S3.F7 "Figure 7 ‣ LOCA-Bench million-token pressure. ‣ 3.4 Pressure Regimes ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") varies only WW: tiny windows make dashboard
overhead costly, large windows let ReAct retain enough evidence, and the gain
peaks in the middle. VISTA also
uses less active context than ReAct, though more cumulative API tokens, because
it survives longer and issues more retrieval rounds.

### 3.5 Backbone Robustness

The cross-backbone result asks whether the effect is tied to one model family.
It is not: the same untrained VISTA layer improves Claude-Sonnet-4.5,
DeepSeek-V4-Pro, GLM-5, and Gemini-3-Flash at 128K
(Figure [7](https://arxiv.org/html/2606.30005v4#S3.F7 "Figure 7 ‣ LOCA-Bench million-token pressure. ‣ 3.4 Pressure Regimes ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")), including stronger backbones. This supports the
elicitation view: capable models can use a context-management interface when
runtime state is visible.

### 3.6 Offline Trajectory-Memory Transfer

| Method | F1 | Acc. | Runtime/ep | Tokens/ep |
| --- | --- | --- | --- | --- |
| BM25 | 0.335 | 0.575 | 35.5s | 303.43K |
| EMem | 0.363 | 0.651 | 166.2s | 470.30K |
| Mem0 | 0.329 | 0.536 | 108.0s | 30.63K |
| AMA | 0.368 | 0.753 | 176.5s | 268.98K |
| VISTA | 0.382 | 0.731 | 43.7s | 148.49K |

Table 3: VISTA as replayed trajectory memory on AMA-Bench. Long-memory evaluation against the specialized AMA agent and
memory-style adapters.

AMA-Bench removes live tool interaction but preserves the long-memory demand: the
model must answer questions about completed agent histories. We adapt
VISTA by replaying each trajectory into the workspace before QA, so actions
and observations become managed blocks rather than a flat prompt. This tests
whether VISTA generalizes beyond online context control to a standard
long-memory benchmark. On the full 208-episode comparison, VISTA leads on
F1, stays within about two points of the specialized AMA agent on judge accuracy,
and does so at roughly a quarter of the per-episode runtime; it also outperforms
BM25, EMem, and Mem0 adapters on F1. A training-free layer thus stays on par with
a purpose-built memory agent while running far cheaper, a clean case of transfer
to offline trajectory memory.
Table [9](https://arxiv.org/html/2606.30005v4#A6.T9 "Table 9 ‣ Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") in Appendix gives the by-domain breakdown of
AMA-Bench.

### 3.7 Mechanism Ablations

Figure 8: Component ablations.(a) Removing archive, dashboard,
recovery, or agent choice hurts more than interface variants. (b)
Per-run archive vs. retrieve events (same grouping): without the dashboard the
agent over-archives yet retrieves far less (255/57 vs. 69/105 for the full
system), archiving blindly rather than selectively.

We probe the method along seven variants that hold the model, task set, token
estimator, prompt assembly, and context limit fixed, changing only one mechanism
at a time (Figure [8](https://arxiv.org/html/2606.30005v4#S3.F8 "Figure 8 ‣ 3.7 Mechanism Ablations ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")). Four of them remove a capability.
No-archive drops recoverable externalization, no-dashboard removes the workspace
map, no-recover hides payload paths, and fixed-archive replaces agent choice with
a static rule. Two further variants leave every capability intact and perturb
only the interface, one rephrasing the archive wording and one rendering the same
state as a status board. Because capability and description move on separate
axes, any remaining gap is attributable to the mechanism itself rather than to
surface wording.

The two axes come apart cleanly. Removing a capability is costly, with no-archive
falling to 27/7527/75 and no-dashboard to 28/7528/75, while the wording and
status-board variants stay within a point or two of the full 38/7538/75. The gain
therefore rides the capability pathway rather than phrasing. Tools alone are not
enough either. No-dashboard keeps archive and recovery actions available, yet
lacking the state to target them it issues 255255 archives against only 5757
recoveries, where the full system spends 6969 archives and 105105 recoveries
(Figure [8](https://arxiv.org/html/2606.30005v4#S3.F8 "Figure 8 ‣ 3.7 Mechanism Ablations ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") b). This over-archive, under-retrieve pattern is blind
offloading rather than selective management, and it is precisely the behavior the
rate-limited interface of Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") predicts.

## 4 Analysis

#### Does the perception gap actually exist?

|  | Total size | Block size | Pairwise |
| --- | --- | --- | --- |
| Backbone | −-dash | ++dash | −-dash | ++dash | −-dash | ++dash |
| --- | --- | --- | --- | --- | --- | --- |
| Claude-Sonnet-4.5 | 0.84 | 0.00 | 0.37 | 0.02 | 0.67 | 0.83 |
| DeepSeek-V4-Pro | 0.44 | 0.00 | 0.28 | 0.00 | 0.75 | 1.00 |
| GLM-5 | 0.48 | 0.00 | 0.35 | 0.00 | 0.73 | 0.88 |
| Gemini-3-Flash | 0.43 | 0.00 | 0.24 | 0.00 | 0.68 | 1.00 |

Table 4: The perception gap is real and token-magnitude specific.
Self-estimated context state with the dashboard stripped (−-dash) versus
present (++dash). Size is median relative error; pairwise is within-2×2\\times
accuracy.

VISTA assumes an agent cannot read its own context state from the prompt,
because size, recency, and remaining budget are runtime metadata rather than
text. We test this directly at the first archive moment of real LOCA-Bench runs. We
strip the dashboard and ask the backbone to report its own state along three
independent probes, namely total transcript size, individual block size, and
pairwise size comparison, scoring each against exact token counts across four
open and closed backbones (Table [4](https://arxiv.org/html/2606.30005v4#S4.T4 "Table 4 ‣ Does the perception gap actually exist? ‣ 4 Analysis ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")). The gap is consistent
and large. Without the dashboard every backbone misjudges size, with median
relative error from 0.430.43 to 0.840.84 and estimates essentially uncorrelated with
truth. Adding the factual ledger collapses size error to zero on all four models
and lifts pairwise discrimination toward perfect. The effect is specific to token
magnitude rather than transcript memory, and it holds on open and closed weights
alike, so the intervention is a factual interface rather than a stronger prompt
or a larger model. This is the empirical counterpart of the proprioceptive
channel in Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"), since the dashboard is what moves the agent
from the size-blind regime toward full state observability.

#### What does a rescued run look like?

Figure 9: Case study trace. In one 128K LOCA-Bench run, VISTA archives
large evidence, keeps the live context compact relative to a no-archive
counterfactual, and recovers payloads when needed.

Figure [9](https://arxiv.org/html/2606.30005v4#S4.F9 "Figure 9 ‣ What does a rescued run look like? ‣ 4 Analysis ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") shows one 128K LOCA-Bench email-triage run. The
dashboard marks a large inbox-export block as the biggest item, the agent
archives it, keeps the live prompt below the no-archive counterfactual, and later
reads the exact payload back for the final action. A matched baseline summarizes
or clears the block and cannot restore the verbatim value. Across rescued tasks,
this full archive-then-recover loop appears in 8 of the 16 cases where
VISTA archives at least one block. In 13 other archive-containing runs
outside the rescued subset, archiving mainly frees space without later recovery.
Thus VISTA does not win by discarding old evidence; it moves evidence out of
view while preserving an addressable recovery path. The advantage is clearest on
long trajectories, where VISTA lowers active-context overhead while improving
accuracy.

#### Does the dashboard scale?

![Refer to caption](https://arxiv.org/html/2606.30005v4/fig_dashboard_overhead.png)Figure 10: Dashboard overhead is bounded by the active window, not the
trajectory length (BrowseComp-Plus).
(a) Net dashboard tokens (tool schemas and system prompt excluded)
against cumulative registered blocks NN: the cost peaks near N≈62N{\\approx}62 and
then declines. (b) The visible working set grows sublinearly in NN
(slope bends →0.330.72\\!\\rightarrow\\!0.33 at the same NN), because archiving moves
blocks into recoverable handles and out of the rendered ledger. Solid lines are
binned medians; shaded bands are interquartile ranges.

The dashboard adds tokens, so a fair worry is that it grows without bound as a
trajectory registers more blocks. It does not. We measure dashboard cost on the
three official BrowseComp-Plus runs (deepseek-v4-pro, W=12,288W{=}12{,}288,
B=163,840B{=}163{,}840; the runs whose mean accuracy is the reported 58.0%58.0\\%), using
the harness’s per-turn accounting over all 3030 queries per run. Each turn logs a
fixed overhead of tool schemas plus system prompt (a constant 492492 tokens across
every query, computed with the cl100k\_base tokenizer) and the dashboard
message; we subtract the fixed component to isolate the dashboard’s own cost.
Figure [10](https://arxiv.org/html/2606.30005v4#S4.F10 "Figure 10 ‣ Does the dashboard scale? ‣ 4 Analysis ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")(a) shows that this net footprint is not linear in the
trajectory length: it peaks near N≈62N{\\approx}62 at roughly 340340 tokens and then
_declines_ as NN grows, because the dashboard renders the visible working
set rather than the full history. Figure [10](https://arxiv.org/html/2606.30005v4#S4.F10 "Figure 10 ‣ Does the dashboard scale? ‣ 4 Analysis ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")(b) explains why: the
visible set grows sublinearly in the cumulative block count, with its slope
bending from 0.720.72 to 0.330.33 at the same N≈62N{\\approx}62, as archiving continually
moves blocks out of the visible ledger into recoverable handles. The turning
point in (a) coincides with the slope change in (b): once archiving keeps pace
with new blocks, the visible set—and therefore the dashboard footprint—stops
tracking NN and is instead bounded by the active window BB. Dashboard overhead
is thus decoupled from total trajectory length.

## 5 Related Work

Prior work clarifies where context decisions sit and what state the agent can
observe.

#### Context managed for the agent.

One line keeps context decisions outside the model policy. Stale-observation
masking, Demand Paging, AgentOS, and AgentSwing hide, page, or route context in
the runtime
\[ [44](https://arxiv.org/html/2606.30005v4#bib.bib14 ""), [18](https://arxiv.org/html/2606.30005v4#bib.bib24 ""), [12](https://arxiv.org/html/2606.30005v4#bib.bib23 ""), [7](https://arxiv.org/html/2606.30005v4#bib.bib11 "")\]; such systems
may track size, age, or usage, but that state remains internal to the
controller. Structured-eviction and cache-efficient managers such as Context
Window Lifecycle and TokenPilot push this line further, replacing lossy
summarization with deterministic, semantically aware pruning and cache-friendly
ingestion to extend the working horizon at lower token cost
\[ [23](https://arxiv.org/html/2606.30005v4#bib.bib46 ""), [38](https://arxiv.org/html/2606.30005v4#bib.bib45 "")\], yet they still decide what to evict on
the agent’s behalf. Memory and retrieval systems such as MemGPT, Mem0, SimpleMem,
MR.Agent, PlugMem, BudgetMem, and SkillPro organize prior experience through
virtual context, long-term memory, or retrieval/graph stores
\[ [22](https://arxiv.org/html/2606.30005v4#bib.bib5 ""), [5](https://arxiv.org/html/2606.30005v4#bib.bib6 ""), [15](https://arxiv.org/html/2606.30005v4#bib.bib18 ""), [9](https://arxiv.org/html/2606.30005v4#bib.bib19 ""), [39](https://arxiv.org/html/2606.30005v4#bib.bib20 ""), [45](https://arxiv.org/html/2606.30005v4#bib.bib21 ""), [20](https://arxiv.org/html/2606.30005v4#bib.bib22 "")\].
These systems provide useful storage or routing substrates, but the agent does
not receive a per-block map of its active prompt. In Figure [1](https://arxiv.org/html/2606.30005v4#S0.F1 "Figure 1 ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
this corresponds to context being managed _for_ the agent: the runtime may
discard stale observations, page records, or retrieve memories, but the model
sees only the resulting prompt. It therefore cannot directly decide which
visible evidence should stay, move out of view, or return later, nor can it
trade a small but critical item against a large expendable tool result.

#### Self-managed context without state metadata.

A second line makes context management part of the agent loop. Context as a Tool,
Active Context Compression, ContextBudget, Context-Folding, and LongSeeker expose
compression, folding, deletion, or routing actions, often through learned
policies or specialized controllers
\[ [16](https://arxiv.org/html/2606.30005v4#bib.bib17 ""), [25](https://arxiv.org/html/2606.30005v4#bib.bib16 ""), [30](https://arxiv.org/html/2606.30005v4#bib.bib15 ""), [24](https://arxiv.org/html/2606.30005v4#bib.bib8 ""), [17](https://arxiv.org/html/2606.30005v4#bib.bib9 "")\].
This line is closest to our notion of self-management: the agent or controller
can invoke context operations rather than passively waiting for truncation.
However, these operations usually act on summaries, milestones, commits, or
branches rather than on a persistent block table. ContextBudget makes token
pressure explicit, and Context-Folding gives branch and return actions, but they
do not expose the VISTA-style state needed to target a precise oversized block
while preserving a small exact detail. Other systems add hierarchy, compression
guidance, agent-compatible managers, learned memory operations, or compact
reasoning summaries
\[ [8](https://arxiv.org/html/2606.30005v4#bib.bib36 ""), [10](https://arxiv.org/html/2606.30005v4#bib.bib35 ""), [41](https://arxiv.org/html/2606.30005v4#bib.bib31 ""), [13](https://arxiv.org/html/2606.30005v4#bib.bib12 ""), [42](https://arxiv.org/html/2606.30005v4#bib.bib33 ""), [46](https://arxiv.org/html/2606.30005v4#bib.bib34 ""), [11](https://arxiv.org/html/2606.30005v4#bib.bib28 ""), [28](https://arxiv.org/html/2606.30005v4#bib.bib29 ""), [2](https://arxiv.org/html/2606.30005v4#bib.bib30 ""), [29](https://arxiv.org/html/2606.30005v4#bib.bib7 ""), [26](https://arxiv.org/html/2606.30005v4#bib.bib32 "")\],
and PACE adapts memory granularity by predicting each item’s relevance to the
next action \[ [27](https://arxiv.org/html/2606.30005v4#bib.bib47 "")\].
These works support our premise that context management is an agent-level
decision, but their compressed representations are generally lossy and coarse
relative to tool traces that contain exact identifiers, URLs, or table rows.
VISTA instead isolates what runtime state the agent must perceive, then pairs
that perception with block-level lossless archive and recovery.

#### Self-state awareness.

Work on budget awareness, temporal blindness, and agent
externalization studies signals that models cannot infer from prompt contents
alone \[ [1](https://arxiv.org/html/2606.30005v4#bib.bib27 ""), [14](https://arxiv.org/html/2606.30005v4#bib.bib26 ""), [4](https://arxiv.org/html/2606.30005v4#bib.bib13 ""), [48](https://arxiv.org/html/2606.30005v4#bib.bib25 "")\].
Complementary probing work finds that agent-critical information such as plans is
context-resident rather than persisted in hidden state, decaying once removed
from the visible context \[ [19](https://arxiv.org/html/2606.30005v4#bib.bib48 "")\], motivating an explicit
self-description of working memory rather than assuming the model retains it.
VISTA treats context state as such a signal and supplies it externally at
inference time. This framing separates our contribution from simply enlarging
the context window or improving summarizers: the missing information is not only
more text, but a compact self-description of the agent’s current working memory.
In our setting, that self-description includes which blocks exist, how large and
old they are, whether they are visible or archived, and whether they can be
recovered exactly. This is the Figure [1](https://arxiv.org/html/2606.30005v4#S0.F1 "Figure 1 ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") contrast: the agent does
not merely see context, but also sees a compact state view over that context. We
evaluate this view mainly on LOCA-Bench, which stresses online tool agents under
controllable context growth \[ [43](https://arxiv.org/html/2606.30005v4#bib.bib1 "")\], and use AMA-Bench as a
memory-oriented transfer point \[ [47](https://arxiv.org/html/2606.30005v4#bib.bib4 "")\].

## 6 Conclusion

We argued that frontier LLMs are proprioceptively blind to their own context:
they cannot perceive how large, old, or used each piece of working memory is.
VISTA addresses this with a runtime dashboard plus lossless archive and
recovery, giving the agent context-state information it can act on without
destroying evidence. With no training, the same interface
outperforms ReAct, deletion, masking, compaction, and Claude Code on LOCA-Bench and
transfers across four backbones. The result suggests that some agent
capabilities are elicited by making hidden runtime state perceptible, positioning
the interface as complementary to post-training rather than a replacement.

## References

- \[1\]C. Ackerman (2026)Evidence for limited metacognition in LLMs.
External Links: 2509.21545,
[Link](https://arxiv.org/abs/2509.21545 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px3.p1.1 "Self-state awareness. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[2\]M. Aghajohari, K. Chitsaz, A. Kazemnejad, S. Chandar, A. Sordoni, A. Courville, and S. Reddy (2025)The markovian thinker: architecture-agnostic linear scaling of reasoning.
arXiv preprint arXiv:2510.06557.
Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[3\]Z. Chen, X. Ma, S. Zhuang, P. Nie, K. Zou, A. Liu, J. Green, K. Patel, R. Meng, M. Su, S. Sharifymoghaddam, Y. Li, H. Hong, X. Shi, X. Liu, N. Thakur, C. Zhang, L. Gao, W. Chen, and J. Lin (2025)BrowseComp-plus: a more fair and transparent evaluation benchmark of deep-research agent.
External Links: 2508.06600,
[Link](https://arxiv.org/abs/2508.06600 "")Cited by: [§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px1.p1.1 "Benchmarks. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[4\]Y. Cheng, A. S. Moakhar, C. Fan, P. Hosseini, K. Faghih, Z. Sodagar, W. Wang, and S. Feizi (2025)Your LLM agents are temporally blind: the misalignment between tool use decisions and human time perception.
arXiv preprint arXiv:2510.23853.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px3.p1.1 "Self-state awareness. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[5\]P. Chhikara, D. Khant, S. Aryan, T. Singh, and D. Yadav (2025)Mem0: building production-ready ai agents with scalable long-term memory.
arXiv preprint arXiv:2504.19413.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[6\]X. Dai, Z. Xu, W. Cai, and Q. Xu (2026)From samples to scenarios: a new paradigm for probabilistic forecasting.
In The Fourteenth International Conference on Learning Representations,
Cited by: [Appendix F](https://arxiv.org/html/2606.30005v4#A6.p1.1 "Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[7\]Z. Feng, L. Su, Z. Zhang, X. Wang, X. Zhang, X. Wang, R. Fang, Q. Zhang, B. Li, S. Cai, et al. (2026)AgentSwing: adaptive parallel context management routing for long-horizon web agents.
arXiv preprint arXiv:2603.27490.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[8\]M. Hu, T. Chen, Q. Chen, Y. Mu, W. Shao, and P. Luo (2025)Hiagent: hierarchical working memory management for solving long-horizon agent tasks with large language model.
In Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers),
pp. 32779–32798.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[9\]S. Ji, Y. Li, and B. Hooi (2026)Memory is reconstructed, not retrieved: graph memory for llm agents.
External Links: 2606.06036,
[Link](https://arxiv.org/abs/2606.06036 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[10\]M. Kang, W. Chen, D. Han, H. A. Inan, L. Wutschitz, Y. Chen, R. Sim, and S. Rajmohan (2025)Acon: optimizing context compression for long-horizon llm agents.
arXiv preprint arXiv:2510.00615.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[11\]V. Kontonis, Y. Zeng, S. Garg, L. Chen, H. Tang, Z. Wang, A. Awadallah, E. Horvitz, J. Langford, and D. Papailiopoulos (2026)Memento: teaching llms to manage their own context.
arXiv preprint arXiv:2604.09852.
Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[12\]C. Li, X. Liu, X. Meng, and X. Zhao (2026)Architecting agentos: from token-level context to emergent system-level intelligence.
External Links: 2602.20934,
[Link](https://arxiv.org/abs/2602.20934 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[13\]J. Liang, J. Han, W. Li, X. Wang, Z. Zhang, Z. Jiang, Y. Liao, T. Li, Y. Huang, H. Shen, et al. (2026)GenericAgent: a token-efficient self-evolving llm agent via contextual information density maximization.
arXiv preprint arXiv:2604.17091.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[14\]Y. Lin, Z. Wang, M. Liu, Y. Shan, L. Bai, J. Zhang, X. Jin, B. Chen, J. Su, X. Wang, J. Pei, and M. Li (2026)BAGEN: are llm agents budget-aware?.
External Links: 2606.00198,
[Link](https://arxiv.org/abs/2606.00198 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px3.p1.1 "Self-state awareness. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[15\]J. Liu, Y. Su, P. Xia, S. Han, Z. Zheng, C. Xie, M. Ding, and H. Yao (2026)SimpleMem: efficient lifelong memory for llm agents.
arXiv preprint arXiv:2601.02553.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[16\]S. Liu, J. Yang, B. Jiang, Y. Li, J. Guo, X. Liu, and B. Dai (2025)Context as a tool: context management for long-horizon swe-agents.
arXiv preprint arXiv:2512.22087.
Cited by: [Appendix E](https://arxiv.org/html/2606.30005v4#A5.SS0.SSS0.Px3.p1.1 "Baseline definitions. ‣ Appendix E Implementation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§1](https://arxiv.org/html/2606.30005v4#S1.p2.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px2.p1.1 "Baselines and configuration. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[17\]Y. Lu, R. Ye, Y. Du, J. Wang, S. Liu, and S. Chen (2026)LongSeeker: elastic context orchestration for long-horizon search agents.
arXiv preprint arXiv:2605.05191.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[18\]T. Mason (2026)The missing memory hierarchy: demand paging for llm context windows.
External Links: 2603.09023,
[Link](https://arxiv.org/abs/2603.09023 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[19\]A. Mehta and A. Datta (2026)Plans don’t persist: why context management is load bearing for llm agents.
arXiv preprint arXiv:2606.22953.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px3.p1.1 "Self-state awareness. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[20\]Q. Mi, Z. Ma, M. Yang, H. Li, Y. Wang, H. Zhang, and J. Wang (2026)Skill-pro: learning reusable skills from experience via non-parametric ppo for llm agents.
External Links: 2602.01869,
[Link](https://arxiv.org/abs/2602.01869 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[21\]G. Mialon, C. Fourrier, C. Swift, T. Wolf, Y. LeCun, and T. Scialom (2024)GAIA: a benchmark for general ai assistants.
In Proceedings of the 12th International Conference on Learning Representations (ICLR),
External Links: 2311.12983Cited by: [§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px1.p1.1 "Benchmarks. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[22\]C. Packer, S. Wooders, K. Lin, V. Fang, S. G. Patil, I. Stoica, and J. E. Gonzalez (2023)MemGPT: towards llms as operating systems.
arXiv preprint arXiv:2310.08560.
Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[23\]A. Semenov and S. Dorofeev (2026)Beyond compaction: structured context eviction for long-horizon agents.
arXiv preprint arXiv:2606.11213.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[24\]W. Sun, M. Lu, Z. Ling, K. Liu, X. Yao, Y. Yang, and J. Chen (2025)Scaling long-horizon llm agent via context-folding.
arXiv preprint arXiv:2510.11967.
Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p2.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px2.p1.1 "Baselines and configuration. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[25\]N. Verma (2026)Active context compression: autonomous memory management in llm agents.
arXiv preprint arXiv:2601.07190.
Cited by: [Appendix E](https://arxiv.org/html/2606.30005v4#A5.SS0.SSS0.Px3.p1.1 "Baseline definitions. ‣ Appendix E Implementation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§1](https://arxiv.org/html/2606.30005v4#S1.p2.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px2.p1.1 "Baselines and configuration. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[26\]Z. Wang, H. Chen, J. Wang, and W. Wei (2026)Memex (rl): scaling long-horizon llm agents via indexed experience memory.
arXiv preprint arXiv:2603.04257.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[27\]L. Wei, X. Peng, G. Zhang, C. Jiang, H. Li, L. Lin, Y. Xu, J. Liu, K. Wang, B. Wang, et al. (2026)PACE: predictive adaptive context extraction for long-horizon llm agents.
In Proceedings of the 64th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers),
pp. 27184–27199.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[28\]I. Wu, Y. Qu, A. Setlur, and A. Kumar (2026)Reasoning cache: continual improvement over long horizons via short-horizon rl.
arXiv preprint arXiv:2602.03773.
Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[29\]X. Wu, K. Li, Y. Zhao, L. Zhang, L. Ou, H. Yin, Z. Zhang, X. Yu, D. Zhang, Y. Jiang, et al. (2025)Resum: unlocking long-horizon search intelligence via context summarization.
arXiv preprint arXiv:2509.13313.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[30\]Y. Wu, Y. Zheng, T. Xu, Z. Zhang, Y. Yu, J. Zhu, C. Ma, B. Lin, B. Dong, H. Zhu, et al. (2026)Contextbudget: budget-aware context management for long-horizon search agents.
arXiv preprint arXiv:2604.01664.
Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§1](https://arxiv.org/html/2606.30005v4#S1.p2.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[31\]B. Xu, X. Dai, D. Tang, and K. Zhang (2025)One surrogate to fool them all: universal, transferable, and targeted adversarial attacks with clip.
In Proceedings of the 2025 ACM SIGSAC Conference on Computer and Communications Security,
pp. 3087–3101.
Cited by: [Appendix F](https://arxiv.org/html/2606.30005v4#A6.p3.1 "Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[32\]B. Xu, X. Dai, F. Yang, and K. Zhang (2026)When agent automation becomes profitable: quantifying and insuring autonomous ai risk through trace-economic underwriting.
arXiv preprint arXiv:2606.16465.
Cited by: [Appendix F](https://arxiv.org/html/2606.30005v4#A6.p1.1 "Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[33\]B. Xu, X. Dai, and K. Zhang (2026)Contextual agentic memory is a memo, not true memory.
arXiv preprint arXiv:2604.27707.
Cited by: [Appendix E](https://arxiv.org/html/2606.30005v4#A5.SS0.SSS0.Px1.p1.1 "Benchmark setting. ‣ Appendix E Implementation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[34\]B. Xu, D. Fang, H. Li, and K. Zhang (2026)From multi-agent to single-agent: when is skill distillation beneficial?.
arXiv preprint arXiv:2604.01608.
Cited by: [Appendix G](https://arxiv.org/html/2606.30005v4#A7.p2.1 "Appendix G Limitations ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[35\]B. Xu, F. Yang, X. Dai, D. Tang, and K. Zhang (2025)CLIP-guided backdoor defense through entropy-based poisoned dataset separation.
In Proceedings of the 33rd ACM International Conference on Multimedia,
pp. 7415–7423.
Cited by: [Appendix G](https://arxiv.org/html/2606.30005v4#A7.p1.1 "Appendix G Limitations ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[36\]B. Xu, F. Yang, X. Dai, D. Tang, and K. Zhang (2026)From internal diagnosis to external auditing: a vlm-driven paradigm for online test-time backdoor defense.
arXiv preprint arXiv:2601.19448.
Cited by: [Appendix F](https://arxiv.org/html/2606.30005v4#A6.p1.1 "Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[37\]B. Xu, F. Yang, D. Tang, X. Dai, and K. Zhang (2026)Breaking the stealth-potency trade-off in clean-image backdoors with generative trigger optimization.
In Proceedings of the AAAI Conference on Artificial Intelligence,
Vol. 40, pp. 27197–27205.
Cited by: [Appendix G](https://arxiv.org/html/2606.30005v4#A7.p1.1 "Appendix G Limitations ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[38\]B. Xu, Z. Xue, D. Chen, C. Fu, C. Wu, C. Huang, C. Jiang, J. Fang, X. Deng, Y. Chen, et al. (2026)TokenPilot: cache-efficient context management for llm agents.
arXiv preprint arXiv:2606.17016.
Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[39\]K. Yang, Z. Chen, X. He, J. Jiang, M. Galley, C. Wang, J. Gao, J. Han, and C. Zhai (2026)PlugMem: a task-agnostic plugin memory module for llm agents.
External Links: 2603.03296,
[Link](https://arxiv.org/abs/2603.03296 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[40\]H. Yen, A. Paranjape, M. Xia, T. Venkatesh, J. Hessel, D. Chen, and Y. Zhang (2025)Lost in the maze: overcoming context limitations in long-horizon agentic search.
arXiv preprint arXiv:2510.18939.
Cited by: [Appendix E](https://arxiv.org/html/2606.30005v4#A5.SS0.SSS0.Px3.p1.1 "Baseline definitions. ‣ Appendix E Implementation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px2.p1.1 "Baselines and configuration. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[41\]L. Yi, R. Lei, L. Yao, Y. Xie, Y. Li, W. Zhang, Z. Wei, Y. Li, and J. Nie (2026)Learning agent-compatible context management for long-horizon tasks.
arXiv preprint arXiv:2605.30785.
Cited by: [Appendix G](https://arxiv.org/html/2606.30005v4#A7.p2.1 "Appendix G Limitations ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[42\]Y. Yu, L. Yao, Y. Xie, Q. Tan, J. Feng, Y. Li, and L. Wu (2026)Agentic memory: learning unified long-term and short-term memory management for large language model agents.
arXiv preprint arXiv:2601.01885.
Cited by: [Appendix G](https://arxiv.org/html/2606.30005v4#A7.p2.1 "Appendix G Limitations ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[43\]W. Zeng, Y. Huang, and J. He (2026)LOCA-bench: benchmarking language agents under controllable and extreme context growth.
In Proceedings of the 43rd International Conference on Machine Learning (ICML),
External Links: 2602.07962Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p1.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§1](https://arxiv.org/html/2606.30005v4#S1.p6.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px1.p1.1 "Benchmarks. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px3.p1.1 "Self-state awareness. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[44\]H. Zhang, Q. Xu, Z. Li, L. Zhang, P. Jiang, Y. Zhang, and J. McAuley (2026)Masking stale observations helps search agents–until it doesn’t: a regime map and its mechanism.
arXiv preprint arXiv:2606.00408.
Cited by: [§1](https://arxiv.org/html/2606.30005v4#S1.p2.1 "1 Introduction ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§3.1](https://arxiv.org/html/2606.30005v4#S3.SS1.SSS0.Px2.p1.1 "Baselines and configuration. ‣ 3.1 Experiment Setup ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[45\]H. Zhang, H. Yue, T. Feng, Q. Long, J. Bao, B. Jin, W. Zhang, X. Li, J. You, C. Qin, and W. Wang (2026)Learning query-aware budget-tier routing for runtime agent memory.
External Links: 2602.06025,
[Link](https://arxiv.org/abs/2602.06025 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px1.p1.1 "Context managed for the agent. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[46\]Y. Zhang, J. Shu, Y. Ma, X. Lin, S. Wu, and J. Sang (2026)Memory as action: autonomous context curation for long-horizon agentic tasks.
In Findings of the Association for Computational Linguistics: ACL 2026,
pp. 19149–19164.
Cited by: [Appendix G](https://arxiv.org/html/2606.30005v4#A7.p2.1 "Appendix G Limitations ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"),
[§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px2.p1.1 "Self-managed context without state metadata. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[47\]Y. Zhao, B. Yuan, J. Huang, H. Yuan, Z. Yu, H. Xu, L. Hu, A. Shankarampeta, Z. Huang, W. Ni, et al. (2026)AMA-bench: evaluating long-horizon memory for agentic applications.
In Proceedings of the 43rd International Conference on Machine Learning (ICML),
External Links: 2602.22769Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px3.p1.1 "Self-state awareness. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

- \[48\]C. Zhou, H. Chai, W. Chen, Z. Guo, R. Shan, Y. Song, T. Xu, Y. Yang, A. Yu, W. Zhang, C. Zheng, J. Zhu, Z. Zheng, Z. Zhang, X. Lou, C. Zhang, Z. Fu, J. Wang, W. Liu, J. Lin, and W. Zhang (2026)Externalization in llm agents: a unified review of memory, skills, protocols and harness engineering.
External Links: 2604.08224,
[Link](https://arxiv.org/abs/2604.08224 "")Cited by: [§5](https://arxiv.org/html/2606.30005v4#S5.SS0.SSS0.Px3.p1.1 "Self-state awareness. ‣ 5 Related Work ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").


## Appendix A Proof of Proposition [1](https://arxiv.org/html/2606.30005v4\#Thmproposition1 "Proposition 1 (Recovery is necessary under budget pressure). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")

This is Fano’s inequality in _reconstruction_ mode: a budget-limited state
cannot reproduce more blocks than it has bits for. We restate the setting. The
history holds NN blocks X1,…,XNX\_{1},\\dots,X\_{N}, each an
independent string of kk uniformly random bits, so H⁡(Xi)=kH(X\_{i})=k and the XiX\_{i} are
mutually independent. A non-recovering method holds a pre-reveal in-prompt state
RR with H⁡(R)≤BH(R)\\leq B. The state RR is a function of the blocks and the method’s
internal randomness, formed before the query index i⋆i^{\\star} is revealed, and
i⋆i^{\\star} is drawn uniformly on {1,…,N}\\{1,\\dots,N\\} independently of everything else.
After the reveal the method outputs a guess g⁡(R,i⋆)g(R,i^{\\star}), and it is correct
when g⁡(R,i⋆)=Xi⋆g(R,i^{\\star})=X\_{i^{\\star}}.

Let Pe(i)=Pr\[g(R,i)≠Xi\]P\_{e}^{(i)}=\\Pr\[g(R,i)\\neq X\_{i}\] and let the reported success probability be
1−Pe1-P\_{e} with Pe=1N​∑i=1NPe(i)P\_{e}=\\frac{1}{N}\\sum\_{i=1}^{N}P\_{e}^{(i)}, the average over the
uniform i⋆i^{\\star}.

#### Step 1: per-block Fano bound.

Fix a block ii. Since XiX\_{i} is uniform on an alphabet of size 2k2^{k}, Fano’s
inequality applied to the estimator g⁡(R,i)g(R,i) gives

|     |     |     |
| --- | --- | --- |
|  | H⁡(Xi∣R)≤Hb​(Pe(i))+Pe(i)​log2⁡(2k−1)≤ 1+Pe(i)​k,H(X\_{i}\\mid R)\\;\\leq\\;H\_{b}\\!\\left(P\_{e}^{(i)}\\right)+P\_{e}^{(i)}\\log\_{2}(2^{k}-1)\\;\\leq\\;1+P\_{e}^{(i)}\\,k, |  |

where HbH\_{b} is the binary entropy function, bounded by 11.

#### Step 2: independence couples the blocks to a budget.

Because the XiX\_{i} are mutually independent, H(X1:N)=∑iH(Xi)H(X\_{1:N})=\\sum\_{i}H(X\_{i}), and
subadditivity of conditional entropy gives H(X1:N∣R)≤∑iH(Xi∣R)H(X\_{1:N}\\mid R)\\leq\\sum\_{i}H(X\_{i}\\mid R). Hence

|     |     |     |     |
| --- | --- | --- | --- |
|  | ∑i=1NI⁡(Xi,R)\\displaystyle\\sum\_{i=1}^{N}I(X\_{i};R) | =∑i(H⁡(Xi)−H⁡(Xi∣R))\\displaystyle=\\sum\_{i}\\big(H(X\_{i})-H(X\_{i}\\mid R)\\big) |  |
|  |  | ≤H(X1:N)−H(X1:N∣R)\\displaystyle\\leq H(X\_{1:N})-H(X\_{1:N}\\mid R) |  |
|  |  | =I(X1:N;R)≤H(R)≤B.\\displaystyle=I(X\_{1:N};R)\\;\\leq\\;H(R)\\;\\leq\\;B. |  |

#### Step 3: combine.

Using I⁡(Xi,R)=k−H⁡(Xi∣R)≥k−1−Pe(i)​kI(X\_{i};R)=k-H(X\_{i}\\mid R)\\geq k-1-P\_{e}^{(i)}k from Step 1 and summing,

|     |     |     |     |
| --- | --- | --- | --- |
|  | B\\displaystyle B | ≥∑i=1NI⁡(Xi,R)\\displaystyle\\geq\\sum\_{i=1}^{N}I(X\_{i};R) |  |
|  |  | ≥∑i=1N(k−1−Pe(i)​k)=N​k−N−k​∑i=1NPe(i).\\displaystyle\\geq\\sum\_{i=1}^{N}\\big(k-1-P\_{e}^{(i)}k\\big)=Nk-N-k\\sum\_{i=1}^{N}P\_{e}^{(i)}. |  |

Dividing by N​kNk and using Pe=1N​∑iPe(i)P\_{e}=\\frac{1}{N}\\sum\_{i}P\_{e}^{(i)},

|     |     |     |     |
| --- | --- | --- | --- |
|  | Pe\\displaystyle P\_{e} | ≥1−1k−BN​k,\\displaystyle\\geq 1-\\frac{1}{k}-\\frac{B}{Nk}, |  |
|  | Pr⁡\[correct\]=1−Pe\\displaystyle\\Pr\[\\text{correct}\]=1-P\_{e} | ≤BN​k+1k.\\displaystyle\\leq\\frac{B}{Nk}+\\frac{1}{k}. |  |

#### VISTA attains probability one.

VISTA writes each block to external storage as an exact transcript and keeps
only a compact handle in the prompt. The pre-reveal prompt holds the instruction
and NN handles, whose size is O⁡(N​log⁡N)O(N\\log N) rather than O⁡(N​k)O(Nk). Once i⋆i^{\\star} is
revealed, the agent reads payload i⋆i^{\\star} and recovers Xi⋆X\_{i^{\\star}} byte for
byte. Whenever the instruction, the handles, and one recovered block fit within
BB, the method emits Xi⋆X\_{i^{\\star}} exactly, so its success probability is 11.

#### Asymptotic separation.

The gap statement requires a regime in which VISTA _stays feasible_
while the lossy bound vanishes. Feasibility needs the NN handles plus one
recovered block to fit, i.e. B≥c0​N​log2​N+kB\\geq c\_{0}N\\log\_{2}N+k for the constant c0c\_{0} set
by the handle encoding; the lossy bound BN​k+1k\\tfrac{B}{Nk}+\\tfrac{1}{k} vanishes when
N​k/B→∞Nk/B\\to\\infty and k→∞k\\to\\infty. Both hold, for example, at
k=⌈N⌉k=\\lceil\\sqrt{N}\\rceil and B=c​N​log2⁡NB=cN\\log\_{2}N with c>c0c>c\_{0}: then BB dominates the
handle cost, so VISTA is feasible and stays at success 11, while
BN​k+1k=Θ⁡(log⁡NN)→0\\tfrac{B}{Nk}+\\tfrac{1}{k}=\\Theta\\!\\big(\\tfrac{\\log N}{\\sqrt{N}}\\big)\\to 0, so the
lossy success probability tends to 00 and the gap tends to 11 as N→∞N\\to\\infty.
A _fixed_ BB does not exhibit this separation, because then VISTA’s own
O⁡(N​log⁡N)O(N\\log N) handle table eventually violates the budget. The separation is thus
a statement about the growth rate of the raw evidence N​kNk relative to a budget
BB that grows only fast enough to index it. ∎

## Appendix B Proof of Proposition [2](https://arxiv.org/html/2606.30005v4\#Thmproposition2 "Proposition 2 (The dashboard-free endpoint is 𝑛-independent). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")

We locate the dashboard-free endpoint of Def. [2](https://arxiv.org/html/2606.30005v4#Thmdefinition2 "Definition 2 (Proprioceptive interface of rate 𝐼). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"). Conditioned on
J⋆=jJ^{\\star}=j, the observation W=(W1,…,Wn)W=(W\_{1},\\dots,W\_{n}) is Gaussian with independent
coordinates, Wi∼𝒩⁡(mi(j),σ2)W\_{i}\\sim\\mathcal{N}(m\_{i}^{(j)},\\sigma^{2}), where the mean vector
m(j)m^{(j)} has mj(j)=ln⁡Lm\_{j}^{(j)}=\\ln L (the bulky block) and mi(j)=ln⁡ℓm\_{i}^{(j)}=\\ln\\ell for
i≠ji\\neq j. Let PjP\_{j} denote this conditional law and P¯=1n​∑kPk\\bar{P}=\\frac{1}{n}\\sum\_{k}P\_{k}
the mixture.

#### Step 1: mutual information as mixture KL.

For J⋆J^{\\star} uniform, a standard identity gives

|     |     |     |
| --- | --- | --- |
|  | I(J⋆;W)=1n∑j=1nKL(Pj∥P¯).I(J^{\\star};W)\\;=\\;\\frac{1}{n}\\sum\_{j=1}^{n}\\mathrm{KL}\\!\\left(P\_{j}\\,\\\|\\,\\bar{P}\\right). |  |

Because KL(P∥⋅)\\mathrm{KL}(P\\,\\\|\\,\\cdot) is convex in its second argument and
P¯=1n​∑kPk\\bar{P}=\\frac{1}{n}\\sum\_{k}P\_{k}, Jensen gives
KL(Pj∥P¯)≤1n∑kKL(Pj∥Pk)\\mathrm{KL}(P\_{j}\\\|\\bar{P})\\leq\\frac{1}{n}\\sum\_{k}\\mathrm{KL}(P\_{j}\\\|P\_{k}), hence

|     |     |     |
| --- | --- | --- |
|  | I(J⋆;W)≤1n2∑j=1n∑k=1nKL(Pj∥Pk).I(J^{\\star};W)\\;\\leq\\;\\frac{1}{n^{2}}\\sum\_{j=1}^{n}\\sum\_{k=1}^{n}\\mathrm{KL}\\!\\left(P\_{j}\\,\\\|\\,P\_{k}\\right). |  |

#### Step 2: pairwise Gaussian KL.

PjP\_{j} and PkP\_{k} are Gaussians with the same covariance σ2​𝐈\\sigma^{2}\\mathbf{I}, so
KL(Pj∥Pk)=12​σ2∥m(j)−m(k)∥22\\mathrm{KL}(P\_{j}\\\|P\_{k})=\\frac{1}{2\\sigma^{2}}\\\|m^{(j)}-m^{(k)}\\\|\_{2}^{2}. For j≠kj\\neq k
the mean difference is nonzero only in coordinates jj and kk: coordinate jj
contributes ln⁡L−ln⁡ℓ=ln⁡κ\\ln L-\\ln\\ell=\\ln\\kappa and coordinate kk contributes
ln⁡ℓ−ln⁡L=−ln⁡κ\\ln\\ell-\\ln L=-\\ln\\kappa, so ‖m(j)−m(k)‖22=2​(ln⁡κ)2\\\|m^{(j)}-m^{(k)}\\\|\_{2}^{2}=2(\\ln\\kappa)^{2} and

|     |     |     |
| --- | --- | --- |
|  | KL(Pj∥Pk)=(ln⁡κ)2σ2(j≠k),KL(Pj∥Pj)=0.\\mathrm{KL}(P\_{j}\\\|P\_{k})=\\frac{(\\ln\\kappa)^{2}}{\\sigma^{2}}\\quad(j\\neq k),\\qquad\\mathrm{KL}(P\_{j}\\\|P\_{j})=0. |  |

#### Step 3: combine.

There are n⁡(n−1)n(n-1) ordered pairs with j≠kj\\neq k, so

|     |     |     |
| --- | --- | --- |
|  | I⁡(J⋆,W)≤1n2​n​(n−1)​(ln⁡κ)2σ2≤(ln⁡κ)2σ2​nats=(log2⁡κ)2σ2​ln⁡2​bits,I(J^{\\star};W)\\;\\leq\\;\\frac{1}{n^{2}}\\,n(n-1)\\,\\frac{(\\ln\\kappa)^{2}}{\\sigma^{2}}\\;\\leq\\;\\frac{(\\ln\\kappa)^{2}}{\\sigma^{2}}\ \\text{nats}\\;=\\;\\frac{(\\log\_{2}\\kappa)^{2}}{\\sigma^{2}}\\,\\ln 2\ \\text{bits}, |  |

the last equality using ln⁡κ=(ln⁡2)​log2​κ\\ln\\kappa=(\\ln 2)\\log\_{2}\\kappa. The bound depends only on
the log size-ratio log2⁡κ\\log\_{2}\\kappa and the perception noise σ\\sigma, and is
constant in the workspace size nn. This is the dashboard-free endpoint: it sits
at a fixed rate while the full ledger sits at log2⁡n\\log\_{2}n. By
Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"), holding 𝔼⁡\[Z\]≤δ​κ\\mathbb{E}\[Z\]\\leq\\delta\\kappa needs
(1+o⁡(1))​log2⁡(n/κ)(1+o(1))\\log\_{2}(n/\\kappa) bits, so for any fixed σ\\sigma a large enough
workspace pushes the content channel below the make-room threshold and the ledger
becomes necessary. ∎

## Appendix C Proof of Theorem [1](https://arxiv.org/html/2606.30005v4\#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")

The proof has four parts: (A) the list-Fano lemma; (B) a reduction that turns the
make-room recovery cost into a list-decoding error, converting the information
budget II into a lower bound on 𝔼⁡\[Z\]\\mathbb{E}\[Z\]; (C) the closed-form tradeoff and
its corollaries (endpoints, threshold, price); and (D) a matching achievability
construction. Throughout, J⋆J^{\\star} is uniform on \[n\]:={1,…,n}\[n\]:=\\{1,\\dots,n\\},
κ=L/ℓ∈{2,…,n−1}\\kappa=L/\\ell\\in\\{2,\\dots,n-1\\} is an integer, and ν:=log2⁡n−κκ\\nu:=\\log\_{2}\\frac{n-\\kappa}{\\kappa}.

#### (A) List-Fano lemma (proof of Lemma [1](https://arxiv.org/html/2606.30005v4\#Thmlemma1 "Lemma 1 (Fano, list form). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")).

Let ℒ=ℒ⁡(Y,U)\\mathcal{L}=\\mathcal{L}(Y,U) be a list of size mm and
E:=𝟏\[J⋆∉ℒ\]E:=\\mathbf{1}\[J^{\\star}\\notin\\mathcal{L}\], so Pr\[E=0\]=Pc\\Pr\[E{=}0\]=P\_{c}. Expand
H(J⋆,E∣Y,U)H(J^{\\star},E\\mid Y,U) two ways. Since EE is a function of (J⋆,Y,U)(J^{\\star},Y,U),
H(J⋆,E∣Y,U)=H(J⋆∣Y,U)H(J^{\\star},E\\mid Y,U)=H(J^{\\star}\\mid Y,U). Also

|     |     |     |
| --- | --- | --- |
|  | H(J⋆,E∣Y,U)=H(E∣Y,U)+H(J⋆∣E,Y,U)≤1+H(J⋆∣E,Y,U).H(J^{\\star},E\\mid Y,U)=H(E\\mid Y,U)+H(J^{\\star}\\mid E,Y,U)\\leq 1+H(J^{\\star}\\mid E,Y,U). |  |

Condition on EE: given E=0E{=}0, J⋆J^{\\star} lies in a set of size ≤m\\leq m, so
H⁡(J⋆∣E=0,Y,U)≤log2⁡mH(J^{\\star}\\mid E{=}0,Y,U)\\leq\\log\_{2}m; given E=1E{=}1, J⋆J^{\\star} lies in the
complement of size ≤n−m\\leq n-m (recall ℒ\\mathcal{L} is (Y,U)(Y,U)-measurable), so
H⁡(J⋆∣E=1,Y,U)≤log2⁡(n−m)H(J^{\\star}\\mid E{=}1,Y,U)\\leq\\log\_{2}(n-m). Averaging with weights Pc,1−PcP\_{c},1-P\_{c} and
using H⁡(J⋆∣Y,U)=H⁡(J⋆)−I⁡(J⋆,Y,U)=log2⁡n−IH(J^{\\star}\\mid Y,U)=H(J^{\\star})-I(J^{\\star};Y,U)=\\log\_{2}n-I (as U⟂J⋆U\\perp J^{\\star}, I⁡(J⋆,Y,U)=I⁡(J⋆,Y)=II(J^{\\star};Y,U)=I(J^{\\star};Y)=I),

|     |     |     |
| --- | --- | --- |
|  | log2⁡n−I≤ 1+Pc​log2​m+(1−Pc)​log2⁡(n−m),\\log\_{2}n-I\\;\\leq\\;1+P\_{c}\\log\_{2}m+(1-P\_{c})\\log\_{2}(n-m), |  |

which is Lemma [1](https://arxiv.org/html/2606.30005v4#Thmlemma1 "Lemma 1 (Fano, list form). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"). ∎

#### (B) Reduction: recovery cost lower-bounds via list decoding.

By the “still-over” argument (part (E) below), any admissible make-room policy
is equivalent in cost to archiving blocks in some order
π=(π1,π2,…)\\pi=(\\pi\_{1},\\pi\_{2},\\dots) that is measurable in (Y,U)(Y,U) and stopping at the first
time the freed size reaches LL. Because the bulky block frees LL by itself while
each load-bearing block frees only ℓ\\ell, the process stops exactly at step
T=min⁡(τ,κ)T=\\min(\\tau,\\kappa) where τ\\tau is the position of J⋆J^{\\star} in π\\pi: if
τ≤κ\\tau\\leq\\kappa it captures J⋆J^{\\star} and frees LL; if τ>κ\\tau>\\kappa it has
archived κ\\kappa load-bearing blocks, freeing κ​ℓ=L\\kappa\\ell=L, before reaching
J⋆J^{\\star}. The number of archived load-bearing blocks, which are exactly the ones
that must later be recovered, is ( [5](https://arxiv.org/html/2606.30005v4#S2.E5 "In 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")), Z=min⁡(τ−1,κ)Z=\\min(\\tau-1,\\kappa).

Fix any integer 1≤m≤κ1\\leq m\\leq\\kappa and let ℒm:={π1,…,πm}\\mathcal{L}\_{m}:=\\{\\pi\_{1},\\dots,\\pi\_{m}\\},
the first mm probed blocks; this is a size-mm, (Y,U)(Y,U)-measurable list. The key
observation is

|     |     |     |     |
| --- | --- | --- | --- |
|  | Z≥m⟺τ>m⟺J⋆∉ℒm,Z\\geq m\ \\Longleftrightarrow\ \\tau>m\ \\Longleftrightarrow\ J^{\\star}\\notin\\mathcal{L}\_{m}, |  | (6) |

because Z=min⁡(τ−1,κ)≥mZ=\\min(\\tau-1,\\kappa)\\geq m iff τ−1≥m\\tau-1\\geq m (using m≤κm\\leq\\kappa) iff
J⋆J^{\\star} is not among the first mm probes. Hence, writing
Pc(m):=Pr\[J⋆∈ℒm\]P\_{c}(m):=\\Pr\[J^{\\star}\\in\\mathcal{L}\_{m}\], we have Pr\[Z≥m\]=1−Pc(m)\\Pr\[Z\\geq m\]=1-P\_{c}(m).

_Expectation via tail sum._ Since Z∈{0,1,…,κ}Z\\in\\{0,1,\\dots,\\kappa\\},

|     |     |     |     |
| --- | --- | --- | --- |
|  | 𝔼\[Z\]=∑m=1κPr\[Z≥m\]=∑m=1κ(1−Pc(m))=κ−∑m=1κPc(m).\\mathbb{E}\[Z\]=\\sum\_{m=1}^{\\kappa}\\Pr\[Z\\geq m\]=\\sum\_{m=1}^{\\kappa}\\big(1-P\_{c}(m)\\big)=\\kappa-\\sum\_{m=1}^{\\kappa}P\_{c}(m). |  | (7) |

_One-shot list bound._ Apply Lemma [1](https://arxiv.org/html/2606.30005v4#Thmlemma1 "Lemma 1 (Fano, list form). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") to the size-κ\\kappa
list ℒκ\\mathcal{L}\_{\\kappa}. With m=κm=\\kappa and n−κ≥κn-\\kappa\\geq\\kappa (so
ν=log2⁡n−κκ≥0\\nu=\\log\_{2}\\frac{n-\\kappa}{\\kappa}\\geq 0),

|     |     |     |
| --- | --- | --- |
|  | log2⁡n−I≤1+Pc​(κ)​log2​κ+(1−Pc​(κ))​log2⁡(n−κ).\\log\_{2}n-I\\leq 1+P\_{c}(\\kappa)\\log\_{2}\\kappa+(1-P\_{c}(\\kappa))\\log\_{2}(n-\\kappa). |  |

Rearranging, and using log2⁡n≥log2⁡(n−κ)\\log\_{2}n\\geq\\log\_{2}(n-\\kappa),

|     |     |     |
| --- | --- | --- |
|  | −(I+1)≤(log2⁡(n−κ)−log2⁡n)+Pc​(κ)​(log2⁡κ−log2⁡(n−κ))≤−Pc​(κ)​ν,-(I+1)\ \\leq\ \\big(\\log\_{2}(n-\\kappa)-\\log\_{2}n\\big)+P\_{c}(\\kappa)\\big(\\log\_{2}\\kappa-\\log\_{2}(n-\\kappa)\\big)\ \\leq\ -\\,P\_{c}(\\kappa)\\,\\nu, |  |

so Pc​(κ)≤I+1νP\_{c}(\\kappa)\\leq\\frac{I+1}{\\nu}. Because ℒm⊆ℒκ\\mathcal{L}\_{m}\\subseteq\\mathcal{L}\_{\\kappa} for m≤κm\\leq\\kappa, Pc​(m)≤Pc​(κ)≤I+1νP\_{c}(m)\\leq P\_{c}(\\kappa)\\leq\\frac{I+1}{\\nu}, and
plugging into ( [7](https://arxiv.org/html/2606.30005v4#A3.E7 "In (B) Reduction: recovery cost lower-bounds via list decoding. ‣ Appendix C Proof of Theorem ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")),

|     |     |     |     |
| --- | --- | --- | --- |
|  | 𝔼⁡\[Z\]≥κ−κ​I+1ν=κ⁡(1−I+1ν).\\boxed{\ \\mathbb{E}\[Z\]\ \\geq\ \\kappa-\\kappa\\frac{I+1}{\\nu}=\\kappa\\Big(1-\\frac{I+1}{\\nu}\\Big).\ } |  | (8) |

This is the bound in Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"). (When the right side is negative the
statement is vacuous, consistent with Z≥0Z\\geq 0.)

#### (C) Corollaries.

_(i) Endpoints._ The size-aware ledger reveals the size vector, which
identifies the unique block of size LL, so I=log2⁡nI=\\log\_{2}n; then the agent archives
{J⋆}\\{J^{\\star}\\}, freeing exactly LL, giving τ=1\\tau=1, Z=0Z=0, hence 00 recoveries
and 00 recall errors. The content-only agent (no ledger) has
I=IcontentI=I\_{\\mathrm{content}} bounded by Proposition [2](https://arxiv.org/html/2606.30005v4#Thmproposition2 "Proposition 2 (The dashboard-free endpoint is 𝑛-independent). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"), a constant in
nn, so ( [8](https://arxiv.org/html/2606.30005v4#A3.E8 "In (B) Reduction: recovery cost lower-bounds via list decoding. ‣ Appendix C Proof of Theorem ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")) gives 𝔼⁡\[Z\]≥κ⁡(1−Icontent+1ν)→κ\\mathbb{E}\[Z\]\\geq\\kappa(1-\\frac{I\_{\\mathrm{content}}+1}{\\nu})\\to\\kappa as
n/κ→∞n/\\kappa\\to\\infty (since ν→∞\\nu\\to\\infty while IcontentI\_{\\mathrm{content}} stays
bounded). The pure size-blind case I=0I=0 is the special instance
σ→∞\\sigma\\to\\infty.

_(ii) Threshold._ 𝔼⁡\[Z\]≤δ​κ\\mathbb{E}\[Z\]\\leq\\delta\\kappa forces, via
( [8](https://arxiv.org/html/2606.30005v4#A3.E8 "In (B) Reduction: recovery cost lower-bounds via list decoding. ‣ Appendix C Proof of Theorem ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")), κ⁡(1−I+1ν)≤δ​κ\\kappa(1-\\frac{I+1}{\\nu})\\leq\\delta\\kappa, i.e. I≥(1−δ)​ν−1I\\geq(1-\\delta)\\nu-1.

_(iii) Price._ The right-hand floor κ⁡(1−I+1ν)\\kappa(1-\\frac{I+1}{\\nu}) is affine in
II with slope −κ/ν-\\kappa/\\nu, so raising II by one bit lowers the guaranteed
recovery floor by at most κ/ν\\kappa/\\nu; achieving a reduction of Δ\\Delta
round-trips therefore requires I≥Δ​ν/κI\\geq\\Delta\\nu/\\kappa bits.

_From ZZ to recoveries and errors._ Each archived load-bearing block is
queried later; answering correctly requires recovering it, one round-trip each,
so the expected number of recoveries is ≥𝔼⁡\[Z\]\\geq\\mathbb{E}\[Z\]. If recoveries are
capped at rr, at least 𝔼⁡\[Z\]−r\\mathbb{E}\[Z\]-r archived load-bearing blocks are never
restored in expectation, each causing an exact-recall failure. All three
size-aware costs are 00.

#### (D) Achievability (matching upper bound).

Consider an II-bit _bucket ledger_: partition \[n\]\[n\] into 2⌊I⌋2^{\\lfloor I\\rfloor} contiguous buckets, each of size at most b:=⌈n​ 2−⌊I⌋⌉b:=\\lceil n\\,2^{-\\lfloor I\\rfloor}\\rceil, and report the bucket YY containing J⋆J^{\\star}; then
I⁡(J⋆,Y)≤log2⁡2⌊I⌋=⌊I⌋≤II(J^{\\star};Y)\\leq\\log\_{2}2^{\\lfloor I\\rfloor}=\\lfloor I\\rfloor\\leq I, so this is a
rate-≤I\\leq I interface. The agent probes blocks inside the reported bucket in
uniformly random order until the flag clears. The bulky block sits at a uniform
position P∈{1,…,b′}P\\in\\{1,\\dots,b^{\\prime}\\} within its bucket of size b′≤bb^{\\prime}\\leq b, and as in part
(E) it frees LL upon capture, so the number of load-bearing blocks archived is
min⁡(P−1,κ)≤P−1\\min(P-1,\\kappa)\\leq P-1, giving

|     |     |     |
| --- | --- | --- |
|  | 𝔼⁡\[Z\]≤𝔼⁡\[P−1\]=b′−12≤b−12≤n2​ 2−⌊I⌋,\\mathbb{E}\[Z\]\ \\leq\ \\mathbb{E}\[P-1\]=\\frac{b^{\\prime}-1}{2}\ \\leq\ \\frac{b-1}{2}\ \\leq\ \\frac{n}{2}\\,2^{-\\lfloor I\\rfloor}, |  |

where the last step uses ⌈x⌉−1<x\\lceil x\\rceil-1<x. Thus 𝔼⁡\[Z\]≤δ​κ\\mathbb{E}\[Z\]\\leq\\delta\\kappa
whenever n2​2−⌊I⌋≤δ​κ\\tfrac{n}{2}2^{-\\lfloor I\\rfloor}\\leq\\delta\\kappa, i.e. ⌊I⌋≥log2⁡n2​δ​κ\\lfloor I\\rfloor\\geq\\log\_{2}\\frac{n}{2\\delta\\kappa}; and I=log2⁡nI=\\log\_{2}n gives buckets
of size 11, hence P=1P=1, Z=0Z=0. For fixed δ\\delta this sufficient rate is
log2⁡(n/κ)−log2⁡(2​δ)+O⁡(1)=(1+o⁡(1))​ν\\log\_{2}(n/\\kappa)-\\log\_{2}(2\\delta)+O(1)=(1+o(1))\\nu, matching the necessary rate
(1−δ)​ν−1(1-\\delta)\\nu-1 of (ii) up to the (1+o⁡(1))(1+o(1)) factor as n/κ→∞n/\\kappa\\to\\infty.
Hence the transition of 𝔼⁡\[Z\]\\mathbb{E}\[Z\] from Θ⁡(κ)\\Theta(\\kappa) to o⁡(κ)o(\\kappa) occurs
at I⋆=(1+o⁡(1))​νI^{\\star}=(1+o(1))\\nu, and ν=(1+o⁡(1))​log2⁡(n/κ)\\nu=(1+o(1))\\log\_{2}(n/\\kappa).

#### (E) Why archive-in-an-order is without loss, and adaptivity is useless.

Two reductions were used above. First, any admissible archive _set_ SS of
size mm that exits overflow can be realized by an order that archives its
members first; the recovered load-bearing count is \|S∖{J⋆}\|\|S\\setminus\\{J^{\\star}\\}\|,
matching ZZ in ( [5](https://arxiv.org/html/2606.30005v4#S2.E5 "In 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")), so restricting to orders is without loss for
the cost. Second, adaptivity through the binary flag adds no usable information:
before the bulky block is archived, every archived prefix of t≤κ−1t\\leq\\kappa-1
load-bearing blocks has freed t​ℓ<Lt\\ell<L, so the flag reads “over”
deterministically and is independent of _which_ blocks were chosen; after
the bulky block is archived the freed size is ≥L\\geq L and the process stops. Thus
the only J⋆J^{\\star}-information available to the ordering is YY, exactly as
assumed, and Lemma [1](https://arxiv.org/html/2606.30005v4#Thmlemma1 "Lemma 1 (Fano, list form). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") applies to the (Y,U)(Y,U)-measurable prefix
lists ℒm\\mathcal{L}\_{m}. This is why the lower bound ( [8](https://arxiv.org/html/2606.30005v4#A3.E8 "In (B) Reduction: recovery cost lower-bounds via list decoding. ‣ Appendix C Proof of Theorem ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")) holds for all
adaptive content-only (I=IcontentI=I\_{\\mathrm{content}}) and rate-II policies alike. ∎

###### Remark 1(Interpretation: dashboard bits versus recovery round-trips).

Theorem [1](https://arxiv.org/html/2606.30005v4#Thmtheorem1 "Theorem 1 (Information–recovery tradeoff). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") identifies a _phase transition in an information_
_parameter_: recovery tools are wasted until the interface supplies
Θ⁡(log⁡(n/κ))\\Theta(\\log(n/\\kappa)) bits about which block to evict, after which the recovery
cost collapses, and the exchange rate is exactly κ/ν\\kappa/\\nu round-trips per bit.
The no-dashboard agent perceives a genuine, noisy size signal from content, but
Proposition [2](https://arxiv.org/html/2606.30005v4#Thmproposition2 "Proposition 2 (The dashboard-free endpoint is 𝑛-independent). ‣ 2.5 Theory: Recovery and Proprioception Are Both Necessary ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") places that signal at
Icontent≤(ln⁡2)​(log2⁡κ)2/σ2I\_{\\mathrm{content}}\\leq(\\ln 2)(\\log\_{2}\\kappa)^{2}/\\sigma^{2} bits, constant in nn, so
it falls below the log2⁡(n/κ)\\log\_{2}(n/\\kappa) make-room threshold once the workspace is
large, while the full ledger reaches the I=log2⁡nI{=}\\log\_{2}n end. The empirical proxy
for IcontentI\_{\\mathrm{content}} is the model’s size- _ranking_ ability: the
pairwise size-comparison accuracy of Appendix [H](https://arxiv.org/html/2606.30005v4#A8 "Appendix H Proprioceptive-Blindness Diagnostic ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") measures
how well content localizes the block to evict, and the dashboard drives it toward
the I=log2⁡nI{=}\\log\_{2}n end (median relative size error 0.430.43–0.840.84 without the
ledger, collapsing to 00 with it; Table [4](https://arxiv.org/html/2606.30005v4#S4.T4 "Table 4 ‣ Does the perception gap actually exist? ‣ 4 Analysis ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception")). The 255/57255/57
vs. 69/10569/105 archive/retrieve split (Figure [8](https://arxiv.org/html/2606.30005v4#S3.F8 "Figure 8 ‣ 3.7 Mechanism Ablations ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") b) is the
over-archive-under-retrieve signature the theorem predicts.

## Appendix D Method Capability Comparison

Table [5](https://arxiv.org/html/2606.30005v4#A4.T5 "Table 5 ‣ Appendix D Method Capability Comparison ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") summarizes the evaluated baselines and the
learned-compression family against the design properties of Section 3. It
isolates the two properties that distinguish
VISTA: an agent-facing context dashboard and byte-exact recovery of
externalized evidence. The marks are a coarse capability summary rather than a
performance claim, and partial marks reflect mechanisms that hold the property
only in part, such as Claude Code, which keeps files on disk but still
summarizes the active context.

| Method | Training-free | Model-agnostic | Agent-controlled | Exact recovery | Context dashboard |
| --- | --- | --- | --- | --- | --- |
| ReAct (append until truncation) | ✓ | ✓ | ✗ | ✗ | ✗ |
| Tool-result clearing | ✓ | ✓ | ✗ | ✗ | ✗ |
| Stale-observation masking | ✓ | ✓ | ✗ | ✗ | ✗ |
| Active Context Compression | ✓ | ✓ | ✓ | ✗ | ✗ |
| Skeleton compression | ✓ | ✓ | ✗ | ✗ | ✗ |
| Claude Code | ✓ | ∼\\sim | ✓ | ∼\\sim | ✗ |
| Learned compression (CAT, RL budget) | ✗ | ✗ | ✓ | ✗ | ✗ |
| Context-Folding | ✗ | ✗ | ✓ | ✗ | ✗ |
| LongSeeker | ✗ | ✗ | ✓ | ✗ | ✗ |
| GenericAgent | ✗ | ✗ | ✓ | ✗ | ✗ |
| VISTA (ours) | ✓ | ✓ | ✓ | ✓ | ✓ |

Table 5: Method capability comparison. Capability summary against the
design properties of Section 3; VISTA uniquely combines agent-facing state
with exact recovery.

## Appendix E Implementation Details

This section reports the exact run configuration, the verbatim prompt the agent
receives, the dashboard format, and the context tool definitions, so the setting
can be reproduced without access to our harness.

#### Benchmark setting.

LOCA-Bench evaluates online tool agents under controllable context growth: the
agent must continue acting while earlier reasoning, tool calls, and observations
remain in or are externalized from the working context. We evaluate 75 task
configurations; unless otherwise stated, accuracy is solved tasks over all 75,
with errors and timeouts counted as failures. AMA-Bench is used as a secondary
generalization benchmark. Its episodes provide a completed trajectory and ask
questions about past events, causal relations, and state changes. This is not
the native online-control setting for VISTA; it tests whether the same
context-management layer can be adapted into trajectory memory. We use the
benchmark’s two-stage memory interface. During memory construction, the
completed trajectory is replayed step by step as a growing conversation: each
action and observation becomes a workspace block, the future questions are
hidden, and the replayed agent may archive exact payloads when the workspace
budget becomes tight. During retrieval, VISTA assembles the resulting
workspace, dashboard, construction events, and recoverable archive handles for
the current question. Thus the AMA-Bench result evaluates a replayed
VISTA workspace as offline memory \[ [33](https://arxiv.org/html/2606.30005v4#bib.bib40 "")\], rather than simply placing the full
trajectory in the model prompt.

#### Run configuration.

VISTA is integrated into the LOCA-Bench harness and invoked as a strategy
(loca run -s self\_managed) with no training and no per-model tuning.
The main results use gemini-3-flash at a 128K budget
(max-context-size=128,000=128{,}000); the cross-backbone runs reuse the same
strategy unchanged on claude-sonnet-4-5, deepseek-v4-pro
(open-weight), and glm-5 (open-weight). Two flags define the full
method: SM\_STRICT\_LONG\_CONTEXT=1 enforces a hard budget rather than a
soft warning, and SM\_BETTER\_DASHBOARD=1 selects the factual ledger
dashboard below. The ablations toggle single flags from this base, for example
SM\_DISABLE\_ARCHIVE, SM\_DISABLE\_AGENT\_ARCHIVE (fixed
archive policy), and SM\_ENABLE\_STATE\_BOARD (status-board variant).
Per-task timeout is 1800 seconds and reasoning effort is medium across all
backbones.

#### Baseline definitions.

We organize the LOCA-Bench baselines by who makes the keep-or-drop decision. Fixed
external policies include ReAct, which appends until truncation; Tool-result
Clearing, which removes old tool-result/tool-call pairs after the prompt crosses
a threshold; and fixed stale masking, which masks old tool observations while
preserving the assistant reasoning and tool-call skeleton. Agent-mediated
baselines still reduce context irreversibly. SLIM \[ [40](https://arxiv.org/html/2606.30005v4#bib.bib10 "")\], reproduced
from its public release, periodically summarizes older context once the budget is
exceeded. Active Context Compression \[ [25](https://arxiv.org/html/2606.30005v4#bib.bib16 "")\] asks the agent to
write and prune its own knowledge blocks. A structured-compression baseline
preserves a compact skeleton of prior context, following the design of
context-as-a-tool compressors \[ [16](https://arxiv.org/html/2606.30005v4#bib.bib17 "")\]. Learned members of this
family generally do not release trained checkpoints and, in many cases, do not
release code, so we reproduce the training-free methods directly and follow the
published inference-time design for the rest rather than a trained policy. Claude Code is the Claude Code command-line agent at the CLI
release of May 6, 2026, included as a strong practical agent with mature tool-use
and context-handling heuristics. These baselines cover deletion, masking,
summarization, self-compression, and structured compression. None combines
agent-facing context-state metadata with exact evidence recovery. On AMA-Bench, the
EMem-style and Mem0-style rows are local adapters implemented for this harness
and should be read as engineering baselines rather than official reproductions.

#### Baseline reproduction details.

SLIM and Active Context Compression are faithful reproductions of training-free
published methods, run with the procedure described by their authors and
triggered at the same 128K budget used for every method. SLIM periodically
summarizes older context once the budget is exceeded, and Active Context
Compression runs the explore, write a knowledge block, then prune the raw history
loop. The structured-compression baseline is inspired by context-as-a-tool
compressors rather than a faithful reimplementation, since that method is learned
and we run no trained policy. Across all baselines we vary only the
context-management mechanism and hold the agent loop, tools, budget, backbone,
and scoring fixed, so accuracy differences reflect the context policy rather than
the surrounding harness.

#### Context-management protocol.

The agent receives the following instruction block appended to the task prompt,
together with a budget notice. It is identical across backbones.

Context-management protocol (verbatim)[⬇](data:text/plain;base64,Q09OVEVYVCBNQU5BR0VNRU5UIFBST1RPQ09MOgpBIDxjb250ZXh0X3dvcmtzcGFjZV9zdGF0dXM+IGRhc2hib2FyZCBpcyBzaG93biBldmVyeSB0dXJuIGFzIGEgY29tcGFjdCBtYXAgb2YKY29udGV4dCBibG9ja3MuIFVzZSBjb250ZXh0IHRvb2xzIG9ubHkgd2hlbiBjbGVhcmx5IG5lZWRlZC4gRG8gbm90IGFyY2hpdmUsCmRlbGV0ZSwgb3Igb2ZmbG9hZCBjb250ZW50IHNvbGVseSBiZWNhdXNlIGl0IGlzIG9sZCwgbGFyZ2UsIG9yIGxpc3RlZCBpbiBjb250ZXh0Cm1ldGFkYXRhOyBsZWF2ZSBjb250ZW50IHZpc2libGUgd2hlbiB0aGUgY29udGV4dCBidWRnZXQgaXMgc3VmZmljaWVudC4gTGFyZ2UKcGF5bG9hZHMgbWF5IGJlIHJlcHJlc2VudGVkIGJ5IHBsYWNlaG9sZGVyczsgaW5zcGVjdCBvcmlnaW5hbHMgb25seSB3aGVuIG5lZWRlZC4KVXNlIG9yZGluYXJ5IGZpbGUvdGVybWluYWwvcHl0aG9uIHRvb2xzLCBzb3VyY2UgbWV0YWRhdGEsIGFuZCBhbnkgaW4tY29udGV4dApwYXlsb2FkIHBsYWNlaG9sZGVycyB0byBpbnNwZWN0IGV4dGVybmFsIGV2aWRlbmNlIHdoZW4gZGV0YWlscyBhcmUgbmVlZGVkLiBGb3IKc3RydWN0dXJlZCBkYXRhIG9yIGNhbGN1bGF0aW9ucywgdXNlIHRoZSBzb3VyY2UgZmlsZSwgc291cmNlIHRvb2wsIG9yIHF1ZXJ5CmRpcmVjdGx5LiBEbyBub3QgY29weSB0YWJsZSwgQ1NWLCBvciBKU09OIHJvd3MgZnJvbSB0aGUgY29udmVyc2F0aW9uIGludG8gY29kZS4=)CONTEXTMANAGEMENTPROTOCOL:A<context\_workspace\_status>dashboardisshowneveryturnasacompactmapofcontextblocks.Usecontexttoolsonlywhenclearlyneeded.Donotarchive,delete,oroffloadcontentsolelybecauseitisold,large,orlistedincontextmetadata;leavecontentvisiblewhenthecontextbudgetissufficient.Largepayloadsmayberepresentedbyplaceholders;inspectoriginalsonlywhenneeded.Useordinaryfile/terminal/pythontools,sourcemetadata,andanyin-contextpayloadplaceholderstoinspectexternalevidencewhendetailsareneeded.Forstructureddataorcalculations,usethesourcefile,sourcetool,orquerydirectly.Donotcopytable,CSV,orJSONrowsfromtheconversationintocode.[⬇](data:text/plain;base64,WW91IG5lZWQgdG8gY29tcGxldGUgdGhlIHRhc2sgd2l0aGluIHRoZSBmb2xsb3dpbmcgY29udGV4dCB3aW5kb3cgc2l6ZToKPGJ1ZGdldDp0b2tlbl9idWRnZXQ+MTI4MDAwPC9idWRnZXQ6dG9rZW5fYnVkZ2V0Pg==)Youneedtocompletethetaskwithinthefollowingcontextwindowsize:<budget:token\_budget>128000</budget:token\_budget>

#### Dashboard format.

Each turn the harness injects a <context\_workspace\_status> block. It is
a budget bar followed by one ledger row per block, with columns ID, approximate
tokens, age (root-turn distance, where 0r is newest), type, compression
level, parent, and status (visible, pinned, archived,
or offloaded\_placeholder). The instance below shows the same compact
column subset used in Figures [1](https://arxiv.org/html/2606.30005v4#S0.F1 "Figure 1 ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") and [3](https://arxiv.org/html/2606.30005v4#S2.F3 "Figure 3 ‣ 2 Methodology ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception"); the full
renderer additionally prints the compression Level and Parent columns described
above.

Dashboard instance shown to the agent[⬇](data:text/plain;base64,IyMgQ29udGV4dCBCdWRnZXQKWyMjIyMjIyMjIyMjIy0tLS0tLS0tXSA2MiUgICh+NzksNDAwIC8gMTI4LDAwMCB0b2tlbnMpCiAgb3ZlcmhlYWQgfjYsMjAwIHwgY29udmVyc2F0aW9uIH43MSw5MDAgfCBkYXNoYm9hcmQgfjEsMzAwCgojIyBDb250ZXh0IEJsb2NrcyAgKEFnZSA9IHJvb3QtdHVybiBkaXN0YW5jZTsgMHIgbmV3ZXN0KQpJRCAgICAgflRvayAgIEFnZSAgVHlwZSAgICAgICAgICAgICAgIFN0YXR1cwotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQjEgICAgICAgMTIwICAgOHIgIHVzZXJfbWVzc2FnZSAgICAgICBwaW5uZWQKQjIgICAgMTgsNDAwICAgN3IgIHRvb2xfY2FsbCAgICAgICAgICBhcmNoaXZlZApCMyAgICAgMiwxNTAgICA2ciAgYXNzaXN0YW50X21lc3NhZ2UgIHZpc2libGUKQjUgICAgMTQsODAwICAgM3IgIHRvb2xfY2FsbCAgICAgICAgICB2aXNpYmxlCkI2ICAgICA5LDMwMCAgIDJyICB0b29sX2NhbGwgICAgICAgICAgdmlzaWJsZQpCOSAgICAgMSwwNzAgICAwciAgYXNzaXN0YW50X21lc3NhZ2UgIHZpc2libGU=)##ContextBudget\[############--------\]62%(~79,400/128,000tokens)overhead~6,200\|conversation~71,900\|dashboard~1,300##ContextBlocks(Age=root-turndistance;0rnewest)ID~TokAgeTypeStatus\-\-\----------------------------------------------B11208ruser\_messagepinnedB218,4007rtool\_callarchivedB32,1506rassistant\_messagevisibleB514,8003rtool\_callvisibleB69,3002rtool\_callvisibleB91,0700rassistant\_messagevisible

#### Context tool definitions.

The agent acts on the workspace with two tools. Archiving replaces a block with a
compact handle and returns the payload file path; the agent recovers byte-exact
content by reading that path with ordinary file or terminal tools, so recovery is
a normal read rather than a dedicated decompressor.

Context tool definitions (docstrings)[⬇](data:text/plain;base64,Y29udGV4dF93b3Jrc3BhY2VfYXJjaGl2ZShibG9ja19pZDogc3RyLCByZXBsYWNlbWVudDogc3RyID0gIiIpIC0+IHN0cgogIFJlcGxhY2Ugb25lIG9yIG1vcmUgYmxvY2tzIHdpdGggY29tcGFjdCBpbmRleGVzLiBUaGUgb3JpZ2luYWwgY29udGVudCBpcwogIHN0b3JlZCBleHRlcm5hbGx5IGFzIGEgcGF5bG9hZCBmaWxlLiBPcGVyYXRpb25zIGFyZSBibG9jay1sZXZlbDogb25seSBsaXN0ZWQKICBibG9jayBJRHMgYXJlIGFyY2hpdmVkLiBSZXR1cm5zIHRoZSBwYXlsb2FkIGZpbGUgcGF0aCBmb3IgbGF0ZXIgcmVjb3ZlcnkuCiAgICBibG9ja19pZDogICAgQmxvY2sgSURzLCByYW5nZXMsIG9yIGdyb3VwIElEcywgZS5nLiAiQjMiLCAiQjMsQjQiLAogICAgICAgICAgICAgICAgICJCMTAtQjIwIiwgb3IgIkcyIi4KICAgIHJlcGxhY2VtZW50OiBTaG9ydCBpbmRleCB0ZXh0IGZvciB0aGUgYXJjaGl2ZWQgYmxvY2socykuCgpjb250ZXh0X3dvcmtzcGFjZV9kZWxldGUoYmxvY2tfaWQ6IHN0ciwgcmVhc29uOiBzdHIpIC0+IHN0cgogIFBlcm1hbmVudGx5IHJlbW92ZSBvbmUgb3IgbW9yZSBibG9ja3MuIERlbGV0ZWQgY29udGVudCBjYW5ub3QgYmUgcmVjb3ZlcmVkLgogICAgYmxvY2tfaWQ6IEJsb2NrIElEcywgcmFuZ2VzLCBvciBncm91cCBJRHMuCiAgICByZWFzb246ICAgU2hvcnQgcmVhc29uIHdoeSB0aGUgY29udGVudCBoYXMgbm8gZnV0dXJlIHRhc2sgdmFsdWUu)context\_workspace\_archive(block\_id:str,replacement:str="")->strReplaceoneormoreblockswithcompactindexes.Theoriginalcontentisstoredexternallyasapayloadfile.Operationsareblock-level:onlylistedblockIDsarearchived.Returnsthepayloadfilepathforlaterrecovery.block\_id:BlockIDs,ranges,orgroupIDs,e.g."B3","B3,B4","B10-B20",or"G2".replacement:Shortindextextforthearchivedblock(s).context\_workspace\_delete(block\_id:str,reason:str)->strPermanentlyremoveoneormoreblocks.Deletedcontentcannotberecovered.block\_id:BlockIDs,ranges,orgroupIDs.reason:Shortreasonwhythecontenthasnofuturetaskvalue.

Large tool results are stored as external transcript payloads with compact
placeholders. These payloads record what a tool returned to the model, not a
complete source database; if a transcript is truncated or paginated, the agent
must query the original source tool for complete data.

## Appendix F Evaluation Details

For LOCA-Bench, we use the independently released public task suite and evaluation
protocol without modification. It contains 75 online tool-task configurations
with controllable context growth, where prior reasoning, tool calls, and
observations accumulate until context management becomes central. We report task
success, count errors and timeouts as incorrect, and compute average steps and
tokens over task rows present in each run log. These cost values therefore
describe observed execution cost rather than normalized cost conditional on
success. They also do not model downstream economic exposure or insurance-style
trace risk \[ [32](https://arxiv.org/html/2606.30005v4#bib.bib43 "")\], online auditing \[ [36](https://arxiv.org/html/2606.30005v4#bib.bib41 "")\], or
probabilistic forecasting settings that turn samples into scenarios
\[ [6](https://arxiv.org/html/2606.30005v4#bib.bib44 "")\]. We additionally log archive and recover/read events for VISTA
variants.

Figure [11](https://arxiv.org/html/2606.30005v4#A6.F11 "Figure 11 ‣ Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") and Table [6](https://arxiv.org/html/2606.30005v4#A6.T6 "Table 6 ‣ Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") expand
the 128K LOCA-Bench comparison, Table [7](https://arxiv.org/html/2606.30005v4#A6.T7 "Table 7 ‣ Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") gives the pairwise
rescued-task split, and Table [8](https://arxiv.org/html/2606.30005v4#A6.T8 "Table 8 ‣ Appendix F Evaluation Details ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception") gives exact counts for the
context-growth sweep in Figure [5](https://arxiv.org/html/2606.30005v4#S3.F5 "Figure 5 ‣ LOCA-Bench million-token pressure. ‣ 3.4 Pressure Regimes ‣ 3 Experiments ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").

Figure 11: Expanded LOCA result at 128K. Tasks solved, tokens, and steps
for the main LOCA-Bench comparison.

| Family | Method | Correct | Acc. | Timeout | Error | Steps | Tokens | Mgmt. events | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| No CM | ReAct | 17 | 22.7 | 0 | 0 | 54.6 | 3.51M | 636 trims | full 75 |
| Deletion | Tool-result Clearing | 20 | 26.7 | 0 | 0 | 72.9 | 2.60M | 1,968 clears | full 75 |
| Masking | Fixed stale masking | 21 | 28.0 | – | – | 61.0 | 3.32M | – | full 75 |
| Summary | SLIM | 22 | 29.3 | – | – | 77.9 | 3.76M | – | full 75 |
| Self-compression | Active Context Compression | 27 | 36.0 | – | – | 65.8 | 3.20M | – | full 75 |
| Structured compression | Skeleton compression | 25 | 33.3 | – | – | 60.5 | 2.84M | – | full 75 |
| Agent CLI | Claude Code | 32 | 42.7 | 0 | 22 | 171.5 | 6.72M | – | full 75 |
| Ours | VISTA | 38 | 50.7 | 20 | 0 | 36.4 | 2.86M | 69 archive / 105 read | full 75 |

Table 6: Dense LOCA run ledger. 128K main comparison with execution cost
and method-specific context-management events.

| Comparison | Both | Base. | VISTA | Neither |
| --- | --- | --- | --- | --- |
| Fixed stale masking | 18 | 3 | 20 | 34 |
| SLIM | 17 | 5 | 21 | 32 |
| Active Context Compression | 20 | 7 | 18 | 30 |
| Claude Code | 25 | 7 | 13 | 30 |

Table 7: Outcome transitions. Pairwise 128K LOCA-Bench split against each
baseline: both solve, baseline-only, VISTA-only, and neither.

| Method | Setting | Success | Avg. steps | Avg. tok. | Notes |
| --- | --- | --- | --- | --- | --- |
| VISTA | 8K | 82.7 | 16.7 | 0.44M | complete |
| VISTA | 16K | 84.0 | 16.2 | 0.52M | complete |
| VISTA | 32K | 70.7 | 17.4 | 0.87M | complete |
| VISTA | 64K | 61.3 | 21.2 | 1.38M | complete |
| VISTA | 96K | 57.3 | 29.7 | 2.32M | complete |
| VISTA | 128K | 50.7 | 36.4 | 2.86M | complete |
| VISTA | 256K | 32.0 | 43.1 | 3.51M | complete |
| ReAct | 8K | 84.0 | 27.9 | 0.68M | complete |
| ReAct | 16K | 74.7 | 24.9 | 0.80M | complete |
| ReAct | 32K | 65.3 | 25.3 | 1.02M | complete |
| ReAct | 64K | 52.0 | 29.6 | 1.70M | complete |
| ReAct | 96K | 36.0 | 39.5 | 2.79M | complete |
| ReAct | 128K | 22.7 | 54.2 | 3.51M | complete |
| ReAct | 256K | 12.0 | 82.6 | 5.80M | complete |

Table 8: Observed pressure sweep. Matched VISTA and ReAct runs over
the full 75-task suite.

For BrowseComp-Plus, we evaluate deep-research retrieval with DeepSeek-V4-Pro on
an N=150N{=}150 subset and report judged Pass@1 with one sampled answer. The agent
searches a fixed, non-adversarial corpus \[ [31](https://arxiv.org/html/2606.30005v4#bib.bib37 "")\], so evidence is
scattered across retrieved passages and the transcript grows through repeated retrieval. To expose context management,
we use a deliberately tight active window (W=12W{=}12K tokens per call) and total
budget (B=160B{=}160K), chosen so early evidence can be evicted before synthesis.

For GAIA, we use a fixed random 165-question subset of the public validation split.
We preserve the original question text and attached files, require the official
FINAL ANSWER: format, and score with quasi-exact match. All methods use
DeepSeek-V4-Pro, real web/search/file tools, W=12W{=}12K, and B=80B{=}80K.

For AMA-Bench, each of the 208 episodes contains 12 open-ended questions, giving
2496 judged QA pairs. We report judge accuracy and token-level F1 following the
benchmark harness. Runtime per episode is measured for generation; judge time is
reported separately in the analysis files.

|  | Embodied | Game | OpenQA | Software | Text2SQL | Web |
| --- | --- | --- | --- | --- | --- | --- |
| Method | Acc. | F1 | Acc. | F1 | Acc. | F1 | Acc. | F1 | Acc. | F1 | Acc. | F1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AMA | 0.678 | 0.489 | 0.814 | 0.407 | 0.817 | 0.249 | 0.565 | 0.150 | 0.838 | 0.395 | 0.782 | 0.272 |
| VISTA | 0.683 | 0.525 | 0.747 | 0.443 | 0.731 | 0.386 | 0.567 | 0.238 | 0.846 | 0.384 | 0.763 | 0.341 |

Table 9: AMA domain breakdown. By-domain accuracy and F1 for AMA and
the VISTA trajectory-memory adaptation.

| Case | Baselines failed | VISTA steps | Archive/read evidence | Evaluation signal |
| --- | --- | --- | --- | --- |
| NHL B2B schedule analysis | ReAct, Tool-clear, SLIM | 64 | 5 archive calls; 17 payload reads/uses | CSV and Google Sheet correct; HA/AH/HH/AA counts verified |
| WooCommerce low-selling products | ReAct, Claude-style, Tool-clear, SLIM | 38 | 4 archive calls; 3 payload reads/uses | Correct products moved; subscriber emails sent |
| Canvas final-exam schedule | ReAct, Claude-style, Tool-clear, SLIM | 17 | 1 archive call for course announcements | Final Excel schedule accepted |
| NLP course reminders | ReAct, Claude-style, Tool-clear, SLIM | 31 | 1 archive call for large roster table | Correct students emailed; dropped/submitted students excluded |

Table 10: Rescued-task case studies. Tasks VISTA solves where
multiple baselines fail, with archive and payload-use counts.

## Appendix G Limitations

VISTA supplies the missing proprioceptive signals, but it does not guarantee
the agent uses them well. A model can still misread the dashboard, archive
evidence it later needs, or recover a payload too late. The elicitation view
also predicts a floor: a model with little latent context-management skill has
little for the interface to unlock, and GLM-5 gains least. We test four
backbones; mapping the low-capability end of this curve remains open. We also
do not test poisoned external evidence \[ [35](https://arxiv.org/html/2606.30005v4#bib.bib39 "")\] or generative trigger
settings \[ [37](https://arxiv.org/html/2606.30005v4#bib.bib38 "")\].

VISTA is complementary to post-training rather than an alternative to it.
Training improves what an agent does with context-state information, while the
dashboard supplies information that is absent from the prompt. We do not combine
VISTA with post-training, richer metadata such as predicted relevance, or
learned context-management policies such as learned compression managers or
memory-action policies \[ [41](https://arxiv.org/html/2606.30005v4#bib.bib31 ""), [42](https://arxiv.org/html/2606.30005v4#bib.bib33 ""), [46](https://arxiv.org/html/2606.30005v4#bib.bib34 "")\]; nor
do we test whether skills distilled from multi-agent systems change how a single
agent uses the dashboard \[ [34](https://arxiv.org/html/2606.30005v4#bib.bib42 "")\].
Finally, the EMem-style and Mem0-style AMA-Bench rows are local adapters rather
than official implementations, so they support diagnosis but are not final
claims against those systems; AMA-Bench remains a transfer test rather than a
primary benchmark.

## Appendix H Proprioceptive-Blindness Diagnostic

This appendix documents the diagnostic behind Table [4](https://arxiv.org/html/2606.30005v4#S4.T4 "Table 4 ‣ Does the perception gap actually exist? ‣ 4 Analysis ‣ LLM Agents Are Latent Context Managers:Eliciting Self-Managed Context via State Proprioception").
The goal is to measure directly whether a backbone can read its own context
state, separating perception from skill.

#### Data.

We anchor on the first archive event of each real LOCA-Bench run, the moment the
agent itself decided to externalize content. We take the accumulated transcript
just before that call as the snapshot, treating each message as one block. The
runtime dashboard is not persisted in the transcript, so the stored messages are
already free of the live ledger; we additionally strip the three injected
artifacts that would leak state, namely the context-management protocol header,
the hard-limit rejection notices that print token counts, and archived-block
placeholders. A scan over all anchored snapshots confirms no residual token,
budget, or usage strings remain, and there is no per-block usage annotation.
Twenty-nine runs contain an archive; we cap each snapshot at 100K tokens by
dropping trailing blocks so it fits every backbone window, and compute ground
truth with the same tokenizer used by the harness.

#### Questions and conditions.

Figure 12: Proprioceptive-blindness diagnostic. Without the dashboard,
self-estimated context size is poorly calibrated; the factual ledger closes the
gap.

We ask four quantities, each in its own request so the measurements stay
independent. _Total size_: estimate the token count of the whole
transcript. _Block size_: estimate the token count of four sampled blocks.
_Pairwise_: for sampled block pairs, say which is larger, reported on the
hard subset within 2×2\\times in true size. _Recency_: a quoted passage is
shown and the model states how many model turns ago it appeared; for this
question the transcript is rendered without block identifiers so the model is
not handed an ordinal index, and the passage is verified unique. The
_−-dash_ condition shows the cleaned transcript only; the _++dash_
condition prepends the factual ledger (the columns of
the implementation-details appendix). Size answers are scored as median
relative error and pairwise as accuracy against the larger block. We run Gemini-3-Flash,
Claude-Sonnet-4.5, DeepSeek-V4-Pro, and GLM-5 with greedy decoding.
Claude-Sonnet-4.5 returns valid structured output slightly less often than the
other three, but the qualitative gap and its closure with the dashboard hold for
every backbone.