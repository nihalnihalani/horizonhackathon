# RawTree API

Use the live OpenAPI specification for exact methods, fields, formats, and status codes:

```text
https://api.rawtree.com/v1/openapi.json
```

Cross-cutting authentication and database selection are enforced outside some operation schemas. Apply the selection rules below as well as the operation's OpenAPI contract, and reverify against current public API and authentication documentation when those rules are material to the task.

Base URL:

```text
https://api.rawtree.com
```

## Authenticate and Select a Database

Send API keys as bearer tokens:

```text
Authorization: Bearer rt_...
```

API keys belong to one organization and cluster. Their permission applies across the cluster's current and future databases; the database stored with a key is only its fallback.

Select a data-plane database with `?database=<name>` or `x-rawtree-database`. Omission uses the key's stored default. When both selectors are present they must agree. Use a descriptive `User-Agent` so request logs can identify the client.

Use the least sufficient permission:

| Permission | Intended operations |
|---|---|
| `read_only` | List and describe data, query, and inspect logs |
| `write_only` | Insert data |
| `read_write` | Insert and read data |
| `admin` | Manage databases and keys, and delete data resources |

API keys cannot manage organizations, membership, billing, or clusters. Save a newly created key immediately: later listings expose a hint, not the recoverable secret.

## Query

`POST /v1/query` accepts `sql` plus optional `query_id` and `format`. A structured `params` field is unsupported and is not bound into the SQL; omit it. Construct the final SQL in application code using a SQL-literal encoder or a narrow allowlist appropriate to the input contract. Never interpolate untrusted input directly or rely on shell quoting as SQL escaping. If safe construction cannot be established, stop before sending the request.

```json
{
  "sql": "SELECT count() AS rows FROM events",
  "format": "JSON"
}
```

The default JSON response contains `meta`, `data`, `rows`, `statistics`, and optional `hints`. Other formats return raw bodies; branch response parsing on the selected format. Apply [query.md](query.md) before constructing the SQL, and inspect statistics and hints when the selected format exposes them.

Provide `query_id` when cancellation matters. Query cancellation is scoped to the selected database; verify the current cancel request in OpenAPI before using it.

## Insert

`POST /v1/tables/{table}` accepts one JSON object or an array of objects. RawTree creates the table on first insert.

For URL ingestion, pass a public HTTP(S) URL through the endpoint's `url` query parameter. Body and URL modes are mutually exclusive. URL mode streams NDJSON progress rather than returning the ordinary insert envelope.

Transforms apply to JSON body inserts. URL ingestion does not accept transforms; pre-transform hosted data.

Treat inserts and retries as append-like. A failed or interrupted multi-request workflow may have inserted data already. When duplicate avoidance matters, inspect the current OpenAPI deduplication options and use a stable retry token deliberately.
