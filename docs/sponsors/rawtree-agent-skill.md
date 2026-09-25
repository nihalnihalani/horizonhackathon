---
name: rawtree
description: Operate and query RawTree. Use for RawTree MCP tools, CLI, or API tasks involving authentication, databases, API keys, ingestion, tables, logs, read-only SQL, nested or Dynamic fields, query debugging, and performance.
metadata:
  author: rawtree
  version: "0.5.0"
---

# RawTree

Treat MCP, the CLI, and the API as access surfaces for the same RawTree workflows. Preserve the user's chosen surface when one is specified.

## Route

Read every reference whose condition matches before acting:

- For MCP connection, authentication, resource selection, or RawTree tool calls, read [references/mcp.md](references/mcp.md) and use each tool's schema as its interface contract.
- For CLI installation, authentication, commands, configuration, or automation, read [references/cli.md](references/cli.md).
- For HTTP authentication, requests, endpoints, payloads, formats, or responses, read [references/api.md](references/api.md).
- For writing, reviewing, executing, or debugging SQL, read [references/query.md](references/query.md).
- For mixed or uncertain types, missing values, casts, joins, arrays, grouping, ordering, dates, or query hints, also read [references/dynamic-fields.md](references/dynamic-fields.md).
- For SQL queries that are slow or high-volume, automatic keys, predicate pruning, runtime measurement, or `EXPLAIN`, also read [references/performance.md](references/performance.md).

An MCP, API, or CLI query requires both its interface reference and `query.md`. Load the Dynamic and performance references only when their branches apply. Routing is complete when every requested operation and RawTree-specific data risk maps to a loaded reference.

## Workflow

1. Verify the input contract.
   - For MCP work, inspect the tool schema, annotations, and required inputs.
   - For CLI work, inspect `rtree --help` and the relevant subcommand help.
   - For API work, inspect the live OpenAPI specification when exact request or response fields matter.
   - For SQL-only work, inspect the table or use the supplied schema; state inferred paths when access is unavailable.
   - Finish when every command, method, field, and SQL path used by the task is known or clearly labeled as inferred for explanation-only work.

2. Resolve context and authority.
   - Identify the organization, cluster, database, authentication source, and required permission wherever they apply.
   - Use the least permission that can complete the operation.
   - Obtain explicit authorization immediately before deleting a database, table, or API key.
   - Finish when the exact target and permitted operation are unambiguous.

3. Produce or, when execution is requested and authorized, perform the smallest scoped operation that satisfies the request.
   - Prefer machine-readable results for agent and automation workflows.
   - Keep exploratory reads bounded and retries deliberate.
   - Finish when the requested guidance, result, or state has been produced without expanding the task.

4. Verify the outcome.
   - Use the tool or command result, API response, table description, query metadata, statistics, hints, or request logs that the selected surface exposes.
   - Treat partial inserts and skipped Dynamic variants as incomplete until accounted for.
   - Finish when success is verified or the failure and next safe action are explained.
