[![Longshot – screenshot 7](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/461/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/461/datas/original.png)
_Prompt structure for runtime agents and project specifications_

Longshot - TreeHacks 2026 - YouTube

Tap to unmute

[Longshot - TreeHacks 2026](https://www.youtube.com/watch?v=5oxXfazBcaQ) [Matthew Chow](https://www.youtube.com/channel/UC4X5mFZWBhp1aMIjEw8iF-w)

Matthew Chow1 subscriber

[Watch on](https://www.youtube.com/watch?v=5oxXfazBcaQ)

[![Longshot – screenshot 1](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/458/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/458/datas/original.png)

[![Longshot – screenshot 2](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/464/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/464/datas/original.png)
_Longshot technical architecture_

[![Longshot – screenshot 3](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/333/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/333/datas/original.png)

[![Longshot – screenshot 4](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/460/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/460/datas/original.png)
_Rich GUI terminal of agents working_

[![Longshot – screenshot 5](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/323/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/323/datas/original.png)
_Gorce agents visualization_

[![Longshot – screenshot 6](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/463/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/463/datas/original.png)
_Planner, subplanner, worker structure_

[![Longshot – screenshot 7](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/461/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/461/datas/original.png)
_Prompt structure for runtime agents and project specifications_

Longshot - TreeHacks 2026 - YouTube

Tap to unmute

[Longshot - TreeHacks 2026](https://www.youtube.com/watch?v=5oxXfazBcaQ) [Matthew Chow](https://www.youtube.com/channel/UC4X5mFZWBhp1aMIjEw8iF-w)

Matthew Chow1 subscriber

[Watch on](https://www.youtube.com/watch?v=5oxXfazBcaQ)

[![Longshot – screenshot 1](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/458/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/458/datas/original.png)

[![Longshot – screenshot 2](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/464/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/464/datas/original.png)
_Longshot technical architecture_

[![Longshot – screenshot 3](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/333/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/333/datas/original.png)

[![Longshot – screenshot 4](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/460/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/460/datas/original.png)
_Rich GUI terminal of agents working_

[![Longshot – screenshot 5](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/323/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/330/323/datas/original.png)
_Gorce agents visualization_

[![Longshot – screenshot 6](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/463/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/463/datas/original.png)
_Planner, subplanner, worker structure_

[![Longshot – screenshot 7](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/461/datas/gallery.jpg)](https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/004/325/461/datas/original.png)
_Prompt structure for runtime agents and project specifications_

- 1
- 2
- 3
- 4
- 5
- 6
- 7
- 8

**In 36 hours, we built Minecraft from one prompt using a swarm of 200 agents and $5,000 in Modal credits.**

## Inspiration

AI has already transformed the digital world by translating language to code with autonomous coding agents, but this requires human intervention.

Longshot changes that by orchestrating swarms of autonomous agents. Each agent observes, interprets, and acts in real time, working in parallel while staying aligned to the project’s goal.

Longshot is our architectural system curated towards spawning swarms of carefully managed long-running agents that code an end product start to finish.
![](https://raw.githubusercontent.com/andrewcai8/agentswarm/47f806d29f05d11c2d87fdc01ccf27c96bf49434/photos/5.png)

## ⚠️ Problem

Most agentic coding today like **Claude and OpenClaw** are iterative loops where you either supervise step by step or let a single agent run in a loop. It can handle small tasks, but on long runs it gets brittle, loses context, and drifts from the original objective.

To scale, many systems “spawn subagents” but these are usually just extra LLM calls with different roles and smaller context slices. They improve parallel thinking, not parallel execution.

Some newer systems give agents their own sandboxes/resources for true parallel coding. But at the scale of 100k plus LOC and 5k plus commits, they often fall apart because the work diverges from the objective. The bottleneck is maintaining global coherence, shared state, and quality across thousands of independent commits.

## 🧠 What it does

Longshot is an autonomous coding orchestrator that manages a swarm of coding agents. Given a project specification, Longshot:

- Balances between GPT 5.2 and GLM 5.0 to planner to decompose the project into hundreds of granular tasks
- Dispatches tasks to isolated sandboxes running in parallel on Modal
- Runs code generation, tests, linting, and concurrently pushes commits using Git
- Merges results through a merge queue that detects conflicts and enforces build and test gates
- Self-heals via a reconciler agent that detects broken builds and spawns targeted fix tasks
- Visualizes the entire run in real time of each individual agent through a Rich-powered terminal UI and Gource
- The planner, subplanner, worker, and reconciler agent architecture lets Longshot execute long-horizon builds without losing alignment across thousands of changes.

This is the future of vibecoding, where we can enter a single prompt that will code a project with long-term running agents.

## 🛠️ How we built it

We built Longshot as a modular distributed system designed to coordinate planning, execution, validation, and reconciliation across hundreds of agents.

- **Poke:** Enables external tools with an MCP server for users to interact with the system in real time.
- **PI.Dev Harness** \- Lightweight development environment that auto-provisions isolated sandboxes per agent, letting them code, test, and run tasks safely and independently.
- **Anthropic Claude SDK** \- Embedded programming toolkit giving agents structured coding tools, execution APIs, and reusable skill modules.
- **LLMs:** OpenAI ChatGPT 5.2 and Zhipu AI GLM-5 coordinate planning, sub-task assignment, and code generation across agents.
- **Modal:** Serverless GPU backend that runs each sandboxed agent at scale with high-performance compute and automatic resource provisioning.
- **Gource:** Visualizes planner, sub-planner, and worker lifecycles from commit traces, producing a tree-style timelapse that shows agent progression and interaction patterns.
- **Rich Terminal:** Real-time interface displaying active agents, task progress, build health, cost metrics, and throughput in a unified monitoring view.

## 🤖 AI & Agent Logic

Multi-agent architecture has two parts: designing the runtime agent infrastructure and refining the input specification for the project. These design choices let the swarm sustain high throughput while staying aligned to the objective.

**On the infrastructure side, we wrote a dedicated prompt for each agent role.**

- The system is recursive: the planner spawns subplanners until a task is small enough for a worker to complete end to end.
- To avoid coordination overhead, workers never communicate with other agents.
- We also run a reconciler on a 5 minute cadence that checks main for regressions, rather than blocking the merge queue on perfect correctness for every commit.
- Agents are prompted to push at high confidence rather than 100% confidence to increase throughput. - Conflicts can be resolved by another agent.

![](https://raw.githubusercontent.com/andrewcai8/agentswarm/47f806d29f05d11c2d87fdc01ccf27c96bf49434/photos/6.png)

**On the specification side, we separate static intent from runtime memory.**

- The core spec is locked before the run to prevent objective drift.
- During execution, agents maintain an editable text file and decision log that get frequently rewritten to capture the latest priorities, assumptions, and changes. This keeps the swarm aligned over long horizons without freezing its ability to adapt.
- `SPEC.md` is intentionally goal driven rather than feature driven. It defines intent and constraints without over-prescribing implementation details, so agents can make progress without getting trapped in checklist behavior.

![](https://raw.githubusercontent.com/andrewcai8/agentswarm/47f806d29f05d11c2d87fdc01ccf27c96bf49434/photos/7.png)

## ⚙️ Infrastructure

We used Modal to spin up ephemeral sandbox environments where agents execute safely in parallel. Each container runs isolated code generation and testing pipelines. State between the orchestrator and sandboxes is passed through strict JSON protocols containing diffs, logs, and metadata.

## 💻 Interface

We built a real-time terminal dashboard using Rich that visualizes the agent states, throughput metrics, merge queue progress, and an activity log.

Additionally, we use Gource to visualize the life cycles of all planners, sub-planners, and workers across all commit traces for an agent’s lifetime. This creates a tree life structure and timelapse of its progression and how agents interact with one another.

## 🧩 Challenges we ran into

- We ran 16 GPUs on Modal and cold start and setup under high utilization.
- Iterating the spec prompt to stop agents from changing the objective over time.
- Heavy credit costs for compute time.
- Agents behaved conservatively by default. The agent swarm did not have enough instructions in their prompts to merge into main, so the agents continuously merged branches and resolved conflicts instead of taking action.

## 🏆 Accomplishments that we're proud of

- We created Minecraft in a single hackathon with autonomous agents
- We learned how to use serverless GPUs
- We built a high-level technical implementation of code agent planning, execution, and distribution of tasks in an efficient system

## 📚 What we learned

- **Parallelism Requires Strong Coordination**: Large multi-agent builds need strict spec control, merge gating, and reconciler agents to maintain alignment across thousands of commits.
- **Serverless GPUs Change Development Workflow**: Ephemeral environments enable rapid scaling but require careful cold-start handling, cost tracking, and sandbox state management.
- **Prompt + Architecture Design Matters**: Agent role prompts, recursive planning, and clear separation of static intent vs. runtime memory were critical to prevent drift

## 🚀 What’s Next for Longshot

- **Agent throughput tuning:** We will iterate on the agent harness to increase sustained commits per hour without sacrificing build health. This includes reducing sandbox cold-start overhead, improving task batching, and tightening the JSON diff and log protocol to cut orchestration latency.
- **Dev observability:** Add run replay, commit provenance, and a unified event timeline with failure clustering so we can debug agent behavior and CI regressions quickly without rerunning expensive compute.

## Built With

- chatgpt
- claude
- cursor
- modal
- pidev
- poke

[Like\\
26](https://secure.devpost.com/users/register?flow%5Bdata%5D%5Bsoftware_id%5D=1194635&flow%5Bname%5D=like_software&return_to=https%3A%2F%2Fdevpost.com%2Fsoftware%2Flongshot)

26 people like this:


- [![Priscilla Ye](https://d112y698adiu2z.cloudfront.net/photos/production/user_photos/003/073/992/datas/medium.jpg)](https://devpost.com/ScriptKitKat)
- [![Michael D](https://avatars.githubusercontent.com/u/63403474?type=square&v=4)](https://devpost.com/dfFoldedProtein)
- [![John M. Owen](https://avatars.githubusercontent.com/u/187327?type=square&v=4)](https://devpost.com/jmowen)
- [![Phani Ratan Yalamanchili Yalamanchili](https://lh3.googleusercontent.com/a/ACg8ocJiImhFDH9TFbAZvy--GK5e4xczmIteCg0AIE_MKIitMNzICg=s96-c?type=square)](https://devpost.com/phaniratan2000)
- [![Danny Willow Liu](https://avatars.githubusercontent.com/u/183432928?type=square&v=4)](https://devpost.com/dannywillowliu-uchi)
- [![Basavraj Chinagundi](https://lh3.googleusercontent.com/a/ACg8ocKQPQHJcXFYFpN6M7FulkYw5xxOTnTUmbg9JtBNWptFmT7w5Q=s96-c?type=square)](https://devpost.com/basavrajchinagundi10)
- [![Jonathan Zhang](https://lh3.googleusercontent.com/a/ACg8ocIfw8gJxaoEnmgASqwJNJ7o1_GlbOKRxyOnUtN0r9fKfU0n59iK=s96-c?type=square)](https://devpost.com/jz2357)
- [![Sofia Zaozerska](https://lh3.googleusercontent.com/a/ACg8ocKoWr3Qs2NNbAa2t6Syig8AAk1gU3pKbf-1idGWlVmNJRpR1SY=s96-c?type=square)](https://devpost.com/szaozerska)
- [![Matthew Chow](https://lh3.googleusercontent.com/a/ACg8ocIm_cXkFeADmhHGsjZqp7NaqKpl_quhktCo04172vfN76iaeq1c=s96-c?type=square)](https://devpost.com/matthewchow03)
- [![Legasse Remon](https://lh3.googleusercontent.com/a/ALm5wu2xEJncerlt4K7p3KaPtaQnSOQRxOkvPiOscZQ=s96-c?type=square)](https://devpost.com/legasseahs1)

[\+ 16 more](https://devpost.com/software/longshot/likes)

Share this project:




## Updates

[![Legasse Remon](https://lh3.googleusercontent.com/a/ALm5wu2xEJncerlt4K7p3KaPtaQnSOQRxOkvPiOscZQ=s96-c?height=180&width=180)](https://devpost.com/legasseahs1)

[Legasse Remon](https://devpost.com/legasseahs1)
started this project

—
[7 months ago](https://devpost.com/software/longshot/updates/738506)

_Leave feedback in the comments!_

**[Log in](https://secure.devpost.com/users/login)**
or
**[sign up for Devpost](https://secure.devpost.com/users/register?flow%5Bdata%5D%5Bcommentable_id%5D=738506&flow%5Bname%5D=comment_on_software_update&return_to=https%3A%2F%2Fdevpost.com%2Fsoftware%2Flongshot)**
to join the conversation.


## Submission history

![](<Base64-Image-Removed>)

[Previous image](https://devpost.com/software/longshot)[Next image](https://devpost.com/software/longshot)