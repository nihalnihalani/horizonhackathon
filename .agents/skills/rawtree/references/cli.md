# RawTree CLI

Use the installed CLI as the command source of truth. Run `rtree --help` and `rtree <command> --help` before composing unfamiliar commands; use the public CLI docs only when the executable is unavailable.

## Install and Authenticate

Install only when `rtree` is unavailable and installation is within scope:

```bash
curl -fsSL https://rawtree.com/install.sh | bash
```

Use `rtree login` for an interactive browser flow. For an agent, service, or CI job, prefer an existing API key through `--api-key` or `RAWTREE_API_KEY`; this avoids changing saved local credentials.

Verify resolved context without exposing the credential:

```bash
rtree status --json
```

## Resolve Configuration

Use explicit organization and database values for deterministic automation.

- API URL: `--api-url`, then `RAWTREE_API_URL`, then saved configuration, then the hosted default.
- Credential: `--api-key`, then `RAWTREE_API_KEY`, then saved login credentials.
- Organization: `--org`, then `RAWTREE_ORG`, then saved configuration.
- Database: the relevant command's `--database`, then `RAWTREE_DATABASE`, then saved configuration.

`--database` belongs to database-scoped subcommands, not the root command. With user credentials and no organization selection, the CLI may choose the first available organization; specify it when that choice matters.

`rtree database use <name>` changes local configuration and does not prove the database exists. Verify the resulting context or list databases before depending on it.

## Run Commands

Use `--json` for agent-readable output and parse stdout. Treat a nonzero exit status and structured stderr as failure.

Representative shapes:

```bash
rtree database create analytics --json
rtree key create --name agent --permission read_write --json
rtree table describe --database analytics events --json
rtree query --database analytics --json "SELECT count() FROM events"
rtree logs --database analytics --since 1h --json
```

Before writing SQL for `rtree query`, apply [query.md](query.md). SQL can be positional, passed with `--sql`, or read from stdin with `-`. The `--limit` option mechanically appends a limit; put the limit inside complex SQL instead.

## Insert Data

Choose exactly one input mode:

```bash
rtree insert --database analytics --table events --data '{"event":"signup"}' --json
rtree insert --database analytics --table events --file ./events.jsonl --json
rtree insert --database analytics --table events --url https://example.com/events.jsonl --json
```

Apply transforms only to inline or file data. URL ingestion and transforms are mutually exclusive; pre-transform URL-hosted data.

A `.jsonl` file is uploaded in multiple concurrent batches. If the command fails, earlier batches may already be present. Inspect the result before retrying and avoid assuming an insert is atomic.
