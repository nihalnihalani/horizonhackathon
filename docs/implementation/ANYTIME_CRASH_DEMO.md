# Anytime worker crash: operation and evidence

The board supports two distinct modes. Both kill actual child processes; the control service, persistence service and simulated booking desk must survive.

## Operator flow

With the existing local services running, open `http://127.0.0.1:4400/board` and enter the local operator token.

1. Select **Start free run**. This starts both comparison arms with `crash:false`; neither deliberately waits at the ferry boundary.
2. Select **Crash now (all live workers)** while a worker is running. The request is operator-authenticated `POST /demo/kill` with `{ "all": true }`. The button targets all current workers in this local demo, not a single mission.
3. Read the actual exit result: PID, observed signal, and whether the process remains alive. No live target means the run may already have finished; it is not a successful crash demonstration.
4. Optionally select **Close Site A**, then **Resume**. Resume reuses the existing mission identities, launches new worker generations, and runs recovery. Its existing demo clock advances to the simulated +48h time.
5. Show the recovered receipt, source revalidation, current constraints, final validator result and booking ledger. Only report the outcome actually observed.

For a reproducible presentation, **Start controlled test** still holds at the ferry commit boundary; **Crash held workers** only terminates workers at that hold. Keep this mode available if the free run finishes before the judge presses the button.

The phone pairing gateway is not implemented by this change. A phone cannot use the laptop's `127.0.0.1`; do not expose the entire local control service to make the button reachable.

## Changes

- Expose free-run start and immediate worker termination on the board, with explicit exit feedback.
- Capture generation-specific child handles and exit promises; signal all selected children before awaiting any. This avoids dereferencing a later child's cleared handle when it exits while the first is awaited.
- Attach exit listeners before asynchronous status persistence, and emit spawned before that await so an early exit cannot appear followed by a stale spawned event.
- Restore missing F3 constraints, plan steps and initial facts row by row. Existing pins and progressed steps are preserved.
- Revalidate superseded as well as stale facts, including alternate campsite candidates, to recover an interrupted fact replacement.

## Tested scope

- Real freely running fixture workers emit activity, receive SIGKILL without HOLD, disappear, and restart as generation 2. Duplicate kill calls and no-active-worker calls are covered.
- A multi-worker exit-order regression exercises captured handles rather than mutable mission child references.
- Fourteen durable-write interruption positions cover initialization, including a persisted row whose acknowledgement is lost. One additional case retries interrupted observation. These are injected failures, not fourteen real process-kill tests.
- Existing R01/R02/R03 subprocess tests cover before desk execution, after desk commit before receipt persistence, and after persisted receipt. Existing effect/lifecycle tests were also run.
- These checks use local fake RawTree/provider inputs and the simulated desk; no live provider calls were made for this change.

Suggested claim: **“The judge can terminate a running worker at any time. We demonstrate recovery from durable state and independently test specific crash windows.”**

Do not claim universal crash-anywhere reliability, full-machine/control-service restart recovery, guaranteed recovery during every live provider call, or correctness of an unmeasured naive-baseline run. Full workflow randomized interruption and repeated-crash testing remain additional acceptance work. Independent review here was a provisional Codex source review, not an invocation of the repository's requested Fable model gate.
