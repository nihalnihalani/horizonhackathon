For the complete documentation index, see [llms.txt](https://developers.openai.com/llms.txt). Markdown versions of documentation pages are available by appending
`.md` to the page URL.

## Search the API docs

Search docs

### Suggested

response\_formatreasoning\_effortstreamingtools

Primary navigation

Search docs

### Suggested

response\_formatreasoning\_effortstreamingtools

Overview  Models  Agents  Tools  Audio & voice  Production  API reference

OverviewModelsAgentsToolsAudio & voiceProductionAPI referenceDocsOverview

- [Home](https://developers.openai.com/api/docs)

### Get started

- [Quickstart](https://developers.openai.com/api/docs/quickstart)
- [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model)
- [Key concepts](https://developers.openai.com/api/docs/concepts)

### Core concepts

- [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [Background mode](https://developers.openai.com/api/docs/guides/background)
- [Streaming](https://developers.openai.com/api/docs/guides/streaming-responses)
- [WebSocket mode](https://developers.openai.com/api/docs/guides/websocket-mode)
- [Mid-turn steering](https://developers.openai.com/api/docs/guides/steering)
- [Multi-agent](https://developers.openai.com/api/docs/guides/responses-multi-agent)
- [Webhooks](https://developers.openai.com/api/docs/guides/webhooks)
- [File inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [Compaction](https://developers.openai.com/api/docs/guides/compaction)
- [Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)

### SDKs and CLI

- [OpenAI SDK](https://developers.openai.com/api/docs/libraries)
- [OpenAI CLI](https://developers.openai.com/api/docs/libraries/openai-cli)

### Resources

- [Changelog](https://developers.openai.com/api/docs/changelog)
- [Deprecations](https://developers.openai.com/api/docs/deprecations)
- [Supported countries](https://developers.openai.com/api/docs/supported-countries)
- [OpenAI Crawlers](https://developers.openai.com/api/docs/bots)
- [Terms and policies](https://openai.com/policies)

### Legacy APIs

- Agent Builder

  - [Overview](https://developers.openai.com/api/docs/guides/agent-builder)
  - [Migration guide](https://developers.openai.com/api/docs/guides/agent-builder/migrate-from-agent-builder)
  - [Node reference](https://developers.openai.com/api/docs/guides/node-reference)
  - [Safety in building agents](https://developers.openai.com/api/docs/guides/agent-builder-safety)

- Evals

  - [Getting started](https://developers.openai.com/api/docs/guides/evaluation-getting-started)
  - [Working with evals](https://developers.openai.com/api/docs/guides/evals)
  - [Prompt optimizer](https://developers.openai.com/api/docs/guides/prompt-optimizer)
  - [External models](https://developers.openai.com/api/docs/guides/external-models)
  - [Best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  - [Graders](https://developers.openai.com/api/docs/guides/graders)

- Fine-tuning

  - [Optimization cycle](https://developers.openai.com/api/docs/guides/model-optimization)
  - [Supervised fine-tuning](https://developers.openai.com/api/docs/guides/supervised-fine-tuning)
  - [Vision fine-tuning](https://developers.openai.com/api/docs/guides/vision-fine-tuning)
  - [Direct preference optimization](https://developers.openai.com/api/docs/guides/direct-preference-optimization)
  - [Reinforcement fine-tuning](https://developers.openai.com/api/docs/guides/reinforcement-fine-tuning)
  - [RFT use cases](https://developers.openai.com/api/docs/guides/rft-use-cases)
  - [Best practices](https://developers.openai.com/api/docs/guides/fine-tuning-best-practices)

- Assistants API

  - [Migration guide](https://developers.openai.com/api/docs/assistants/migration)

[API Dashboard](https://platform.openai.com/login)

[Try ChatGPT](https://chatgpt.com/)

Copy Page

## Overview

To support long-running interactions, you can use compaction to reduce context
size while preserving state needed for subsequent turns.

Compaction helps you balance quality, cost, and latency as conversations grow.

## Server-side compaction

You can enable server-side compaction in a Responses create request
(`POST /responses` or `client.responses.create`) by setting
`context_management` with `compact_threshold`.

- When the rendered token count crosses the configured threshold, the server
runs server-side compaction.
- No separate `/responses/compact` call is required in this mode.
- The response stream includes the encrypted compaction item.
- ZDR note: server-side compaction is ZDR-friendly when you set `store=false`
on your Responses create requests.

The returned compaction item carries forward key prior state and reasoning into
the next run using fewer tokens. It is opaque and not intended to be
human-interpretable.

For stateless input-array chaining, append output items as usual. If you are
using `previous_response_id`, pass only the new user message each turn. In both
cases, the compaction item carries context needed for the next window.

Latency tip: After appending output items to the previous input items, you can
drop items that came before the most recent compaction item to keep requests
smaller and reduce long-tail latency. The latest compaction item carries the
necessary context to continue the conversation. If you use
`previous_response_id` chaining, do not manually prune.

## User journey

1. Call `/responses` as usual, but include `context_management` with
`compact_threshold` to enable server-side compaction.
2. As the response streams, if the context size crosses the threshold, the server
triggers a compaction pass, emits a compaction output item in the same stream,
and prunes context before continuing inference.
3. Continue your loop with one pattern: stateless input-array chaining (append
output, including compaction items, to your next input array) or
`previous_response_id` chaining (pass only the new user message each turn and
carry that ID forward).

## Example user flow

JavaScript

```
import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";

const client = new OpenAI();

const conversation = [\
  {\
    type: "message",\
    role: "user",\
    content: "Let's begin a long coding task.",\
  },\
];

const response = await client.responses.create({
  model: "gpt-5.3-codex",
  input: conversation,
  store: false,
  context_management: [{ type: "compaction", compact_threshold: 200_000 }],
});

conversation.push(...toResponseInputItems(response.output));
console.log(response.output_text);
```

```
conversation = [\
    {\
        "type": "message",\
        "role": "user",\
        "content": "Let's begin a long coding task.",\
    }\
]

while keep_going:
    response = client.responses.create(
        model="gpt-5.3-codex",
        input=conversation,
        store=False,
        context_management=[{"type": "compaction", "compact_threshold": 200000}],
    )

    conversation.extend(response.output)

    conversation.append(
        {
            "type": "message",
            "role": "user",
            "content": get_next_user_input(),
        }
    )
```

```
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

func main() {
	client := openai.NewClient()
	conversation := []responses.ResponseInputItemUnionParam{
		responses.ResponseInputItemParamOfMessage("Let's begin a long coding task.", responses.EasyInputMessageRoleUser),
	}
	scanner := bufio.NewScanner(os.Stdin)
	for {
		response, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
			Model: "gpt-5.3-codex",
			Store: openai.Bool(false),
			Input: responses.ResponseNewParamsInputUnion{OfInputItemList: conversation},
			ContextManagement: []responses.ResponseNewParamsContextManagement{{
				Type: "compaction", CompactThreshold: openai.Int(200000),
			}},
		})
		if err != nil {
			panic(err)
		}
		conversation = append(conversation, outputAsInput(response.Output)...)
		fmt.Println(response.OutputText())
		if !scanner.Scan() {
			break
		}
		conversation = append(conversation,
			responses.ResponseInputItemParamOfMessage(scanner.Text(), responses.EasyInputMessageRoleUser),
		)
	}
	if err := scanner.Err(); err != nil {
		panic(err)
	}
}

func outputAsInput(output []responses.ResponseOutputItemUnion) []responses.ResponseInputItemUnionParam {
	input := make([]responses.ResponseInputItemUnionParam, 0, len(output))
	for _, item := range output {
		var converted responses.ResponseInputItemUnion
		if err := json.Unmarshal([]byte(item.RawJSON()), &converted); err != nil {
			panic(err)
		}
		input = append(input, converted.ToParam())
	}
	return input
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.core.JsonValue;
import com.openai.models.responses.EasyInputMessage;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.ResponseInputItem;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

var conversation = new ArrayList<ResponseInputItem>();
conversation.add(
    ResponseInputItem.ofEasyInputMessage(
        EasyInputMessage.builder()
            .role(EasyInputMessage.Role.USER)
            .content("Let's begin a long coding task.")
            .build()));

ResponseCreateParams params =
    ResponseCreateParams.builder()
        .model("gpt-5.3-codex")
        .inputOfResponse(conversation)
        .store(false)
        .putAdditionalBodyProperty(
            "context_management",
            JsonValue.from(List.of(Map.of("type", "compaction", "compact_threshold", 200000))))
        .build();

var response = client.responses().create(params);
response.output().stream()
    .map(item -> JsonValue.from(item).convert(ResponseInputItem.class))
    .forEach(conversation::add);
conversation.add(
    ResponseInputItem.ofEasyInputMessage(
        EasyInputMessage.builder()
            .role(EasyInputMessage.Role.USER)
            .content("Now implement the next step.")
            .build()));

client
    .responses()
    .create(params.toBuilder().inputOfResponse(conversation).build())
    .output()
    .stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));
```

```
require "openai"

client = OpenAI::Client.new
conversation = [\
  {\
    type: :message,\
    role: :user,\
    content: "Let's begin a long coding task."\
  }\
]

response = client.responses.create(
  model: "gpt-5.3-codex",
  input: conversation,
  store: false,
  context_management: [\
    {\
      type: :compaction,\
      compact_threshold: 200_000\
    }\
  ]
)
conversation.concat(response.output)
conversation << {
  type: :message,
  role: :user,
  content: "Now implement the next step."
}
next_response = client.responses.create(
  model: "gpt-5.3-codex",
  input: conversation,
  store: false,
  context_management: [\
    {\
      type: :compaction,\
      compact_threshold: 200_000\
    }\
  ]
)
puts(next_response.output_text)
```

## Standalone compact endpoint

For explicit control, use the
[standalone compact endpoint](https://developers.openai.com/api/docs/api-reference/responses/compact) for
stateless compaction in long-running workflows.

This endpoint is fully stateless and ZDR-friendly.

You send a full context window (messages, tools, and other items), and the
endpoint returns a new compacted context window you can pass to your next
`/responses` call.

The returned compacted window includes an encrypted compaction item that carries
forward key prior state and reasoning using fewer tokens. It is opaque and not
intended to be human-interpretable.

Note: the compacted window generally contains more than just the compaction
item. It can also include retained items from the previous window.

Output handling: do not prune `/responses/compact` output. The returned window
is the canonical next context window, so pass it into your next `/responses`
call as-is.

### User journey for standalone compaction

1. Use `/responses` normally, sending input items that include user messages,
assistant outputs, and tool interactions.
2. When your context window grows large, call `/responses/compact` to generate a
new compacted context window. The window you send to `/responses/compact`
must still fit within your model’s context window.
3. For subsequent `/responses` calls, pass the returned compacted window
(including the compaction item) as input instead of the full transcript.

### Example user flow

JavaScript

```
import OpenAI from "openai";

const client = new OpenAI();

const conversation = [{ role: "user", content: "Plan a trip to Kyoto." }];

const compacted = await client.responses.compact({
  model: "gpt-6-astra",
  input: conversation,
});

const nextInput = [\
  ...compacted.output.map((item) => item),\
  { role: "user", content: "Add two more days to the itinerary." },\
];

const response = await client.responses.create({
  model: "gpt-6-astra",
  input: nextInput,
  store: false,
});

console.log(response.output_text);
```

```
# Full window collected from prior turns
long_input_items_array = [{"role": "user", "content": "Plan a trip to Kyoto."}]

# 1) Compact the current window
compacted = client.responses.compact(
    model="gpt-6-astra",
    input=long_input_items_array,
)

# 2) Start the next turn by appending a new user message
next_input = [\
    *compacted.output,  # Use compact output as-is\
    {\
        "type": "message",\
        "role": "user",\
        "content": user_input_message(),\
    },\
]

next_response = client.responses.create(
    model="gpt-6-astra",
    input=next_input,
    store=False,  # Keep the flow ZDR-friendly
)
```

```
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

func main() {
	client := openai.NewClient()
	longInputItems := []responses.ResponseInputItemUnionParam{
		responses.ResponseInputItemParamOfMessage("Plan a trip to Kyoto.", responses.EasyInputMessageRoleUser),
	}
	compacted, err := client.Responses.Compact(context.Background(), responses.ResponseCompactParams{
		Model: "gpt-6-astra",
		Input: responses.ResponseCompactParamsInputUnion{OfResponseInputItemArray: longInputItems},
	})
	if err != nil {
		panic(err)
	}
	scanner := bufio.NewScanner(os.Stdin)
	if !scanner.Scan() {
		return
	}
	nextInput := append(outputAsInput(compacted.Output),
		responses.ResponseInputItemParamOfMessage(scanner.Text(), responses.EasyInputMessageRoleUser),
	)
	nextResponse, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model: "gpt-6-astra",
		Store: openai.Bool(false),
		Input: responses.ResponseNewParamsInputUnion{OfInputItemList: nextInput},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(nextResponse.OutputText())
}

func outputAsInput(output []responses.ResponseOutputItemUnion) []responses.ResponseInputItemUnionParam {
	input := make([]responses.ResponseInputItemUnionParam, 0, len(output))
	for _, item := range output {
		var converted responses.ResponseInputItemUnion
		if err := json.Unmarshal([]byte(item.RawJSON()), &converted); err != nil {
			panic(err)
		}
		input = append(input, converted.ToParam())
	}
	return input
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.responses.EasyInputMessage;
import com.openai.models.responses.ResponseCompactParams;
import com.openai.models.responses.ResponseCompactionItemParam;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.ResponseInputItem;
import java.util.ArrayList;

var compacted =
    client
        .responses()
        .compact(
            ResponseCompactParams.builder()
                .model("gpt-6-astra")
                .input("Plan a trip to Kyoto.")
                .build());
var input = new ArrayList<ResponseInputItem>();
for (var item : compacted.output()) {
  item.message().map(ResponseInputItem::ofResponseOutputMessage).ifPresent(input::add);
  item.reasoning().map(ResponseInputItem::ofReasoning).ifPresent(input::add);
  item.compaction()
      .map(
          value ->
              ResponseInputItem.ofCompaction(
                  ResponseCompactionItemParam.builder()
                      .id(value.id())
                      .encryptedContent(value.encryptedContent())
                      .build()))
      .ifPresent(input::add);
}
input.add(
    ResponseInputItem.ofEasyInputMessage(
        EasyInputMessage.builder()
            .role(EasyInputMessage.Role.USER)
            .content("Add restaurant recommendations.")
            .build()));

client
    .responses()
    .create(
        ResponseCreateParams.builder()
            .model("gpt-6-astra")
            .inputOfResponse(input)
            .store(false)
            .build())
    .output()
    .stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));
```

```
require "openai"

client = OpenAI::Client.new
long_input = [\
  {\
    role: :user,\
    content: "Plan a trip to Kyoto."\
  }\
]
compaction = client.responses.compact(
  model: "gpt-6-astra",
  input: long_input
)
next_input = [\
  *compaction.output,\
  {\
    type: :message,\
    role: :user,\
    content: "Add restaurant recommendations."\
  }\
]
response = client.responses.create(
  model: "gpt-6-astra",
  input: next_input,
  store: false
)
puts(response.output_text)
```

Ask AI

Loading docs agent...