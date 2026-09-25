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

Responses

Copy Page

OpenAI provides a few ways to manage conversation state, which is important for preserving information across multiple messages or turns in a conversation.

When troubleshooting cases where GPT-5.5 treats an intermediate update as
the final answer, verify your integration preserves the assistant message
`phase` field correctly. See [Phase\\
parameter](https://developers.openai.com/api/docs/guides/reasoning#phase-parameter) for details.

## Manually manage conversation state

While each text generation request is independent and stateless, you can still implement **multi-turn conversations** by providing additional messages as parameters to your text generation request. Consider a knock-knock joke:

Manually construct a past conversation

Python

```
import OpenAI from "openai";

const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: "gpt-6-astra",
  messages: [\
    {\
      role: "user",\
      content: "knock knock.",\
    },\
    {\
      role: "assistant",\
      content: "Who's there?",\
    },\
    {\
      role: "user",\
      content: "Orange.",\
    },\
  ],
});

console.log(response.choices[0].message.content);
```

```
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-6-astra",
    messages=[\
        {"role": "user", "content": "knock knock."},\
        {"role": "assistant", "content": "Who's there?"},\
        {"role": "user", "content": "Orange."},\
    ],
)

print(response.choices[0].message.content)
```

```
package main

import (
	"context"
	"fmt"

	"github.com/openai/openai-go/v3"
)

func main() {
	client := openai.NewClient()

	completion, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Model: "gpt-6-astra",
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage("Knock knock."),
			openai.AssistantMessage("Who's there?"),
			openai.UserMessage("Orange."),
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(completion.Choices[0].Message.Content)
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;

ChatCompletionCreateParams params =
    ChatCompletionCreateParams.builder()
        .model("gpt-6-astra")
        .addUserMessage("Knock knock.")
        .addAssistantMessage("Who's there?")
        .addUserMessage("Orange.")
        .build();

client.chat().completions().create(params).choices().stream()
    .flatMap(choice -> choice.message().content().stream())
    .forEach(System.out::println);
```

```
using OpenAI.Chat;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
string model = "gpt-6-astra";
ChatClient client = new(model, key);

ChatCompletion completion = await client.CompleteChatAsync(
    [\
        new UserChatMessage("Knock knock."),\
        new AssistantChatMessage("Who's there?"),\
        new UserChatMessage("Orange."),\
    ]
);

Console.WriteLine(completion.Content[0].Text);
```

```
require "openai"

client = OpenAI::Client.new

completion = client.chat.completions.create(
  model: "gpt-6-astra",
  messages: [\
    {\
      role: :user,\
      content: "Knock knock."\
    },\
    {\
      role: :assistant,\
      content: "Who's there?"\
    },\
    {\
      role: :user,\
      content: "Orange."\
    }\
  ]
)

puts(completion.choices.fetch(0).message.content)
```

Manually construct a past conversation

Python

```
import OpenAI from "openai";

const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-6-astra",
  input: [\
    { role: "user", content: "knock knock." },\
    { role: "assistant", content: "Who's there?" },\
    { role: "user", content: "Orange." },\
  ],
});

console.log(response.output_text);
```

```
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-6-astra",
    input=[\
        {"role": "user", "content": "knock knock."},\
        {"role": "assistant", "content": "Who's there?"},\
        {"role": "user", "content": "Orange."},\
    ],
)

print(response.output_text)
```

```
package main

import (
	"context"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

func main() {
	client := openai.NewClient()

	response, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model: "gpt-6-astra",
		Input: responses.ResponseNewParamsInputUnion{
			OfInputItemList: responses.ResponseInputParam{
				responses.ResponseInputItemParamOfMessage("Knock knock.", responses.EasyInputMessageRoleUser),
				responses.ResponseInputItemParamOfMessage("Who's there?", responses.EasyInputMessageRoleAssistant),
				responses.ResponseInputItemParamOfMessage("Orange.", responses.EasyInputMessageRoleUser),
			},
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(response.OutputText())
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.responses.EasyInputMessage;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.ResponseInputItem;
import java.util.List;

ResponseCreateParams params =
    ResponseCreateParams.builder()
        .model("gpt-6-astra")
        .inputOfResponse(
            List.of(
                ResponseInputItem.ofEasyInputMessage(
                    EasyInputMessage.builder()
                        .role(EasyInputMessage.Role.USER)
                        .content("Knock knock.")
                        .build()),
                ResponseInputItem.ofEasyInputMessage(
                    EasyInputMessage.builder()
                        .role(EasyInputMessage.Role.ASSISTANT)
                        .content("Who's there?")
                        .build()),
                ResponseInputItem.ofEasyInputMessage(
                    EasyInputMessage.builder()
                        .role(EasyInputMessage.Role.USER)
                        .content("Orange.")
                        .build())))
        .build();

client.responses().create(params).output().stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));
```

```
using OpenAI.Responses;
#pragma warning disable OPENAI001

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
ResponsesClient client = new(key);

ResponseResult response = await client.CreateResponseAsync(
    "gpt-6-astra",
    [\
        ResponseItem.CreateUserMessageItem("Knock knock."),\
        ResponseItem.CreateAssistantMessageItem("Who's there?"),\
        ResponseItem.CreateUserMessageItem("Orange."),\
    ]
);

Console.WriteLine(response.GetOutputText());
```

```
require "openai"

client = OpenAI::Client.new

response = client.responses.create(
  model: "gpt-6-astra",
  input: [\
    {\
      role: :user,\
      content: "Knock knock."\
    },\
    {\
      role: :assistant,\
      content: "Who's there?"\
    },\
    {\
      role: :user,\
      content: "Orange."\
    }\
  ]
)

puts(response.output_text)
```

By using alternating `user` and `assistant` messages, you capture the previous state of a conversation in one request to the model.

To manually share context across generated responses, include the model’s previous response output as input, and append that input to your next request.

For stateless reasoning-model requests, preserve every item in the response’s `output` array. The Responses API returns encrypted reasoning items by default. Replaying the complete output keeps reasoning items and assistant `phase` values intact. Models that support persisted reasoning can use `reasoning.context: "all_turns"` to render the available reasoning from earlier turns into the next sample. See [preserve reasoning across calls](https://developers.openai.com/api/docs/guides/reasoning#preserve-reasoning-across-calls).

In the following example, we ask the model to tell a joke, followed by a request for another joke. Appending previous responses to new requests in this way helps ensure conversations feel natural and retain the context of previous interactions.

Manually manage conversation state with the Chat Completions API.

Python

```
import OpenAI from "openai";

const openai = new OpenAI();

let history = [\
  {\
    role: "user",\
    content: "tell me a joke",\
  },\
];

const completion = await openai.chat.completions.create({
  model: "gpt-6-astra",
  messages: history,
});

console.log(completion.choices[0].message.content);

history.push(completion.choices[0].message);
history.push({
  role: "user",
  content: "tell me another",
});

const secondCompletion = await openai.chat.completions.create({
  model: "gpt-6-astra",
  messages: history,
});

console.log(secondCompletion.choices[0].message.content);
```

```
from openai import OpenAI

client = OpenAI()

history = [{"role": "user", "content": "tell me a joke"}]

response = client.chat.completions.create(
    model="gpt-6-astra",
    messages=history,
)

print(response.choices[0].message.content)

history.append(response.choices[0].message)
history.append({"role": "user", "content": "tell me another"})

second_response = client.chat.completions.create(
    model="gpt-6-astra",
    messages=history,
)

print(second_response.choices[0].message.content)
```

```
package main

import (
	"context"
	"fmt"

	"github.com/openai/openai-go/v3"
)

func main() {
	client := openai.NewClient()
	history := []openai.ChatCompletionMessageParamUnion{
		openai.UserMessage("Tell me a joke."),
	}

	first, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Model:    "gpt-6-astra",
		Messages: history,
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(first.Choices[0].Message.Content)

	history = append(history,
		openai.AssistantMessage(first.Choices[0].Message.Content),
		openai.UserMessage("Tell me another."),
	)
	second, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Model:    "gpt-6-astra",
		Messages: history,
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(second.Choices[0].Message.Content)
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;

var params =
    ChatCompletionCreateParams.builder()
        .model("gpt-6-astra")
        .addUserMessage("Tell me a joke.")
        .build();
var first = client.chat().completions().create(params);
first.choices().stream()
    .flatMap(choice -> choice.message().content().stream())
    .forEach(System.out::println);

var second =
    client
        .chat()
        .completions()
        .create(
            params.toBuilder()
                .addAssistantMessage(first.choices().get(0).message().content().orElseThrow())
                .addUserMessage("Tell me another.")
                .build());
second.choices().stream()
    .flatMap(choice -> choice.message().content().stream())
    .forEach(System.out::println);
```

```
using OpenAI.Chat;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
string model = "gpt-6-astra";
ChatClient client = new(model, key);

List<ChatMessage> messages = [new UserChatMessage("Tell me a joke.")];
ChatCompletion first = await client.CompleteChatAsync(messages);
Console.WriteLine(first.Content[0].Text);

messages.Add(new AssistantChatMessage(first));
messages.Add(new UserChatMessage("Tell me another."));
ChatCompletion second = await client.CompleteChatAsync(messages);
Console.WriteLine(second.Content[0].Text);
```

```
require "openai"

client = OpenAI::Client.new
history = [\
  {\
    role: :user,\
    content: "Tell me a joke."\
  }\
]

first = client.chat.completions.create(
  model: "gpt-6-astra",
  messages: history
)
puts(first.choices.fetch(0).message.content)

history << {
  role: :assistant,
  content: first.choices.fetch(0).message.content
}
history << {
  role: :user,
  content: "Tell me another."
}

second = client.chat.completions.create(
  model: "gpt-6-astra",
  messages: history
)
puts(second.choices.fetch(0).message.content)
```

Manually manage conversation state with the Responses API.

Python

```
import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";

const openai = new OpenAI();

let history = [\
  {\
    role: "user",\
    content: "tell me a joke",\
  },\
];

const response = await openai.responses.create({
  model: "gpt-6-astra",
  input: history,
  store: false,
});

console.log(response.output_text);

// Add replayable output items, including reasoning items, to the history
history.push(...toResponseInputItems(response.output));

history.push({
  role: "user",
  content: "tell me another",
});

const secondResponse = await openai.responses.create({
  model: "gpt-6-astra",
  input: history,
  store: false,
});

console.log(secondResponse.output_text);
```

```
from openai import OpenAI

client = OpenAI()

history = [{"role": "user", "content": "tell me a joke"}]

response = client.responses.create(
    model="gpt-6-astra",
    input=history,
    store=False,
)

print(response.output_text)

# Add all response output items, including encrypted reasoning items, to the conversation
history += response.output

history.append({"role": "user", "content": "tell me another"})

second_response = client.responses.create(
    model="gpt-6-astra",
    input=history,
    store=False,
)

print(second_response.output_text)
```

```
package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

func main() {
	client := openai.NewClient()
	history := responses.ResponseInputParam{
		responses.ResponseInputItemParamOfMessage("tell me a joke", responses.EasyInputMessageRoleUser),
	}
	first, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model: "gpt-6-astra",
		Input: responses.ResponseNewParamsInputUnion{OfInputItemList: history},
		Store: openai.Bool(false),
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(first.OutputText())

	history = append(history, outputAsInput(first.Output)...)
	history = append(history, responses.ResponseInputItemParamOfMessage("tell me another", responses.EasyInputMessageRoleUser))
	second, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model: "gpt-6-astra",
		Input: responses.ResponseNewParamsInputUnion{OfInputItemList: history},
		Store: openai.Bool(false),
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(second.OutputText())
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

var history = new ArrayList<ResponseInputItem>();
history.add(
    ResponseInputItem.ofEasyInputMessage(
        EasyInputMessage.builder()
            .role(EasyInputMessage.Role.USER)
            .content("Tell me a joke.")
            .build()));

var first =
    client
        .responses()
        .create(
            ResponseCreateParams.builder()
                .model("gpt-6-astra")
                .inputOfResponse(history)
                .store(false)
                .build());
first.output().stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));
first.output().stream()
    .map(item -> JsonValue.from(item).convert(ResponseInputItem.class))
    .forEach(history::add);
history.add(
    ResponseInputItem.ofEasyInputMessage(
        EasyInputMessage.builder()
            .role(EasyInputMessage.Role.USER)
            .content("Tell me another.")
            .build()));

client
    .responses()
    .create(
        ResponseCreateParams.builder()
            .model("gpt-6-astra")
            .inputOfResponse(history)
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
using OpenAI.Responses;
#pragma warning disable OPENAI001

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
ResponsesClient client = new(key);

List<ResponseItem> history =
[\
    ResponseItem.CreateUserMessageItem("Tell me a joke."),\
];

CreateResponseOptions options = new("gpt-6-astra", history)
{
    StoredOutputEnabled = false,
    IncludedProperties =
    {
        IncludedResponseProperty.ReasoningEncryptedContent,
    },
};
ResponseResult first = await client.CreateResponseAsync(options);
Console.WriteLine(first.GetOutputText());

history.AddRange(first.OutputItems);
history.Add(ResponseItem.CreateUserMessageItem("Tell me another."));

options = new("gpt-6-astra", history)
{
    StoredOutputEnabled = false,
    IncludedProperties =
    {
        IncludedResponseProperty.ReasoningEncryptedContent,
    },
};
ResponseResult second = await client.CreateResponseAsync(options);
Console.WriteLine(second.GetOutputText());
```

```
require "openai"

client = OpenAI::Client.new
history = [\
  {\
    role: :user,\
    content: "Tell me a joke."\
  }\
]

first = client.responses.create(
  model: "gpt-6-astra",
  input: history,
  store: false
)
puts(first.output_text)

history.concat(first.output)
history << {
  role: :user,
  content: "Tell me another."
}

second = client.responses.create(
  model: "gpt-6-astra",
  input: history,
  store: false
)
puts(second.output_text)
```

## OpenAI APIs for conversation state

Our APIs make it easier to manage conversation state automatically, so you don’t have to pass inputs manually with each turn of a conversation.

We recommend using the [Responses API](https://developers.openai.com/api/docs/guides/conversation-state?api-mode=responses) instead. Because it’s stateful, managing context across conversations is a simple parameter.

If you’re using the Chat Completions endpoint, you’ll need to either manually manage state, as documented above.

### Using the Conversations API

The [Conversations API](https://developers.openai.com/api/docs/api-reference/conversations/create) works with the [Responses API](https://developers.openai.com/api/docs/api-reference/responses/create) to persist conversation state as a long-running object with its own durable identifier. After creating a conversation object, you can keep using it across sessions, devices, or jobs.

Conversations store items, which can be messages, tool calls, tool outputs, and other data.

Create a conversation

Python

```
const conversation = await client.conversations.create();
```

```
conversation = openai.conversations.create()
```

```
conversation, err := client.Conversations.New(context.Background(), conversations.ConversationNewParams{})
if err != nil {
	panic(err)
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;

var conversation = client.conversations().create();

System.out.println(conversation.id());
```

```
conversation = client.conversations.create
```

In a multi-turn interaction, you can pass the `conversation` into subsequent responses to persist state and share context across subsequent responses, rather than having to chain multiple response items together.

Manage conversation state with Conversations and Responses APIs

Python

```
const response = await client.responses.create({
  model: "gpt-6-astra",
  input: [{ role: "user", content: "What are the five Ds of dodgeball?" }],
  conversation: conversation.id,
});

console.log(response.output_text);
```

```
response = openai.responses.create(
    model="gpt-6-astra",
    input=[{"role": "user", "content": "What are the 5 Ds of dodgeball?"}],
    conversation=conversation.id,
)
```

```
response, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
	Model: "gpt-6-astra",
	Conversation: responses.ResponseNewParamsConversationUnion{
		OfString: openai.String(conversation.ID),
	},
	Input: responses.ResponseNewParamsInputUnion{
		OfString: openai.String("What are the five Ds of dodgeball?"),
	},
})
if err != nil {
	panic(err)
}
fmt.Println(response.OutputText())
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.responses.ResponseCreateParams;

var conversation = client.conversations().create();

var response =
    client
        .responses()
        .create(
            ResponseCreateParams.builder()
                .model("gpt-6-astra")
                .conversation(conversation.id())
                .input("What are the five Ds of dodgeball?")
                .build());

response.output().stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));
```

```
response = client.responses.create(
  model: "gpt-6-astra",
  conversation: conversation.id,
  input: "What are the five Ds of dodgeball?"
)

puts(response.output_text)
```

### Passing context from the previous response

Another way to manage conversation state is to share context across generated responses with the `previous_response_id` parameter. This parameter lets you chain responses and create a threaded conversation.

Chain responses across turns by passing the previous response ID

Python

```
import OpenAI from "openai";

const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-6-astra",
  input: "tell me a joke",
  store: true,
});

console.log(response.output_text);

const secondResponse = await openai.responses.create({
  model: "gpt-6-astra",
  previous_response_id: response.id,
  input: [{ role: "user", content: "explain why this is funny." }],
  store: true,
});

console.log(secondResponse.output_text);
```

```
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-6-astra",
    input="tell me a joke",
)
print(response.output_text)

second_response = client.responses.create(
    model="gpt-6-astra",
    previous_response_id=response.id,
    input=[{"role": "user", "content": "explain why this is funny."}],
)
print(second_response.output_text)
```

```
package main

import (
	"context"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

func main() {
	client := openai.NewClient()

	first, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model: "gpt-6-astra",
		Input: responses.ResponseNewParamsInputUnion{
			OfString: openai.String("Tell me a joke."),
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(first.OutputText())

	second, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model:              "gpt-6-astra",
		PreviousResponseID: openai.String(first.ID),
		Input: responses.ResponseNewParamsInputUnion{
			OfString: openai.String("Explain why this is funny."),
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(second.OutputText())
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.responses.ResponseCreateParams;

var first =
    client
        .responses()
        .create(
            ResponseCreateParams.builder().model("gpt-6-astra").input("Tell me a joke.").build());

first.output().stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));

var second =
    client
        .responses()
        .create(
            ResponseCreateParams.builder()
                .model("gpt-6-astra")
                .input("Explain why this is funny.")
                .previousResponseId(first.id())
                .build());
second.output().stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));
```

```
using OpenAI.Responses;
#pragma warning disable OPENAI001

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
ResponsesClient client = new(key);

ResponseResult first = await client.CreateResponseAsync(
    "gpt-6-astra",
    "Tell me a joke."
);
Console.WriteLine(first.GetOutputText());

ResponseResult second = await client.CreateResponseAsync(
    "gpt-6-astra",
    "Explain why this is funny.",
    previousResponseId: first.Id
);
Console.WriteLine(second.GetOutputText());
```

```
require "openai"

client = OpenAI::Client.new

first = client.responses.create(
  model: "gpt-6-astra",
  input: "Tell me a joke."
)
puts(first.output_text)

second = client.responses.create(
  model: "gpt-6-astra",
  previous_response_id: first.id,
  input: "Explain why this is funny."
)
puts(second.output_text)
```

In the following example, we ask the model to tell a joke. Separately, we ask the model to explain why it’s funny, and the model has all necessary context to deliver a good response.

Manually manage conversation state with the Responses API

Python

```
import OpenAI from "openai";

const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-6-astra",
  input: "tell me a joke",
  store: true,
});

console.log(response.output_text);

const secondResponse = await openai.responses.create({
  model: "gpt-6-astra",
  previous_response_id: response.id,
  input: [{ role: "user", content: "explain why this is funny." }],
  store: true,
});

console.log(secondResponse.output_text);
```

```
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-6-astra",
    input="tell me a joke",
)
print(response.output_text)

second_response = client.responses.create(
    model="gpt-6-astra",
    previous_response_id=response.id,
    input=[{"role": "user", "content": "explain why this is funny."}],
)
print(second_response.output_text)
```

```
package main

import (
	"context"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

func main() {
	client := openai.NewClient()

	first, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model: "gpt-6-astra",
		Input: responses.ResponseNewParamsInputUnion{
			OfString: openai.String("Tell me a joke."),
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(first.OutputText())

	second, err := client.Responses.New(context.Background(), responses.ResponseNewParams{
		Model:              "gpt-6-astra",
		PreviousResponseID: openai.String(first.ID),
		Input: responses.ResponseNewParamsInputUnion{
			OfString: openai.String("Explain why this is funny."),
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(second.OutputText())
}
```

```
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.responses.ResponseCreateParams;

var first =
    client
        .responses()
        .create(
            ResponseCreateParams.builder().model("gpt-6-astra").input("Tell me a joke.").build());

first.output().stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));

var second =
    client
        .responses()
        .create(
            ResponseCreateParams.builder()
                .model("gpt-6-astra")
                .input("Explain why this is funny.")
                .previousResponseId(first.id())
                .build());
second.output().stream()
    .flatMap(item -> item.message().stream())
    .flatMap(message -> message.content().stream())
    .flatMap(content -> content.outputText().stream())
    .forEach(text -> System.out.println(text.text()));
```

```
using OpenAI.Responses;
#pragma warning disable OPENAI001

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
ResponsesClient client = new(key);

ResponseResult first = await client.CreateResponseAsync(
    "gpt-6-astra",
    "Tell me a joke."
);
Console.WriteLine(first.GetOutputText());

ResponseResult second = await client.CreateResponseAsync(
    "gpt-6-astra",
    "Explain why this is funny.",
    previousResponseId: first.Id
);
Console.WriteLine(second.GetOutputText());
```

```
require "openai"

client = OpenAI::Client.new

first = client.responses.create(
  model: "gpt-6-astra",
  input: "Tell me a joke."
)
puts(first.output_text)

second = client.responses.create(
  model: "gpt-6-astra",
  previous_response_id: first.id,
  input: "Explain why this is funny."
)
puts(second.output_text)
```

#### `previous_response_id` in WebSocket mode

If you are using [the Responses API WebSocket mode](https://developers.openai.com/api/docs/guides/websocket-mode), continuation uses the same `previous_response_id` semantics as HTTP mode, but over a persistent socket with repeated `response.create` events.

The connection-local cache keeps recent previous responses in memory for low-latency continuation. When you use `stream_id`, each lane can retain its latest response; `previous_response_id` still controls lineage, so a new lane can fork from a response on another lane while that response remains available. If an uncached ID cannot be resolved, send a new turn with `previous_response_id` set to `null` and pass full input context.

Data retention for model responses

Response objects are saved for 30 days by default. They can be viewed in the dashboard
[logs](https://platform.openai.com/logs?api=responses) page or
[retrieved](https://developers.openai.com/api/docs/api-reference/responses/get) via the API.
You can disable this behavior by setting `store` to `false`
when creating a Response.

Conversation objects and items in them are not subject to the 30 day TTL. Any response attached to a conversation will have its items persisted with no 30 day TTL.

OpenAI does not use data sent via API to train our models without your explicit consent— [learn more](https://developers.openai.com/api/docs/guides/your-data).

Even when using `previous_response_id`, all previous input tokens for responses in the chain are billed as input tokens in the API.

## Managing the context window

Understanding context windows will help you successfully create threaded conversations and manage state across model interactions.

The **context window** is the maximum number of tokens that can be used in a single request. This max tokens number includes input, output, and reasoning tokens. To learn your model’s context window, see [model details](https://developers.openai.com/api/docs/models).

### Managing context for text generation

As your inputs become more complex, or you include more turns in a conversation, you’ll need to consider both **output token** and **context window** limits. Model inputs and outputs are metered in [**tokens**](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them), which are parsed from inputs to analyze their content and intent and assembled to render logical outputs. Models have limits on token usage during the lifecycle of a text generation request.

- **Output tokens** are the tokens generated by a model in response to a prompt. Each model has different [limits for output tokens](https://developers.openai.com/api/docs/models). For example, `gpt-4o-2024-08-06` can generate a maximum of 16,384 output tokens.
- A **context window** describes the total tokens that can be used for both input and output tokens (and for some models, [reasoning tokens](https://developers.openai.com/api/docs/guides/reasoning)). Compare the [context window limits](https://developers.openai.com/api/docs/models) of our models. For example, `gpt-4o-2024-08-06` has a total context window of 128k tokens.

If you create a large prompt—often by including extra context, data, or examples for the model—you run the risk of exceeding the allocated context window for a model, which might result in truncated outputs.

Use the [tokenizer tool](https://platform.openai.com/tokenizer), built with the [tiktoken library](https://github.com/openai/tiktoken), to see how many tokens are in a particular string of text.

For example, when making an API request to [Chat Completions](https://developers.openai.com/api/docs/api-reference/chat) with the [o1 model](https://developers.openai.com/api/docs/guides/reasoning), the following token counts will apply toward the context window total:

- Input tokens (inputs you include in the `messages` array with [Chat Completions](https://developers.openai.com/api/docs/api-reference/chat))
- Output tokens (tokens generated in response to your prompt)
- Reasoning tokens (used by the model to plan a response)

For example, when making an API request to the [Responses API](https://developers.openai.com/api/docs/api-reference/responses) with a reasoning enabled model, like the [o1 model](https://developers.openai.com/api/docs/guides/reasoning), the following token counts will apply toward the context window total:

- Input tokens (inputs you include in the `input` array for the [Responses API](https://developers.openai.com/api/docs/api-reference/responses))
- Output tokens (tokens generated in response to your prompt)
- Reasoning tokens (used by the model to plan a response)

Tokens generated in excess of the context window limit may be truncated in API responses.

![context window visualization](https://cdn.openai.com/API/docs/images/context-window.png)

You can estimate the number of tokens your messages will use with the [tokenizer tool](https://platform.openai.com/tokenizer).

### Compaction

Detailed compaction guidance now lives in
[Compaction](https://developers.openai.com/api/docs/guides/compaction).

- For `/responses` with `context_management` and `compact_threshold`, see
[Server-side compaction](https://developers.openai.com/api/docs/guides/compaction#server-side-compaction).
- For explicit compaction control, see
[Standalone compact endpoint](https://developers.openai.com/api/docs/guides/compaction#standalone-compact-endpoint)
and the [`/responses/compact` API reference](https://developers.openai.com/api/docs/api-reference/responses/compact).

## Next steps

For more specific examples and use cases, visit the [OpenAI Cookbook](https://developers.openai.com/cookbook), or learn more about using the APIs to extend model capabilities:

- [Receive JSON responses with Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Extend the models with function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Enable streaming for real-time responses](https://developers.openai.com/api/docs/guides/streaming-responses)
- [Build a computer-using agent](https://developers.openai.com/api/docs/guides/tools-computer-use)

Ask AI

Loading docs agent...