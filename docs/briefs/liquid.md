# Liquid AI — Sponsor Brief (Long Horizon Agents Hack, Sep 25 2026)

**Prize:** 1st place Edge AI Kit + $250 · **Liquid judges:** Viviana Márquez (DevRel), Tianshu Yu (ML Engineer)
**Pitch in one line:** A small, local LFM runs as the always-on *state/memory manager* (extract, compress, retrieve, route) while a planner model does the hard reasoning. The long-horizon state lives in an explicit, editable store, not in a growing chat log.

All facts below come from the Liquid docs (`docs/sponsors/liquid-*.txt|md`). Every section cites the source URL. Anything marked **[not in docs]** is a gap, not a fact.

---

## 1. What LFMs are (and why they're efficient)

- "LFM (Liquid Foundation Models) are a family of efficient language models built on a new hybrid architecture designed for fast training and inference." They span 350M–8B in the FAQ. The model library also includes 230M and 24B-A2B. — https://docs.liquid.ai/lfm/help/faqs
- **Architecture:** "The LFM2 and LFM2.5 architecture interleaves short convolutions with grouped-query attention. In practice, that means **less KV-cache pressure and better long-context latency scaling** than pure-attention models of the same size." — https://docs.liquid.ai/guides/hardware-evaluation
- LoRA module names reflect the conv-attention hybrid: `w1, w2, w3, q_proj, k_proj, v_proj, out_proj, in_proj`. There is no `o_proj/gate_proj/up_proj/down_proj`. — https://docs.liquid.ai/guides/migration-guide
- LFM2.5 = the same architecture as LFM2 plus extended pre-training and RL, which improves chat, instruction-following and tool calling. The docs recommend LFM2.5 variants. — https://docs.liquid.ai/lfm/models/text-models
- Dense and MoE variants. The MoE models (8B-A1B with 1.5B active, 24B-A2B with 2B active) give large-model capacity at small-model compute.
- Vision models = LFM text backbone + SigLIP2 image encoder. Audio models are fully interleaved audio/text in and out in a single model, so there's no separate ASR/TTS stack. — https://docs.liquid.ai/lfm/models/vision-models, https://docs.liquid.ai/lfm/models/audio-models
- Reference speed for **LFM2-1.2B Q4_0 on llama.cpp**: Apple Mac Mini M4 gets 1427 tok/s prefill and 122 tok/s decode. AMD Ryzen AI Max+ 395 gets 5476 prefill and 143 decode. — https://docs.liquid.ai/deployment/on-device/llama-cpp
- License: LFM Open License v1.0 — https://docs.liquid.ai/lfm/help/model-license
- Tech report: "LFM2 Technical Report" (arXiv 2511.23404), from the HF org page.

---

## 2. Model table

Context: "32K token context length … (128K for LFM2.5-8B-A1B)" — https://docs.liquid.ai/lfm/models/complete-library. **Conflict:** the Text Models page and the agent-harness guide both say **LFM2.5-2.6B supports 128K**. The llama.cpp example serves it with `-c 131072`. Treat 2.6B as 128K. — https://docs.liquid.ai/examples/agent-harnesses

Formats: append `-GGUF` or `-ONNX` to the HF id. For MLX, see the column. Recommended quants are GGUF `Q4_K_M`, MLX `8bit` and ONNX `Q4`.

### Text (current)
| Model | Params | Modality / tag | Ctx | Best use (per docs) | HF id | MLX id |
|---|---|---|---|---|---|---|
| LFM2.5-230M | 230M | Text, "Smallest" | 32K | "Built for data extraction and lightweight on-device agents" | `LiquidAI/LFM2.5-230M` | `LiquidAI/LFM2.5-230M-MLX-8bit` |
| LFM2.5-350M | 350M | Text, "Fastest" | 32K | Edge and low latency. Replaces LFM2-350M-Extract | `LiquidAI/LFM2.5-350M` | `LiquidAI/LFM2.5-350M-MLX-8bit` |
| LFM2-700M | 700M | Text | 32K | Mid-size for most devices | `LiquidAI/LFM2-700M` | `mlx-community/LFM2-700M-8bit` |
| **LFM2.5-1.2B-Instruct** | 1.2B | Text, "Recommended" | 32K | Chat, tool calling, structured output. Replaces the RAG, Tool and 1.2B-Extract Nanos | `LiquidAI/LFM2.5-1.2B-Instruct` | `LiquidAI/LFM2.5-1.2B-Instruct-MLX-8bit` |
| LFM2.5-1.2B-Thinking | 1.2B | Text, reasoning | 32K | Math and logic | `LiquidAI/LFM2.5-1.2B-Thinking` | `LiquidAI/LFM2.5-1.2B-Thinking-MLX-8bit` |
| LFM2.5-1.2B-JP | 1.2B | Text, Japanese | 32K | Japanese generation | `LiquidAI/LFM2.5-1.2B-JP` | `…-MLX-8bit` |
| **LFM2.5-2.6B** | 2.6B dense | Text, "Agentic" | **128K** | "trained for agentic workloads, with 128K context and native tool calling for on-device agents" | `LiquidAI/LFM2.5-2.6B` | `LiquidAI/LFM2.5-2.6B-MLX` |
| **LFM2.5-8B-A1B** | 8B / 1.5B active MoE | Text, reasoning MoE | **128K** | "on-device tool calling and agentic tasks" | `LiquidAI/LFM2.5-8B-A1B` | `LiquidAI/LFM2.5-8B-A1B-MLX-8bit` |
| LFM2-24B-A2B | 24B / 2B active MoE | Text | 32K | "Our largest model for laptops and single-GPU" | `LiquidAI/LFM2-24B-A2B` | `LiquidAI/LFM2-24B-A2B-MLX-8bit` |

### Vision
| Model | Params | Notes | HF id |
|---|---|---|---|
| LFM2.5-VL-3B | 3B | "Strongest grounding, screen understanding, and function calling". Vision tool calling works best on this model | `LiquidAI/LFM2.5-VL-3B` (MLX `-MLX-8bit`) |
| LFM2.5-VL-1.6B | 1.6B | Recommended. OCR, layout, multi-image | `LiquidAI/LFM2.5-VL-1.6B` (MLX `mlx-community/LFM2.5-VL-1.6B-8bit`) |
| LFM2.5-VL-450M | 450M | Fastest. No MLX build | `LiquidAI/LFM2.5-VL-450M` |

### Audio
| Model | Params | Notes | HF id |
|---|---|---|---|
| LFM2.5-Audio-1.5B | 1.5B | ASR, TTS, speech-to-speech and audio function calling in one model. CPU-friendly GGUF | `LiquidAI/LFM2.5-Audio-1.5B` |
| LFM2.5-Audio-1.5B-JP | 1.5B | Japanese | `LiquidAI/LFM2.5-Audio-1.5B-JP` |

### Liquid Nanos (task-specific: the cheap sub-agent candidates)
"Many Nanos require specific prompting formats … See each model's page." — https://docs.liquid.ai/lfm/models/liquid-nanos

| Model | Params | Task | HF id | Sub-agent role for us |
|---|---|---|---|---|
| **LFM2.5-Embedding-350M** | 350M | Dense bi-encoder, multilingual retrieval (trainable with sentence-transformers) | `LiquidAI/LFM2.5-Embedding-350M` (+GGUF) | Memory index / recall |
| **LFM2.5-ColBERT-350M** | 350M | Late-interaction retriever and reranker (PyLate) | `LiquidAI/LFM2.5-ColBERT-350M` (+GGUF) | Rerank recalled memories before injecting them into context |
| LFM2.5-Encoder-350M / -230M | 350M / 230M | Bidirectional encoder to fine-tune for classification | `LiquidAI/LFM2.5-Encoder-350M`, `…-230M` | Keep/discard classifier for memory items |
| **LFM2.5-VL-1.6B-Extract** | 1.6B | Image → user-defined JSON fields | `LiquidAI/LFM2.5-VL-1.6B-Extract` (+GGUF) | Screenshot → state JSON |
| LFM2.5-VL-450M-Extract | 450M | Compact image → JSON | `LiquidAI/LFM2.5-VL-450M-Extract` (+GGUF) | Same, on the edge |
| **LFM2-2.6B-Transcript** | 2.6B | Meeting transcript summarization | `LiquidAI/LFM2-2.6B-Transcript` (+GGUF/ONNX) | Episode/trajectory compressor |
| LFM2-350M-PII-Extract-JP | 350M | Japanese PII → JSON | `LiquidAI/LFM2-350M-PII-Extract-JP` | Redact before persisting |
| LFM2-350M-ENJP-MT | 350M | EN↔JP translation | `LiquidAI/LFM2-350M-ENJP-MT` | — |
| LFM2-350M-Math | 350M | Tiny math reasoning | `LiquidAI/LFM2-350M-Math` | — |

**Deprecated but still downloadable** (https://docs.liquid.ai/lfm/help/deprecations): LFM2-1.2B-Extract and LFM2-1.2B-RAG and LFM2-1.2B-Tool (replaced by LFM2.5-1.2B-Instruct), LFM2-350M-Extract (replaced by LFM2.5-350M), LFM2-ColBERT-350M, LFM2-8B-A1B, LFM2-2.6B, LFM2-VL-*, and LFM2-Audio-1.5B. The FAQ still recommends the `-Extract` models, but the Deprecations page overrides it. **Use LFM2.5 ids in the demo.** A Liquid judge will notice deprecated ids.

**Memory-curator short-list:** `LFM2.5-350M` or `LFM2.5-230M` (state extraction, routing, classification) · `LFM2.5-1.2B-Instruct` (JSON state patches, tool calls) · `LFM2.5-Embedding-350M` + `LFM2.5-ColBERT-350M` (recall + rerank) · `LFM2-2.6B-Transcript` (compress old turns) · `LFM2.5-2.6B` / `8B-A1B` (128K local agent).

---

## 3. Running them fast

Default ports (https://docs.liquid.ai/examples/agent-harnesses): llama.cpp and MLX use 8080, vLLM 8000, SGLang 30000, LM Studio 1234, Atomic Chat 1337, Ollama 11434. All of them expose an OpenAI-compatible `/v1`.

### Mac laptop: llama.cpp (recommended path)
Source: https://docs.liquid.ai/deployment/on-device/llama-cpp
```bash
brew install llama.cpp
llama-server -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF -c 4096 --port 8080
# CLI
llama-cli -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF -c 4096 --color -i \
    --temp 0.1 --top-k 50 --repeat-penalty 1.05
# manual download
hf download LiquidAI/LFM2.5-1.2B-Instruct-GGUF lfm2.5-1.2b-instruct-q4_k_m.gguf --local-dir .
```
**Agent-ready server with tool calling and 128K context** (https://docs.liquid.ai/examples/agent-harnesses):
```bash
llama-server -hf LiquidAI/LFM2.5-2.6B-GGUF:Q4_K_M \
  --jinja \
  --port 8080 \
  -c 131072 \
  -fa on \
  -ngl 99 \
  --temp 0.1 \
  --top-k 50 \
  --repeat-penalty 1.1
```
`--jinja` **enables tool calling** through the model's template. Sizes for LFM2.5-2.6B: Q4_K_M is 1.67 GB, Q6_K 2.22 GB, Q8_0 2.87 GB ("safe choice for tool-heavy agentic work") and BF16 5.4 GB.

Vision:
```bash
llama-cli -hf LiquidAI/LFM2.5-VL-1.6B-GGUF:Q4_0 --image test_image.jpg --image-max-tokens 64 \
  -p "What's in this image?" -n 128 --temp 0.1 --min-p 0.15 --repeat-penalty 1.05
```
To run several small models side by side, start one `llama-server` per model on different ports, e.g. the curator on 8081 and the embedder on 8082.

### Ollama
Source: https://docs.liquid.ai/deployment/on-device/ollama
```bash
ollama run hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF
ollama run hf.co/LiquidAI/LFM2.5-VL-1.6B-GGUF
# OpenAI API at http://localhost:11434/v1
```
⚠ Ollama v0.17.0 stable fails on **all LFM MoE models** (`missing tensor 'output_norm.weight'`). For those you need v0.17.1-rc0 or later. For 8B-A1B and 24B-A2B, use llama.cpp instead.

Modelfile template (from the docs):
```
FROM /path/to/model.gguf
TEMPLATE """<|startoftext|><|im_start|>system
{{ .System }}<|im_end|>
<|im_start|>user
{{ .Prompt }}<|im_end|>
<|im_start|>assistant
"""
PARAMETER temperature 0.1
PARAMETER top_k 50
PARAMETER repeat_penalty 1.05
PARAMETER stop "<|im_end|>"
PARAMETER stop "<|endoftext|>"
```

### MLX (Apple Silicon)
Source: https://docs.liquid.ai/deployment/on-device/mlx and /examples/agent-harnesses
```bash
pip install mlx-lm
mlx_lm.server --model LiquidAI/LFM2.5-2.6B-MLX --port 8080
```
```python
from mlx_lm import load, generate
model, tokenizer = load("LiquidAI/LFM2.5-1.2B-Instruct-MLX-8bit")  # docs example uses deprecated mlx-community/LFM2-1.2B-8bit
```
The docs caution: "Confirm your `mlx-lm` version forwards tools to the chat template." Vision models go through `mlx_vlm`.

### LM Studio / Atomic Chat (GUI)
- LM Studio: search "LiquidAI", pick `Q4_K_M`, open Developer/Local Server, **enable tool use**, set the context length, then Start Server (`localhost:1234`). — https://docs.liquid.ai/deployment/on-device/lm-studio
- Atomic Chat: Integrations tab, then Start Server (`localhost:1337`). It has one-click agent launchers. Its desktop build supports **TurboQuant**: "can compress the KV cache to 3 or 4 bits, so long contexts fit in significantly less memory." — https://docs.liquid.ai/deployment/on-device/atomic-chat

### Transformers (Python, GPU or CPU)
Source: https://docs.liquid.ai/deployment/gpu-inference/transformers
```bash
uv pip install "transformers>=5.2.0" torch accelerate
```
```python
model = AutoModelForCausalLM.from_pretrained("LiquidAI/LFM2.5-1.2B-Instruct", device_map="auto", dtype="bfloat16")
output = model.generate(**inputs, do_sample=True, temperature=0.1, top_k=50, repetition_penalty=1.05, max_new_tokens=512)
```

### vLLM / SGLang (cloud GPU)
Sources: https://docs.liquid.ai/deployment/gpu-inference/vllm, /sglang
```bash
uv pip install -U vllm            # LFM2.5 dense/MoE/VL need vLLM >= 0.23.0
vllm serve LiquidAI/LFM2.5-2.6B --enable-auto-tool-choice --tool-call-parser lfm2
# thinking models: add --reasoning-parser qwen3 (per cookbook)

uv pip install "sglang>=0.5.10"
sglang serve --model-path LiquidAI/LFM2.5-2.6B --host 0.0.0.0 --port 30000 --tool-call-parser lfm2
```
Pass `top_k`, `min_p` and `repetition_penalty` through `extra_body`. Some checkpoints ship without `generation_config.json` defaults, so "pass them on every request." Per-checkpoint presets are in the vLLM cookbook (https://docs.vllm.ai/projects/recipes/en/latest/LiquidAI/LFM2.5.html) and the SGLang cookbook (https://docs.sglang.ai/cookbook/autoregressive/LiquidAI/LFM2.5).

### Serverless cloud (Modal / Baseten / Fal)
All three use `git clone https://github.com/Liquid4All/lfm-inference`.
- Modal: `cd modal && modal deploy deploy-vllm.py`. Set `MODEL_NAME=LiquidAI/<model-slug>` to choose a model (default `LiquidAI/LFM2-8B-A1B`). vLLM cold start is over 2 minutes, so keep `min_containers = 1`. — https://docs.liquid.ai/deployment/gpu-inference/modal
- Fal: `cd fal && fal run deploy-lfm2.py::serve` — https://docs.liquid.ai/deployment/gpu-inference/fal
- Baseten: `pip install truss && truss push lfm2-8b --publish` — https://docs.liquid.ai/deployment/gpu-inference/baseten

### Hosted / zero-install
- **Liquid Playground**: https://playground.liquid.ai (linked on every model page)
- **OpenRouter**: https://openrouter.ai/liquid (linked only; the docs give no model slugs or commands)
- HF Spaces (WebGPU, in-browser): `LiquidAI/LFM2.5-2.6B-WebGPU` ("LFM2.5 Edge Research Agent") and `LiquidAI/LFM2.5-VL-3B-WebGPU`
- **Liquid docs MCP**: `claude mcp add --transport http liquid-docs https://docs.liquid.ai/mcp` gives the coding agent live docs during the hack. — https://docs.liquid.ai/lfm/help/connect-ai-tools
- **AWS / Bedrock / SageMaker: [not in docs].** Neither the docs nor the HF page mention them. **Apollo: [not in docs].** **LEAP SDK and leap-bundle are deprecated.** Liquid now points to llama.cpp directly. LEAP *Finetune* is the active product. — https://docs.liquid.ai/lfm/help/deprecations
- Browser/edge: ONNX + WebGPU via LiquidONNX (`git clone https://github.com/Liquid4All/onnx-export && uv sync`, then `uv run lfm2-infer --model …/model_q4.onnx`). — https://docs.liquid.ai/deployment/on-device/onnx

---

## 4. Chat template, tool calling, structured output, sampling

### Chat template (ChatML-like)
Source: https://docs.liquid.ai/lfm/key-concepts/chat-template
```
<|startoftext|><|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
What is machine learning?<|im_end|>
<|im_start|>assistant
```
The roles are `system`, `user`, `assistant` and `tool`. Always use `apply_chat_template` or the server's chat endpoint. Never hand-write prompts or reuse Qwen/Llama strings. — https://docs.liquid.ai/guides/migration-guide

### Tool calling
Source: https://docs.liquid.ai/lfm/key-concepts/tool-use
- Define tools as a JSON list **in the system prompt** (recommended), e.g. `{"role":"system","content": f"List of tools: {json.dumps(tools)}"}`. You can also pass `tools=[...]` to `apply_chat_template`.
- LFM2.5 emits **Pythonic** calls wrapped in special tokens:
  ```
  <|tool_call_start|>[get_candidate_status(candidate_id="12345")]<|tool_call_end|>
  ```
  LFM2 also wraps tool lists in `<|tool_list_start|>…<|tool_list_end|>` and responses in `<|tool_response_start|>…<|tool_response_end|>`.
- **Need JSON calls?** Add "Output function calls as JSON" to the system prompt.
- Return results as a `{"role":"tool","content": json.dumps(result)}` message, then generate again.
- Decode with `skip_special_tokens=False` so you can see the tool-call tokens.
- On a server: vLLM/SGLang need `--tool-call-parser lfm2`, llama.cpp needs `--jinja`, and LM Studio needs "enable tool use". A generic JSON parser will make tool calls "appear broken." — https://docs.liquid.ai/guides/migration-guide
- Tool definitions consume context. Include only the tools relevant to the current step. That fits the theme: rotate the tool list per phase.
- VL models support text-only function calling. LFM2.5-VL-3B handles image-grounded routing best. — https://docs.liquid.ai/lfm/key-concepts/vision-capabilities
- Hermes Agent tip: set `agent.tool_use_enforcement true`, "without it, the model tends to *describe* actions instead of calling tools." — https://docs.liquid.ai/examples/agent-harnesses

### Structured output / JSON
- **Assistant prefill**: put a partial assistant turn such as `{"role":"assistant","content":"{\n  \"name\": "}` to force JSON. — https://docs.liquid.ai/lfm/key-concepts/text-generation-and-prompting
- **Constrained decoding**: llama.cpp supports "JSON schema and GBNF grammar constrained generation" (https://docs.liquid.ai/deployment/on-device/llama-cpp, structured-output subpage). For Python/Transformers the docs recommend **Outlines**. — https://docs.liquid.ai/examples/customize-models/car-maker-identification
- The docs say to use constrained decoding for strict JSON *before* you consider fine-tuning. — https://docs.liquid.ai/lfm/fine-tuning/overview

### Sampling (copied from docs)
| Model / case | Params | Source |
|---|---|---|
| LFM2.5-1.2B-Instruct (text default across docs) | `temperature=0.1, top_k=50, repetition_penalty=1.05` | transformers / llama.cpp / vLLM pages |
| LFM2.5-2.6B agent server | `--temp 0.1 --top-k 50 --repeat-penalty 1.1` | /examples/agent-harnesses |
| VL models | `temperature=0.1, min_p=0.15, repetition_penalty=1.05`. Image tokens: `min_image_tokens=64, max_image_tokens=256, do_image_splitting=True` | prompting guide, llama.cpp |
| LFM2-2.6B-Transcript (summarizer) | `temperature=0.0, top_p=0.9, max_tokens=2048` | /examples/laptop-examples/meeting-summarization |
| Repetition/loop issues | `repetition_penalty 1.1–1.2` | /lfm/help/troubleshooting |

Nanos may need their own prompts and parameters, so check each model card.

---

## 5. Fine-tuning (only if it fits in a 5-hour day)

**Verdict:** it's feasible *if* you start by hour 1 and have 500 examples. The docs say "A 1.2B LoRA run can take minutes to tens of minutes on a single modern GPU", with 500–5,000 examples recommended. — https://docs.liquid.ai/lfm/fine-tuning/overview

- **Proof point:** in the Home Assistant example, leap-finetune ran on Modal: "5 epochs of LoRA SFT on an H100. Takes a few minutes and costs roughly $1.50" with 500 synthetic examples generated by gpt-4o-mini. Tool-call accuracy rose, e.g. lights went from 25% to 87.5% and scene from 0% to 80%. The baseline table shows LFM2.5-1.2B-Instruct Q4_0 at 71/100 vs gpt-4o-mini at 93/100 before fine-tuning. — https://docs.liquid.ai/examples/customize-models/home-assistant
- **LEAP Finetune** (https://docs.liquid.ai/lfm/fine-tuning/leap-finetune): covers SFT/DPO/GRPO for text, VLM and MoE, LoRA or full; launches on local Ray, SLURM, **Modal** or KubeRay; **exports to HF and GGUF**. The repo ships `CLAUDE.md` and `.claude/skills/` so Claude Code can drive it.
  ```bash
  git clone https://github.com/Liquid4All/leap-finetune.git && cd leap-finetune && uv sync
  uv run leap-finetune job_configs/sft_example.yaml
  ```
  Local training needs CUDA. On a Mac, use the `modal` block in the config.
- **TRL** (`pip install trl>=0.9.0 transformers>=4.55.0 torch>=2.6 peft accelerate`) with an SFT LoRA Colab. — https://docs.liquid.ai/lfm/fine-tuning/trl
- **Unsloth**: "2-5x faster with 70% less memory". There are Colabs for SFT-LoRA, GRPO-LoRA and CPT. — https://docs.liquid.ai/lfm/fine-tuning/unsloth. ⚠ **The docs contradict each other here.** The Unsloth snippet uses Llama module names (`o_proj, gate_proj…`), but the Migration Guide says those "do not exist" in LFMs. Use `["w1","w2","w3","q_proj","k_proj","v_proj","out_proj","in_proj"]` and check `model.print_trainable_parameters()`.
- Rules: train with the model's own chat template, and train tool calls in the **native Pythonic format**. LoRA LR is about 2e-4. Export to GGUF with `python convert_hf_to_gguf.py /path --outfile model.gguf --outtype q4_k_m`.
- **Hackathon-sized idea:** run a GRPO or SFT pass that rewards valid JSON state patches. The docs list "Set up a GRPO experiment that rewards valid JSON answers" as a starter prompt for LEAP Finetune.

---

## 6. Features that fit long-horizon agents, plus what impresses a Liquid judge

**Direct fits**
1. **Conv + GQA hybrid means less KV-cache pressure and better long-context latency scaling.** That's the architectural argument for "an always-on memory manager that is cheap to call every turn."
2. **128K local context** on LFM2.5-2.6B (dense, 1.67 GB at Q4_K_M) and LFM2.5-8B-A1B (1.5B active). The docs suggest serving only 32K when memory-constrained.
3. **Native tool calling** with a dedicated `lfm2` parser, so memory operations (`write_state`, `evict`, `recall`) can be real tool calls made by a 1.2B–2.6B model.
4. **Embedding-350M + ColBERT-350M** give a fully local retrieve-then-rerank memory, with GGUFs available.
5. **Extract Nanos (VL-1.6B/450M-Extract)** turn screenshots or documents into strict JSON, so observations become structured state.
6. **LFM2-2.6B-Transcript** was built to summarize long transcripts. Point it at agent trajectories to compress "episodes" into persistent notes.
7. **Encoders (230M/350M)** can be fine-tuned as a keep/discard classifier. The HF blog "LFM2.5-Encoders for Fast Long-Context Inference on CPU" and the Spaces "Policy Linting" and "PII Detection" run on CPU.
8. **Prompt-cache / KV-cache reuse** in llama.cpp keeps a stable system prefix (the state block) warm across turns. See the Chat & Streaming guide at /deployment/on-device/llama-cpp/chat. Put mutable state *after* the stable prefix.
9. **TurboQuant 3–4-bit KV cache** in Atomic Chat for long local sessions.

**Lesser-known items to name-drop (a DevRel or ML-engineer judge will notice)**
- Using **`--tool-call-parser lfm2`** / **`--jinja`** correctly, and the Pythonic tool format, shows you read the migration guide.
- Using **LFM2.5 ids, not deprecated LFM2 ones.** The FAQ and some examples still show old ids.
- **Correct LoRA target modules** (`in_proj`, `out_proj`, `w1-3`).
- **LEAP Finetune driven by Claude Code**, plus GGUF export straight back into llama-server.
- **Liquid docs MCP server** (`https://docs.liquid.ai/mcp`).
- HF org blog posts (titles only; content not in our docs): "Up to 3.2x Faster Inference with **LFM2.5-DSpark**", "LFM2.5 **Q4_0 checkpoints from Quantization-Aware Distillation**", "Deploy local agents everywhere with LFM2.5-2.6B". The paper "**Zero-Overhead Introspection for Adaptive Test-Time Compute**" (2512.01457) is thematically on point for self-monitoring agents. The HF datasets `LiquidAI/antidoom-mix-v1.0` and `LiquidAI/ifstruct-v1.0` are listed with no description in our docs. [Details not in docs; check the pages before citing specifics.]
- **Benchmark the way the Liquid docs ask**: separate TTFT from decode tok/s, report P50/P95, and record peak memory at 256/512/1k/2k/4k context. — https://docs.liquid.ai/guides/hardware-evaluation. A slide showing "memory manager latency stays flat as the task grows" speaks the judges' language.
- **Local agent harnesses** Liquid documents: Hermes Agent, OpenClaw, Pi. All of them work against a local LFM endpoint.

---

## 7. Three ways to anchor a long-horizon agent project on Liquid

### A. "Liquid State Keeper": local small-model memory manager + big planner
- **Planner:** any frontier model, or LFM2.5-8B-A1B locally.
- **Curator:** LFM2.5-1.2B-Instruct (or 350M) on `llama-server --jinja` runs **after every step**. It takes `(current_state.json, last_action, last_observation)` and emits a **JSON state patch** through tools like `set_fact`, `mark_done`, `evict`, `promote_to_longterm`. Force the JSON with prefill or a GBNF/JSON-schema constraint.
- The planner never sees raw history, only `state.json`, the top-k recalled notes and the last observation. Discarded items go to a cold log. Promoted items are embedded with **LFM2.5-Embedding-350M** and reranked by **ColBERT-350M** at recall time.
- **Demo:** run a 100+ step task side by side. The naive agent's context grows linearly and it drifts. Ours holds a flat context size and flat curator latency. Show the planner token count saved and the curator's on-device ms per step.

### B. "Episode Compressor + Keep/Discard classifier"
- Every N steps, **LFM2-2.6B-Transcript** (temp 0.0) summarizes the trajectory chunk into a structured episode note.
- A fine-tuned **LFM2.5-Encoder-350M** (or LFM2.5-350M prompted) labels each fact persist, ephemeral or discard. Stretch goal: a quick LoRA with leap-finetune on Modal, around $1.50 per the Home Assistant example.
- The agent can **edit its own working context** by calling `rewrite_note(id, text)`. The small model validates and diffs the edit, and the UI shows a live "context ledger" of what was kept, compressed or dropped.

### C. "Fully on-device 128K agent with self-managed context" (edge-AI-kit bait)
- **LFM2.5-2.6B** Q4_K_M (1.67 GB) on a Mac via the documented `llama-server … --jinja -c 131072 -fa on` command, driven by Hermes, Pi or a custom loop.
- The agent has explicit context-management tools: `checkpoint_state`, `drop_tool_outputs`, `load_tools(phase)` (following the docs' advice to include only relevant tools). **LFM2.5-VL-1.6B-Extract** turns screenshots into state JSON, and LFM2.5-Audio-1.5B handles voice input.
- **Pitch:** nothing leaves the laptop, the whole thing uses about 2–3 GB, and reliability comes from explicit state rather than a bigger context window. It maps directly onto the Edge AI Kit prize.

**Build-order tip (5 hours):** at hour 0, start `llama-server` with LFM2.5-1.2B-Instruct and LFM2.5-2.6B and smoke-test a tool call. In hours 0–2, build the state schema and curator loop. In hours 2–3.5, add the retrieval pair. From 3.5 onward, build the side-by-side drift demo and the latency/memory chart. Skip fine-tuning unless a GPU and 500 examples are ready by hour 1.
