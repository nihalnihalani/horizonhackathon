// Bounded runner child for control lifecycle tests: the real runner's control plumbing (HttpRowSink,
// HttpProjectionLoader, intent gate, dispatch claim) + kernel recovery + the F3 ferry step, without providers.
// Spawned by MissionActor (opts.runnerMain) with the same env allowlist as the real runner.
import { CrashPoint, type Arm } from "@dr/shared";
import { DispatchRefused, HttpDeskClient, recover, runFerryStep } from "@dr/kernel";
import { HttpProjectionLoader, HttpRowSink, httpClaimDispatch, httpIntentGate } from "@dr/runner/io";

const env = process.env;
const runId = env.DR_RUN_ID!;
const arm = (env.DR_ARM ?? "dr") as Arm;
const epoch = Number(env.DR_EPOCH);
const link = { baseUrl: env.DR_CONTROL_URL!.replace(/\/$/, ""), token: env.DR_RUNNER_TOKEN! };
const desk = new HttpDeskClient({ baseUrl: env.DR_WORLD_BASE_URL!, token: env.DR_WORLD_TOKEN!, ns: { run_id: runId, arm } });
const point = env.DR_CRASH_AFTER ? CrashPoint.parse(env.DR_CRASH_AFTER) : null;
const log = (l: string) => console.log(l);

const rec = await recover({ loader: new HttpProjectionLoader(link), sink: new HttpRowSink(link), desk, run_id: runId, arm, log });
const ferry = rec.journal.state.plan_steps.ferry;
if (ferry?.status === "done" || ferry?.status === "blocked") {
  log(`booking-child: ferry ${ferry.status}; nothing to dispatch`);
  process.exit(0);
}
try {
  const out = await runFerryStep(
    { journal: rec.journal, desk, log, awaitIntentVisible: httpIntentGate(link), claimDispatch: httpClaimDispatch(link, epoch) },
    { holdAfterCommit: point === "after_desk_commit", point, holdMs: Number(env.DR_HOLD_MS ?? 120_000) },
  );
  log(`booking-child: ferry ${out.receipt.outcome} ${out.receipt.receipt_id}`);
} catch (e) {
  if (e instanceof DispatchRefused) { log(`booking-child: stopped (${e.refusal})`); process.exit(0); }
  throw e;
}
process.exit(0);
