[Skip to content](https://docs.letta.com/configuration/memory#_top)

Configuration

[Memory & dreaming](https://docs.letta.com/configuration/memory)

Copy Markdown

Open in **Claude**

Open in **ChatGPT**

Open in **Cursor**

* * *

**Copy Markdown**

**View as Markdown**

# Memory & dreaming

Initialize, teach, and improve your agent's memory over time

Letta agents use [MemFS](https://docs.letta.com/concepts/memfs), a git-backed memory filesystem that they can inspect and edit. Memory is shared across the agent’s conversations and improves as the agent learns durable information about you and its work.

## Initialize memory

[Section titled “Initialize memory”](https://docs.letta.com/configuration/memory#initialize-memory)

Run `/init` to bootstrap or refresh memory for the current project. The agent inspects the repository, asks about your working style when needed, and can review prior coding sessions using [subagents](https://docs.letta.com/configuration/subagents).

```
> /init
```

If the memory hierarchy has drifted or grown too large, run `/doctor` to audit placement, duplication, and system-prompt token usage.

## Teach your agent

[Section titled “Teach your agent”](https://docs.letta.com/configuration/memory#teach-your-agent)

Your agent updates memory when it learns something durable. You can also teach it explicitly with `/remember`:

```
> /remember always use pnpm in this repo
```

The agent decides where the lesson belongs and commits the update to MemFS. Use the memory viewer in the desktop app or inspect `$MEMORY_DIR` directly to review what it saved.

## Dreaming

[Section titled “Dreaming”](https://docs.letta.com/configuration/memory#dreaming)

Dreaming uses background subagents to review recent conversations, consolidate useful lessons, and update memory without interrupting your active work.

Configure dreaming with `/sleeptime` in the CLI or **Dream settings** in the app. Choose when it runs: after a set number of completed agent steps or when the context window is compacted.

Select **Agent reviews before applying** to have your agent review and revise proposed memory updates in a second background conversation. This uses more model tokens and does not ask you for approval.

## Reorganize memory

[Section titled “Reorganize memory”](https://docs.letta.com/configuration/memory#reorganize-memory)

For larger cleanups, ask the agent to reorganize its memory. The memory workflow backs up the current repository before splitting large files, merging duplicates, or restructuring the hierarchy.

See [MemFS](https://docs.letta.com/concepts/memfs) for the directory structure, versioning model, synchronization behavior, and agent-owned skills.

Ask Ezra

**Ezra** Ask me about Letta!

Ask Ezra

### What can I help you build?

Ask about the Letta docs or anything on this page. Ezra will use the page you're viewing as context.

[Continue on Discord ↗](https://discord.gg/letta)

- [Docs](https://docs.letta.com/)
- [Agent SDK](https://docs.letta.com/agent-sdk)
- [Handbook](https://docs.letta.com/handbook)