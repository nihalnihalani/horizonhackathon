# Dynamic Field Semantics

RawTree JSON leaf paths normally have type `Dynamic`: each row retains its concrete value type. Choose whether the query should preserve, convert, or select that type before applying SQL operations.

## Contents

- [Inspect variants](#inspect-variants)
- [Choose conversion or exact extraction](#choose-conversion-or-exact-extraction)
- [Compare and filter](#compare-and-filter)
- [Handle missing and null](#handle-missing-and-null)
- [Group, deduplicate, and order](#group-deduplicate-and-order)
- [Call functions and aggregates](#call-functions-and-aggregates)
- [Join and combine relations](#join-and-combine-relations)
- [Work with arrays and deep paths](#work-with-arrays-and-deep-paths)

## Inspect Variants

Audit a path before assuming one type:

```sql
SELECT dynamicType(value) AS concrete_type, count() AS rows
FROM events
GROUP BY concrete_type
ORDER BY rows DESC;
```

`dynamicType` returns names such as `Int64`, `Float64`, `String`, `Bool`, `Array(String)`, or `None`.

## Choose Conversion or Exact Extraction

- `value::Int64` and `CAST(value AS Int64)` convert compatible variants to `Int64`. A missing value can become the target type's default, and an unconvertible value can fail the query.
- `accurateCastOrNull(value, 'Int64')` performs tolerant conversion and returns `NULL` for invalid or overflowing values. Use it for dirty or uncertain data, then handle `NULL` explicitly.
- `__raw_data.value.:Int64` extracts the exact stored `Int64` variant rather than converting. A nonmatching variant returns `NULL` when the target can be nullable, but some non-nullable-capable targets return their default instead. Pair exact extraction with `dynamicType(value)` for a reliable type audit; do not use it for general normalization.

Strict casts can create false matches and groups: missing Dynamic values commonly become `''`, `0`, or another target default. Use `accurateCastOrNull`, or explicitly reject missing values before a strict cast, whenever default collision would change semantics.

Example tolerant filter:

```sql
WITH accurateCastOrNull(latency_ms, 'Float64') AS latency
SELECT service, latency
FROM requests
WHERE latency IS NOT NULL AND latency > 1000
ORDER BY latency DESC
LIMIT 100;
```

## Compare and Filter

Bare comparisons are suitable when the path is known to be homogeneous:

```sql
WHERE status = 'error'
WHERE duration_ms >= 1000
```

For mixed paths, comparisons dispatch per concrete type. Numeric variants compare numerically, while incompatible variants such as strings can yield a default result and a hint. In particular, a string variant can be false for `id = 1` but true for `id != 1`. Convert to the intended semantic type when mixed values should participate consistently.

Cast before `IN`:

```sql
WHERE accurateCastOrNull(user_id, 'String') IN ('u1', 'u2')
```

## Handle Missing and Null

Ordinary field access presents both a missing path and explicit JSON null as `NULL`.

```sql
SELECT
    count() AS rows,
    countIf(email IS NOT NULL) AS rows_with_email,
    countIf(email IS NULL) AS rows_without_email
FROM users;
```

Use `countIf(path IS NOT NULL)` for presence. `count(path)` counts every Dynamic wrapper row, including rows whose concrete value is `None`.

Use a null-preserving conversion such as `ifNull(accurateCastOrNull(path, 'String'), 'unknown')` only when a target default is part of the requested semantics.

## Group, Deduplicate, and Order

Do not assume that `GROUP BY`, `DISTINCT`, or `uniq*` normalizes every Dynamic type. RawTree applies value-based numeric normalization and integer bucketing to compatible variants, while numeric `42`, string `"42"`, and boolean values remain distinct. Cast to the business type whenever exact grouping identity matters.

```sql
WITH accurateCastOrNull(value, 'String') AS normalized_value
SELECT normalized_value, count()
FROM events
WHERE normalized_value IS NOT NULL
GROUP BY normalized_value;
```

Bare Dynamic ordering depends on concrete types and `dynamic_columns_compare_by_value`. With its default `false`, different stored types sort by type before value; when enabled, compatible numeric and string families can compare by value across types. Neither mode supplies one reliable business order for mixed numeric, string, boolean, or temporal representations. Convert the sort key and spell out null placement:

```sql
ORDER BY accurateCastOrNull(score, 'Float64') DESC NULLS LAST
```

Apply the same rule to `min`, `max`, window `ORDER BY`, and order-dependent aggregates.

## Call Functions and Aggregates

Scalar functions can return `NULL` or a default for incompatible variants. Dynamic aggregates such as `sum(value)` and `avg(value)` can skip incompatible variants and emit a query hint.

Use an explicit type when the aggregate has numeric or date semantics:

```sql
WITH accurateCastOrNull(amount, 'Float64') AS amount_number
SELECT
    sum(amount_number) AS total,
    countIf(amount IS NOT NULL AND amount_number IS NULL) AS invalid_amounts
FROM payments;
```

Treat every skipped-type hint as a correctness decision: normalize the field, restrict the intended variants, or report the omission.

For date strings or mixed date representations, normalize once and reuse the result:

```sql
WITH parseDateTimeBestEffortOrNull(
    accurateCastOrNull(event_time, 'String')
) AS event_ts
SELECT toDate(event_ts) AS day, count()
FROM events
WHERE event_ts IS NOT NULL
GROUP BY day
ORDER BY day;
```

Inspect numeric timestamp variants before converting them. Epoch values require an explicit unit and timezone contract; do not guess whether a number is seconds, milliseconds, microseconds, or nanoseconds.

## Join and Combine Relations

Dynamic JOIN keys are rejected by default. Normalize both sides to the same nullable type and exclude invalid or missing keys before joining:

```sql
SELECT e.event, u.plan
FROM
(
    SELECT event, accurateCastOrNull(user_id, 'String') AS user_key
    FROM events
    WHERE user_key IS NOT NULL
) AS e
INNER JOIN
(
    SELECT plan, accurateCastOrNull(id, 'String') AS user_key
    FROM users
    WHERE user_key IS NOT NULL
) AS u
    ON e.user_key = u.user_key
LIMIT 100;
```

Do not join with `e.user_id::String = u.id::String` unless both keys were first proven present and valid; otherwise missing keys can both become an empty string and match. Also concretize corresponding columns for `UNION`, `INTERSECT`, and `EXCEPT`, and concretize window partition/order keys when value semantics matter.

## Work with Arrays and Deep Paths

Nested paths remain direct logical names at arbitrary depth, such as `request.client.geo.country`. Array indexes are one-based: `items[1].name` addresses the first element's field.

When a path's contract is a specific array type, cast before `ARRAY JOIN`:

```sql
SELECT event_id, tag
FROM events
ARRAY JOIN CAST(tags AS Array(String)) AS tag
ORDER BY event_id::String, tag;
```

Audit `dynamicType(tags)` first when scalar, null, or multiple array variants may be present; direct Dynamic dispatch can omit non-array rows and empty arrays produce no joined rows.
