# RawTree Queries

Use this reference with the selected interface reference when one exists. Treat `RawMergeTree` and `ReplicatedRawMergeTree` as one user-facing query model; replication does not change SQL syntax or type handling.

## Query Model

RawTree injects an internal physical `__raw_data JSON` column. Undeclared, semi-structured input fields are stored as paths inside it, while declared physical columns can coexist. Query known fields through their logical names, such as `event`, `user.id`, or alias-qualified `e.user.id`.

## Workflow

1. Inspect the table before writing SQL.
   - Prefer the selected interface's table-description operation.
   - With direct SQL access, run `DESCRIBE TABLE table SETTINGS describe_include_subcolumns = 1`.
   - Treat returned names such as `user.id` as queryable logical paths. The absence of the `__raw_data` parent from the description is expected.
   - If access is unavailable, use the supplied schema or samples and state every inferred path.
   - Finish when the table and paths are verified, or when every placeholder and inferred path is clearly labeled for explanation-only work.

2. Decide the intended type of each field.
   - A described JSON leaf is typically `Dynamic`, even when sample values look uniform.
   - Preserve `Dynamic` only for exploration or when concrete stored types are part of the result.
   - For mixed or uncertain values, casts, missing data, joins, arrays, grouping, ordering, dates, aggregates, windows, or query hints, read [dynamic-fields.md](dynamic-fields.md) before composing the expression.
   - Finish when each type-sensitive operation has an explicit target type or deliberate Dynamic semantics.

3. Compose a narrow read-only query.
   - Select named logical paths. Use `__raw_data` only when the stored parent JSON object is genuinely required.
   - Add a deterministic `ORDER BY` whenever row order matters and a `LIMIT` while exploring rows.
   - Start with `SELECT`, `WITH`, `EXPLAIN`, or `DESCRIBE`; RawTree's public query surfaces reject mutating statements.
   - Keep user-provided values under application control: validate, allowlist, or safely escape them according to the calling interface.
   - Finish when the query is type-intentional, bounded for its purpose, and stable under schema evolution.

4. Validate when execution is authorized.
   - Run a bounded version first.
   - Inspect result metadata, rows and bytes read, and query hints when the selected interface and format expose them.
   - Resolve or explicitly report every skipped incompatible type; a successful query can still omit Dynamic variants.
   - For SQL queries that are slow or high-volume, automatic keys, predicate pruning, runtime comparison, or `EXPLAIN`, also read [performance.md](performance.md).
   - Finish when no missing path, type omission, accidental ordering, or unexplained cost remains.

## Storage Semantics

- `SELECT *` expands declared columns plus the leaf paths known to the current schema instead of returning the `__raw_data` parent. New JSON shapes can add columns to that expansion, so use explicit column lists in reusable queries.
- A known path missing from a row yields `NULL`. A completely unknown bare path fails with `UNKNOWN_IDENTIFIER`.
- A declared physical column wins over a same-named JSON path. Use explicit `__raw_data.path` only to select the raw subpath in that rare collision.
- `__raw_data` without a suffix returns RawTree's stored, parsed JSON object. It is not the original textual JSON representation.
- Read known fields as direct subcolumns. Avoid `JSONExtract*(toString(__raw_data), ...)`: it materializes and reparses the parent object instead of using RawTree's path-level read model.
