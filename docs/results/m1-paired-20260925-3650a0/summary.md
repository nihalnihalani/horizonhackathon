# Batch m1-paired-20260925-3650a0

Evidence levels: deterministic unit test / local integration in stub mode; live smoke only for rows whose `mode` is `live` (see VALIDATION_AND_DEMO.md §1).

| arm | mode | rounds | max input tokens | mean input tokens | curator/summary calls | recall ok | pins preserved | CONTEXT_CAPACITY blocks |
|---|---|---|---|---|---|---|---|---|
| dr | stub | 12 | 308 | 247 | 10 | yes | yes | 0 |
| baseline | live | 12 | 5534 | 4992 | 7 | yes | yes | 1 |

B01 comparability: OK
C06 (fixed repeated-memory trace, DR arm): MET — accepted_eviction_round=1
C07 (positive Liquid-authored edit): NOT MET (mode=stub)
Baseline summary calls: 7 (mode=live)
