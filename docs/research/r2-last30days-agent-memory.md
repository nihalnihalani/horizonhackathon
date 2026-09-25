## Research Results: agent memory

**Date Range:** 2026-08-26 to 2026-09-25
**Mode:** reddit-only
**OpenAI Model:** gpt-5.1-codex-mini

*💡 Tip: Add an xAI key (`XAI_API_KEY`) for X/Twitter data and better triangulation.*

### Reddit Threads

*No relevant Reddit threads found for this topic.*

### YouTube Videos

**xs-ob87TTzg** (score:63) AI Engineer (2026-09-18) [27,151 views, 202 likes]
  Total Recall: Agent Memory and Harness Engineering — Ignacio Martinez, Oracle
  https://www.youtube.com/watch?v=xs-ob87TTzg
  *YouTube: Total Recall: Agent Memory and Harness Engineering — Ignacio*

**bK1clrG-boc** (score:56) Jam With AI | Shirin Khosravi Jam (2026-08-28) [35,750 views, 640 likes]
  AI Agent Memory: 7 Types Explained in 12 Minutes
  https://www.youtube.com/watch?v=bK1clrG-boc
  *YouTube: AI Agent Memory: 7 Types Explained in 12 Minutes*

**X4FVEEegCbk** (score:53) IBM Technology (2026-09-03) [171,391 views, 2,335 likes]
  Skills vs MCP vs RAG vs Memory: What AI Agents Need to Know
  https://www.youtube.com/watch?v=X4FVEEegCbk
  Highlights:
    - "Now, I think instinctively the answer to getting some agentic help for this 500 error is just to kind of gather as much context as possible, and then throw that into the context window from the actual agent itself."
    - "So, tell me, does that reflect how you incorporate knowledge with AI agents?"
    - "There are different ways to give an AI agent the knowledge it needs to complete a task beyond the knowledge that it just has in its training data."
    - "So, let's look at four of them: skills, MCP, rag, and memory, and define which methods are best in different situations."
    - "So, let's consider that we've got some kind of web app here, and we look at this web page, and uh-oh, this web page is throwing an error, the dreaded 500 internal server error."
  <details><summary>Full transcript (1355 words)</summary>
  There are different ways to give an AI agent the knowledge it needs to complete a task beyond the knowledge that it just has in its training data. So, let's look at four of them: skills, MCP, rag, and memory, and define which methods are best in different situations. So, let's consider that we've got some kind of web app here, and we look at this web page, and uh-oh, this web page is throwing an error, the dreaded 500 internal server error. Okay, we need to fix this. Well, the goal of an AI agent is to do just that. We want to resolve this error. Now, I think instinctively the answer to getting some agentic help for this 500 error is just to kind of gather as much context as possible, and then throw that into the context window from the actual agent itself. So, in this context window, we might store a bunch of runbooks, and then maybe we'd also pass it a bunch of dashboards, and perhaps also we'd have a little bit of customer history in here as well, and just throw it in the context window, and then let the AI agent figure out how to resolve this error. But, that can be quite an ineffective means to resolve an error like this, because there's plenty of scope for this AI agent to kind of get lost or to go down dead ends, or just act in a generalized way that doesn't really represent how this specific checkout page actually works. So, just throwing context into the fire, it might not be the best way to go. Perhaps a better approach would be to use skills or MCP or rag or memory maybe all of the above. But how? Well, I'm going to take these one at a time as to how we can get this web page resolved with this AI agent and let's start with the first one which is to use agent skills. Now, an agent skill is really just kind of a set of instructions that we can hand to the agent for doing one particular kind of task. So, sometimes it might also have a bit of code attached as well. Now, it might list a procedure like the steps to follow along with some judgment about when to follow them. And the agent only pulls the skill in when the task actually calls for it through something called progressive disclosure. So, for this checkout error we've got here, we might give the agent a special skill that we have created. Let's call this the triage skill. And that skill lays out the runbook. So, maybe it says, first of all, we need to take a look at the error rate. That's the first thing we need to do. And then once we've done that, the skill says the next thing to do is to check on the status of the recent deployments. So, these are the steps to follow. But beyond the steps to take, a good skill can also carry a bit of judgment as well. Like when the agent should stop poking around on its own and instead it should escalate to maybe a actual human to help with the problem. Now, without this triage skill, the agent probably wouldn't know to do all of these things because this information is not sitting in the model's training data anywhere. So, a skill give the agent a clear procedure and maybe a bit of judgment about how to run it. But it kind of stops there. The skill can tell the agent to go and check the the error rate, but the agent still can't necessarily reach the dashboard to actually read that error rate in the first place. So, one way to deal with getting that error rate and stuff like that is to use MCP. P. That's the model context protocol. It can connect the agent to the outside world so it can actually go out and do things. Now, the way it works is there is a standard MCP protocol sitting between the agent and whatever it needs to reach. Now, the agent itself, that is considered the MCP host and each system it wants to talk to, that sits behind an MCP server. So, this model on its own maybe hasn't got a clue how to say query a particular back end that has a logging stack, but the MCP server for that logging stack does know how to connect to it and it exposes that as something that the agent can then call. So, if we go back to my 500 error here, the skill wants it to check the error rate. Well, with MCP, the agent can reach all of that information so it can get hold of all of the logs by performing an MCP call. It can get hold of the metrics as well by doing the same thing and it can read that error rate for real. Right. So, getting the error rate is is solved by MCP. We're calling out to another service. But what the agent still doesn't know yet is Well, it doesn't really have any real knowledge of how this particular setup for this web page behaves. Like what's normal or what the dependencies are and what's maybe caused some of these issues before. So, where does that knowledge come from? Well, you probably guessed it. It comes from the the other two things on my list here. So, let's start with RAG. This is retrieval augmented generation. And the idea is instead of stuffing everything into the context window up front, the agent is just going to pull in the information that it needs, some sort of relevant piece of information from some outside source and to only do it when it actually needs it. So, for our checkout error, we might point RAG at a collection of our own documents. So, these might be like manuals or dependency maps, stuff like that. And then the agent gets to ask its question and then RAG is going to retrieve the matching pieces by performing something called a semantic search. And relevant matching chunks, then they get returned back to the agent's context window. That's RAG. And then the last one to talk about is talking about memory. And memory at first glance sounds quite a bit like RAG where the agent pulls in relevant pieces of knowledge when it's needed, but there is a a difference between these two things. And the difference is where the knowledge comes from. So, RAG, it reads documents which are stored in a vector database and those documents were put in that vector database by a person. Like, they were stored there deliberately. But memory is the stuff that the agent has picked up itself and kind of stored for later from things that have happened previously. So, the agent can look back at some kind of memory like previous error situations. Maybe last time this exact error happened, the real cause was not something that was documented in the the run book over here, and it kind of had to get worked out the hard way. Well, that memory can tell us what that hard way was. And when this pesky 500 error is finally fixed, then the memory can also write back what the fix actually was, so the agent has that for next time. So basically experience is building up here in the agentic memory. So, that is all four. And then rough rule of thumb on when to use each one. Well, if it's knowledge that somebody has written down, that's rag. If it's knowledge the agents picked up from experience, that's memory. If it's a procedure to follow, something repeatable, that is an agent skill. And if an agent needs to go and actually look something up in the world without using proprietary code, that can be MCP. So, tell me, does that reflect how you incorporate knowledge with AI agents? Let me know in the comments.
  </details>
  *YouTube: Skills vs MCP vs RAG vs Memory: What AI Agents Need to Know*

### Hacker News Stories

**HN1** (score:79) hn/ingve (2026-08-31) [191pts, 96cmt]
  Agent memory as a file format
  https://news.ycombinator.com/item?id=49508317
  *HN story about Agent memory as a file format*
  Insights:
    - That's a whole lot of text to say "it's markdown".
    - I'm not convinced an unstructured collection of memory files is the way to go at all.
    - I've come to a similar lofi solution for my agent fleet

**HN2** (score:76) hn/okf_memory (2026-09-05) [81pts, 32cmt]
  OKF Agent Memory – Git-native persistent memory for AI coding agents
  https://news.ycombinator.com/item?id=49581240
  *HN story about OKF Agent Memory – Git-native persistent memory for AI codin*
  Insights:
    - Hey HN,
    - How are you using this compared to more explicit approaches where you lay out the project documentation in certain formats and conventions?
    - cool going to check it out, I've got an opensource project that might compliment it that I'm excited to try

**HN3** (score:62) hn/anuptalwalkar (2026-08-26) [36pts, 14cmt]
  Show HN: A lightweight, stateless database for agent memory
  https://news.ycombinator.com/item?id=49450816
  *HN story about Show HN: A lightweight, stateless database for agent memory*

**HN26** (score:61) hn/cat-whisperer (2026-09-17) [68pts, 62cmt]
  Launch HN: Skillsync (YC W26) – AI chat sessions made portable across agents
  https://news.ycombinator.com/item?id=49743049
  *HN story about Launch HN: Skillsync (YC W26) – AI chat sessions made portab*
  Insights:
    - This is good, I like it!! I've been mostly working with Claude and Chatgpt for separate stuff, however sometimes one of them is stuck and I could definitely use this to start a session with the other 
    - If I were you I would look into maybe like analyzing sessions across harnesses? I’m not sure, some way to leverage this shared schema work that is not syncing
    - I was thinking about doing this

**HN27** (score:56) hn/jd_ (2026-09-15) [61pts, 37cmt]
  Show HN: Pizza Bot – An inbox for AI agents that work in the background
  https://news.ycombinator.com/item?id=49713894
  *HN story about Show HN: Pizza Bot – An inbox for AI agents that work in the*
  Insights:
    - congrats on the public launch! it's been clear to me for a while now that agents will need their own ways to communicate and an asynchronous inbox/task system is a necessity already
    - I have a more basic question; I am trying to understand its purpose.
    - Why does it have to be a desktop app vs a self hostable web app?

**HN6** (score:56) hn/supportm (2026-09-09) [4pts, 0cmt]
  Four Kinds of Agent Memory
  https://news.ycombinator.com/item?id=49628820
  *HN story about Four Kinds of Agent Memory*

**HN8** (score:53) hn/rdslw (2026-09-21) [3pts, 0cmt]
  V7 gives AI agents institutional memory
  https://news.ycombinator.com/item?id=49791877
  *HN story about V7 gives AI agents institutional memory*

**HN12** (score:53) hn/howdoweknowit (2026-09-11) [5pts, 0cmt]
  AI Agent Builder gives memory across voice, SMS, email, web chat and social
  https://news.ycombinator.com/item?id=49651788
  *HN story about AI Agent Builder gives memory across voice, SMS, email, web *

**HN21** (score:51) hn/itskie (2026-09-16) [9pts, 4cmt]
  Show HN: Friday – Self-hosted persistent memory for AI coding agents (MCP)
  https://news.ycombinator.com/item?id=49731353
  *HN story about Show HN: Friday – Self-hosted persistent memory for AI codin*

**HN7** (score:49) hn/dat999zx (2026-08-27) [3pts, 4cmt]
  Show HN: Knowl – agent memory with write-time supersession, 0.90 on MAB
  https://news.ycombinator.com/item?id=49465138
  *HN story about Show HN: Knowl – agent memory with write-time supersession, *

**HN5** (score:48) hn/s-xyz (2026-08-28) [5pts, 0cmt]
  Cross-Agent Memory
  https://news.ycombinator.com/item?id=49478291
  *HN story about Cross-Agent Memory*

**HN28** (score:47) hn/dimitrismrtzs (2026-09-09) [50pts, 15cmt]
  Show HN: Self-hosted company OS, Claude Code and Codex agents in departments
  https://news.ycombinator.com/item?id=49630606
  *HN story about Show HN: Self-hosted company OS, Claude Code and Codex agent*
  Insights:
    - I work on a realtime collaboration platform, and I've been building something similar for internal use - cool to see your mental model.
    - This seems a lot like Cloudflare OS (https://blog.cloudflare.com/cloudflare-os/)
    - I need to understand what is the UX of departments

**HN24** (score:46) hn/chiedo (2026-09-24) [3pts, 0cmt]
  Pinocchio, make copilot agents real by giving them memory
  https://news.ycombinator.com/item?id=49833566
  *HN story about Pinocchio, make copilot agents real by giving them memory*

**HN13** (score:46) hn/mrsalty (2026-09-14) [5pts, 0cmt]
  Show HN: Slowave – local adaptive memory for coding agents
  https://news.ycombinator.com/item?id=49702887
  *HN story about Show HN: Slowave – local adaptive memory for coding agents*

**HN9** (score:46) hn/mrwhite81 (2026-09-01) [3pts, 0cmt]
  Why 1M context windows won't solve agent memory (and a protocol that does)
  https://news.ycombinator.com/item?id=49516682
  *HN story about Why 1M context windows won't solve agent memory (and a proto*

---
**🔍 Research Coverage: 80%**

Research quality: 4/5 core sources.
Missing: X/Twitter.

Free fixes:
  - X/Twitter: scan browser cookies automatically — just log into x.com in any browser and re-run.

last30days has no affiliation with any API provider.

---
**Sources:**
  ⏭️ X: skipped — Bird installed but not authenticated — log into x.com in browser
  ✅ YouTube: 3 videos (1 with transcripts)
  ⚡ Xiaohongshu: Xiaohongshu API unavailable or not logged in - start xiaohongshu-mcp and login (base: http://host.docker.internal:18060)
  ✅ HN: 30 stories
  ⚡ Web: assistant will use WebSearch

