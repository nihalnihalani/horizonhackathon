# RawTree Query Performance

Optimize from observed query behavior. When a RawTree table has no explicit key and automatic key generation is enabled, RawTree can choose sorting keys independently for inserted parts. No automatically chosen path is a permanent global primary key, and storage order is not result order.

## Read Narrowly

- Select only the logical paths the result needs.
- Filter on direct paths such as `service`, `request.user.id`, or their alias-qualified forms.
- Avoid `SELECT *` in reusable or high-volume queries; schema evolution can add returned paths.
- Use `count()` for a row count rather than reading fields.
- Read `__raw_data` only when the stored parent JSON object is the requested result; it is parsed data, not the original textual JSON.
- Do not reparse the payload with `JSONExtract*`. Direct paths let the packed reader read only the matching path unit or shared-data unit; reading the parent can span every packed unit.

## Bound the Work

- Add the narrowest valid time or partition filter available.
- Use `LIMIT` for exploration and debugging.
- Aggregate before returning high-cardinality detail when the user needs a summary.
- Add explicit `ORDER BY`; automatic per-part keys do not promise output order.
- Inspect rows and bytes read when the selected interface and format expose them; a short result is not necessarily a cheap query.

## Preserve Useful Predicate Shape

Direct equality, range, prefix `LIKE`, and `startsWith` predicates can prune when they constrain a usable sorting-key prefix. On an automatic-key table that prefix can differ by part; merely appearing later in a compound key is not enough. Cast predicates can still contribute filter statistics, so never change query meaning merely to remove a necessary cast.

Prefer the simplest equivalent predicate. Arbitrary wrappers may hide a path from adaptive statistics, while a blanket claim that every function or cast disables pruning is incorrect.

Ordinary conversions such as `path::Int64` can accrue adaptive statistics to the base path. Exact-variant expressions such as `__raw_data.path.:Int64` are tracked separately and can become separate automatic-key candidates; do not substitute exact extraction for conversion.

## Inspect the Plan and Measure Work

Use indexed explain when Parts and Granules evidence is needed:

```sql
EXPLAIN indexes = 1
SELECT service, duration_ms
FROM requests
WHERE service = 'api'
  AND accurateCastOrNull(duration_ms, 'Float64') > 1000
LIMIT 100
SETTINGS use_query_condition_cache = 0;
```

If a particular interface rejects the indexed form, use plain `EXPLAIN` for plan shape and rely on runtime statistics for pruning evidence. Do not assume that rejection from one interface is a RawTree engine limitation.

Run before-and-after variants over the same fixed literal range with `use_query_condition_cache = 0`, then compare rows and bytes read when exposed. A moving `now()` boundary or the query-condition cache can make the comparison misleading. Isolate one predicate at a time or inspect the full condition section before attributing pruning to a filter. Partial pruning can be normal because usable automatic-key prefixes may differ by part.

## Completion Check

Finish optimization only when:

- the query selects named paths and is bounded for its purpose;
- every type cast preserves the requested semantics;
- indexed or plain `EXPLAIN` and runtime metadata have been checked when plan cost matters;
- runtime rows and bytes are lower under a fixed, cache-controlled comparison, or the remaining cost is explained; and
- no exposed query hint reports an unreviewed skipped Dynamic variant.
