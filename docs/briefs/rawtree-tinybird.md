# Sponsor Brief: Tinybird / RawTree

> **Confirmed (web, 2026-09-25):** RawTree is built by Tinybird. A LinkedIn post by Jorge Gomez Sancha calls it "the new analytical database we are working on at Tinybird" (linkedin.com/posts/jorgesancha_rawtree-the-new-analytical-database-we-are-activity-7462549023183499264-uJRm). So "Best use of Tinybird" = use RawTree.


**Event:** Long Horizon Agents Hack, Sep 25 2026, SF (~5h hacking)
**Prize "Best use of Tinybird":** 1st $2,000 / 2nd $1,000 / 3rd $500 (Amazon gift cards). This is the largest cash pool at the event. Two Tinybird people are judges.
**Docs the organizers linked:** RawTree only (`rawtree.com/docs`). Local copies are in `docs/sponsors/rawtree-*`.

Citation key: `[RT /docs/...]` = a page in `rawtree-docs-full.txt`. `[RT auth.md]`, `[RT skill]`, `[RT sdk-readme]` = the other local rawtree files. `[TB <url path>]` = `tinybird-docs-full.txt`.

---

## 1. What RawTree is, how it relates to Tinybird, and when to use each

### RawTree
- "A simple analytics database for unstructured data. Send events as they are, query them with SQL, and inspect API activity in the platform." [RT /docs]
- "Designed for agent workflows where schema design, migrations, and type debugging should not be the first step." The intended loop is: create a database, ingest, run a bounded `SELECT`, then use **Queries** (execution history) and **Logs** (API request diagnostics). [RT /docs]
- The OpenAPI title describes it as a "Simplified analytics API for AI agents. Store JSON data and query with SQL." [rawtree-openapi.json `info.description`]
- Under the hood it is ClickHouse. The docs mention `X-ClickHouse-Query-Id`, "ClickHouse response format", "Update a table's ClickHouse configuration", and the `system` database. The SQL reference is ClickHouse's own function catalog. [RT /docs/reference/api]
- Main pieces: auto-created tables, JSON/JSONL/URL ingest, read-only SQL, native OTLP ingest (traces/logs/metrics), Prometheus remote-write and query API, Splunk SPL search, SQL triggers (scheduled SQL that sends results to a webhook or table), a hosted MCP server, the `rtree` CLI, and the TS packages `@rawtree/sdk` + `@rawtree/otel`.

### Relationship to Tinybird: not in the docs, but confirmed on the web (see note at top)
- I searched every local RawTree file (`rawtree-docs-full.txt`, `rawtree-index.txt`, `rawtree-auth.md`, `rawtree-agent-skill.md`, `rawtree-sdk-ts-readme.md`, `rawtree-openapi.json`) for "tinybird". **There are zero matches.** The Tinybird docs never mention "rawtree" either.
- RawTree uses its own domains and orgs: `rawtree.com`, `api.rawtree.com`, `mcp.rawtree.com`, GitHub org `rawtreedb`, npm scope `@rawtree`.
- What the docs do show: both products are ClickHouse-based analytics services built around agents. The organizers link RawTree under the Tinybird sponsor slot, so it is probably a Tinybird product or spin-out, but **nothing in these docs states that**. Ask the Tinybird judges/mentors at the event before claiming it in the pitch.

### When to use RawTree vs Tinybird Forward
| Need | RawTree | Tinybird Forward |
|---|---|---|
| Zero-schema ingest (send any JSON, table auto-created) | Yes. Tables are created on first insert [RT /docs/guides/ingest-data] | Needs a datafile with a `SCHEMA` and JSONPaths before ingest (`tb init`, `tb build`) [TB /forward/quickstarts/cli] |
| Native OTLP from AI SDK / agent harness | Yes: `@rawtree/otel` with `aiSdkIntegration()` [RT /docs/reference/sdk] | Via the OTel Collector Tinybird exporter, contrib >= v0.131.0, plus a template [TB /forward/guides/ingest-from-opentelemetry] |
| Parameterized, published low-latency REST endpoints (endpoints as agent tools) | No. You build the SQL string in your app [RT /docs/guides/query-data] | Yes: Pipes with `TYPE endpoint` and `{{Int32(limit,10)}}` templating [TB /forward/quickstarts/cli] |
| MCP for agents | `mcp.rawtree.com/mcp` (OAuth or API key), with read and write tools | `mcp.tinybird.co?token=...`, read/query/call-endpoint tools plus `text_to_sql` |
| Fastest path for a 5-hour hack | **RawTree** (no schema, SDK is 5 lines) | More setup, but more polished for serving |

**Recommendation:** build on **RawTree**, since it is what the organizers linked. If there is time, mention or add a Tinybird Forward endpoint or the MCP piece as a stretch goal.

---

## 2. Setup

### 2.1 CLI [RT /docs/quickstart/cli, /docs/reference/cli]
```bash
curl -fsSL https://rawtree.com/install.sh | bash
rtree login            # interactive; or: rtree login --token rt_...
rtree status           # add --json for agents
rtree database create analytics
rtree database use analytics
```
Global flags: `--database`, `--org`, `--json`, `--version`. Utility commands: `rtree ping | docs | open | completions zsh`.
Resolution order: the API key comes from `--api-key`, then `RAWTREE_API_KEY`, then saved `rtree login` creds. The database comes from `--database`, then `RAWTREE_DATABASE`, then saved config.

### 2.2 API keys and permissions [RT /docs/reference/authentication]
```bash
rtree key create --name my-agent --permission read_write
export RAWTREE_API_KEY=rt_...
export RAWTREE_DATABASE=analytics
export RAWTREE_ORG=team_alpha
```
- Every request uses the header `Authorization: Bearer rt_...`. The base URL is `https://api.rawtree.com`.
- A key is scoped to **one org + one cluster**, not to one database. Choose the DB per request with `?database=<name>` or the `x-rawtree-database` header. If you set neither, the key's stored default DB is used (`default` if the key was created without a selector).

| Permission | List DBs | Insert | Query/logs | Delete table | Manage DBs | Manage keys |
|---|---|---|---|---|---|---|
| `admin` | Y | Y | Y | Y | Y | Y |
| `read_write` | Y | Y | Y | N | N | N |
| `write_only` | N | Y | N | N | N | N |
| `read_only` | Y | N | Y | N | N | N |

Suggested split for the hack: give the agent runtime a `write_only` key for the telemetry producer, give the dashboard a `read_only` key, and use `read_write` for the agent's own memory tool.

### 2.3 Agent auth guidance [RT auth.md]
- Use existing tooling first: the `rtree` CLI, then the RawTree agent skill, then the hosted MCP server.
- Look for credentials in this order: `--api-key` → `RAWTREE_API_KEY` → a `.env` the user explicitly named → saved CLI creds → the configured MCP (prefer its OAuth).
- **Never** ask the user to paste a key into chat. Never echo, log, or commit it. Reference `$RAWTREE_API_KEY`; do not interpolate the key inline.
- Errors: `401` means a bad or revoked key, so re-read it from the source. `403` means the key lacks the permission, or you are using the wrong DB. `404` means the DB/table context is wrong, so check `rtree status --json`. `429` means rate limited, so back off and honor `Retry-After`.
- Agent skill: `npx skills add rawtreedb/agent-skills`. The skill routes to `mcp.md`, `cli.md`, `api.md`, `query.md`, `dynamic-fields.md`, `performance.md`. Its rule: "Treat partial inserts and skipped Dynamic variants as incomplete until accounted for." [RT skill]

### 2.4 MCP server [RT /docs/reference/mcp]
Hosted, Streamable HTTP, OAuth (no key needed):
```bash
claude mcp add --transport http rawtree https://mcp.rawtree.com/mcp      # then /mcp → rawtree → OAuth
codex mcp add rawtree --url https://mcp.rawtree.com/mcp
```
Cursor: `{"mcpServers":{"rawtree":{"url":"https://mcp.rawtree.com/mcp"}}}`. For Claude web/desktop: Settings > Connectors > Add custom connector.

Headless use (API key as bearer):
```bash
claude mcp add --transport http rawtree https://mcp.rawtree.com/mcp \
  --header "Authorization: Bearer rt_xxxxxxxxx"
```
Local stdio server (open source `@rawtree/mcp`):
```bash
claude mcp add rawtree -e RAWTREE_API_KEY=rt_xxxxxxxxx -- npx -y @rawtree/mcp
```
Tools:
- Data: `run-query`, `insert-json`, `insert-from-url`
- Tables/logs: `list-tables`, `create-table`, `describe-table`, `delete-table`, `list-logs`
- Also databases, organizations, clusters, apps (`install-app`), and API keys.

With OAuth, start with `list-organizations` → `list-clusters` → `list-databases`. Data tools take `organization` + `cluster` (and optionally `database`). API-key calls may omit these. User-level tools such as `list-organizations` require OAuth.

### 2.5 TypeScript SDK [RT /docs/reference/sdk, sdk-readme]
```bash
npm install @rawtree/sdk        # query, insert, table metadata
npm install @rawtree/otel       # OTel setup, trace export, AI SDK integration
```
The SDK is marked **Experimental** and its "public API may change" [sdk-readme]. See Gotchas for the signature mismatch between the docs site and the README.

### 2.6 `@rawtree/otel` for AI tracing (details in §4)
```ts
import { registerOTel, aiSdkIntegration } from "@rawtree/otel";
const rawtree = registerOTel({
  serviceName: "ai-sdk",
  apiKey: process.env.RAWTREE_API_KEY!,
  environment: "production",
  integrations: [aiSdkIntegration()],
});
// ... run agent ...
await rawtree.shutdown();
```

---

## 3. Cheat sheet

### Create a DB
```bash
rtree database create analytics && rtree database use analytics
curl -X POST https://api.rawtree.com/v1/databases -H "Authorization: Bearer $RAWTREE_API_KEY" \
  -H "Content-Type: application/json" -d '{"name":"analytics"}'      # needs admin key
```

### Ingest. The table is auto-created on first insert [RT /docs/guides/ingest-data]
```bash
# inline (object or array)
rtree insert --table events --data '[{"action":"signup","user_id":1},{"action":"purchase","user_id":1,"amount":42}]' --json
# file (JSONL = one event per line)
rtree insert --table events --file ./events.jsonl
# public URL (blocks until import finishes; no progress stream)
rtree insert --table events --url https://example.com/events.jsonl
```
```bash
curl -X POST "https://api.rawtree.com/v1/tables/events?database=analytics" \
  -H "Authorization: Bearer $RAWTREE_API_KEY" -H "Content-Type: application/json" \
  -d '[{"action":"click","user":"alice","value":42}]'
# → {"inserted": 1}
# URL ingest: POST /v1/tables/events?url=<urlencoded>&query_id=<optional>  → {"inserted":N|null}, id in X-ClickHouse-Query-Id
```
Optional explicit table creation with a sorting key (admin): `POST /v1/tables {"name":"events","sorting_key":"run_id, ts"}`. If you omit the key, the table "picks a sorting key per part from the ingested data". A sorting key **cannot be removed once set** [RT /docs/reference/api].

### Query. Read-only SQL only [RT /docs/guides/query-data]
```bash
rtree query "SELECT * FROM events LIMIT 10"
rtree query --json "SELECT action, count() AS total FROM events GROUP BY action ORDER BY total DESC LIMIT 10"
cat q.sql | rtree query -
curl -X POST https://api.rawtree.com/v1/query -H "Authorization: Bearer $RAWTREE_API_KEY" \
  -H "Content-Type: application/json" -d '{"sql":"SELECT * FROM events LIMIT 10","format":"JSON"}'
```
Response shape: `{meta:[{name,type}], data:[...], rows, statistics:{elapsed,rows_read,bytes_read}, hints:[]}`.
`format` also accepts `JSONEachRow`, `JSONEachRowWithProgress`, `JSONCompact`, `CSV`, `CSVWithNames`, `TSV`, `TSVWithNames`, `TabSeparated`.

### TS equivalents
```ts
import { RawTree } from "@rawtree/sdk";
const rt = new RawTree({ apiKey: process.env.RAWTREE_API_KEY!, database: "analytics" });
// README (object-param) form:
await rt.insert({ table: "agent_events", values: [{ run_id: "r1", step: 1, kind: "tool_call" }] });
const res = await rt.query<{ kind: string; n: number }>({
  sql: "SELECT kind, count() AS n FROM agent_events WHERE run_id = 'r1' GROUP BY kind LIMIT 50",
});
await rt.tables.list();
await rt.tables.describe({ table: "agent_events" });
```
The docs-site page shows a positional form instead: `rt.insert("events", [...])`, `rt.query("SELECT ...")`, `rt.tables.describe("events")`. Check the installed version's types before relying on either.

### Nested, Dynamic, and raw fields
- Use dot notation for nested fields: `SELECT user.id, count() FROM events GROUP BY user.id LIMIT 10` [RT /docs/guides/query-data]
- `__raw_data` is a virtual column holding the original JSON of each row: `SELECT __raw_data.user.id, __raw_data.event FROM events LIMIT 10`
- Cast when you need a type: `value::Float64`, `toString(user)`, `CAST(id AS UInt64)`, `accurateCastOrNull(customer_id,'String')` [RT /docs/guides/query-data, /docs/guides/triggers]
- The agent skill has a dedicated branch for "mixed or uncertain types, missing values, casts... Dynamic fields" [RT skill]. Useful introspection: `dynamicType(col)`, `distinctJSONPaths(...)`, `distinctJSONPathsAndTypes(...)`, `distinctDynamicTypes(...)`, `JSONAllPathsWithTypes(...)` [RT /docs/reference/sql/functions/json, aggregate-functions].

### Query history and logs
- **Queries** (SQL execution history) is a **platform UI screen**. I found no dedicated REST endpoint for it in the API reference [RT /docs/quickstart/agents].
- **Logs** covers API requests: `GET /v1/logs?start_time=...&end_time=...&limit=50` (max 200). Filters: `search`, `methods`, `status_codes`, `sources=ui|cli|api`, `user_agent`, `offset`. Each row includes route, status, duration, trace ID, database, and structured errors. A request body (<=8 KiB) is included for some requests. Response bodies are not recorded [RT /docs/reference/api].
```bash
curl "https://api.rawtree.com/v1/logs?start_time=2026-09-25T17:00:00Z&end_time=2026-09-25T18:00:00Z&status_codes=400,500&limit=50" \
  -H "Authorization: Bearer $RAWTREE_API_KEY"
```

### SQL triggers: scheduled SQL that pushes to a webhook or table [RT /docs/guides/triggers]
- A trigger runs read-only SQL every `interval_ms`. **Every returned row is a match.** The destination is `http` (webhook) or `table` (insert into a RawTree table). Up to 5 destinations.
- Delivery is at-least-once with an `Idempotency-Key`. Creating a trigger requires an org admin session token (`POST /v1/triggers?organization=..&cluster=..`) and "an enabled trigger service".
- **For agents:** this is how an agent can get a push when its telemetry crosses a threshold. Examples: token budget exceeded, loop detected, same tool failing N times.

---

## 4. OpenTelemetry and AI integration (the main angle)

RawTree has its own agent-telemetry use case: "Use RawTree as a **flight recorder** for agent and sandbox runs... reconstruct what happened with SQL or an agent" [RT /docs/use-cases/sandboxes]. It recommends: pick a **stable run ID on every event**, store command start/exit/duration/exit codes, file-change events, **tool calls**, and lifecycle events, then "query recent failures by run ID".

### 4.1 Path A: `@rawtree/otel` + Vercel AI SDK (fewest lines) [RT sdk-readme]
```bash
npm install @rawtree/otel ai @ai-sdk/otel          # AI SDK 7 needs @ai-sdk/otel
# README harness example additionally uses: @ai-sdk/harness @ai-sdk/harness-claude-code @ai-sdk/sandbox-vercel
```
```ts
import { HarnessAgent } from "@ai-sdk/harness/agent";
import { claudeCode } from "@ai-sdk/harness-claude-code";
import { createVercelSandbox } from "@ai-sdk/sandbox-vercel";
import { registerOTel, aiSdkIntegration } from "@rawtree/otel";

const rawtree = registerOTel({
  serviceName: "ai-sdk", apiKey: process.env.RAWTREE_API_KEY!,
  environment: "production", integrations: [aiSdkIntegration()],
});
const agent = new HarnessAgent({
  id: "support-agent", harness: claudeCode,
  sandbox: createVercelSandbox({ runtime: "node24" }),
  telemetry: { recordInputs: true, recordOutputs: true, functionId: "support-agent" },
});
const session = await agent.createSession();
try {
  const result = await agent.stream({ session, prompt: "Investigate checkout latency..." });
  for await (const _ of result.fullStream) {}      // must consume the stream
} finally { await session.destroy(); await rawtree.shutdown(); }   // shutdown flushes spans
```
- How it works: spans are sent "as OTLP JSON through `transform=otlp-traces`". RawTree stores **one row per span in `traces`**, with the span fields plus merged resource attributes (`service.name`, `scope.name`) [sdk-readme].
- `aiSdkIntegration()` "will register AI SDK's official OpenTelemetry integration for you" [sdk-readme]. The same approach should work with plain `generateText`/`streamText` calls that have telemetry enabled. That is an inference; the docs only show the harness example.
- **Important:** the generic `/v1/tables/traces?transform=otlp-traces` path **does not require installing the OpenTelemetry app** [RT /docs/reference/api#opentelemetry-app]. That makes this path the lowest-friction option.

### 4.2 Manual events and spans for your own agent loop (framework-agnostic) [sdk-readme]
```ts
import { initRawTree } from "@rawtree/otel";
const monitor = initRawTree({ apiKey: process.env.RAWTREE_API_KEY!, table: "agent_events" });

monitor.capture("context.compacted", { runId, step, tokensBefore: 182000, tokensAfter: 41000, kept: 12, dropped: 88 });
monitor.capture("state.patch",       { runId, step, op: "replace", path: "/plan/2", reason: "subgoal done" });
await monitor.span("tool.web_search", async () => { await search(q); });
await monitor.flush();
```
Use this to log the long-horizon events that OTel does not model: context edits, persist-vs-discard decisions, state diffs, and budget checkpoints.

### 4.3 Path B: native OTLP (any language, any OTel SDK) [RT /docs/guides/opentelemetry]
Prerequisite: in the RawTree platform, open the cluster → **Apps** → install **OpenTelemetry**. The cluster must also be running.
```bash
export OTEL_SERVICE_NAME=my-agent
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.rawtree.com/otlp
export OTEL_EXPORTER_OTLP_HEADERS="authorization=Bearer%20$API_KEY,x-rawtree-database=analytics"
export OTEL_EXPORTER_OTLP_COMPRESSION=gzip
# optional custom tables: ,x-rawtree-traces-table=my_traces  (also -logs-table, -metrics-table)
```
- Endpoints: `POST /otlp/v1/traces|logs|metrics` go to the `traces`/`logs`/`metrics` tables. gRPC endpoint: `https://api.rawtree.com`. JSON, protobuf, and gzip are accepted. Bodies are limited to **100 MiB** after decompression (larger returns 413).
- Python/Go agents (LangGraph, OpenAI Agents SDK, etc.) can use their standard OTel exporter with these env vars.
- 60-second smoke test:
```bash
curl -X POST "https://api.rawtree.com/otlp/v1/traces" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
 -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"otel-smoke-test"}}]},"scopeSpans":[{"spans":[{"traceId":"5B8EFFF798038103D269B633813FC60C","spanId":"EEE19B7EC3C1B174","name":"rawtree smoke test"}]}]}]}'
rtree query "SELECT name, service.name FROM traces WHERE service.name = 'otel-smoke-test' LIMIT 1"
```
- The Collector route is also supported (`otlphttp/rawtree` exporter) [RT /docs/examples/opentelemetry-collector]. The Daytona SDK can export sandbox spans directly (`otelEnabled: true` or `DAYTONA_OTEL_ENABLED=true`, `service.name = 'daytona-typescript-sdk'`) [RT /docs/examples/daytona]. Daytona is a good combination if the team also uses sandboxes.

### 4.4 Row shape of `traces` [RT /docs/guides/transforms#otlp-traces]
- There is one row per span. The row starts from the span object (`traceId`, `spanId`, `name`, and the OTLP timing fields). **Span attributes are flattened to top-level columns.** The docs example shows `"model": "claude-haiku"`. Resource attributes (`service.name`) and `scope.name` are merged in. The original `attributes` array is dropped.
- Scalar attribute values are unwrapped. `arrayValue`/`kvlistValue` keep their OTLP wrapper.
- If an attribute key collides with a span field, the span field wins.
- Protobuf timestamps arrive as "exact decimal strings" (ns). Cast before doing math.

### 4.5 Starter queries (verify the column names with `SELECT * FROM traces LIMIT 1` first)
```sql
-- span mix per service
SELECT service.name, name, count() AS spans FROM traces GROUP BY 1,2 ORDER BY spans DESC LIMIT 50;

-- slowest spans (OTLP JSON field names; cast because ns may be strings)
SELECT name,
       (toUInt64(endTimeUnixNano) - toUInt64(startTimeUnixNano)) / 1e6 AS ms
FROM traces WHERE service.name = 'ai-sdk' ORDER BY ms DESC LIMIT 20;

-- see which attribute paths/types actually landed (AI SDK attribute names are not documented by RawTree)
SELECT distinctJSONPathsAndTypes(__raw_data) FROM traces;   -- inferred usage; confirm it works on __raw_data
```
> The AI SDK's own attribute names (for example token-usage keys) are defined by the AI SDK, not by RawTree. Discover them with `SELECT * FROM traces LIMIT 1` before hardcoding them in a dashboard.

---

## 5. SQL functions useful for agent-memory analytics (all in [RT /docs/reference/sql/...])

| Goal | Functions |
|---|---|
| Time bucketing and windows | `toStartOfInterval`, `toDate`, `dateDiff`, `tumble(t, INTERVAL 5 MINUTE)`, `tumbleStart/End`, `hop(t, hop, window)` (only the first window without WINDOW VIEW), `fromUnixTimestamp64Nano`, `parseDateTimeBestEffort` |
| Latest-state reconstruction from an append-only log | `argMax(value, ts)`, `argMin`, `anyLast`, `groupArrayLast`, `argAndMax` (the CDC use case explicitly suggests "rebuild the latest state from an append-only stream" [RT /docs/use-cases/cdc]) |
| Decayed relevance (memory "recency" scoring) | `exponentialTimeDecayedAvg/Sum/Count/Max(halflife)(value, time)`, `exponentialMovingAverage` (window `OVER (...)` syntax appears in examples) |
| JSON extraction | `JSONExtract*`, `JSONExtractKeysAndValues`, `JSON_VALUE`, `JSON_QUERY`, `JSON_EXISTS`, `JSONHas`, `JSONLength`, `jsonMergePatch` (merge JSON objects, for example to fold state patches), `toJSONString`, `isValidJSON` |
| Schema discovery on dynamic data | `distinctJSONPaths`, `distinctJSONPathsAndTypes`, `distinctDynamicTypes`, `dynamicType`, `dynamicElement`, `JSONAllPathsWithTypes`, `JSONDynamicPaths` |
| Vector similarity (bring your own embeddings as `Array(Float)`) | `cosineDistance`, `L2Distance`, `L2SquaredDistance`, `L1Distance`, `LpDistance`, `L2Normalize` (Distance page). The docs describe **no vector index**, so this is a brute-force scan, which is fine at hackathon scale |
| Full-text / fuzzy search | `hasToken`, `hasAnyTokens`, `hasAllTokens`, `multiSearchAny`, `match` (regex), `ilike`, `ngramDistance`, `ngramSearch`, `editDistance`, `arraySimilarity`. Note: `hasAllTokens`/`hasAnyTokens` do a "brute-force column scan" without a text index, and the RawTree API exposes no way to create one |
| NLP | `detectLanguage`, `detectTonality`, `lemmatize`, `stem`, `synonyms` |
| Aggregates for dashboards | `count`, `uniq`, `topK`, `quantile(s)`, `quantilesTiming`, `sumMappedArrays`, `groupArray`, `groupConcat`, `sparkbar`, `deltaSum`, `intervalLengthSum` (total busy time), `maxIntersections` (peak concurrency), `largestTriangleThreeBuckets` (downsample for charts), `simpleLinearRegression` (token-growth slope) |
| IDs | `generateULID`, `ULIDStringToDateTime`, UUID functions |

Example memory-recall query (episodic store with embeddings):
```sql
SELECT step, summary, cosineDistance(embedding, [0.12, -0.03, ...]) AS d
FROM agent_memory
WHERE run_id = 'r42' AND kind = 'episode'
ORDER BY d ASC LIMIT 8;
```
Example "current working state" from a patch log:
```sql
SELECT key, argMax(value, ts) AS current, max(ts) AS updated_at
FROM agent_state_patches WHERE run_id = 'r42'
GROUP BY key HAVING argMax(op, ts) != 'delete' LIMIT 500;
```

---

## 6. Tinybird Forward highlights relevant to agents (brief)

- **Remote MCP server** [TB /forward/query-data/mcp]: `https://mcp.tinybird.co?token=TINYBIRD_TOKEN` (Streamable HTTP; `mcp-remote` bridge available).
  `claude mcp add tinybird --scope user --transport http "https://mcp.tinybird.co?token=TINYBIRD_TOKEN"`
  Tools: `call_endpoint`, `list_endpoints`, `list_datasources`, `list_service_datasources`, `execute_query`, `text_to_sql`.
  With JWTs you can restrict which Endpoints an agent may call, fix params, and set rate limits. MCP requests carry `from=mcp`, so you can monitor agent queries via `tinybird.pipe_stats_rt WHERE url LIKE '%from=mcp%'`.
- **Endpoints as agent tools:** a Pipe with `TYPE endpoint` and templated params (`{{DateTime(start_date,'...')}}`, `{{Int32(limit,10)}}`) becomes `GET /v0/pipes/<name>.json`. The MCP server exposes it through `call_endpoint`, which turns a vetted SQL query into a safe, parameterized tool [TB /forward/quickstarts/cli].
- **Setup:** `curl https://tinybird.co | sh` → `tb init` → `tb build`. Ingest via the Events API: `POST $TB_HOST/v0/events?name=<ds>&token=$TB_TOKEN` (100 appends/sec rate limit; creating a data source via events is limited to 5/min) [TB /forward/pricing/limits].
- **LLM usage tracking templates:** there is a ready schema and a `wrapModelWithTinybird()` wrapper for Vercel AI SDK LLM calls (tokens, cost, duration, errors, `chat_id`) [TB /forward/guides/ingest-vercel-ai-sdk], the same schema for LiteLLM [TB /forward/guides/ingest-litellm], and the **LLM tracker template** `github.com/tinybirdco/llm-performance-tracker` (multi-tenant AI analytics dashboard + cost calculator).
- **OTel:** the Tinybird exporter ships in OTel Collector contrib >= v0.131.0. Template deploy: `tb --cloud deploy --template https://github.com/tinybirdco/tinybird-otel-template/tree/main/` [TB /forward/guides/ingest-from-opentelemetry].
- **Agent Skills:** `npx skills add tinybirdco/tinybird-agent-skills` (best-practices, CLI, TS SDK `@tinybirdco/sdk`, Python SDK) [TB /forward/development-workflow/agent-skills].
- `tinybird.llm_usage` is a service data source for Tinybird's *own* AI features (Explorations/MCP `text_to_sql`), not for your app's calls [TB /forward/monitoring/service-datasources].

---

## 7. Gotchas and limits

1. **The query endpoint is read-only.** Insert through `/v1/tables/{t}` and the other ingest paths only. You cannot run `INSERT ... SELECT` or `CREATE` through `/v1/query` [RT /docs/reference/sql].
2. **No bind parameters.** You "build the final SQL string" yourself, so allowlist and escape anything agent- or user-supplied. SQL injection in a memory tool is a real risk [RT /docs/guides/query-data].
3. **Always bound exploratory queries** with `LIMIT` (the skill's defaults). `/v1/logs` has a hard maximum of 200 rows per page.
4. **The OTel app must be installed** on the cluster for native `/otlp/*` endpoints, and the cluster must be running (installing does not start it). `@rawtree/otel` and `?transform=otlp-traces` do not need the app.
5. **Partial success is silent.** An OTLP export can return `partialSuccess` with rejected spans, and many SDKs hide that. If rows are missing, check the Logs screen and then the Queries screen [RT /docs/guides/opentelemetry].
6. **Flush before exit.** Call `rawtree.shutdown()`, `monitor.flush()`, or `daytona[Symbol.asyncDispose]()`. Short scripts otherwise drop the last batch. You must also fully consume `fullStream`.
7. **Transforms are built-in only:** `otlp-*`, `cloudwatch-logs`, `cloudtrail`, `firehose`. No custom transforms, and none on URL inserts. A wrong input shape silently emits 0 rows. Unknown transform names return 400 [RT /docs/guides/transforms].
8. **URL ingest blocks** until done, with no progress stream, and `inserted` may be `null`.
9. **Types are inferred.** Mixed types across rows mean you must cast (`::Float64`, `accurateCastOrNull`). Attribute keys flattened from OTel contain dots (`service.name`), so check whether dot notation resolves to a flattened key or a nested path by describing the table.
10. **A sorting key can't be removed once set.** Changing it only affects new parts. Picking none is fine for a hack.
11. **The SDK is experimental.** The docs-site signature is `insert("t", rows)` and the README says `insert({table, values})`. Check the installed types.
12. **Keys are cluster-wide.** Deleting a DB does not revoke keys. `admin` is the only permission that can delete. MCP OAuth grants broad access, including destructive tools. Revoke it via Profile > OAuth apps.
13. **Triggers** need admin, a session token, and an enabled trigger service. Delivery is at-least-once, so dedupe on `Idempotency-Key`. Trigger history is best-effort, "not an exactly-once audit ledger".
14. `429` means back off and honor `Retry-After`. No numeric RawTree rate limits are published in these docs.
15. Several SQL reference pages (Data Types, SELECT, EXPLAIN, System Tables) say "being migrated". Rely on ClickHouse semantics for the details.
16. **Tinybird ≠ RawTree APIs.** The hosts, tokens (`rt_` vs Tinybird tokens), and MCP URLs all differ. Don't mix them.

---

## 8. Three concrete ways to anchor a long-horizon agent project

### A. "Flight Recorder + Episodic Memory": the agent queries its own past with SQL
- **What:** every agent step writes an event row to `agent_events` via `monitor.capture` or `rt.insert`: `{run_id, step, ts, kind: thought|tool_call|tool_result|state_patch|compaction, tool, args_hash, ok, tokens_in, tokens_out, summary, embedding[]}`. The agent's working context stays small (explicit mutable state). When it needs history, it calls a `recall(query)` tool. That tool runs bounded SQL: recency via `exponentialTimeDecayedAvg`, similarity via `cosineDistance`, keyword match via `hasToken`/`multiSearchAny`, and exact lookups like "what did tool X return at step 37".
- **Why it wins:** it is the "persist vs discard" split made concrete. Discarded context is not lost; it lives in RawTree, where the agent can query it. Zero-schema ingest means new event kinds appear mid-hack without migrations.
- **Demo:** run a 200-step task, delete the chat history, and the agent recovers by querying its own flight recorder. Show the SQL live via the RawTree MCP in Claude Code.

### B. Context-Budget Telemetry Dashboard + self-regulating agent
- **What:** wrap the agent with `@rawtree/otel` + `aiSdkIntegration()` (auto spans for every LLM/tool call), plus custom `context.compacted` / `context.size` events. The dashboard shows tokens-in-context over steps (`toStartOfInterval`, `sparkbar`, `simpleLinearRegression` for the growth slope), cost and latency per step (`quantilesTiming`), tool failure loops (`count() ... HAVING n > 3`), and compaction events overlaid on the timeline.
- **Closed loop:** a **RawTree SQL trigger** (every 5s) fires a webhook when context > X% or the same tool fails 3 times in a row. The webhook tells the agent to compact or re-plan, so the agent edits its own working context based on its telemetry.
- **Stretch goal for the Tinybird judges:** publish the same metrics as a Tinybird Forward endpoint and expose it over the Tinybird MCP (`call_endpoint`), so a supervisor agent can check the budget as a tool.

### C. State-Diff Audit Trail (event-sourced agent state)
- **What:** the agent's state is an explicit JSON document (plan, facts, open questions). Every mutation is appended as a patch row `{run_id, step, ts, op, path, old, new, reason}`, following the CDC pattern of "before and after values" [RT /docs/use-cases/cdc]. The current state is reconstructed with `argMax(value, ts) GROUP BY key`. Time-travel is `WHERE ts <= T`. Drift analysis compares runs: "which facts were overwritten and then reinstated?" Blame asks "which tool result caused this belief?", joined to `traces` by `traceId`/`run_id`.
- **Why it wins:** it directly answers "reliable over long tasks". You can replay, diff, and audit every state transition after the run, even after the sandbox is gone ("flight recorder" framing [RT /docs/use-cases/sandboxes]).
- **Demo:** a slider over steps that re-renders the agent's state at step N, with a red flag where a bad patch entered and the span that caused it.

**Suggested 5-hour plan (for any option):**
1. 0:00–0:30: key, DB, smoke test, `registerOTel`.
2. 0:30–2:30: agent loop plus event schema.
3. 2:30–4:00: SQL queries, recall tool, and trigger.
4. 4:00–4:45: dashboard (Next.js route calling `/v1/query`).
5. 4:45–5:00: demo script.

Ask the Tinybird team on-site about the RawTree↔Tinybird relationship and whether they would rather see Forward endpoints or MCP used.
