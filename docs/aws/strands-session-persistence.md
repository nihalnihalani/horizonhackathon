Today I learned that the [Strands Agents SDK](https://github.com/strands-agents/sdk-python?trk=ef8ca202-7071-4ec3-aff2-78ef3bddfabf&sc_channel=el) has a built-in persistence layer for conversation history.

Pass a `SessionManager` to the `Agent` constructor, and every message and state change is persisted automatically through lifecycle hooks. No manual save/load calls.

## The Code

Save this as `session_demo.py` and run it with `uv run session_demo.py`.

> The `# /// script` block is [PEP 723 inline metadata](https://peps.python.org/pep-0723/) \- `uv run` reads it to install dependencies automatically, no venv or pip needed. All you need is [uv](https://docs.astral.sh/uv/) and [AWS credentials configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html?trk=ef8ca202-7071-4ec3-aff2-78ef3bddfabf&sc_channel=el).

```
# /// script
# requires-python = ">=3.10"
# dependencies = ["strands-agents"]
# ///

from strands import Agent
from strands.session.file_session_manager import FileSessionManager

SESSION_ID = "user-abc-123"
STORAGE_DIR = "./sessions"  # defaults to /tmp/strands/sessions

# First agent instance - ask a question
agent1 = Agent(
    model="global.anthropic.claude-haiku-4-5-20251001-v1:0",
    agent_id="assistant",
    session_manager=FileSessionManager(
        session_id=SESSION_ID, storage_dir=STORAGE_DIR
    ),
)
prompt1 = "What's the capital of France?"
print(f"Prompt: {prompt1}")
agent1(prompt1)
print()

# Second agent instance - same session_id, loads conversation from disk
agent2 = Agent(
    model="global.anthropic.claude-haiku-4-5-20251001-v1:0",
    agent_id="assistant",
    session_manager=FileSessionManager(
        session_id=SESSION_ID, storage_dir=STORAGE_DIR
    ),
)
prompt2 = "What did I just ask you?"
print(f"Prompt: {prompt2}")
agent2(prompt2)
print()
```

Enter fullscreen modeExit fullscreen mode

What's happening here:

1. `agent1` and `agent2` are separate `Agent` instances - they share no memory
2. `agent2` can answer "What did I just ask you?" because `FileSessionManager` restored the conversation from disk when the second instance was created
3. The `agent_id` identifies which agent's state to save and restore - required when using a session manager

## What Gets Persisted

The session manager saves three things:

- **Conversation history** \- all user and assistant messages (the `messages/` directory)
- **Agent state** \- a JSON-serializable key-value dict you can use for your own data (`agent.json`)
- **Session metadata** \- timestamps and session type (`session.json`)

After running the script, here's what's on disk:

```
sessions/
└── session_user-abc-123
    ├── agents
    │   └── agent_assistant
    │       ├── agent.json
    │       └── messages
    │           ├── message_0.json
    │           ├── message_1.json
    │           ├── message_2.json
    │           └── message_3.json
    ├── multi_agents
    └── session.json
```

Enter fullscreen modeExit fullscreen mode

Each message is a separate JSON file:

```
{
  "message": {
    "role": "user",
    "content": [\
      {\
        "text": "What's the capital of France?"\
      }\
    ]
  },
  "message_id": 0,
  "created_at": "2026-02-17T14:45:31.439081+00:00"
}
```

Enter fullscreen modeExit fullscreen mode

User and assistant turns alternate through `message_0.json` to `message_3.json`.

## Built-In Backends

The example uses `FileSessionManager`, but the SDK ships three backends:

| Manager | Use Case |
| --- | --- |
| `FileSessionManager` | Local development, single-process |
| `S3SessionManager` | Production, distributed, multi-container |
| `RepositorySessionManager` | Custom backend (implement `SessionRepository`) |

* * *

## Tips and Notes

### Troubleshooting tips

**`uv: command not found`**

Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh` (macOS/Linux) or `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"` (Windows). See [uv installation docs](https://docs.astral.sh/uv/getting-started/installation/).

**`NoCredentialError` or `Unable to locate credentials`**

AWS credentials aren't configured. Run `aws configure` to set up a default profile, or export `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. See [AWS CLI configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html?trk=ef8ca202-7071-4ec3-aff2-78ef3bddfabf&sc_channel=el).

**`AccessDeniedException` when calling the model**

Your AWS credentials don't have permission to invoke the Bedrock model. Make sure your IAM user or role has `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` permissions.

### Good to know

**`FileSessionManager` is not safe for concurrent same-session writes**

Two API requests with the same `session_id` writing to `FileSessionManager` concurrently can corrupt the session data. The storage layer has no locking - it reads, appends, and writes the full JSON file without coordination.

For development, this is fine. Single-process, single-user development (CLI, local testing) will never hit this. Sequential requests to the same session are safe.

For production, you have three options:

1. Per-session locking in your API layer - serialize requests per session\_id before they reach the Agent
2. `S3SessionManager` \- uses atomic S3 operations for safe concurrent writes
3. A custom `SessionRepository` \- implement your own with proper concurrency handling (database-backed, etc.)

**`agent_id` is required with a session manager**

If you omit `agent_id` when using a `SessionManager`, you'll get `ValueError: agent_id needs to be defined.` The session system uses it as a directory key to separate state for different agents within the same session.

**`FileSessionManager` defaults to `/tmp`**

Without an explicit `storage_dir`, sessions are written to `/tmp/strands/sessions` \- which most operating systems wipe on reboot. Set it to a project-local path like `./sessions` or `.data/sessions`.

### References

- [Session Management docs](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/agents/session-management/?trk=ef8ca202-7071-4ec3-aff2-78ef3bddfabf&sc_channel=el)
- [Conversation Management docs](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/agents/conversation-management/?trk=ef8ca202-7071-4ec3-aff2-78ef3bddfabf&sc_channel=el)

DEV Community

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=238784)

[![Google AI Education track image](https://media2.dev.to/dynamic/image/width=775%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fu09y9fffqrb2one15j3g.png)](https://dev.to/deved/build-apps-with-google-ai-studio?bb=238784)

## [Work through these 3 parts to earn the exclusive Google AI Studio Builder badge!](https://dev.to/deved/build-apps-with-google-ai-studio?bb=238784)

This track will guide you through Google AI Studio's new "Build apps with Gemini" feature, where you can turn a simple text prompt into a fully functional, deployed web application in minutes.

[Read more →](https://dev.to/deved/build-apps-with-google-ai-studio?bb=238784)

Read More


![pic](https://media2.dev.to/dynamic/image/width=256,height=,fit=scale-down,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F8j7kvp660rqzt99zui8e.png)

[Create template](https://dev.to/settings/response-templates)

Templates let you quickly answer FAQs or store snippets for re-use.

SubmitPreview [Dismiss](https://dev.to/404.html)

CollapseExpand

[![signalstack profile image](https://media2.dev.to/dynamic/image/width=50,height=50,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3773217%2Fe86c1f15-ca9c-4aaa-9da9-1805169d1790.png)](https://dev.to/signalstack)

[signalstack](https://dev.to/signalstack)

signalstack




[![](https://media2.dev.to/dynamic/image/width=90,height=90,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3773217%2Fe86c1f15-ca9c-4aaa-9da9-1805169d1790.png)\\
signalstack](https://dev.to/signalstack)

Follow

- Joined


Feb 14, 2026


• [Feb 17](https://dev.to/aws/til-strands-agents-has-built-in-session-persistence-3nhl#comment-34j63)

Dropdown menu

- [Copy link](https://dev.to/aws/til-strands-agents-has-built-in-session-persistence-3nhl#comment-34j63)
- Hide

- [Report abuse](https://dev.to/report-abuse?url=https://dev.to/signalstack/comment/34j63)

Good timing on this — session persistence is one of the more underrated problems in production agent systems. The file-based approach is a solid starting point, but there are a few things that bite you at scale:

Message ordering: when you're persisting individual files per message, concurrent agent calls can race on session state. Probably fine for single-user scenarios, but the DynamoDB backend likely handles this better if you're running multiple agent instances per session.

Session size management: conversation history grows fast, especially with tool-heavy agents. At some point you'll want to prune or summarize older turns before persisting, or you end up loading 50KB of context just to handle a simple follow-up question.

Cross-session memory vs. within-session state: this handles the latter well, but for longer-lived agents that need to "remember" things across sessions (user preferences, learned patterns), you typically need a separate memory layer on top of raw session storage.

For the file-based backend specifically: does Strands handle lock files or have any protection against two processes writing to the same session concurrently? That's the first failure mode we hit when testing local persistence.

CollapseExpand

[![dennistraub profile image](https://media2.dev.to/dynamic/image/width=50,height=50,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F752988%2Fea2b8598-0758-4ffa-b8d7-d904360f46e4.png)](https://dev.to/dennistraub)

[Dennis Traub\\
\\
AWS](https://dev.to/dennistraub)

Dennis Traub

AWS


[![](https://media2.dev.to/dynamic/image/width=90,height=90,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F752988%2Fea2b8598-0758-4ffa-b8d7-d904360f46e4.png)\\
Dennis Traub](https://dev.to/dennistraub)

Follow

AI Engineering Specialist at AWS \| Exploring the impact of AI \| Helping make sense of technology in our rapidly changing world


- Location



Hamburg, Germany


- Pronouns



he / him


- Work



Amazon Web Services


- Joined


Nov 14, 2021


• [Feb 17• Edited on Feb 17• Edited](https://dev.to/aws/til-strands-agents-has-built-in-session-persistence-3nhl#comment-34j8k)

Dropdown menu

- [Copy link](https://dev.to/aws/til-strands-agents-has-built-in-session-persistence-3nhl#comment-34j8k)
- Hide

- [Report abuse](https://dev.to/report-abuse?url=https://dev.to/dennistraub/comment/34j8k)

That's a good point. I've added some notes to the **Good to Know** section to highlight this limitation.

CollapseExpand

[![signalstack profile image](https://media2.dev.to/dynamic/image/width=50,height=50,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3773217%2Fe86c1f15-ca9c-4aaa-9da9-1805169d1790.png)](https://dev.to/signalstack)

[signalstack](https://dev.to/signalstack)

signalstack




[![](https://media2.dev.to/dynamic/image/width=90,height=90,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3773217%2Fe86c1f15-ca9c-4aaa-9da9-1805169d1790.png)\\
signalstack](https://dev.to/signalstack)

Follow

- Joined


Feb 14, 2026


• [Feb 18](https://dev.to/aws/til-strands-agents-has-built-in-session-persistence-3nhl#comment-34k4k)

Dropdown menu

- [Copy link](https://dev.to/aws/til-strands-agents-has-built-in-session-persistence-3nhl#comment-34k4k)
- Hide

- [Report abuse](https://dev.to/report-abuse?url=https://dev.to/signalstack/comment/34k4k)

Thanks for the quick update — the Good to Know section now covers exactly the gotchas that get people in production. The per-session API locking option is the one I'd reach for first before moving to S3; it keeps the local dev experience intact while adding the coordination layer only where it matters. The /tmp default is also a classic trap — I've seen more than one staging environment lose session state after a deploy restart because no one noticed the default path.

Are you sure you want to hide this comment? It will become hidden in your post, but will still be visible via the comment's [permalink](https://dev.to/aws/til-strands-agents-has-built-in-session-persistence-3nhl#).


Hide child comments as well

Confirm


For further actions, you may consider blocking this person and/or [reporting abuse](https://dev.to/report-abuse)

DEV Community

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=238780)

[![Google AI Education track image](https://media2.dev.to/dynamic/image/width=775%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fu09y9fffqrb2one15j3g.png)](https://dev.to/deved/build-apps-with-google-ai-studio?bb=238780)

## [Build Apps with Google AI Studio 🧱](https://dev.to/deved/build-apps-with-google-ai-studio?bb=238780)

This track will guide you through Google AI Studio's new "Build apps with Gemini" feature, where you can turn a simple text prompt into a fully functional, deployed web application in minutes.

[Read more →](https://dev.to/deved/build-apps-with-google-ai-studio?bb=238780)

👋 Kindness is contagious

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=239338)

x

Explore this practical breakdown on DEV’s open platform, where developers from every background come together to push boundaries. **No matter your experience,** your viewpoint enriches the conversation.

Dropping a simple “thank you” or question in the comments goes a long way in supporting authors—your feedback helps ideas evolve.

At DEV, **shared discovery drives progress** and builds lasting bonds. If this post resonated, a quick nod of appreciation can make all the difference.

## [Okay](https://dev.to/enter?state=new-user&bb=239338)

![DEV Community](https://media2.dev.to/dynamic/image/width=190,height=,fit=scale-down,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F8j7kvp660rqzt99zui8e.png)

We're a place where coders share, stay up-to-date and grow their careers.


[Log in](https://dev.to/enter?signup_subforem=1) [Create account](https://dev.to/enter?signup_subforem=1&state=new-user)

![](https://assets.dev.to/assets/sparkle-heart-5f9bee3767e18deb1bb725290cb151c25234768a0e9a2bd39370c382d02920cf.svg)![](https://assets.dev.to/assets/multi-unicorn-b44d6f8c23cdd00964192bedc38af3e82463978aa611b4365bd33a0f1f4f3e97.svg)![](https://assets.dev.to/assets/exploding-head-daceb38d627e6ae9b730f36a1e390fca556a4289d5a41abb2c35068ad3e2c4b5.svg)![](https://assets.dev.to/assets/raised-hands-74b2099fd66a39f2d7eed9305ee0f4553df0eb7b4f11b01b6b1b499973048fe5.svg)![](https://assets.dev.to/assets/fire-f60e7a582391810302117f987b22a8ef04a2fe0df7e3258a5f49332df1cec71e.svg)