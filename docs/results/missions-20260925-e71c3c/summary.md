# Mission batch missions-20260925-e71c3c

10/12 fixture x arm runs matched the oracle.

| fixture | arm | expected verdict | actual verdict | match | mismatches |
|---|---|---|---|---|---|
| F1 | dr | VALID | VALID (status valid) | MATCH | - |
| F1 | naive | VALID | VALID (status valid) | MATCH | - |
| F2 | dr | VALID | VALID (status valid) | MATCH | - |
| F2 | naive | VALID | VALID (status valid) | MATCH | - |
| F3 | dr | VALID | VALID (status valid) | MATCH | - |
| F3 | naive | VALID | BLOCKED (status blocked) | MISMATCH | verdict: expected VALID, got BLOCKED (mission status blocked); committed_by_slot.campsite: expected 1, got 0; campsiteBooked: expected true, got false |
| F4 | dr | VALID | VALID (status valid) | MATCH | - |
| F4 | naive | VALID | VALID (status valid) | MATCH | - |
| F5 | dr | BLOCKED | BLOCKED (status blocked) | MATCH | - |
| F5 | naive | BLOCKED | BLOCKED (status blocked) | MATCH | - |
| F6 | dr | BLOCKED | BLOCKED (status blocked) | MATCH | - |
| F6 | naive | BLOCKED | HARNESS_ERROR (status harness_error) | MISMATCH | harness error: timeout waiting for terminal status on f3-20260926-4bbd (status=executing, worker={"pid":null,"state":"failed","generation":1,"lastExit":{"pid":72776,"code":1,"signal":null}}) |

Evidence level: local integration (real running control + desk + RawTree + provider adapters against a shared loopback world; not a live-demo recording).

## Reading this table (lead note)

The oracle is the correct outcome for each mission, and both arms are scored against it.
- **Dead Reckoning (`dr`): 6/6 match.**
- **Transcript ablation (`naive`):** F3 fails the oracle as expected. It resumes from its transcript, never re-checks the closed site, has its booking rejected by the desk, and ends BLOCKED instead of repairing to Site C.
- **F6 naive:** this was a harness error. The runner hit a transient RawTree 503 on its final projection read and exited 1. The projection read now retries a bounded number of times on 503 (packages/runner/src/io.ts); this batch was not re-run.
- **F2/F4 naive:** the crash point never fires, because the naive booking path only holds at `after_desk_commit`. This is a recorded limitation.

Single run per cell; not a statistical claim.
