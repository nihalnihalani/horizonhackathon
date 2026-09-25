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

# Memory strategies

[PDF](https://docs.aws.amazon.com/pdfs/bedrock-agentcore/latest/devguide/bedrock-agentcore-dg.pdf#memory-strategies)

[RSS](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/bedrock-agentcore-dg.rss)

[Markdown](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.md "Download Markdown")

Agent SetupUp-to-date AWS docs, tested procedures, and IAM guardrails via a single setup prompt in your AI coding agent.

Focus mode

Memory strategies - Amazon Bedrock AgentCore

[Open PDF](https://docs.aws.amazon.com/pdfs/bedrock-agentcore/latest/devguide/bedrock-agentcore-dg.pdf#memory-strategies "Open PDF")

[Built-in strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html#memory-built-in-strategies-desc) [Built-in overrides](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html#memory-built-in-overrides-desc) [Self-managed strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html#memory-self-managed-strategies-desc)

In AgentCore Memory, you can add memory strategies to your memory resource. These strategies determine what types of information to extract from raw conversations. Strategies are configurations that intelligently capture and persist key concepts from interactions, sent as events in the [CreateEvent](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_CreateEvent.html) operation. You can add strategies to the memory resource as part of [CreateMemory](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateMemory.html) or [UpdateMemory](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_UpdateMemory.html) operations. Once enabled, these strategies are automatically executed on raw conversation events associated with that memory resource to extract long-term memories.

If no strategies are specified, long-term memory records will not be extracted for that memory.

AgentCore Memory supports a variety of memory strategies:

###### Topics

- [Built-in strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html#memory-built-in-strategies-desc)

- [Built-in overrides](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html#memory-built-in-overrides-desc)

- [Self-managed strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html#memory-self-managed-strategies-desc)

- [Built-in strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/built-in-strategies.html)

- [Customize a built-in strategy or create your own strategy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-custom-strategy.html)

- [Self-managed strategy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-self-managed-strategies.html)


## Built-in strategies

AgentCore handles all memory extraction and consolidation automatically with predefined algorithms.

- AgentCore handles all memory extraction and consolidation automatically

- No configuration required beyond basic trigger settings

- Uses predefined algorithms optimized and benchmarked for common use cases

- Suitable for standard conversational AI applications

- Limited customization options

- Higher cost for storage


## Built-in overrides

Extends built-in strategies with targeted customization while using an AgentCore managed extraction pipeline.

- Extends built-in strategies with targeted customization

- Allows modification of prompts while still using AgentCore managed extraction pipeline

- Provides support for bedrock models (invoked in your account)

- Lower cost for storage than built-ins


## Self-managed strategies

You have complete ownership of memory processing pipeline with custom extraction and consolidation algorithms.

- Complete ownership of memory processing pipeline

- Custom extraction and consolidation algorithms using any model, prompts, etc.

- Full control over memory record schemas, namespaces etc.

- Integration with external systems and databases

- Requires infrastructure setup and maintenance

- Lower cost for storage than built-in strategies


A single memory resource can be configured to utilize both built-in and custom strategies simultaneously, providing flexibility to address diverse memory requirements.

[Document Conventions](https://docs.aws.amazon.com/general/latest/gr/docconventions.html)

Memory types

Built-in strategies

Did this page help you? - Yes

Thanks for letting us know we're doing a good job!

If you've got a moment, please tell us what we did right so we can do more of it.

Did this page help you? - No

Thanks for letting us know this page needs work. We're sorry we let you down.

If you've got a moment, please tell us how we can make the documentation better.

- ### On this page

- Did this page help you?








Yes



No













[Provide feedback](https://docs.aws.amazon.com/feedback/doc-feedback.html?hidden_service_name=bedrock-agentcore&topic_url=https%3A%2F%2Fdocs.aws.amazon.com%2Fbedrock-agentcore%2Flatest%2Fdevguide%2Fmemory-strategies.html)


#### Next topic:

[Built-in strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/built-in-strategies.html)

#### Previous topic:

[Memory types](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-types.html)