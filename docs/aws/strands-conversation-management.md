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

 [Skip to content](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#_top)

# strands.agent.conversation\_manager.sliding\_window\_conversation\_manager

Sliding window conversation history management.

## SlidingWindowConversationManager

[Section titled “SlidingWindowConversationManager”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#slidingwindowconversationmanager)

```
class SlidingWindowConversationManager(ConversationManager)
```

Defined in: [src/strands/agent/conversation\_manager/sliding\_window\_conversation\_manager.py:22](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/sliding_window_conversation_manager.py#L22)

Implements a sliding window strategy for managing conversation history.

This class handles the logic of maintaining a conversation window that preserves tool usage pairs and avoids
invalid window states.

When truncation is enabled (the default), large tool results are partially truncated, preserving the first
and last 200 characters, and image blocks inside tool results are replaced with descriptive text placeholders.
Truncation targets the oldest tool results first so the most relevant recent context is preserved as long
as possible.

Supports proactive management during agent loop execution via the per\_turn parameter.

#### \_\_init\_\_

[Section titled “\_\_init\_\_”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#__init__)

```
def __init__(window_size: int = 40,

             should_truncate_results: bool = True,

             *,

             per_turn: bool | int = False,

             pin_first: int | None = None,

             proactive_compression: bool | ProactiveCompressionConfig

             | None = None)
```

Defined in: [src/strands/agent/conversation\_manager/sliding\_window\_conversation\_manager.py:36](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/sliding_window_conversation_manager.py#L36)

Initialize the sliding window conversation manager.

**Arguments**:

- `window_size` \- Maximum number of messages to keep in the agent’s history.
Use 0 to clear all messages on every reduction. Defaults to 40 messages.

- `should_truncate_results` \- Truncate tool results when a message is too large for the model’s context window

- `per_turn` \- Controls when to apply message management during agent execution.


  - False (default): Only apply management at the end (default behavior)
  - True: Apply management before every model call
  - int (e.g., 3): Apply management before every N model calls

When to use per\_turn: If your agent performs many tool operations in loops
(e.g., web browsing with frequent screenshots), enable per\_turn to proactively
manage message history and prevent the agent loop from slowing down. Start with
per\_turn=True and adjust to a specific frequency (e.g., per\_turn=5) if needed
for performance tuning.

- `pin_first` \- Number of messages at the start of the conversation to permanently pin.
Pinned messages are protected from eviction during context reduction.

- `proactive_compression` \- Enable proactive context compression before the model call.
  - `True`: compress when 70% of the context window is used (default threshold).
  - `\{"compression_threshold": float}`: compress at the specified ratio (0, 1\].
  - `False` or `None`: disabled, only reactive overflow recovery is used.

**Raises**:

- `ValueError` \- If window\_size is negative, or if per\_turn is 0 or a negative integer.

#### register\_hooks

[Section titled “register\_hooks”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#register_hooks)

```
def register_hooks(registry: "HookRegistry", **kwargs: Any) -> None
```

Defined in: [src/strands/agent/conversation\_manager/sliding\_window\_conversation\_manager.py:85](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/sliding_window_conversation_manager.py#L85)

Register hook callbacks for per-turn conversation management.

**Arguments**:

- `registry` \- The hook registry to register callbacks with.
- `**kwargs` \- Additional keyword arguments for future extensibility.

#### get\_state

[Section titled “get\_state”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#get_state)

```
def get_state() -> dict[str, Any]
```

Defined in: [src/strands/agent/conversation\_manager/sliding\_window\_conversation\_manager.py:127](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/sliding_window_conversation_manager.py#L127)

Get the current state of the conversation manager.

**Returns**:

Dictionary containing the manager’s state, including model call count for per-turn tracking.

#### restore\_from\_session

[Section titled “restore\_from\_session”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#restore_from_session)

```
def restore_from_session(state: dict[str, Any]) -> list | None
```

Defined in: [src/strands/agent/conversation\_manager/sliding\_window\_conversation\_manager.py:137](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/sliding_window_conversation_manager.py#L137)

Restore the conversation manager’s state from a session.

**Arguments**:

- `state` \- Previous state of the conversation manager

**Returns**:

Optional list of messages to prepend to the agent’s messages.

#### apply\_management

[Section titled “apply\_management”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#apply_management)

```
def apply_management(agent: "Agent", **kwargs: Any) -> None
```

Defined in: [src/strands/agent/conversation\_manager/sliding\_window\_conversation\_manager.py:150](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/sliding_window_conversation_manager.py#L150)

Apply the sliding window to the agent’s messages array to maintain a manageable history size.

This method is called after every event loop cycle to apply a sliding window if the message count
exceeds the window size.

**Arguments**:

- `agent` \- The agent whose messages will be managed.
This list is modified in-place.
- `**kwargs` \- Additional keyword arguments for future extensibility.

#### reduce\_context

[Section titled “reduce\_context”](https://strandsagents.com/docs/api/python/strands.agent.conversation_manager.sliding_window_conversation_manager/#reduce_context)

```
def reduce_context(agent: "Agent",

                   e: Exception | None = None,

                   **kwargs: Any) -> None
```

Defined in: [src/strands/agent/conversation\_manager/sliding\_window\_conversation\_manager.py:170](https://github.com/strands-agents/harness-sdk/blob/main/strands-py/src/strands/agent/conversation_manager/sliding_window_conversation_manager.py#L170)

Trim the oldest messages to reduce the conversation context size.

When `e` is set (reactive overflow recovery), attempts to truncate large tool results
first before falling back to message trimming.

When `e` is None (proactive compression or routine management), only trims messages
without attempting tool result truncation.

The method handles special cases where trimming the messages leads to:

- toolResult with no corresponding toolUse
- toolUse with no corresponding toolResult

**Arguments**:

- `agent` \- The agent whose messages will be reduce.
This list is modified in-place.
- `e` \- The exception that triggered the context reduction, if any.
When set, this is a reactive overflow recovery call.
When None, this is a proactive or routine management call.
- `**kwargs` \- Additional keyword arguments for future extensibility.

**Raises**:

- `ContextWindowOverflowException` \- If the context cannot be reduced further and a context overflow
error was provided (e is not None). When called during routine window management or
proactive compression (e is None), logs a warning and returns without modification.