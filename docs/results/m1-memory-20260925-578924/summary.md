# Batch m1-memory-20260925-578924

Evidence levels: deterministic unit test / local integration in stub mode; live smoke only for rows whose `mode` is `live` (see VALIDATION_AND_DEMO.md §1).

| arm | mode | rounds | max input tokens | mean input tokens | curator/summary calls | recall ok | pins preserved | CONTEXT_CAPACITY blocks |
|---|---|---|---|---|---|---|---|---|
| dr | stub | 12 | 308 | 247 | 10 | yes | yes | 0 |

C03 (bounded provenance-labelled recall of evicted original): MET (deterministic)
C06 (fixed repeated-memory trace): MET — accepted_eviction_round=1
C07 (positive Liquid-authored edit): NOT MET (mode=stub)
