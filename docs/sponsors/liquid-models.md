> ## Documentation Index
>
> Fetch the complete documentation index at: [/llms.txt](https://docs.liquid.ai/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.liquid.ai/lfm/models/complete-library#content-area)

🚀 New: LFM2.5-VL-3B — our most capable vision-language model is now available! [Learn more →](https://docs.liquid.ai/lfm/models/lfm25-vl-3b)

[Liquid Docs home page![light logo](https://mintcdn.com/liquidai/GZ4byic0rSMkhisf/logo/light.svg?fit=max&auto=format&n=GZ4byic0rSMkhisf&q=85&s=38de6a520e556114d9bdd76300d71c58)![dark logo](https://mintcdn.com/liquidai/GZ4byic0rSMkhisf/logo/dark.svg?fit=max&auto=format&n=GZ4byic0rSMkhisf&q=85&s=87de315938749fc0bef458d3e25059a7)](https://docs.liquid.ai/lfm/models/complete-library)

Search...

Ctrl KAsk AssistantCTRLI

- [Discord](https://discord.gg/DFU3WQeaYD)
- [Liquid4All/cookbook\\
\\
2,513](https://github.com/Liquid4All/cookbook "Liquid4All/cookbook")
- [Liquid4All/cookbook\\
\\
2,513](https://github.com/Liquid4All/cookbook "Liquid4All/cookbook")

Search...

Navigation

Liquid Foundation Models

Liquid Foundation Models

[LFM](https://docs.liquid.ai/lfm/models/complete-library) [Examples](https://docs.liquid.ai/examples)

### Models

- Liquid Foundation Models



  - [Text Models](https://docs.liquid.ai/lfm/models/text-models)
  - [Vision Models](https://docs.liquid.ai/lfm/models/vision-models)
  - [Audio Models](https://docs.liquid.ai/lfm/models/audio-models)
  - [Liquid Nanos](https://docs.liquid.ai/lfm/models/liquid-nanos)
- [Chat Template](https://docs.liquid.ai/lfm/key-concepts/chat-template)
- [Prompting Guide](https://docs.liquid.ai/lfm/key-concepts/text-generation-and-prompting)
- [Tool Use](https://docs.liquid.ai/lfm/key-concepts/tool-use)
- [Vision Capabilities](https://docs.liquid.ai/lfm/key-concepts/vision-capabilities)

### Fine-tuning

- [Overview](https://docs.liquid.ai/lfm/fine-tuning/overview)
- [LEAP Finetune](https://docs.liquid.ai/lfm/fine-tuning/leap-finetune)
- [Datasets](https://docs.liquid.ai/lfm/fine-tuning/datasets)
- [TRL](https://docs.liquid.ai/lfm/fine-tuning/trl)
- [Unsloth](https://docs.liquid.ai/lfm/fine-tuning/unsloth)

### Edge Inference

- [llama.cpp](https://docs.liquid.ai/deployment/on-device/llama-cpp)
- [iOS & Android](https://docs.liquid.ai/deployment/on-device/llama-cpp/mobile)
- [LM Studio](https://docs.liquid.ai/deployment/on-device/lm-studio)
- [MLX](https://docs.liquid.ai/deployment/on-device/mlx)
- [ONNX](https://docs.liquid.ai/deployment/on-device/onnx)
- [Ollama](https://docs.liquid.ai/deployment/on-device/ollama)
- [Atomic Chat](https://docs.liquid.ai/deployment/on-device/atomic-chat)

### GPU Inference

- [Transformers](https://docs.liquid.ai/deployment/gpu-inference/transformers)
- [SGLang](https://docs.liquid.ai/deployment/gpu-inference/sglang)
- [vLLM](https://docs.liquid.ai/deployment/gpu-inference/vllm)

### Cloud Inference

- [Modal](https://docs.liquid.ai/deployment/gpu-inference/modal)
- [Baseten](https://docs.liquid.ai/deployment/gpu-inference/baseten)
- [Fal](https://docs.liquid.ai/deployment/gpu-inference/fal)

### Guides

- [Hardware Evaluation](https://docs.liquid.ai/guides/hardware-evaluation)
- [Use Case Evaluation](https://docs.liquid.ai/guides/use-case-evaluation)
- [Migration Guide](https://docs.liquid.ai/guides/migration-guide)

### Help

- [FAQs](https://docs.liquid.ai/lfm/help/faqs)
- [Troubleshooting](https://docs.liquid.ai/lfm/help/troubleshooting)
- [Deprecations](https://docs.liquid.ai/lfm/help/deprecations)
- [Contributing to Docs](https://docs.liquid.ai/lfm/help/contributing)
- [Connect AI Tools](https://docs.liquid.ai/lfm/help/connect-ai-tools)
- [Model License](https://docs.liquid.ai/lfm/help/model-license)

- [Liquid Playground](https://playground.liquid.ai/chat?model=cmk0wefde000204jp2knb2qr8)
- [HuggingFace Collections](https://huggingface.co/LiquidAI/collections)
- [LEAP Finetune](https://github.com/Liquid4All/leap-finetune)
- [OpenRouter API](https://openrouter.ai/liquid)

Liquid Foundation Models

# Liquid Foundation Models

Copy pageCopy page

Liquid Foundation Models (LFMs) are a new class of multimodal architectures built for fast inference and on-device deployment. Browse all available models and formats here.

Copy pageCopy page

- [Liquid Playground](https://playground.liquid.ai/chat?model=cmk0wefde000204jp2knb2qr8)
- [HuggingFace Collections](https://huggingface.co/LiquidAI/collections)
- [LEAP Finetune](https://github.com/Liquid4All/leap-finetune)
- [OpenRouter API](https://openrouter.ai/liquid)

All of our models share the following capabilities:

- 32K token context length for extended conversations and document processing (128K for LFM2.5-8B-A1B)
- Designed for fast inference with [Transformers](https://docs.liquid.ai/deployment/gpu-inference/transformers), [llama.cpp](https://docs.liquid.ai/deployment/on-device/llama-cpp), [vLLM](https://docs.liquid.ai/deployment/gpu-inference/vllm), [SGLang](https://docs.liquid.ai/deployment/gpu-inference/sglang), [MLX](https://docs.liquid.ai/deployment/on-device/mlx), [Ollama](https://docs.liquid.ai/deployment/on-device/ollama), and [Atomic Chat](https://docs.liquid.ai/deployment/on-device/atomic-chat)
- Trainable via SFT, DPO, VLM, and GRPO workflows with [LEAP Finetune](https://docs.liquid.ai/lfm/fine-tuning/leap-finetune), [TRL](https://docs.liquid.ai/lfm/fine-tuning/trl), and [Unsloth](https://docs.liquid.ai/lfm/fine-tuning/unsloth)

Start with the model family that matches your input and output shape, then choose a runtime based on where you want to run it. Use the complete matrix below when you need exact repository and format availability.

## [​](https://docs.liquid.ai/lfm/models/complete-library\#model-families)  Model Families

[**Text Models** \\
\\
Chat, tool calling, structured output, and classification.](https://docs.liquid.ai/lfm/models/text-models)

[**Vision Models** \\
\\
Image understanding with LFM backbones and custom encoders.](https://docs.liquid.ai/lfm/models/vision-models)

[**Audio Models** \\
\\
Interleaved audio/text models for TTS, ASR, and voice chat.](https://docs.liquid.ai/lfm/models/audio-models)

[**Liquid Nanos** \\
\\
Task-specific models for extraction, summarization, RAG, and translation.](https://docs.liquid.ai/lfm/models/liquid-nanos)

## [​](https://docs.liquid.ai/lfm/models/complete-library\#common-workflows)  Common Workflows

[**GPU Serving**](https://docs.liquid.ai/deployment/gpu-inference/vllm)

[Use](https://docs.liquid.ai/deployment/gpu-inference/vllm) [vLLM](https://docs.liquid.ai/deployment/gpu-inference/vllm) or [SGLang](https://docs.liquid.ai/deployment/gpu-inference/sglang) for high-throughput serving, and [Transformers](https://docs.liquid.ai/deployment/gpu-inference/transformers) for direct Python inference.

[**Local and On-Device**](https://docs.liquid.ai/deployment/on-device/llama-cpp)

[Use](https://docs.liquid.ai/deployment/on-device/llama-cpp) [llama.cpp](https://docs.liquid.ai/deployment/on-device/llama-cpp), [Ollama](https://docs.liquid.ai/deployment/on-device/ollama), [Atomic Chat](https://docs.liquid.ai/deployment/on-device/atomic-chat), or [MLX](https://docs.liquid.ai/deployment/on-device/mlx) depending on platform and packaging needs. To embed a model in an iOS, Android, or desktop app, see [Build with llama.cpp](https://docs.liquid.ai/deployment/on-device/llama-cpp/mobile).

[**Fine-Tuning**](https://docs.liquid.ai/lfm/fine-tuning/leap-finetune)

[Start with](https://docs.liquid.ai/lfm/fine-tuning/leap-finetune) [LEAP Finetune](https://docs.liquid.ai/lfm/fine-tuning/leap-finetune) for managed workflows, or use [TRL](https://docs.liquid.ai/lfm/fine-tuning/trl) and [Unsloth](https://docs.liquid.ai/lfm/fine-tuning/unsloth) for framework-level control.

[**Model Repositories** \\
\\
Browse LiquidAI collections on Hugging Face for model weights, GGUF exports, MLX packages, ONNX exports, and model cards.](https://huggingface.co/LiquidAI/collections)

## [​](https://docs.liquid.ai/lfm/models/complete-library\#formats)  Formats

Use the format that matches your runtime and deployment target:

- **GGUF** — Best for local CPU/GPU inference on any platform. Use with [llama.cpp](https://docs.liquid.ai/deployment/on-device/llama-cpp), [LM Studio](https://docs.liquid.ai/deployment/on-device/lm-studio), [Ollama](https://docs.liquid.ai/deployment/on-device/ollama), or [Atomic Chat](https://docs.liquid.ai/deployment/on-device/atomic-chat). Append `-GGUF` to any model name.
- **MLX** — Best for Mac users with Apple Silicon. Leverages unified memory for fast inference via [MLX](https://docs.liquid.ai/deployment/on-device/mlx) or [Atomic Chat](https://docs.liquid.ai/deployment/on-device/atomic-chat). Browse at [mlx-community](https://huggingface.co/mlx-community/collections?search=LFM).
- **ONNX** — Best for production deployments and edge devices. Cross-platform with ONNX Runtime across CPUs, GPUs, and accelerators. Append `-ONNX` to any model name.

### [​](https://docs.liquid.ai/lfm/models/complete-library\#quantization)  Quantization

Quantization reduces model size and speeds up inference with minimal quality loss. Available options by format:

- **GGUF** — Supports `Q4_0`, `Q4_K_M`, `Q5_K_M`, `Q6_K`, `Q8_0`, `BF16`, and `F16`. `Q4_K_M` offers the best balance of size and quality.
- **MLX** — Available in `3bit`, `4bit`, `5bit`, `6bit`, `8bit`, and `BF16`. `8bit` is recommended.
- **ONNX** — Supports `FP32`, `FP16`, `Q4`, and `Q8` (MoE models also support `Q4F16`). `Q4` is recommended for most deployments.

## [​](https://docs.liquid.ai/lfm/models/complete-library\#complete-model-matrix)  Complete Model Matrix

| Model | Family | HF | GGUF | MLX | ONNX | Trainable? |
| --- | --- | --- | --- | --- | --- | --- |
| **Text-to-text Models** |  |  |  |  |  |  |
| [LFM2.5-1.2B-Instruct](https://docs.liquid.ai/lfm/models/lfm25-1.2b-instruct) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX) | Yes (TRL) |
| [LFM2.5-1.2B-Thinking](https://docs.liquid.ai/lfm/models/lfm25-1.2b-thinking) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking-ONNX) | Yes (TRL) |
| [LFM2.5-1.2B-JP](https://docs.liquid.ai/lfm/models/lfm25-1.2b-jp) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-ONNX) | Yes (TRL) |
| [LFM2.5-350M](https://docs.liquid.ai/lfm/models/lfm25-350m) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-350M) | [✓](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-350M-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-350M-ONNX) | Yes (TRL) |
| [LFM2.5-230M](https://docs.liquid.ai/lfm/models/lfm25-230m) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-230M) | [✓](https://huggingface.co/LiquidAI/LFM2.5-230M-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-230M-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-230M-ONNX) | Yes (TRL) |
| [LFM2.5-2.6B](https://docs.liquid.ai/lfm/models/lfm25-2.6b) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-2.6B) | [✓](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-2.6B-MLX) | [✓](https://huggingface.co/LiquidAI/LFM2.5-2.6B-ONNX) | Yes (TRL) |
| [LFM2.5-8B-A1B](https://docs.liquid.ai/lfm/models/lfm25-8b-a1b) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B) | [✓](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-ONNX) | Yes (TRL) |
| [LFM2-24B-A2B](https://docs.liquid.ai/lfm/models/lfm2-24b-a2b) | LFM2 | [✓](https://huggingface.co/LiquidAI/LFM2-24B-A2B) | [✓](https://huggingface.co/LiquidAI/LFM2-24B-A2B-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2-24B-A2B-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2-24B-A2B-ONNX) | Yes (TRL) |
| [LFM2-700M](https://docs.liquid.ai/lfm/models/lfm2-700m) | LFM2 | [✓](https://huggingface.co/LiquidAI/LFM2-700M) | [✓](https://huggingface.co/LiquidAI/LFM2-700M-GGUF) | [✓](https://huggingface.co/mlx-community/LFM2-700M-8bit) | [✓](https://huggingface.co/onnx-community/LFM2-700M-ONNX) | Yes (TRL) |
| **Vision Language Models** |  |  |  |  |  |  |
| [LFM2.5-VL-3B](https://docs.liquid.ai/lfm/models/lfm25-vl-3b) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-3B) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-3B-GGUF) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-3B-MLX-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-3B-ONNX) | Yes (TRL) |
| [LFM2.5-VL-1.6B](https://docs.liquid.ai/lfm/models/lfm25-vl-1.6b) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-GGUF) | [✓](https://huggingface.co/mlx-community/LFM2.5-VL-1.6B-8bit) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-ONNX) | Yes (TRL) |
| [LFM2.5-VL-450M](https://docs.liquid.ai/lfm/models/lfm25-vl-450m) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-450M) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-450M-GGUF) | ✗ | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-450M-ONNX) | Yes (TRL) |
| **Audio Models** |  |  |  |  |  |  |
| [LFM2.5-Audio-1.5B](https://docs.liquid.ai/lfm/models/lfm25-audio-1.5b) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-GGUF) | ✗ | [✓](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-ONNX) | Yes (TRL) |
| [LFM2.5-Audio-1.5B-JP](https://docs.liquid.ai/lfm/models/lfm25-audio-1.5b-jp) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-JP) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF) | ✗ | ✗ | Yes (TRL) |
| [LFM2-Audio-1.5B](https://docs.liquid.ai/lfm/models/lfm2-audio-1.5b) | LFM2 | [✓](https://huggingface.co/LiquidAI/LFM2-Audio-1.5B) | [✓](https://huggingface.co/LiquidAI/LFM2-Audio-1.5B-GGUF) | ✗ | ✗ | No |
| **Liquid Nanos** |  |  |  |  |  |  |
| [LFM2.5-VL-1.6B-Extract](https://docs.liquid.ai/lfm/models/lfm25-vl-1.6b-extract) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-Extract) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-Extract-GGUF) | ✗ | ✗ | Yes (TRL) |
| [LFM2.5-VL-450M-Extract](https://docs.liquid.ai/lfm/models/lfm25-vl-450m-extract) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-450M-Extract) | [✓](https://huggingface.co/LiquidAI/LFM2.5-VL-450M-Extract-GGUF) | ✗ | ✗ | Yes (TRL) |
| [LFM2.5-Embedding-350M](https://docs.liquid.ai/lfm/models/lfm25-embedding-350m) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Embedding-350M) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Embedding-350M-GGUF) | ✗ | ✗ | Yes (sentence-transformers) |
| [LFM2.5-ColBERT-350M](https://docs.liquid.ai/lfm/models/lfm25-colbert-350m) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-ColBERT-350M) | [✓](https://huggingface.co/LiquidAI/LFM2.5-ColBERT-350M-GGUF) | ✗ | ✗ | Yes (PyLate) |
| [LFM2.5-Encoder-350M](https://docs.liquid.ai/lfm/models/lfm25-encoder-350m) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Encoder-350M) | ✗ | ✗ | ✗ | Yes (Transformers) |
| [LFM2.5-Encoder-230M](https://docs.liquid.ai/lfm/models/lfm25-encoder-230m) | LFM2.5 (Latest release) | [✓](https://huggingface.co/LiquidAI/LFM2.5-Encoder-230M) | ✗ | ✗ | ✗ | Yes (Transformers) |
| [LFM2-350M-ENJP-MT](https://docs.liquid.ai/lfm/models/lfm2-350m-enjp-mt) | LFM2 | [✓](https://huggingface.co/LiquidAI/LFM2-350M-ENJP-MT) | [✓](https://huggingface.co/LiquidAI/LFM2-350M-ENJP-MT-GGUF) | [✓](https://huggingface.co/mlx-community/LFM2-350M-ENJP-MT-8bit) | [✓](https://huggingface.co/onnx-community/LFM2-350M-ENJP-MT-ONNX) | Yes (TRL) |
| [LFM2-350M-Math](https://docs.liquid.ai/lfm/models/lfm2-350m-math) | LFM2 | [✓](https://huggingface.co/LiquidAI/LFM2-350M-Math) | [✓](https://huggingface.co/LiquidAI/LFM2-350M-Math-GGUF) | ✗ | [✓](https://huggingface.co/onnx-community/LFM2-350M-Math-ONNX) | Yes (TRL) |
| [LFM2-350M-PII-Extract-JP](https://docs.liquid.ai/lfm/models/lfm2-350m-pii-extract-jp) | LFM2 | [✓](https://huggingface.co/LiquidAI/LFM2-350M-PII-Extract-JP) | [✓](https://huggingface.co/LiquidAI/LFM2-350M-PII-Extract-JP-GGUF) | ✗ | ✗ | Yes (TRL) |
| [LFM2-2.6B-Transcript](https://docs.liquid.ai/lfm/models/lfm2-2.6b-transcript) | LFM2 | [✓](https://huggingface.co/LiquidAI/LFM2-2.6B-Transcript) | [✓](https://huggingface.co/LiquidAI/LFM2-2.6B-Transcript-GGUF) | ✗ | [✓](https://huggingface.co/onnx-community/LFM2-2.6B-Transcript-ONNX) | Yes (TRL) |

Looking for an older model? Deprecated models and their recommended replacements are listed on the [Deprecations](https://docs.liquid.ai/lfm/help/deprecations) page.

Was this page helpful?

YesNo

[Suggest edits](https://github.com/liquid4all/docs/edit/main/lfm/models/complete-library.mdx) [Raise issue](https://github.com/liquid4all/docs/issues/new?title=Issue%20on%20docs&body=Path:%20/lfm/models/complete-library)

[Text Models](https://docs.liquid.ai/lfm/models/text-models)

[github](https://github.com/Liquid4All/cookbook) [discord](https://discord.gg/DFU3WQeaYD) [website](https://liquid.ai/)

[Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=liquidai)

Assistant

Responses are generated using AI and may contain mistakes.

[Contact support](mailto:support@liquid.ai)