# RawTree MCP

Use each configured tool's schema and annotations as the current contract for its name, inputs, confirmation flow, and result. Use the public [MCP server reference](https://rawtree.com/docs/reference/mcp) for client setup and authentication.

## Connect

Prefer the hosted Streamable HTTP server for interactive agents:

```text
https://mcp.rawtree.com/mcp
```

When the RawTree plugin supplies the MCP connection, authenticate that connection through the client's plugin settings and verify tool discovery. Use manual setup below only when no RawTree connection is configured.

OAuth-capable clients open a browser for sign-in and approval. For standalone Codex setup:

```bash
codex mcp add rawtree --url https://mcp.rawtree.com/mcp
codex mcp login rawtree
```

For a headless client, send a RawTree API key as a Bearer token to the hosted endpoint. Use the least permission that completes the task. When hosted MCP is unavailable to the client, run the local server with an API key:

```bash
codex mcp add rawtree \
  --env RAWTREE_API_KEY=rt_xxxxxxxxx \
  -- npx -y @rawtree/mcp
```

Do not infer live tool availability from configuration alone. Confirm that the client has discovered the RawTree tools before depending on them.

## Resolve Resources

With OAuth, one connection can access every resource available to the signed-in user. Discover context in order:

1. Call `list-organizations`.
2. Call `list-clusters` for the selected organization.
3. Call `list-databases` for the selected organization and cluster.

Use exact discovered values. Organization tools take `organization`; cluster tools also identify a cluster; data, table, log, and API-key tools take `organization` and `cluster`. When `database` is optional, omission selects the cluster's default database.

With API-key authentication, omitted resource inputs use the key's bound cluster and default database. Explicit resource values must match the key binding. User-level tools such as organization discovery require OAuth.

## Call Tools

Inspect the selected tool before every unfamiliar operation instead of relying on a cached tool list. Honor any confirmation or elicitation returned by the server; an operation awaiting confirmation is incomplete.

For queries, also apply [query.md](query.md). For inserts and other writes, keep batches bounded and account for partial success before retrying. Verify completion from the structured tool result, then re-read the affected resource when the operation changes persistent state.
