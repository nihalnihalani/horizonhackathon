# auth.md

You are an agent that wants to call the RawTree API on a user's behalf. This file describes how to find credentials, use them safely, and recover from authentication errors.

Three hosts are relevant:

- **Resource server** - `https://api.rawtree.com` - the API you will call.
- **Dashboard** - `https://rawtree.com` - where the user manages databases, organizations, clusters, and API keys.
- **Hosted MCP server** - `https://mcp.rawtree.com/mcp` - the remote MCP endpoint for OAuth-capable clients.

## Current state

RawTree supports OAuth for the hosted MCP server and API key authentication for scripts, services, CI, CLI commands, direct API calls, and local MCP servers. Use hosted MCP OAuth for interactive MCP clients. Use an API key supplied out of band for unattended or non-MCP work. Do not collect a user's password, register an account on their behalf, or ask them to paste credentials into chat.

## Use the existing tooling first

Before doing anything credential-shaped, check whether RawTree is already wired into your environment.

1. **RawTree CLI** - if you are running shell commands, prefer `rtree` over hand-rolled `curl`. It resolves auth, database, and organization context for you and supports `--json` for agents. Install: `curl -fsSL https://rawtree.com/install.sh | bash`.
2. **RawTree agent skill** - load the RawTree skill before calling the API directly. It includes the CLI, API, SQL, logs, parameterized-query, type, and error-handling patterns. Source: `https://github.com/rawtreedb/agent-skills/blob/main/skills/rawtree/SKILL.md`.
3. **Hosted RawTree MCP server** - if you are an MCP client, use an existing RawTree connection or add `https://mcp.rawtree.com/mcp`. OAuth-capable clients open RawTree sign-in and consent, so no API key needs to enter the agent's context. The server exposes data, table, log, organization, cluster, app, database, and API-key tools. Docs: `https://rawtree.com/docs/reference/mcp`.

If one of these is configured and fits the task, use it. Do not ask the user for an API key you do not need.

## Hosted MCP OAuth

For an interactive MCP client, add the production Streamable HTTP endpoint:

```text
https://mcp.rawtree.com/mcp
```

For Codex:

```bash
codex mcp add rawtree --url https://mcp.rawtree.com/mcp
```

The client discovers RawTree's authorization server and opens a browser for login and consent. One connection can access every organization, cluster, and database available to the signed-in user. Discover resource names with `list-organizations`, `list-clusters`, and `list-databases`; pass the required organization and cluster to subsequent tools.

Use the MCP tools directly after connection. Do not ask the user for an API key as a second credential. If OAuth is revoked or expires, have the MCP client authenticate again.

## API key, supplied out of band

The agent credential is a RawTree API key. RawTree API keys use the `rt_` prefix.

The user can create a key from the RawTree dashboard cluster settings or from the CLI:

```bash
rtree key create --name my-agent --permission read_write
```

Choose the least permission that can complete the task:

| Permission | Use it for |
| --- | --- |
| `read_only` | Query data, inspect tables, and read logs. |
| `write_only` | Insert events without reading data or logs. |
| `read_write` | Insert, query, inspect tables, and read logs. |
| `admin` | Manage databases and API keys, or delete tables. |

### How to pick the key up

Look for credentials in this order. Stop at the first source that exists:

1. `--api-key` on the `rtree` CLI, if the user passed one for this invocation.
2. `RAWTREE_API_KEY` in your process environment.
3. A `.env` file the user has explicitly told you to read.
4. Saved local CLI credentials from `rtree login` or the CLI API-key login mode.
5. A configured RawTree MCP server, if you are calling RawTree through MCP. Prefer its OAuth connection over extracting an API key.

Every API key is scoped to one organization and cluster and applies to all current and future databases there. Select a database per data request with `RAWTREE_DATABASE`, `?database=<name>`, or `x-rawtree-database`; omission uses the key's stored default database. Keys created without a database selector store the logical `default` database. Use `RAWTREE_ORG` only when a CLI command or integration explicitly needs it.

If none of the sources above is set and you genuinely need a key, do not ask the user to paste it into the conversation. Instead, ask them to create a key with the narrowest permission that fits the task and place it in `RAWTREE_API_KEY`, their MCP client config, their shell, or saved CLI credentials. Resume once it is set.

### How to use the key

Present the key as a bearer token:

```http
POST /v1/query HTTP/1.1
Host: api.rawtree.com
Authorization: Bearer $RAWTREE_API_KEY
Content-Type: application/json

{"sql":"SELECT count() FROM events"}
```

Read the key from the environment or configured tool at the moment of the call. Do not echo it, log it, commit it, include it in PR descriptions, attach it to screenshots, or paste it into error reports. If you run shell commands, reference the environment variable instead of interpolating the key inline.

For direct API calls:

```bash
curl -X POST "https://api.rawtree.com/v1/query" \
  -H "Authorization: Bearer $RAWTREE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT count() FROM events"}'
```

For CLI calls:

```bash
test -n "$RAWTREE_API_KEY"
rtree status --json
rtree query --json "SELECT count() FROM events"
```

For a local MCP stdio server:

```bash
codex mcp add rawtree \
  --env RAWTREE_API_KEY="$RAWTREE_API_KEY" \
  -- npx -y @rawtree/mcp
```

## Errors

| Status | Meaning | What to do |
| --- | --- | --- |
| `401` on first use | Key is malformed, missing, revoked, or for a different RawTree environment. | Re-read the configured source and ask the user to refresh the key in their secret store, shell, CLI config, or MCP config. |
| `401` after the key worked earlier | Key was likely rotated or revoked. | Drop any cached value and re-read from the same secure source. |
| `403` | Key lacks permission for the resource or database. | Ask the user to create a key with the required permission, or switch to the right database/org context. |
| `404` | Database, table, or route context is missing or incorrect. | Check `rtree status --json`, `RAWTREE_DATABASE`, `RAWTREE_ORG`, and the table name before assuming auth failed. |
| `429` | Rate limited. | Back off and retry. Honor `Retry-After` if present. |

## Revocation

The user revokes keys from the RawTree dashboard cluster settings or with:

```bash
rtree key delete <id_or_token>
```

You will usually discover revocation as a `401` on a previously-working credential. Drop the cached value and ask the user to refresh the secure source you read from. Do not ask for the key in chat.
