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

# Overview

[PDF](https://docs.aws.amazon.com/pdfs/bedrock-agentcore/latest/devguide/bedrock-agentcore-dg.pdf#what-is-bedrock-agentcore)

[RSS](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/bedrock-agentcore-dg.rss)

[Markdown](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.md "Download Markdown")

Agent SetupUp-to-date AWS docs, tested procedures, and IAM guardrails via a single setup prompt in your AI coding agent.

Focus mode

Overview - Amazon Bedrock AgentCore

[Open PDF](https://docs.aws.amazon.com/pdfs/bedrock-agentcore/latest/devguide/bedrock-agentcore-dg.pdf#what-is-bedrock-agentcore "Open PDF")

[What is Amazon Bedrock AgentCore?](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html#what-is-bedrock-agentcore-overview) [Core services in Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html#core-services-in-agentcore) [What can you build with Amazon Bedrock AgentCore?](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html#what-you-can-build-with-agentcore) [Pricing for Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html#agentcore-pricing) [Next Steps](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html#next-steps)

## What is Amazon Bedrock AgentCore?

Amazon Bedrock AgentCore is an agentic platform for building, deploying, and operating highly effective agents securely at scale using any framework and foundation model. With AgentCore, you can enable agents to take actions across tools and data with the right permissions and governance, run agents securely at scale, and monitor agent performance and quality in production - all without any infrastructure management. AgentCore services work together or independently with any open-source framework such as CrewAI, LangGraph, LlamaIndex, and Strands Agents and with any foundation model, so you don’t have to choose between open-source flexibility and enterprise-grade security and reliability.

![What is AgentCore?](https://docs.aws.amazon.com/images/bedrock-agentcore/latest/devguide/images/agentcore_all_components_final.png)

## Core services in Amazon Bedrock AgentCore

Amazon Bedrock AgentCore includes the following modular services and capabilities that you can use together or independently:

| Service | Description | Integrations |
| :-- | :-- | :-- |
| [Harness](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness.html) | A managed agent loop that lets you define and invoke AI agents with a single API call. Specify a model, system prompt, and tools inline. Harness handles orchestration, tool execution, memory management, and response generation. Each session runs in an isolated microVM with filesystem and shell access, supporting use cases like code generation, data analysis, and deep research. Bring your own container image for custom environments with additional dependencies. | AgentCore Harness works with Amazon Bedrock, OpenAI, Google Gemini, and any OpenAI-compatible model provider. Integrates with AgentCore Memory, Gateway, Browser, Code Interpreter, and Observability. Supports remote MCP servers, inline functions, and custom container environments. |
| [Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html) | A secure, serverless runtime environment purpose-built for deploying and scaling dynamic AI agents and tools. Runtime provides fast cold starts for real-time interactions, extended runtime support for asynchronous agents, true session isolation, built-in identity, and support for multi-modal and multi-agent agentic workloads. | AgentCore Runtime works with custom frameworks and any open-source framework, including CrewAI, LangGraph, LlamaIndex, Google ADK, OpenAI Agents SDK, and Strands Agents, any foundation model in or outside of Amazon Bedrock including OpenAI, Google’s Gemini, Anthropic’s Claude, Amazon Nova, Meta Llama, and Mistral models, and popular protocols like MCP and A2A. |
| [Memory](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html) | A way to build context-aware agents with complete control over what the agent remembers and learns. Supports for both short-term memory for multi-turn conversations and long-term memory that persists across sessions, with the ability to not only share memory stores across agents but also learn from experiences. | AgentCore Memory works with LangGraph, LangChain, Strands, LlamaIndex |
| [Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html) | A secure way to convert your APIs, Lambda functions, and existing services into Model Context Protocol (MCP)-compatible tools and also connect to pre-existing MCP servers, making them available to AI agents through Gateway endpoints with just a few lines of code. | Any APIs, MCP tools, Lambda, and popular integrations including Salesforce, Zoom, JIRA, Slack etc. |
| [Identity](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/identity.html) | A secure, scalable agent identity, access and authentication management service which is compatible with existing identity providers, eliminating needs for user migration or rebuilding authentication flows. | Any IdP and credential providers such as Amazon Cognito, Okta, Microsoft Azure Entra ID, Auth0 etc. |
| [Code Interpreter](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-tool.html) | An isolated sandbox environment for agents to execute code enhancing their accuracy and expanding their ability to solve complex end-to-end tasks. | Multiple languages including Python, JavaScript and TypeScript |
| [Browser](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-tool.html) | A fast and secure cloud-based browser runtime environment to enable AI agents to interact with web applications, fill forms, navigate websites, and extract information in a fully managed environment. | Any foundation model or popular browser automation frameworks including Playwright and BrowserUse |
| [Observability](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html) | A unified view to trace, debug and monitor agent performance in production. It offers detailed visualizations of each step in the agent workflow, enabling you to inspect an agent’s execution path, audit intermediate outputs, and debug performance bottlenecks and failures. | Any monitoring and observability stack that integrate with telemetry data emitted in standardized OpenTelemetry (OTEL)-compatible format |
| [Payments](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments.html) | A fully managed service that enables microtransaction payments for AI agents to access paid APIs, MCP servers, and content using the x402 protocol and the Machine Payments Protocol (MPP). Payments provides wallet integration, configurable spending limits, and end-to-end observability for agent payment operations. | AgentCore payments supports Coinbase CDP and Stripe (Privy) wallet providers, AgentCore Gateway, Strands Agents, any x402-compatible or MPP-compatible endpoint, AgentCore Identity and AgentCore Observability powered by Amazon CloudWatch for unified monitoring. |
| [Evaluations](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/evaluations.html) | A purpose-built evaluation service for automated, consistent, and data-driven agent assessment. AgentCore Evaluations measures how well your agents and tools execute tasks, handle edge cases, and maintain output reliability across diverse inputs and contexts. Evaluations provides measurable quality signals, helps teams optimize performance using structured insights, and ensures your agent meets functional and behavioral standards before and after deployment. | AgentCore Evaluations supports evaluations on sessions, traces, and spans generated from Strands Agent or LangGraph frameworks, and instrumented using OpenTelemetry or OpenInference. All results integrated into AgentCore Observability powered by Amazon CloudWatch for unified monitoring. |
| [Optimization](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/optimization.html) | A continuous improvement service that uses AI-generated recommendations, versioned configuration bundles, and A/B testing to improve agent performance through data-driven configuration changes. Instead of manual, guesswork-driven optimization, you point the service at agent traces to generate improvements and validate them with controlled experiments. | AgentCore optimization builds on AgentCore Evaluations and works with agents instrumented using OpenTelemetry via AgentCore Observability. Supports system prompt and tool description optimization with traffic splitting through AgentCore Gateway for A/B testing. |
| [Policy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html) | A capability that provides deterministic control to ensure agents operate within defined boundaries and business rules without slowing them down. Easily author fine-grained rules using natural language or a policy language — [Dogwood](https://dogwood-policy.github.io/dogwood/index.html), which is compatible with [Cedar](https://www.cedarpolicy.com/en) (AWS's open-source policy language). | Integrates with AgentCore Gateway, to intercept every tool call before execution. You can define which tools agents can access, what actions they can perform, and under what conditions. |
| [Registry](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/registry.html) | A centralized catalog for discovering and managing agents, MCP servers, tools, skills and custom resources across your organization. Registry provides a governed workflow for publishing, reviewing, and approving resources, with hybrid semantic and keyword search so that agents and developers can find the right tools. | AgentCore Registry works with any MCP Server, Agent, Skill or Custom Resource, deployed on AWS, On-Prem or on any other Cloud environment. |

## What can you build with Amazon Bedrock AgentCore?

With Amazon Bedrock AgentCore, developers can accelerate AI agents into production with the scale, reliability, and security, critical to real-world deployment. Some common use cases for which you must consider leveraging AgentCore are:

- **Agents**

Build autonomous AI apps that reason, use tools, and maintain context. Deploy agents for customer support, workflow automation, data analysis, or coding assistance. Your agent runs serverless with isolated sessions, persistent memory, and built-in observability.

- **Tools and Model Context Protocol (MCP) Servers**

Transform existing APIs, databases, or services into tools that any MCP-compatible agent can use. Deploy a gateway that wraps your Lambda functions or OpenAPI specs making your backend instantly accessible to agents without rewriting code.

- **Agent Platforms**

Provide your internal developers or customers with a paved path to build and deploy agents using approved tools, shared memory stores, and governed access to enterprise services. Centralize observability, authentication, and compliance while enabling teams to ship agent-powered features faster.


## Pricing for Amazon Bedrock AgentCore

AgentCore offers flexible, consumption-based pricing with no upfront commitments or minimum fees. For more information, see [AgentCore pricing](https://aws.amazon.com/bedrock/agentcore/pricing/) . AgentCore may use and store your content to improve your service experience or performance. Such improvements would be for your use of AgentCore and not for other customers.

## Next Steps

If you are a first-time user of Amazon Bedrock AgentCore, we recommend that you begin by reading the following sections:

- [Get started with the AgentCore CLI](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli.html)

- [Understand the available interfaces for using Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/develop-agents.html)


[Document Conventions](https://docs.aws.amazon.com/general/latest/gr/docconventions.html)

Supported AWS Regions

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













[Provide feedback](https://docs.aws.amazon.com/feedback/doc-feedback.html?hidden_service_name=bedrock-agentcore&topic_url=https%3A%2F%2Fdocs.aws.amazon.com%2Fbedrock-agentcore%2Flatest%2Fdevguide%2Fwhat-is-bedrock-agentcore.html)


#### Next topic:

[Supported AWS Regions](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-regions.html)

## What is AgentCore?

![What is AgentCore?](https://docs.aws.amazon.com/images/bedrock-agentcore/latest/devguide/images/agentcore_all_components_final.png)

Close