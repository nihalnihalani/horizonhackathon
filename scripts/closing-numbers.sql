-- Closing numbers (RawTree, database deadreckoning). {{DR_RUN}} / {{NAIVE_RUN}} are substituted by
-- scripts/lib.ts closingSql() after assertRunId validation. Dynamic columns are cast with toFloat64(assumeNotNull(x));
-- aliases never reuse a column name; IN() is illegal on Dynamic, so OR is used.
-- 1. per arm: peak planner context, provider-reported input, duplicate effects, stale actions
SELECT arm AS arm_, max(toFloat64(assumeNotNull(context_tokens))) AS max_ctx_tokens, max(toFloat64(assumeNotNull(planner_tokens_in))) AS max_provider_tokens_in, sum(toFloat64(assumeNotNull(duplicate_effects))) AS dup_effects, sum(toFloat64(assumeNotNull(stale_actions))) AS stale_acts FROM metrics WHERE (run_id = '{{DR_RUN}}' OR run_id = '{{NAIVE_RUN}}') GROUP BY arm ORDER BY arm;
-- 2. Liquid curator latency (fact comparisons, DR arm)
SELECT quantile(0.5)(toFloat64(assumeNotNull(curator_ms))) AS curator_p50_ms, quantile(0.95)(toFloat64(assumeNotNull(curator_ms))) AS curator_p95_ms, count() AS curator_calls FROM metrics WHERE run_id = '{{DR_RUN}}' AND phase = 'curator';
-- 3. per-step planner context tokens, both arms (flat-vs-growing chart)
SELECT arm AS arm_, toFloat64(assumeNotNull(epoch)) AS ep, step AS step_, toFloat64(assumeNotNull(context_tokens)) AS ctx_tokens, toFloat64(assumeNotNull(planner_tokens_in)) AS provider_tokens_in FROM metrics WHERE (run_id = '{{DR_RUN}}' OR run_id = '{{NAIVE_RUN}}') AND phase = 'planner' ORDER BY arm_, toFloat64(assumeNotNull(rev));
-- 4. as-of: what DR believed about site-A before the outage vs now (argMax by ts; printed only, never used for restore)
SELECT toString(key) AS key_, argMax(toString(value), toString(ts)) AS latest_value, argMax(toString(status), toString(ts)) AS latest_status, arrayStringConcat(groupArray(toString(status)), ' > ') AS status_history FROM facts WHERE run_id = '{{DR_RUN}}' AND key = 'site-A.status' GROUP BY key_;
-- 5. receipts (recovered flag) for the DR run
SELECT slot AS slot_, resource AS resource_, outcome AS outcome_, receipt_id AS receipt, recovered AS recovered_ FROM receipts WHERE run_id = '{{DR_RUN}}' ORDER BY toFloat64(assumeNotNull(rev))
