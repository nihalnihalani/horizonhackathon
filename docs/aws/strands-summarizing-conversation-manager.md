## Select your cookie preferences

We use essential cookies and similar tools that are necessary to provide our site and services. We use performance cookies to collect anonymous statistics, so we can understand how customers use our site and make improvements. Essential cookies cannot be deactivated, but you can choose “Customize” or “Decline” to decline performance cookies.

If you agree, AWS and approved third parties will also use cookies to provide useful site features, remember your preferences, and display relevant content, including relevant advertising. To accept or decline all non-essential cookies, choose “Accept” or “Decline.” To make more detailed choices, choose “Customize.”

AcceptDeclineCustomize

## Customize cookie preferences

We use cookies and similar tools (collectively, "cookies") for the following purposes.

### Essential

Essential cookies are necessary to provide our site and services and cannot be deactivated. They are usually set in response to your actions on the site, such as setting your privacy preferences, signing in, or filling in forms.

Allowed

### Performance

Performance cookies provide anonymous statistics about how customers navigate our site so we can improve site experience and performance. Approved third parties may perform analytics on our behalf, but they cannot use the data for their own purposes.

Allowed

### Functional

Functional cookies help us provide useful site features, remember your preferences, and display relevant content. Approved third parties may set these cookies to provide certain site features. If you do not allow these cookies, then some or all of these services may not function properly.

Allowed

### Advertising

Advertising cookies may be set through our site by us or our advertising partners and help us deliver relevant marketing content. If you do not allow these cookies, you will experience less relevant advertising.

Allowed

Blocking some types of cookies may impact your experience of our sites. You may review and change your choices at any time by selecting Cookie preferences in the footer of this site. We and selected third-parties use cookies or similar technologies as specified in the [AWS Cookie Notice](https://aws.amazon.com/legal/cookies/).

CancelSave preferences

## Your privacy choices

We and our advertising partners (“we”) may use information we collect from or about you to show you ads on other websites and online services. Under certain laws, this activity is referred to as “cross-context behavioral advertising” or “targeted advertising.”

To opt out of our use of cookies or similar technologies to engage in these activities, select “Opt out of cross-context behavioral ads” and “Save preferences” below. If you clear your browser cookies or visit this site from a different device or browser, you will need to make your selection again. For more information about cookies and how we use them, read our [Cookie Notice](https://aws.amazon.com/legal/cookies/).

Allow cross-context behavioral adsOpt out of cross-context behavioral ads

To opt out of the use of other identifiers, such as contact information, for these activities, fill out the form [here](https://pulse.aws/application/ZRPLWLL6?p=0).

For more information about how AWS handles your information, read the [AWS Privacy Notice](https://aws.amazon.com/privacy/).

CancelSave preferences

## Unable to save cookie preferences

We will only store essential cookies at this time, because we were unable to save your cookie preferences.

If you want to change your cookie preferences, try again later using the link in the AWS console footer, or contact support if the problem persists.

Dismiss

 [Skip to content](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.summarizing_conversation_manager/#_top)

# strands.agent.conversation\_manager.summarizing\_conversation\_manager

Summarizing conversation history management with configurable options.

## SummarizingConversationManager

[Section titled “SummarizingConversationManager”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.summarizing_conversation_manager/#summarizingconversationmanager)

```
class SummarizingConversationManager(ConversationManager)
```

Defined in: [src/strands/agent/conversation\_manager/summarizing\_conversation\_manager.py:34](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/summarizing_conversation_manager.py#L34)

Implements a summarizing window manager.

This manager provides a configurable option to summarize older context instead of
simply trimming it, helping preserve important information while staying within
context limits.

#### \_\_init\_\_

[Section titled “\_\_init\_\_”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.summarizing_conversation_manager/#__init__)

```
def __init__(summary_ratio: float = 0.3,

             preserve_recent_messages: int = 10,

             summarization_agent: Optional["Agent"] = None,

             summarization_system_prompt: str | None = None,

             *,

             pin_first: int | None = None,

             proactive_compression: bool | ProactiveCompressionConfig

             | None = None)
```

Defined in: [src/strands/agent/conversation\_manager/summarizing\_conversation\_manager.py:42](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/summarizing_conversation_manager.py#L42)

Initialize the summarizing conversation manager.

**Arguments**:

- `summary_ratio` \- Ratio of messages to summarize vs keep when context overflow occurs.
Value between 0.1 and 0.8. Defaults to 0.3 (summarize 30% of oldest messages).
- `preserve_recent_messages` \- Minimum number of recent messages to always keep.
Defaults to 10 messages.
- `summarization_agent` \- Optional agent to use for summarization instead of the parent agent.
If provided, this agent can use tools as part of the summarization process.
- `summarization_system_prompt` \- Optional system prompt override for summarization.
If None, uses the default summarization prompt.
- `pin_first` \- Number of messages at the start of the conversation to permanently pin.
Pinned messages are protected from summarization and compacted to the front.
- `proactive_compression`\- Enable proactive context compression before the model call.

  - `True`: compress when 70% of the context window is used (default threshold).
  - `\{"compression_threshold": float}`: compress at the specified ratio (0, 1\].
  - `False` or `None`: disabled, only reactive overflow recovery is used.

#### restore\_from\_session

[Section titled “restore\_from\_session”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.summarizing_conversation_manager/#restore_from_session)

```
@override

def restore_from_session(state: dict[str, Any]) -> list[Message] | None
```

Defined in: [src/strands/agent/conversation\_manager/summarizing\_conversation\_manager.py:86](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/summarizing_conversation_manager.py#L86)

Restores the Summarizing Conversation manager from its previous state in a session.

**Arguments**:

- `state` \- The previous state of the Summarizing Conversation Manager.

**Returns**:

Optionally returns the previous conversation summary if it exists.

#### get\_state

[Section titled “get\_state”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.summarizing_conversation_manager/#get_state)

```
def get_state() -> dict[str, Any]
```

Defined in: [src/strands/agent/conversation\_manager/summarizing\_conversation\_manager.py:99](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/summarizing_conversation_manager.py#L99)

Returns a dictionary representation of the state for the Summarizing Conversation Manager.

#### apply\_management

[Section titled “apply\_management”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.summarizing_conversation_manager/#apply_management)

```
def apply_management(agent: "Agent", **kwargs: Any) -> None
```

Defined in: [src/strands/agent/conversation\_manager/summarizing\_conversation\_manager.py:103](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/summarizing_conversation_manager.py#L103)

Apply management strategy to conversation history.

For the summarizing conversation manager, no proactive management is performed.
Summarization only occurs when there’s a context overflow that triggers reduce\_context.

**Arguments**:

- `agent` \- The agent whose conversation history will be managed.
The agent’s messages list is modified in-place.
- `**kwargs` \- Additional keyword arguments for future extensibility.

#### reduce\_context

[Section titled “reduce\_context”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.summarizing_conversation_manager/#reduce_context)

```
def reduce_context(agent: "Agent",

                   e: Exception | None = None,

                   **kwargs: Any) -> None
```

Defined in: [src/strands/agent/conversation\_manager/summarizing\_conversation\_manager.py:117](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/summarizing_conversation_manager.py#L117)

Reduce context using summarization.

When `e` is set (reactive overflow recovery), summarization failure is re-raised —
the agent loop must not proceed with an overflow.

When `e` is None (proactive compression), summarization failure is logged and
returns silently — the model call proceeds regardless.

**Arguments**:

- `agent` \- The agent whose conversation history will be reduced.
The agent’s messages list is modified in-place.
- `e` \- The exception that triggered the context reduction, if any.
When set, this is a reactive overflow recovery call.
When None, this is a proactive compression call (best-effort).
- `**kwargs` \- Additional keyword arguments for future extensibility.

**Raises**:

- `Exception` \- If summarization fails during reactive overflow recovery (e is set).