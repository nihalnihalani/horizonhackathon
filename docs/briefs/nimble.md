# Nimble — Sponsor Brief (Long Horizon Agents Hack, Sep 25 2026)

Prize: **Best use of Nimble**. 1st place $1,500 + credits, 2nd place $500 + credits. Judge: Yaniv Markovski (Head of Ecosystem Engineering).
Everything below comes from the local doc dump (`docs/sponsors/nimble-*.txt|json`). Doc URLs are `https://docs.nimbleway.com/<path>`.

---

## 1. What it is

- **Nimble is real-time web data for AI.** It gives apps and agents live web data through one API: search, extract any page, map or crawl whole sites, or hand off an entire research task. Output is structured and ready for an LLM. (`nimble-sdk/getting-started/overview`)
- **Web Search Agents** are the headline product. You describe a task in plain language. The agent plans it, searches and extracts across the live web, and returns a cited answer or a structured dataset with a per-claim **trust report**. Agents are "stateful, self-improving": **Memory** keeps what worked and **Storage** keeps collected data, so each run builds on the last. (`nimble-sdk/web-search-agents/overview`)
- **One base URL, one bearer key**, with SDKs for Python, TypeScript and Go, plus a CLI, a hosted MCP server, and an agent-skills plugin for Claude Code, Cursor and Codex.

### Product surfaces
| Surface | What | Endpoint(s) |
|---|---|---|
| Search | Real-time web search. `search_depth` is `lite` or `standard`; `full_content` is optional | `POST /v2/search` |
| Extract | One URL returned as html/markdown/screenshot/links/parsed JSON; sync, async or batch | `POST /v2/extract`, `/v2/extract/async`, `/v2/extract/batch` |
| Extract Templates | Pre-built site parsers (e.g. `amazon_pdp`). Custom ones can be generated from a prompt | `POST /v2/extract/templates/run` (+ `/async`, `/batch`, `/generations`) |
| Map | Fast URL discovery (sitemap and links) | `POST /v2/map` |
| Crawl | Async crawl of a whole site with per-page extraction | `POST /v2/crawl`, `GET/DELETE /v2/crawl/{id}` |
| Web Search Agents ("agent runs") | Async research runs with trust reports, memory and follow-ups | `/v2/agents`, `/v2/agents/runs`, `/v2/agents/{id}/runs/{run_id}[/events|/result]` |
| Jobs | Runs a template on a cron schedule over thousands of inputs | `/v2/jobs/*` |
| Tasks & Batches | Shared async plumbing | `GET /v2/tasks/{id}[/results]`, `GET /v2/batches/{id}/progress` |
| Also | SERP / Fast SERP, Media download, Domain Knowledge, Domain Health, Residential Proxy | see OpenAPI |
| MCP | Hosted Streamable-HTTP server | `https://mcp.nimbleway.com/mcp` |
| Docs MCP | Nimble docs knowledge base exposed over MCP | `https://docs.nimbleway.com/mcp` (changelog, March 2026) |

### "Search credits" vs "agent runs"
The docs do **not** use the phrase "Search credits". They define two separate billing units, and the prize credits presumably map onto these (confirm with the Nimble team at the event):
- **Search / web tools** bill per request. Search `lite` is $1.10 per 1K inputs and `standard` is $5.00 per 1K. `full_content: true` adds $1.00 per 1K URLs. Extraction is $1.00 per 1K URLs and Extract Templates are $3.00 per 1K runs. **Only successful requests are charged.** The free trial is **5,000 free web pages** with no credit card. (`nimble-sdk/admin/pricing`)
- **Agent runs** (Web Search Agent tasks) bill as **runs × effort price**, a flat rate per run (table below). Compute, retrieval and storage are included. (`nimble-sdk/web-search-agents/efforts`)

| effort | typical time | price/run |
|---|---|---|
| `low` | 10–30 s | $0.025 |
| `medium` | 1–3 min | $0.10 |
| `high` (**default**) | 5–15 min | $0.50 |
| `x-high` | 15–30 min | $2.00 |
| `max` | 30 min–hours | custom, **"coming soon"** |

---

## 2. Setup

### API key and environment
1. Sign up at https://online.nimbleway.com/signup and copy a key from **Settings → API Keys**. (`nimble-sdk/getting-started/quickstart`)
2. `export NIMBLE_API_KEY="your-api-key"`. "Every SDK and the CLI read `NIMBLE_API_KEY` automatically."
3. Optional: `NIMBLE_LOG=debug` for SDK debug logging (`nimble-sdk/sdks/node`, `.../python`). `NIMBLE_AGENT_ID` is used only by the Vercel AI SDK deep-research tools (`integrations/connectors/vercel-ai-sdk`).

- **Base URL:** `https://sdk.nimbleway.com` (OpenAPI `servers`). All current endpoints are under `/v2/`. The API became v2 in July 2026 (`changelog/release-notes`).
- **Auth header:** `Authorization: Bearer $NIMBLE_API_KEY`. OpenAPI `securitySchemes.BearerAuth` is http/bearer.

### Install
```bash
pip install nimble_python                 # Python 3.9+
pip install "nimble_python[aiohttp]"      # optional async HTTP backend
npm install @nimble-way/nimble-js         # Node 20 LTS+ (also Deno 1.28+, Bun 1.0+, CF Workers)
go get github.com/Nimbleway/nimble-go@latest
npm install -g @nimble-way/nimble-cli     # CLI (the plugin's skill uses it)
npm install @nimble-way/ai-sdk ai @ai-sdk/openai   # Vercel AI SDK v6 tools
```
Source: `nimble-sdk/getting-started/quickstart`, `nimble-sdk/sdks/node`, `nimble-sdk/sdks/python`, `integrations/connectors/vercel-ai-sdk`.

### Agent Skills plugin (Claude Code). Organizers linked this page.
```bash
npm i -g @nimble-way/nimble-cli
export NIMBLE_API_KEY="your-api-key-here"
claude plugin marketplace add Nimbleway/agent-skills && \
claude plugin install nimble@nimble-plugin-marketplace
# verify: run /mcp and confirm `nimble` is listed
```
- Alternative: `git clone https://github.com/Nimbleway/agent-skills.git && claude --plugin-dir /path/to/agent-skills`.
- Cursor skills: `npx skills add Nimbleway/agent-skills -a cursor`. Codex: `-a codex`. Generic: `npx skills add Nimbleway/agent-skills`.
- The plugin bundles the **nimble-web-expert** skill (search/extract/map/crawl through the CLI, plus Templates and Web Search Agents) and a pre-configured MCP connection.
- Shortcut for coding agents: paste `Read and follow https://docs.nimbleway.com/agents.md` (`nimble-sdk/getting-started/overview`).

Source: `integrations/agent-skills/plugin-installation`.

### MCP server. Organizers linked this page. Copied exactly.
Transport is **Streamable HTTP**. Server URL: `https://mcp.nimbleway.com/mcp`.

Claude Code:
```bash
export NIMBLE_API_KEY="your-api-key"
claude mcp add --transport http nimble-mcp-server https://mcp.nimbleway.com/mcp \
  --header "Authorization: Bearer ${NIMBLE_API_KEY}"
```
Cursor (`.cursor/mcp.json` or `~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "nimble-mcp-server": {
      "url": "https://mcp.nimbleway.com/mcp",
      "headers": {
        "Authorization": "Bearer NIMBLE_API_KEY"
      }
    }
  }
}
```
Claude Desktop and other MCP clients (through the `mcp-remote` bridge):
```json
{
  "mcpServers": {
    "nimble-mcp-server": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote@latest", "https://mcp.nimbleway.com/mcp",
        "--header", "Authorization: Bearer ${NIMBLE_API_KEY}"
      ],
      "env": {
        "NIMBLE_API_KEY": "your-api-key"
      }
    }
  }
}
```
Codex CLI (`~/.codex/config.toml`):
```toml
[mcp_servers.nimble-mcp-server]
url = "https://mcp.nimbleway.com/mcp"
bearer_token_env_var = "NIMBLE_API_KEY"
```
- Tools are auto-discovered and prefixed `nimble_`. They cover Search, Extract (sync, async and polling), Map, Crawl, Extract Templates and Web Search Agents (create, run, poll, read results).
- The server also supports **OAuth**, used by Claude Cowork, Codex Desktop and Cortex Code, so those clients need no API key.
- **Docs tip:** "MCP routes results through the LLM context window and can consume tokens quickly. For typical web retrieval, the Nimble CLI skill is more token-efficient." This matters directly for the long-horizon theme.

Source: `integrations/mcp-server/mcp-server`.

---

## 3. Core API / SDK cheat sheet

Client setup (TS / Python):
```ts
import Nimble from "@nimble-way/nimble-js";
const nimble = new Nimble({ apiKey: process.env.NIMBLE_API_KEY });
```
```python
import os
from nimble_python import Nimble, AsyncNimble
nimble = Nimble(api_key=os.environ["NIMBLE_API_KEY"])
```

### 3.1 Search: `POST /v2/search` (`nimble-sdk/web-tools/search`)
```ts
const result = await nimble.search({
  query: "latest developments in AI agents",
  max_results: 5,
  // search_depth: "lite" | "standard" (default), full_content: true,
  // time_range: "week", include_domains: [...], focus: "news"
});
result.results.forEach((r) => console.log(`- ${r.title}: ${r.url}`));
```
Params (OpenAPI):
- `query` (required)
- `search_depth` (`lite` | `standard`, default `standard`)
- `full_content` (bool)
- `max_results` (1–100, default 10)
- `time_range` (`hour|day|week|month|year`; **cannot be combined** with `start_date`/`end_date`)
- `start_date` / `end_date` (`YYYY-MM-DD` or `YYYY`)
- `include_domains` / `exclude_domains` (max 50 each)
- `focus` (`general` default, or `news`, `coding`, `academic`, `shopping`, `social`, `geo`, `location`, or an **array of template names** such as `["amazon_serp","reddit_discover_posts"]`)
- `content_type` (`pdf`, `docx`, `xlsx`, `pptx`, `documents`, `spreadsheets`, `presentations`; `focus: "general"` only)
- `country` (default `US`), `locale` (default `en`)
- `output_format` (`plain_text` | `markdown` | `simplified_html`)

Response:
```json
{ "total_results": 5,
  "results": [{ "title": "...", "description": "...", "url": "...", "content": "",
                "metadata": { "position": 1, "entity_type": "SearchResult", "country": "US", "locale": "en" } }],
  "request_id": "84f08ac1-..." }
```

### 3.2 Extract: `POST /v2/extract` (`nimble-sdk/web-tools/extract/quickstart`)
```python
result = nimble.extract.run(
    url="https://www.example.com",
    render=True,                      # or "auto" to let Nimble pick per domain
    formats=["html", "markdown"],     # also "screenshot", "headers", "links"
)
print(result.data.html)
```
Structured parsing, with no LLM involved:
```python
result = nimble.extract.run(
    url="https://www.example.com/product", render=True, parse=True,
    parser={
        "title": {"type": "terminal", "selector": {"type": "css", "css_selector": "h1.product-title"}, "extractor": {"type": "text"}},
        "price": {"type": "terminal", "selector": {"type": "css", "css_selector": ".price"},
                  "extractor": {"type": "text", "post_processor": {"type": "number"}}},
    },
)
print(result.data.parsing)
```
- Other params: `driver` (`vx6` HTTP, `vx8` headless JS, `vx8-pro`, `vx10` stealth, `vx10-pro`), `country`/`state`/`city`/`locale`, `browser_actions` (e.g. `[{"click":{"selector":"#load-more"}},{"wait":{"duration":2000}}]`), `network_capture`, `headers`, `cookies`.
- Response: `{ url, task_id, status: "success"|"failed", data: { html, markdown, parsing, ... }, metadata: { query_time, query_duration, driver }, status_code }`.

### 3.3 Extract async + batch (`nimble-sdk/web-tools/extract/features/async`)
```ts
const { task } = await nimble.extract.async({
  url: "https://www.example.com", render: true, formats: ["markdown"],
  callback_url: "https://your-api.com/webhooks/extract-complete",   // optional webhook
  // storage_type: "s3"|"gs", storage_url, storage_compress, storage_object_name
});
// poll GET /v2/tasks/{task.id} until state === "success", then GET /v2/tasks/{task.id}/results

const batch = await nimble.extract.batch({
  inputs: [{ url: "https://www.example.com/page1" }, { url: "https://www.example.com/page2" }],
  shared_inputs: { render: true, formats: ["markdown"] },
});
// poll GET /v2/batches/{batch.batch_id}/progress until completed === true
```
- Note the Python method name: `nimble.extract.async_(...)`, with a trailing underscore.
- Task states are `pending`, `success` and `error`.
- A batch holds up to **1,000 URLs**. Per-item values override `shared_inputs`, except delivery params, which apply batch-wide.
- `GET /v2/tasks?limit=&cursor=` lists every task with a `download_url`.

### 3.4 Map: `POST /v2/map` (`nimble-sdk/web-tools/map`)
```ts
const result = await nimble.map({ url: "https://www.example.com", sitemap: "include" });
result.links.forEach((l) => console.log(`${l.title}: ${l.url}`));
```
- Params: `url` (required), `sitemap` (`include`|`only`|`skip`), `domain_filter` (`domain`|`subdomain`|`all`), `limit` (1–100000, default 5000), `country`, `locale`.
- Response: `{ task_id, success, links: [{ url, title?, description? }] }`. "Most sites mapped in seconds."

### 3.5 Crawl: `POST /v2/crawl` (`nimble-sdk/web-tools/crawl`)
```python
result = nimble.crawl.run(url="https://docs.example.com", limit=10,
    include_paths=["/blog/.*"], extract_options={"formats": ["markdown"]},
    callback={"url": "https://you/hook", "events": ["started", "page", "completed", "failed"]})
print(result.crawl_id, result.status)
```
- Params: `url`, `name`, `limit` (1–10000, default 5000), `extract_options` (any Extract option), `sitemap`, `crawl_entire_domain`, `allow_subdomains`, `include_paths`/`exclude_paths` (regex), `max_discovery_depth` (1–20, default 5), `ignore_query_parameters`, `callback{url,headers,metadata,events}`, `country`, `locale`.
- Status: `GET /v2/crawl/{id}` returns `{ crawl: { status, total, pending, completed, failed, tasks: [{task_id, status}] } }`. Page content comes from `GET /v2/tasks/{task_id}/results`. Cancel with `DELETE /v2/crawl/{id}`.

### 3.6 Extract Templates (`nimble-sdk/web-tools/extract/template`)
```ts
const r = await nimble.extract.templates.run({ template: "amazon_pdp", params: { asin: "B08N5WRWNW" } });
console.log(r.data?.parsing);          // list catalog: nimble.extract.templates.list()
```

### 3.7 Web Search Agents / agent runs (`nimble-sdk/web-search-agents/quickstart`)
```ts
let run = await nimble.agents.run({
  input: "Compare the pricing of Datadog, Grafana Cloud, and New Relic.",
  // agent_name: "saas-pricing-watcher",  // stable, reusable agent + memory
  // effort: "low", output_schema: {...}, enable_events: true
});
const agentId = run.web_search_agent_id;
while (run.is_active) {
  await new Promise((r) => setTimeout(r, 10000));
  run = await nimble.agents.runs.get(run.id, { agent_id: agentId });
}
const result = await nimble.agents.runs.result(run.id, { agent_id: agentId });
if ("output" in result) {
  console.log(result.output.content);            // prose with [n] callouts (or JSON if output_schema)
  console.log(result.output.trust.confidence);   // high | medium | low
  for (const c of result.output.trust.claims) console.log(c.citations[0].url);
}
```
```python
run = nimble.agents.run(input="Compare the pricing of Datadog, Grafana Cloud, and New Relic.")
agent_id = run.web_search_agent_id
while run.is_active:
    time.sleep(10)
    run = nimble.agents.runs.get(run.id, agent_id=agent_id)
result = nimble.agents.runs.result(run.id, agent_id=agent_id)
print(result.output.content)
```
- The create response is `{ "id": "task_run_...", "web_search_agent_id": "wsa_...", "status": "queued", "is_active": true, "effort": "high", "created_at": ... }`.
- Lifecycle: `queued` → `running` → `completed` | `failed` | `cancelled`.
- `POST /v2/agents/runs` body fields (OpenAPI): `input` (required), `agent_name`, `effort`, `enable_events`, `input_data` (rows to enrich), `output_schema`, `previous_interaction_id`, `skill`, `sources`, `use_case`.
- **Persistent agent:**
  ```ts
  nimble.agents.create({ display_name, skill, goals: [...], sources: { prioritize, block: [{title, domains}] }, effort })
  ```
  Then run it with `nimble.agents.runs.create(agent.id, { input, ... })`.
- **Templates:** `nimble.agents.create({ template: "due-diligence" })`. Also available: `competitive-intelligence`, `brand-intelligence`, `company-profile`, `price-comparison`, `real-estate-research`, `lead-enrichment`, `financial-intelligence`, `ecommerce-intelligence`, `business-discovery`, `company-discovery`, `gtm-lead-discovery`, `open-positions-search`, `social-media-monitor` (`GET /v2/agents/templates`).

### 3.8 Jobs: scheduled templates (`nimble-sdk/agentic/jobs`)
```python
job = nimble.jobs.create(name="daily_amazon_top_skus", extract_template_name="amazon_pdp",
    schedule={"cron": "0 7 * * *", "enabled": True},
    inputs={"type": "inline", "data": [{"asin": "B08N5WRWNW"}]},
    destination={"type": "s3", "path": "s3://my-bucket/amazon-skus/", "format": "parquet"})
run = nimble.jobs.runs.create(job.id)          # status PENDING/RUNNING → terminal
arts = nimble.jobs.runs.artifacts.list(run.id)
```

### 3.9 Vercel AI SDK tools (TS agents) (`integrations/connectors/vercel-ai-sdk`)
```ts
import { generateText, stepCountIs } from 'ai';
import { nimbleSearch, nimbleExtract, nimbleAgentStartRun, nimbleAgentRunStatus, nimbleAgentRunResult } from '@nimble-way/ai-sdk';
tools: {
  webSearch: nimbleSearch({ searchDepth: 'lite', maxResults: 5 }),
  extract: nimbleExtract({ format: 'markdown' }),
  startResearch: nimbleAgentStartRun({ effort: 'medium' }),   // needs NIMBLE_AGENT_ID
  checkResearch: nimbleAgentRunStatus(),
  getResearchResult: nimbleAgentRunResult(),                  // returns ready:false while running
}
```

---

## 4. Features that fit long-horizon agents

| Feature | Why it fits the theme | Source |
|---|---|---|
| **Durable run identifiers (`agent_id` + `run_id`)** | Runs execute on Nimble's infrastructure after your process returns. The docs say status and result tools "work from any session, so the two identifiers are all a later session needs." This is explicit persisted state instead of history. | `integrations/connectors/hermes`, `nimble-sdk/web-search-agents/quickstart` |
| **Agent Memory + Storage** | Memory keeps what worked (sources, retrieval paths, domain patterns). Storage keeps data so "runs build on each other instead of starting from zero". Recurring tasks become "up to 50% cheaper". | `nimble-sdk/web-search-agents/overview` |
| **`agent_name` reuse** | A stable name routes every call to the same agent and its memory. Without it, each `agents.run` creates a disposable agent and nothing carries over. | `nimble-sdk/web-search-agents/quickstart` |
| **`previous_interaction_id` follow-ups** | Continues the same task "with full context" without resending history. | same |
| **Override-per-run vs persist** | `skill`, `sources` and `output_schema` passed on a run apply **to that run only**. `agents.update(agent_id, ...)` persists them. This is a built-in persist-vs-discard split. `use_case` is locked once the agent exists. | same |
| **Trust report as a gate** | Per-claim `confidence` (`high`/`medium`/`low`/`pre_existing`) with citations, verbatim excerpts and source types. Docs suggest routing `low` claims to review and auto-accepting `high`, which gives a principled "persist only verified facts" rule. | `nimble-sdk/web-search-agents/trust` |
| **Structured output with JSON-path trust** | With `output_schema`, claims are keyed by JSON path (`$.vendors[0].market_share`). A `null` backed by citations counts as "verified absence" and grades `high`. | `nimble-sdk/web-search-agents/trust` |
| **Enrichment with `input_data`** | Send partial rows and get them back filled. Supplied values are marked `pre_existing` and are not re-researched, so an agent can incrementally complete a state table. | `nimble-sdk/web-search-agents/use-cases/enrichment` |
| **SSE progress stream** | Create with `enable_events: true`, then `GET /v2/agents/{id}/runs/{run_id}/events`. A keep-alive is sent every 15 s. | OpenAPI, `nimble-sdk/web-search-agents/quickstart` |
| **Effort dial** | Spend matches the stakes: `low` $0.025 up to `x-high` $2. The docs recommend using trust grades to right-size effort. | `nimble-sdk/web-search-agents/efforts` |
| **Async extract / batch / crawl with webhooks** | Fire and forget, with results delivered by webhook or to S3/GCS. Crawl `callback.events` includes a per-`page` event. `callback.metadata` echoes your own context, such as a step id. | `nimble-sdk/admin/callbacks-and-delivery` |
| **Crawl progress polling** | `total`/`pending`/`completed`/`failed` counters plus per-page `task_id`s give resumable progress state. | `nimble-sdk/web-tools/crawl` |
| **Tasks list with cursor pagination** | `GET /v2/tasks?limit=100&cursor=` lets an agent rebuild its view of outstanding work after a restart. | `nimble-sdk/web-tools/extract/features/async` |
| **Jobs (cron)** | Scheduled recurring runs with artifacts per run, useful for change monitoring over days. | `nimble-sdk/agentic/jobs` |
| **Parsing schemas / Templates** | Deterministic structured extraction with no LLM tokens, so the agent's context gets compact JSON instead of raw HTML. | `nimble-sdk/web-tools/extract/features/parsing-schema` |
| **`search_depth: lite` then extract** | The documented cost pattern: run a lite search, then extract only the top results. It also keeps context small. | `nimble-sdk/web-tools/search-depth` |

**Not in the docs:** a built-in "change detection" or "diff" API, and a response cache. For change tracking, compose Jobs or scheduled runs with your own diffing. The Marketing skill mentions "before/after tracking" of competitor positioning (`integrations/agent-skills/web-search-skills/marketing`).

---

## 5. Lesser-known features a judge would notice

1. **Self-generated Extract Templates.** `POST /v2/extract/templates/generations` takes `prompt`, `url`, `input_schema` and `output_schema`. You can refine with `from_agent`. Templates are versioned (`/versions`). The limit is 100 generations per customer per day. An agent can **write its own scraper once and reuse it cheaply forever**: $3 per 1K runs versus agent runs. (OpenAPI, `nimble-sdk/admin/rate-limits`)
2. **Custom focus = a list of templates.** For example, `focus: ["amazon_serp","walmart_serp","reddit_discover_posts"]` fans one search across vertical sources. Focus modes require `search_depth: "lite"`. (`nimble-sdk/web-tools/search`)
3. **Network Capture.** Intercepts the page's internal XHR/fetch JSON instead of parsing HTML. Requires `render: true`; use `is_xhr` for non-render cases. (`.../extract/features/network-capture`)
4. **Domain Knowledge.** `nimble.domainKnowledge.getDriver({ url })` returns the recommended driver plus detected antibot systems, so a planner can choose cost tiers up front. (`nimble-sdk/web-tools/domain-knowledge`)
5. **Domain Health.** `nimble.domainHealth.check({ domains: [...] })` returns status and success_rate from live traffic. An agent can tell "site is down" apart from "my step failed" before retrying. (`nimble-sdk/admin/domain-health`)
6. **Trust-report rules are deterministic.** A primary source grades `high`. Two or more independent secondary sources on different domains also grade `high`. A single secondary source grades `medium`, and no citation grades `low`. Dataset confidence is the minimum of fill-rate and claim-trust ratio. (`nimble-sdk/web-search-agents/trust`)
7. **`render: "auto"`** lets Nimble pick the driver config per domain. **`formats: ["links"]`** returns every URL on the page. (`.../extract/quickstart`, changelog April 2026)
8. **LLM-platform templates** such as `chatgpt` and `perplexity` return prompt results, and search `focus: "geo"` returns AI-generated answers. (`nimble-sdk/web-tools/extract/template`, `.../search`)
9. **Docs MCP** at `https://docs.nimbleway.com/mcp` lets your agent look up Nimble's own API while building.
10. **Framework connectors** with resumable start/status/result tools: LangChain (`langchain-nimble>=4.0.0`), Mastra, LlamaIndex, and Cloudflare Agents SDK ("Durable Object-backed start, status..."). Plus Hermes (`hermes-nimble-agent`). (`integrations/connectors/*`)

---

## 6. Gotchas

- **Rate limits:**
  - 83 QPS (5,000 QPM) default across drivers `vx6`/`vx8`/`vx10`.
  - Template generation is capped at 100 per day.
  - Headers `ratelimit-limit`, `ratelimit-remaining`, `x-nimble-request-id` and `x-task-id` come back on every response.
  - A 429 returns `{"status":"failed","msg":"Rate limit exceeded"}`. Use exponential backoff.
  
  (`nimble-sdk/admin/rate-limits`)
- **Status codes:** 400 bad params, 401 bad key, **402 out of budget / trial quota finished**, 403 blocked or not activated, 429, 500, 501 (proxy), **555 request timeout**. Nimble auto-retries before returning a 500.
- **Agent result polling:** `GET .../result` returns **409 while the run is still active** (keep polling) and **422 if the run failed or was cancelled**. Do not treat 409 as an error. Poll on `is_active`. Docs examples sleep 10 s.
- **`use_case` is immutable** after an agent is created. Passing a different value returns 422.
- **`output_schema` hard limits** (422 at the API boundary since Aug 2026):
  - The root must be an object with properties, or an array of objects.
  - Maximum nesting depth is 5, and maximum total properties is 100.
  - No `format`, `pattern`, `minLength`, `minimum`, `maxItems` and similar keywords. Put those constraints in `description`.
  - Nullable fields are written `["string","null"]`.
  
  (`.../use-cases/dataset-building`)
- **Agent runs take minutes.** `high` is the **default** and takes 5–15 minutes. For a 5-hour hackathon demo, pass `effort: "low"` (10–30 s) or `"medium"` (1–3 min) explicitly. `max` is not available yet.
- **Without `agent_name`, `agents.run` creates a disposable agent** and no memory carries over.
- **Breaking change from March 2026:** `data.html` and `data.headers` are no longer returned by default. Add them to `formats`.
- **Rendering flags:** Network capture needs `render: true`. Search focus modes need `search_depth: "lite"`. `content_type` needs `focus: "general"`. `time_range` cannot be combined with dates.
- **Node/Python SDK map example typo:** the SDK pages show `URL:`, but the quickstart and OpenAPI use lowercase `url`. Use `url`.
- **Python SDK crawl management:** the Crawl page says Python supports only `crawl.run()` and that you should use REST for status, list and cancel. The Callbacks page, however, shows `nimble.crawl.status(crawl_id)`. If one fails, fall back to REST `GET /v2/crawl/{id}`.
- **Python async method:** `extract.async_` has a trailing underscore. In TS it is `extract.async`.
- **SDK defaults:** 2 retries and a 3-minute timeout. Tune with `maxRetries`/`timeout` (TS) or `max_retries`/`timeout` (Python).
- **Typed errors:** `BadRequestError`, `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`, `RateLimitError`, `InternalServerError` (TS `APIError` subclasses). Python adds `APIConnectionError` and `APIStatusError`.
- **Webhooks:** the payload contains task metadata only, **without result data**, so fetch `/v2/tasks/{id}/results`. Authenticate with custom headers (crawl `callback.headers`). Return 200 quickly, because Nimble retries failed deliveries. A local demo needs a public URL, or just poll.
- **MCP token cost:** results flow through the context window. Prefer SDK or CLI calls that write to state, and keep only digests in context.
- **Blocked domains** are rejected, including paypal, spotify, kayak, usps and wellsfargo. See the list on `nimble-sdk/admin/rate-limits`.
- **Trial budget:** 5,000 free pages. `full_content` and crawls consume it quickly.

---

## 7. Three ways Nimble could anchor a long-horizon agent project

### A. "Ledger Researcher": explicit state instead of transcript
- **What it is:** a long research task (for example, a market map of 30 companies) driven by a planner whose working memory is a **JSON state file**, not a chat history.
- **How it works:**
  - Each research sub-goal becomes a Nimble agent run on a named agent (`agent_name: "market-map"`), so Nimble-side Memory accumulates.
  - The local state holds only `{goal, agent_id, run_id, status, claims[]}`.
  - On completion, the planner reads the `trust.claims`. It **persists** `high`/`medium` claims keyed by JSON path and **discards** or re-queues `low` ones with a narrower `input` and a `previous_interaction_id` follow-up.
- **Demo:** kill the process mid-run and restart it. The planner reloads the ledger and resumes polling the same `run_id`s ("the two identifiers are all a later session needs"). Show the context stays constant-size across 20+ steps.

### B. "Self-tooling Crawler": the agent writes its own scrapers
- **What it is:** a site-wide data job where the agent learns its own tools and shrinks its token footprint as it goes.
- **How it works:**
  1. **Map** the site to get a URL inventory, which goes into state.
  2. For each new page type, call `POST /v2/extract/templates/generations` (prompt + `output_schema`) to generate a versioned Extract Template.
  3. Run the rest via `extract/templates/batch` or a **Job** with webhooks. `callback.metadata` carries the step id, and the webhook updates the state table.
- **Context policy:** the context holds only a template registry and per-type success rates. Raw HTML never enters the LLM.
- **Reliability:** use **Domain Health** and **Domain Knowledge** to choose drivers and to separate site failures from agent failures.

### C. "Watchtower": multi-day monitoring with a persist/discard split
- **What it is:** a long-lived competitor or price monitor whose "memory" is a curated fact store, not accumulated logs.
- **How it works:**
  - A **Job** (cron) or scheduled agent runs with `use_case: "enrichment"`. `input_data` is the current fact table, so existing facts come back as `pre_existing` and only gaps or changes are researched.
  - New values with `high` confidence overwrite the stored fact, with the citation excerpt as provenance. `medium` goes to a review queue, and `low` is discarded.
  - Stream `enable_events` SSE into a UI timeline.
  - Use `effort: "low"` for daily sweeps and escalate to `high` only when a diff is detected.
- **Pitch:** it matches the docs' own guidance to match effort to stakes and use trust to right-size spend.
