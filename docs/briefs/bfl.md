# Black Forest Labs (FLUX) — Sponsor Brief

Long Horizon Agents Hack · Sep 25 2026 · SF · ~5 h hacking
Prizes (separate): **Best Use of FLUX Video**, **Best Use of FLUX Image**, **Best Use of FLUX Action**, with $1,000 in BFL API credits for each.

Source: `docs/sponsors/bfl-docs-full.txt` (docs.bfl.ml dump). The live OpenAPI spec (https://api.bfl.ai/openapi.json) was pulled for exact FLUX.2 and FLUX 3 field lists. Each claim cites its page. "Not in docs" means the dump does not cover it.

---

## TL;DR

- **FLUX Video** is **FLUX 3**, served at `POST /v1/flux-3-video`. It generates video *with synchronized audio* in four modes: `t2v`, `i2v` (1–10 keyframes, which can be pinned to timestamps), `v2v` (continuation) and `draft_enhance`. It also has a separate **Video Edit [fast]** tool and a **Video Upscale** tool.
- **FLUX Image** is the **FLUX.2** family: `klein 4B/9B`, `pro`, `max` and `flex`. One endpoint handles both generation and editing, with **up to 8 reference images over the API**. The previous-generation models are Kontext, FLUX1.1 and Fill. There are also Tools endpoints: Erase, Deblur, Outpainting and VTO.
- **FLUX Action** is **FLUX 3 Action**. It is a **7B open-weights "world action model"** (a robot/game control policy), and **BFL does not host it as an API**. You run it yourself: Linux, an NVIDIA GPU with about 32 GB for BF16 inference, weights from Hugging Face. Given camera images, current state and a text instruction, it predicts a **chunk of actions** (32 for DROID/games, 42 for SO-101) plus future video latents, then replans from fresh observations. It ships with prepared checkpoints for **DROID (Franka arm)** and the **SO-101 arm (via LeRobot)**, and has fine-tune recipes for **video games** and a **drone in Isaac Sim**.
- **Auth:** send the header `x-key: $BFL_API_KEY`. The flow is async: submit, get `{id, polling_url}`, poll until `Ready`, then read `result.sample`. **Download the result right away.** Image URLs expire after about 10 minutes. Video Edit URLs expire after about 1 hour. FLUX 3 video URLs expire about 2 hours after the job finishes.

---

## 1. Product lineup

### 1a. FLUX 3: video with audio (the "FLUX Video" prize)
Source: https://docs.bfl.ml/flux_3/flux3_overview · https://docs.bfl.ml/flux_3/flux3_video · https://docs.bfl.ml/quick_start/pricing

- One model trained across image, video and audio. It is marked **preview**.
- Clips are 5–20 s (`v2v` is capped at 15 s), 24 fps, at `hd`, `fhd`, `qhd` or `uhd`, up to 3840×2176 at 16:9.
- Aspect ratios: 21:9, 2:1, 16:9, 4:3, 1:1, 3:4 and 9:16.
- Audio: multilingual speech with lipsync, plus effects and ambience.
- It can do multiple scenes and hard cuts in one generation, and it renders legible in-scene text.
- "Omni Reference with images and videos will be available soon" on the public endpoint. See the discrepancy note in §3a.

| Mode | You send | Length | Full render $/s (hd / fhd / qhd / uhd) | Draft $/s |
|---|---|---|---|---|
| `t2v` | prompt | 5–20 s | 0.17 / 0.29 / 0.40 / 0.80 | 0.06 |
| `i2v` | prompt + 1–10 images (`keyframes`) | 5–20 s | 0.17 / 0.29 / 0.40 / 0.80 | 0.06 |
| `v2v` | prompt + `start_video` | 5–15 s | 0.41 / 0.53 / 0.65 / 0.95 | 0.12 |
| `draft_enhance` | `draft_cache` from a prior draft | – | full-render rate at the chosen resolution | – |

With $1,000 in credits, a 10 s `hd` t2v clip costs about $1.70, and a 10 s draft costs about $0.60.

**FLUX Tools for video:**

| Tool | Endpoint | What it does | Price |
|---|---|---|---|
| Video Edit [fast] | `POST /v1/flux-tools/video-edit-v1` | Prompt-driven edit of an existing clip: remove, add or replace objects, change the setting, restyle, change text or dialogue. Input ≤15 s, ≤50 MiB. Output is downscaled to 720p and keeps the source length and audio. | $0.03/s of output |
| Video Upscale | `POST /v1/flux-tools/video-upscale-v1` | 1.5–3× super-resolution. Input ≤20 s, ≤2560×1440. `creativity` 0 = precise, 1 = creative. Optional `prompt`. | $0.07 (precise) or $0.10 (creative) per megapixel-second |

Sources: https://docs.bfl.ml/flux_tools/flux_video_edit · https://docs.bfl.ml/flux_tools/flux_video_upscale

### 1b. FLUX.2: images (the "FLUX Image" prize)
Source: https://docs.bfl.ml/flux_2/flux2_overview · https://docs.bfl.ml/quick_start/pricing

| Model | Endpoint | Best for | Max refs (API) | Price | Notes |
|---|---|---|---|---|---|
| FLUX.2 [klein] 4B | `/v1/flux-2-klein-4b` | real-time, high volume | 4 | $0.014 + $0.001/MP | sub-second, 4 steps, open weights (Apache 2.0), about 13 GB VRAM |
| FLUX.2 [klein] 9B | `/v1/flux-2-klein-9b` (pinned) and `/v1/flux-2-klein-9b-preview` | balanced | 4 | $0.015 + $0.002/MP | the preview version has KV caching; FLUX Non-Commercial License |
| FLUX.2 [pro] | `/v1/flux-2-pro` (pinned snapshot) and `/v1/flux-2-pro-preview` (latest) | **recommended default** | 8 | from $0.03 (T2I) / $0.045 (edit) | prompt upsampling on by default |
| FLUX.2 [max] | `/v1/flux-2-max` | highest quality, strongest edit consistency | 8 | from $0.07 | **grounding search**: it searches the web when the prompt needs it |
| FLUX.2 [flex] | `/v1/flux-2-flex` | typography and small details | 8 | from $0.05 | exposes `steps` (≤50, default 50) and `guidance` (1.5–10, default 5) |
| FLUX.2 [dev] | local only | open weights, non-commercial | ~6 recommended | – | no hosted API |
| klein LoRA | `/v1/flux-2-klein-9b-kv-finetuned` | your own style or character LoRA | – | same as klein 9B (beta) | upload a `.safetensors` file in the dashboard, then pass `finetune_id` and `finetune_strength` |

- Output goes up to 4 MP.
- The playground accepts up to 10 references.
- The [pro] API has a **9 MP total limit for input plus output**. That allows 8 refs at 1 MP output and 7 refs at 2 MP (https://docs.bfl.ml/guides/prompting_editing_multi_reference).

**Image Tools** (https://docs.bfl.ml/flux_tools/…):

| Tool | Endpoint | What it does |
|---|---|---|
| Erase | `/v1/flux-tools/erase-v1` | Removes whatever the mask covers (white = remove). Takes `dilate_pixels` (0–25). Powered by klein 9B. |
| Deblur | `/v1/flux-tools/deblur-v1` | Sharpens an image with no prompt, ≤4 MP. |
| Outpainting | `/v1/flux-tools/outpainting-v1` | Places the image on a canvas of up to 4 MP at `reference_offset_x/y`, with mode `high` or `fast`. |
| Virtual Try-On | `/v1/flux-tools/vto-v2` (recommended) and `vto-v1` | Takes a `person` image, `garment` image(s) and a `prompt`. |

**Previous generation** (docs recommend FLUX.2 for new projects):
- FLUX.1 Kontext [pro]: `/v1/flux-kontext-pro`, $0.04.
- FLUX.1 Kontext [max]: `/v1/flux-kontext-max`, $0.08, limited to 6 concurrent requests.
- FLUX1.1 [pro]: $0.04.
- FLUX1.1 [pro] Ultra and Raw: $0.06.
- FLUX.1 Fill [pro]: $0.05. FLUX.1 Expand also exists.
- FLUX.1 [dev].
Source: https://docs.bfl.ml/quick_start/pricing

### 1c. FLUX 3 Action (the "FLUX Action" prize), what it is exactly
Source: https://docs.bfl.ml/flux_3/flux3_action_overview · https://docs.bfl.ml/flux_3/flux3_action_inference

- **"7B open weights world action model. Turn FLUX's visual intelligence into action for your robot, simulator, or game."** It is built on FLUX 3's image and video training and "learns to predict actions and their visual outcomes together."
- **Inputs:** camera images, the current **state** (for example joint positions, or the last action) and a text **instruction**.
- **Outputs:** a **chunk of actions** plus future video latents. It covers about 2 s at 15 Hz for DROID and games, and uses 30 Hz for SO-101. **The current inference API returns actions only.** Predicted video is not decoded.
- **Control loop:** the app executes `n_action_steps` actions, then "uses fresh observations to plan again."
- **Not a hosted endpoint.** Everything below is self-run:
  - Weights: https://huggingface.co/collections/black-forest-labs/flux-3-action. Includes `flux-3-action-droid`, `flux-3-action-so101` and `flux-3-action-base`. You need an HF account with access to the weights.
  - Code: https://github.com/black-forest-labs/flux-action
  - LeRobot: https://huggingface.co/docs/lerobot/main/en/flux3
  - License: FLUX Kommunity License
  - The release notes say rollout for action prediction is "with selected partners" (https://docs.bfl.ml/release-notes, Jul 23 2026). **Ask the BFL booth whether they provide GPUs, hosted access or hardware at the event.**

| Embodiment | Cameras | Action | State | Checkpoint |
|---|---|---|---|---|
| DROID (Franka arm) | 3, composited to 736×544 | 8 (7 joints + gripper) | same 8 | prepared |
| SO-101 (LeRobot) | 2 side by side, 512×256 (scene left, wrist right) | 6 joint commands | 6 joint positions | prepared (LoRA-tunable) |
| Video game | 1 frame, 256² → 512² | 3–4 values in [-1, 1] | last action | fine-tune example |
| Drone (Isaac Sim) | 1 onboard frame | `[forward, lateral, up, yaw]` | last action | fine-tune example |

**Hardware and costs:**
- Inference: Linux, Python 3.12, NVIDIA GPU. BF16 inference has been reported at about **32 GB of GPU memory**.
- Game plan compute takes **76–79 ms on an H200**.
- Fine-tuning is **multi-GPU**. The game run took about 35 H200 GPU-hours, and the launch commands use 8 GPUs.
- The SO-101 LoRA preset trains on 1 GPU, with batch 2 and gradient accumulation 4.
- **Fine-tuning is not realistic in a 5 h hack.** Plan around the prepared checkpoints.

---

## 2. Auth and API mechanics
Sources: https://docs.bfl.ml/api_integration/integration_guidelines · https://docs.bfl.ml/api_integration/errors · https://docs.bfl.ml/quick_start/get_started

- **Key:** create one at https://dashboard.bfl.ai (Organizations → Projects → API keys).
- **Header:** `x-key: <key>`, sent on both the submit and the poll requests.
- **Base URLs:**
  - `https://api.bfl.ai` is global, with multi-cluster failover.
  - `https://api.eu.bfl.ai` is EU-only (GDPR).
  - `https://api.us.bfl.ai` is US-only.
  - With any of them you **must poll the `polling_url` returned** by the submit call. Do not build it yourself.
- **Async flow:**
  - `POST /v1/<model>` returns `{"id","polling_url","cost"?,"input_mp"?,"output_mp"?}`.
  - `GET polling_url` (which is `/v1/get_result?id=…`) returns `{id,status,result,progress,details,preview}`.
- **Status values:** `Task not found`, `Pending`, `Reasoning` (FLUX 3 planning stage), `Generating`, `Ready`, `Error`, `Request Moderated`, `Content Moderated`.
  - When the status is Moderated, `details["Moderation Reasons"]` lists the categories.
  - The final FLUX 3 poll includes the settled `cost`.
  - Source: OpenAPI `StatusResponse` and the release notes.
- **Result URL expiry:**

  | Result type | Expires after | Source |
  |---|---|---|
  | Images | 10 min | integration guide |
  | Video Edit | ~1 h | video edit page |
  | FLUX 3 video | ~2 h after finishing | FLUX 3 overview |

  Delivery hosts are `delivery.*.bfl.ai`. They have **no CORS** and are "not for direct serving", so download and re-host the file.
- **Webhooks:**
  - FLUX.2, FLUX.1 and Tools requests accept `webhook_url` and `webhook_secret`. The secret is sent in the `X-Webhook-Secret` header.
  - Webhook payloads now match polling responses: status is `Ready`, no longer `SUCCESS` (release notes, Feb 17 2026).
  - Note: the OpenAPI schema for `/v1/flux-3-video` does **not** list `webhook_url`, although the FLUX 3 cookbook uses it on `flux-3-preview-high`. **For video, plan on polling.**
- **Rate limits:**
  - **24 concurrent requests** for most endpoints, **6 for `flux-kontext-max`** (integration guide).
  - Video: **5 concurrent generations per org**. Exceeding it returns `429 (too many active tasks)`, which means wait for a slot, not retry in a loop (video cookbook).
  - Use exponential backoff on 429.
  - 402 means you are out of credits.
- **Video latency:** "several minutes per generation right now." Design around submit-then-poll (https://docs.bfl.ml/cookbook/video_quickstart).
- **`safety_tolerance` ranges:**

  | Range | Applies to |
  |---|---|
  | 0–4 | FLUX 3 video |
  | 0–5 | FLUX.2 and Tools |
  | 0–6 | FLUX.1 |

  Default is 2. A value above the max returns 422.
- **Credits:** check the balance with `GET /v1/credits`. 1 credit = $0.01.
- **Inputs:** images and videos can be sent as an HTTP(S) URL or base64 (a data URL works). "There is no upload service" (cookbook).

### Exact code from docs

**cURL (FLUX.2 [pro] preview):**
```bash
response=$(curl -X 'POST' 'https://api.bfl.ai/v1/flux-2-pro-preview' \
  -H 'accept: application/json' -H "x-key: ${BFL_API_KEY}" -H 'Content-Type: application/json' \
  -d '{"prompt": "A serene landscape with mountains", "width": 1440, "height": 810}')
polling_url=$(echo $response | jq -r .polling_url)
while true; do
  sleep 0.5
  result=$(curl -s -X 'GET' "${polling_url}" -H 'accept: application/json' -H "x-key: ${BFL_API_KEY}")
  status=$(echo $result | jq -r .status)
  if [ "$status" == "Ready" ]; then echo "Result: $(echo $result | jq -r .result.sample)"; break
  elif [ "$status" == "Error" ] || [ "$status" == "Failed" ]; then echo "Generation failed: $result"; break; fi
done
```
Source: https://docs.bfl.ml/api_integration/integration_guidelines

**Python (FLUX 3 video):**
```python
import os, time, requests
BFL_API_KEY = os.environ["BFL_API_KEY"]
submit = requests.post(
    "https://api.bfl.ai/v1/flux-3-video",
    headers={"x-key": BFL_API_KEY, "Content-Type": "application/json"},
    json={"mode": "t2v", "prompt": "a fox running through dawn mist", "generate_audio": True},
).json()
while True:
    time.sleep(2)
    result = requests.get(submit["polling_url"], headers={"x-key": BFL_API_KEY}).json()
    if result["status"] == "Ready":
        print(result["result"]["sample"])   # signed .mp4 URL
        break
    if result["status"] in ("Error", "Request Moderated", "Content Moderated"):
        raise RuntimeError(result["status"])
```
Source: https://docs.bfl.ml/flux_3/flux3_video

**TypeScript (FLUX.2 edit, then poll):**
```ts
const response = await fetch("https://api.bfl.ai/v1/flux-2-pro-preview", {
  method: "POST",
  headers: { accept: "application/json", "x-key": process.env.BFL_API_KEY!, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "<What you want to edit on the image>",
    input_image: "https://example.com/your-image.jpg",
    // input_image_2: "https://example.com/reference-2.jpg",  // Optional
  }),
});
const { id: requestId, polling_url: pollingUrl } = await response.json();
while (true) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const result = await fetch(pollingUrl, {
    headers: { accept: "application/json", "x-key": process.env.BFL_API_KEY! },
  }).then((res) => res.json());
  if (result.status === "Ready") { console.log(`Image ready: ${result.result.sample}`); break; }
  else if (["Error", "Failed"].includes(result.status)) { console.log(`Generation failed: ${JSON.stringify(result)}`); break; }
}
```
Source: https://docs.bfl.ml/flux_2/flux2_image_editing

**Robust submit with 429 and 402 handling** (Python, from the integration guide): on 429, sleep `2 ** attempt` and retry. On 402, raise "Insufficient credits". Raise on any other status ≥400.

---

## 3. Per-prize build notes

### 3a. Best Use of FLUX Video

**Endpoint:** `POST /v1/flux-3-video`.

**Fields** (from OpenAPI and https://docs.bfl.ml/flux_3/flux3_video):

| Field | Required | Values / notes |
|---|---|---|
| `mode` | always | `t2v`, `i2v`, `v2v` or `draft_enhance`. Long aliases are also accepted: `text-to-video`, `image-continuation`, `video-continuation`, `draft-enhance`. |
| `prompt` | always | – |
| `keyframes` | for `i2v` | 1–10 images as URL or base64. Forms: one image = start frame; two = start and end; more = spread evenly (needs a set `duration`); or `[[seconds, image], …]` pairs in time order. |
| `start_video` | for `v2v` | mp4 as URL or base64 |
| `draft_cache` | for `draft_enhance` | bundle from a prior draft |
| `resolution` | – | `hd` (default), `fhd`, `qhd`, `uhd` |
| `duration` | – | integer 5–20, or `auto` |
| `aspect_ratio` | – | `auto` or one of the listed ratios |
| `generate_audio` | – | default `true` |
| `safety_tolerance` | – | 0–4 |
| `draft` | – | bool |
| `version` | – | `latest` |

**There is no `seed` field on FLUX 3 video.** For reproducibility, use **draft → `draft_enhance`**, which reproduces the chosen draft: "Same shot, same seed, nothing re-interpreted."

**Minimal request:**
```bash
curl -X POST https://api.bfl.ai/v1/flux-3-video -H "x-key: $BFL_API_KEY" -H "Content-Type: application/json" \
  -d '{"mode":"i2v","prompt":"a seed grows into a tree through the seasons","duration":10,
       "keyframes":[[0,"https://example.com/seed.png"],[4.5,"https://example.com/sapling.png"],[10,"https://example.com/tree.png"]]}'
```

**Draft, then commit:**
1. Send `{"mode":"t2v","prompt":"…","draft":true}`. It renders at `hd` and returns a `draft_cache` URL.
2. Download the bundle.
3. Send `{"mode":"draft_enhance","draft_cache":"<base64 bundle>","resolution":"fhd"}`. `draft_enhance` defaults to `fhd`.

Source: https://docs.bfl.ml/flux_3/flux3_overview

**Video Edit** (https://docs.bfl.ml/flux_tools/flux_video_edit):
- Request body: `{"video": "<url|base64 mp4>", "prompt": "Remove the orange bucket."}`.
- Any other field returns 422. That includes `mode`, `seed`, `duration`, `resolution` and `aspect_ratio`.
- It **cannot extend a clip**; use `v2v` for that.
- Write new dialogue to the length of the line it replaces.

**Continuity levers** (cookbooks):
- **`start_video` (v2v):** continues from the clip's final frames. `duration` is the length of the *new* segment. Use `aspect_ratio: "auto"` to inherit the source frame. Start the prompt by naming what the final frames show, then say where the shot goes. Carry established sounds across the seam.
- **Last frame → i2v keyframe:** pin one clip's extracted frame as the next clip's opening frame (FLUX 3 overview example).
- **In-prompt cuts:** write `SHOT ONE: … HARD CUT. SHOT TWO: …`.
  - Keep it to 2–3 shots per generation.
  - Consecutive shots must differ strongly in scale.
  - Use one audio bed across all shots.
  - Source: https://docs.bfl.ml/cookbook/video_multishot_films
- **World bible:** one paragraph (place, palette, light, grade) pasted **word for word** into every shot prompt. "Consistency across generations comes from consistent text." Add an **audio motif** staged per shot (enters, builds, resolves). Keep one beat per shot. Generate shots concurrently in a thread pool (3 workers under the cap of 5), then stitch with ffmpeg.

**⚠ Discrepancy to verify at the event.** The cookbook recipes post to a model path `flux-3-preview-high`, not `/v1/flux-3-video`. They also use fields the public schema doesn't list:
- `reference_images` (1–10 identity refs that are never shown on screen; mode `ir2v`)
- `reference_video` (recast the same cast into a new shot; caps at 15 s at 720p)
- `resolution: 480p|720p`
- `grounding`
- `webhook_url`

The public FLUX 3 page says Omni Reference is "available soon". Ask BFL whether `reference_images` is enabled for hackathon keys. If it is, it is the best identity-consistency lever for video. Sources: https://docs.bfl.ml/cookbook/video_start_from_images · https://docs.bfl.ml/cookbook/video_edit_recast_continue

**Video prompting tips** (https://docs.bfl.ml/guides/prompting_video_text_to_video, the cookbooks and the MCP page):
- **Prompt schema:** core summary → scene → a **subject description held identically across shots** → timecoded dynamic narrative (camera plus action) → audio → style and color.
- **Timestep prompting:** `0.0–1.5s — … / 1.5–3.0s — …`. Use two or three beats for a 5 s clip.
- **Name one thing that happens.** Every clip needs a subject, a camera behaviour and a single motivated event. Describe the sound as well.
- **Dialogue:**
  - Quote the line.
  - Add "speaks … exactly once, the complete sentence, no repetition."
  - Add a language lock: "every word in French, no English words at all."
  - A spoken line needs either a visible mouth or an explicit voiceover clause, plus "No on-screen text, no subtitles."
- Mechanical or stylized subjects need their imperfection written in, for example "moves like a wound-up machine, not a person."
- An `Error` is worth one resubmit. A moderated result means reword the prompt; never resubmit it unchanged.

### 3b. Best Use of FLUX Image

**Endpoints:** `/v1/flux-2-pro-preview` (default), `/v1/flux-2-pro` (pinned), `/v1/flux-2-max`, `/v1/flux-2-flex`, `/v1/flux-2-klein-4b`, `/v1/flux-2-klein-9b[-preview]`.

**Fields** (OpenAPI):

| Field | Notes |
|---|---|
| `prompt` | required |
| `input_image` … `input_image_8` | reference slots; klein has 4 |
| `seed` | optional int, "for reproducibility" |
| `width`, `height` | output size |
| `safety_tolerance` | 0–5 |
| `output_format` | jpeg (default) or png |
| `webhook_url`, `webhook_secret` | optional |
| `disable_pup` | pro and max only; turns off automatic prompt upsampling |
| `prompt_upsampling` | flex only; default true |
| `steps`, `guidance` | flex only |
| `user` | opaque end-user id |

**Minimal multi-reference edit:**
```bash
curl -X POST https://api.bfl.ai/v1/flux-2-pro-preview -H "x-key: ${BFL_API_KEY}" -H 'Content-Type: application/json' \
  -d '{"prompt":"The woman from image 1 wearing the jacket from image 2, standing in the cafe from image 3, soft window light",
       "input_image":"https://…/person.jpg","input_image_2":"https://…/jacket.jpg","input_image_3":"https://…/cafe.jpg",
       "seed":42,"width":1024,"height":1024}'
```
The prompt text here is illustrative. The pattern of naming "image 1 / image 2" comes from https://docs.bfl.ml/guides/prompting_editing_multi_reference.

**Key capabilities:**
- **Multi-reference:** 8 refs over the API (pro, max, flex), 4 for klein, within a 9 MP input-plus-output budget on pro. **Say what each image contributes.**
- **Character and product consistency:** "FLUX excels at maintaining character consistency even after multiple sequential edits" (https://docs.bfl.ml/guides/usecases_editing_character_consistency). Product edits preserve "branding, labels, shapes, and materials" (https://docs.bfl.ml/guides/usecases_editing_product_consistency).
- **Reproducibility:** use a `seed` *and* the **pinned snapshot endpoints** (`flux-2-pro`, `flux-2-klein-9b`). Preview endpoints change weights over time (https://docs.bfl.ml/flux_2/flux2_overview).
- **Hex colors:** give exact values in the prompt, e.g. `#02eb3c`. **JSON structured prompts:** a JSON object with subject, background, lighting, style, camera_angle and composition, "ideal for production workflows and automation" (https://docs.bfl.ml/guides/usecases_t2i_json_prompting).
- **Pose and layout guidance:** use reference images for pose, depth or edges (https://docs.bfl.ml/guides/usecases_editing_controlnets).

**Image prompting tips:**
- Put the most important subject first.
- Describe the lighting.
- Put rendered text in "quotes". Use [flex] for typography.
- **No negative prompts**: describe what you want instead.
- For edits, say what should *stay unchanged*, e.g. "Add snow to the scene, keep everything else unchanged."
- Avoid vague edits like "make it better."
- klein has no prompt upsampling, so write detailed prompts for it.
- Sources: https://docs.bfl.ml/api_integration/mcp_integration · https://docs.bfl.ml/guides/prompting_editing_single_reference · https://docs.bfl.ml/flux_2/flux2_overview

### 3c. Best Use of FLUX Action

**There is no HTTP endpoint.** You run it locally with Python and the GPU requirements above.

**Install** (https://docs.bfl.ml/flux_3/flux3_action_inference):
```sh
git clone https://github.com/black-forest-labs/flux-action.git && cd flux-action
uv sync --locked --extra encoders --extra data
uv pip install --python .venv/bin/python 'natten==0.21.6+torch2100cu128' --find-links https://whl.natten.org/
uv run hf auth login
uv run hf download black-forest-labs/flux-3-action-droid --revision ea77cad51fd6e919b2aeb891ae9113828be5698a \
  --exclude 'variants/*' --local-dir outputs/droid
```

**First prediction, no robot needed.** Use the public DROID sample, about 800 MB (see the repo `docs/prepare.md`):
```sh
uv run python examples/droid/make_observation.py outputs/public-droid/episode-000000 --seed 0 --output outputs/public-droid/observation.npz
uv run flux-action infer --checkpoint outputs/droid --observation outputs/public-droid/observation.npz \
  --task "$task_caption" --output outputs/droid/inference-run   # -> actions.npy (1,32,8) + report.json (timing, memory)
```

**Python API and control loop:**
```python
policy = FluxActionPolicy.from_pretrained("outputs/droid", device="cuda")
policy.prepare_inference()
with torch.inference_mode():
    plan = policy.predict_action_chunk(observation)   # torch.Size([1, 32, 8])

policy.reset()  # also reset after an intervention or task change
while not done:
    observation = read_cameras_and_state()
    with torch.inference_mode():
        action = policy.select_action(observation)   # pops the queue; replans when empty
    send_to_robot(action[0]); wait_for_next_control_tick()
```

**DROID observation contract:**
- `images.wrist`, `images.left`, `images.right`: each `(B,3,360,640)` float in [0,1].
- `state`: `(B,8)`, 7 joint angles in radians plus the gripper closed fraction.
- `task`: a list of B strings.

**Key params:**
- `n_action_steps` is the execution horizon. Set it before loading. Reload the policy after changing it, or save with `policy.save_pretrained` and reload.

  | Profile | Executed per plan | Rate | Time covered |
  |---|---|---|---|
  | DROID | 32 | 15 Hz | ≈2.13 s |
  | SO-101 | 32 of 42 | 30 Hz | ≈1.07 s |
  | Games | 8 in the config; 2 in the shooter playback, which reports better aim | 15 Hz | – |

- `select_action` is synchronous. It has no async controller or real-time chunking, so measure latency.

**SO-101 with LeRobot** (https://docs.bfl.ml/flux_3/flux3_action_so101):
- Install LeRobot with `pip install -e '.[training,flux3,peft,diffusion]'` and use `hf download black-forest-labs/flux-3-action-so101`. Real robot demos were trained on about 200 teleop demonstrations.
- Roll out with `lerobot-rollout --policy.path=… --robot.type=so101_follower --fps=30 --task="put the blue box into the container"`.
- Camera keys are `observation.images.scene` (left) and `observation.images.wrist` (right).

**Instruction tips:**
- Instructions are plain task strings, e.g. "put the red cube in the left bin".
- The drone adapter prepends `fly the drone: `. Use the same prefix at inference.
- The drone model generalized to reworded instructions on held-out layouts.

---

## 4. Features that map to long-horizon agents

| Theme need | FLUX feature (doc-backed) |
|---|---|
| **Explicit mutable state instead of growing history** | FLUX 3 Action is *stateless across plans*. Each plan conditions only on the current images, the current `state` vector and the instruction, then replans from fresh observations. It is a natural low-level executor under an LLM planner that holds a compact task ledger. The game and drone state is just "the last action". |
| **Persist vs discard** | Video drafts are cheap (about a third of the cost) and disposable. Persist only the winning `draft_cache` bundle, then `draft_enhance` it. The cookbook pattern is the same: finished shots stay on disk, and you re-run only the failed ones. Result URLs expire (10 min, 1 h or 2 h), so the agent *must* persist artifacts it wants to keep. |
| **Agent edits its own working context** | FLUX.2 iterative edit chains: feed the output back as `input_image`, with sequential edits keeping identity. Video Edit applies an instruction to an existing clip instead of regenerating it. |
| **Memory: character/product consistency across many generations** | FLUX.2 multi-reference (a reference set of up to 8 images is effectively a visual memory bank). Video: the world bible (verbatim text), pinned keyframes, `start_video` continuation, and `reference_images` if it is enabled. |
| **Reproducibility / checkpointing** | `seed` on FLUX.2, Kontext, Deblur and VTO. Pinned endpoints `flux-2-pro` and `flux-2-klein-9b`. `draft_enhance` reproduces a draft exactly. |
| **Long outputs from bounded steps** | 20 s per generation. Chain with `v2v`, or use a shot-list pipeline with 5 concurrent jobs, then ffmpeg concat. The cookbook says the loop of write, generate in parallel, gate and cut "is also the shape an agent can drive unattended" (https://github.com/black-forest-labs/bfl_cookbook/blob/main/video/agent-skill/). |
| **Recovery** | The FLUX 3 Action demo shows the arm recovering when a cube is dropped. Replan frequency (`n_action_steps`) trades reactivity against compute. |

---

## 5. Lesser-known features judges would love

1. **Draft → `draft_enhance`.** Explore video at $0.06/s, then commit the exact same shot at `fhd` to `uhd`. This is effectively a reproducibility primitive, since video has no seed field.
2. **Timestamped keyframes** (`[[0,img],[4.5,img],[10,img]]`) turn a video into a controlled interpolation through agent-chosen states.
3. **Native synchronized audio and multilingual lipsync** in the same call. Use the "exactly once" and language-lock prompt patterns.
4. **FLUX.2 [max] grounding search.** It searches the web for real-time facts such as weather, sports or recent events before it generates.
5. **Pinned vs preview endpoints** for deterministic pipelines.
6. **`Reasoning` status.** FLUX 3 has a planning stage that is visible while polling, so you can surface it in the UI.
7. **Settled `cost`** in poll responses, so you can build a live credit or budget meter for your agent. Also `GET /v1/credits`.
8. **Moderation reasons** in `details["Moderation Reasons"]` let the agent reword prompts automatically.
9. **FLUX MCP server** (`claude mcp add --transport http FLUX https://mcp.bfl.ai`, OAuth, no keys):
   - Tools: `generate_image` (up to 8 in parallel), `generate_variations` (by `request_id`), `get_history`, `vto`, `get_credits`, `generate_video` and `enhance_video`.
   - `get_history` works as a built-in visual memory for an agent.
   - Source: https://docs.bfl.ml/api_integration/mcp_integration
10. **BFL Agent Skills** for Claude Code:
    - Install with `/plugin marketplace add black-forest-labs/skills`.
    - Skills: `flux-image-best-practices`, `bfl-api` and `flux-3-video`.
    - `flux-3-video` includes `flux-3-prompt-doctor`, which "catches the decisions that change the payload before anything is generated."
11. **klein LoRA serving:** upload a `.safetensors` file, then call `flux-2-klein-9b-kv-finetuned` with `finetune_id` and `finetune_strength`. klein 4B runs locally on about 13 GB of VRAM.
12. **Hex-code color control** and **JSON structured prompts**, both good for programmatic agents.
13. **Video Upscale `creativity: 0`** preserves faces and products exactly.

---

## 6. Project angles (3 per prize, all on the long-horizon theme)

### Video
1. **Showrunner with a world-state ledger.**
   - An agent keeps a small JSON state: world bible text, character anchors, audio motif, shot list with status, and the last frame of the most recent approved shot. It never keeps a transcript.
   - Each shot runs through draft, then an LLM/VLM critic, then either reword-and-redraft or `draft_enhance`.
   - Approved shots persist (mp4 and `draft_cache`). Rejected drafts are discarded.
   - The next shot starts from the previous last frame via `i2v` keyframes, or via `v2v`.
   - Demo: a 60–90 s coherent short film built from 6–8 shots, with a live view of the ledger.
2. **Self-healing edit loop.**
   - A reviewer agent watches a generated clip, writes a defect list as state (e.g. "extra pedestrian at 0:04"), and fixes each item with **Video Edit [fast]** ($0.03/s) instead of regenerating.
   - Each defect is closed or reopened after re-inspection.
   - This shows the agent editing its own artifact rather than restarting.
3. **Long-task timelapse narrator.**
   - A coding or research agent emits a state snapshot at each checkpoint.
   - FLUX.2 renders each snapshot as a consistent illustrated frame, using the same characters via refs.
   - FLUX 3 `i2v` with `[seconds, image]` keyframes interpolates them into a narrated recap video with voiceover, i.e. "memory compaction as a movie".

### Image
1. **Graphic-novel agent with a reference memory bank.**
   - A character and prop sheet occupies `input_image`…`_8` as persistent visual memory.
   - Page and panel state lives in JSON. Seeds and the pinned `flux-2-pro` endpoint give reproducible re-renders.
   - klein drafts at about $0.015 per panel, then pro or max for finals.
   - The agent evicts or replaces references as the story's cast changes, which demonstrates persist vs discard.
2. **Versioned edit-tree designer.**
   - Every FLUX.2 edit is a node recording parent image, prompt, seed, model and endpoint snapshot.
   - The agent explores branches, prunes dead ends (discard), and can roll back or replay any path deterministically.
   - Use case: an interior-design or product-campaign client giving 30+ rounds of feedback without the context bloating.
3. **Visual working-memory board.**
   - The agent's plan, progress and blockers render as a live infographic using [flex] typography and hex brand colors.
   - It is updated by *editing* the previous board image, e.g. "mark step 3 done in #22c55e, keep everything else unchanged", rather than regenerating it.
   - [max] grounding search pulls in live facts.
   - This shows the agent editing its own working context visually.

### Action
(All three assume the prepared DROID or SO-101 checkpoints and a ~32 GB GPU. Confirm GPU and hardware availability with BFL first.)
1. **Hierarchical long-horizon executor.**
   - An LLM planner keeps an explicit task ledger (subgoals, done, retries, failures) and issues short instructions such as "put the red cube in the left bin" to FLUX 3 Action.
   - Action handles 1–2 s action chunks and replans from fresh observations. The planner checks progress from camera frames and re-issues or reorders subgoals after failures or disturbances.
   - Target: SO-101 via LeRobot if an arm is available, otherwise replayed DROID episodes.
2. **Adaptive execution-horizon controller.**
   - An agent tunes `n_action_steps` (2, 8 or 32) per phase: short horizons near contact or when there is disturbance, long ones in free space.
   - It reloads the policy as the docs require, and logs decisions to a compact state file.
   - Evaluate offline on public DROID episodes by comparing predicted `actions.npy` with recorded actions. This is feasible without a robot.
3. **Imagine-then-act safety gate (crosses prizes).**
   - Before executing an Action plan, render a preview of the intended outcome with FLUX 3 `i2v` (current camera frame plus instruction).
   - A critic approves or rejects it, and only the approved plan runs.
   - Note: Action's own predicted video latents are **not decoded** by the current API, so the preview must come from FLUX 3 video. Keep a persistent "known-bad instructions" memory.

---

### Quick gotchas
- **Always download results right away:** 10 min for images, 1 h for Video Edit, 2 h for FLUX 3 video.
- **Video jobs take minutes.** Parallelize shots, since the limit is 5 concurrent video jobs per org, and show progress (`Reasoning`, then `Generating`).
- **One video input field per request.** `keyframes` and `reference_images` together return 422 (cookbook).
- **Video Edit** sources must be ≤15 s. Anything larger is downscaled to 720p.
- **The Action release requires HF-gated weights.** Request access early in the day.
