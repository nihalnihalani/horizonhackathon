// R02 child: a real process that runs the ferry step with the HOLD crash hook.
// Env (explicit, no secrets): R02_RAWTREE_URL, R02_RAWTREE_KEY (fake), R02_DESK_URL, DR_WORLD_TOKEN, DR_RUN_ID,
// DR_ARM, DR_CRASH_AFTER (any CrashPoint; after_desk_commit keeps the HOLD line), R02_SELF_KILL=1 (self-SIGKILL
// instead of waiting). Also used by R01/R03 (after_intent / after_receipt).
import { RawTreeClient, RawTreeSink, intentVisibilityGate } from "@dr/storage";
import { CrashPoint, F3, assertRunId, type Arm } from "@dr/shared";
import { HttpDeskClient } from "./desk-client.ts";
import { Journal } from "./journal.ts";
import { runFerryStep } from "./protocol.ts";

const env = process.env;
const need = (k: string) => { const v = env[k]; if (!v) { console.error(`r02-child: missing ${k}`); process.exit(3); } return v; };
const runId = assertRunId(need("DR_RUN_ID"));
const arm = (env.DR_ARM ?? "dr") as Arm;
const client = new RawTreeClient({ baseUrl: need("R02_RAWTREE_URL"), apiKey: need("R02_RAWTREE_KEY"), database: "deadreckoning" });
const sink = new RawTreeSink(client);
const desk = new HttpDeskClient({ baseUrl: need("R02_DESK_URL"), token: need("DR_WORLD_TOKEN") });
const journal = new Journal(sink, { run_id: runId, arm, epoch: 1 });

await journal.append("epochs", { reason: "boot", restored_rows: 0, sim_clock: F3.sim_clock, pid: process.pid, verdict: null, verdict_reason: null });
for (const c of F3.constraints) {
  await journal.append("constraints", { key: c.key, value: JSON.stringify(c.value), authority: "user", private: false, version: 1 });
}
const point = env.DR_CRASH_AFTER ? CrashPoint.parse(env.DR_CRASH_AFTER) : null;
const out = await runFerryStep(
  { journal, desk, awaitIntentVisible: intentVisibilityGate(client, { deadlineMs: 5000, intervalMs: 100 }) },
  { holdAfterCommit: point === "after_desk_commit", point, holdMs: 120_000, selfKill: env.R02_SELF_KILL === "1" },
);
console.log(`r02-child finished without crash: ${out.receipt.receipt_id}`);
