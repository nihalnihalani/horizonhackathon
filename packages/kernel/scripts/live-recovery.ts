// Live check (not a unit test): write-ahead + crash-after-desk-commit + recovery against REAL RawTree
// and the running dev desk (npm run dev:desk). Prints ids/timings only; never prints secrets.
import { loadConfig, newRunId, type BookRequest, type DeskClient, type DeskReceipt } from "@dr/shared";
import { intentVisibilityGate, rawTreeFromEnv } from "@dr/storage";
import { HttpDeskClient, Journal, recover, runFerryStep } from "../src/index.ts";

const desk = loadConfig("desk");
const { client, sink, loader } = rawTreeFromEnv();
const runId = newRunId();
const http = new HttpDeskClient({ baseUrl: desk.DR_WORLD_BASE_URL, token: desk.DR_WORLD_TOKEN, ns: { run_id: runId, arm: "dr" } });
class CrashAfterCommit implements DeskClient {
  async book(r: BookRequest): Promise<DeskReceipt> {
    const rc = await http.book(r);
    console.log(`desk committed ${rc.receipt_id} (${rc.outcome}); simulating crash before receipt row`);
    throw new Error("crash after desk commit");
  }
  lookup(k: string) { return http.lookup(k); }
}
const worldVersion = await http.worldVersion();
const j = new Journal(sink, { run_id: runId, arm: "dr", epoch: 1 });
await j.append("epochs", { reason: "boot", restored_rows: 0, sim_clock: "2026-10-08T09:00:00-07:00 SIMULATED", pid: process.pid, verdict: null, verdict_reason: null });
const t0 = performance.now();
await runFerryStep({ journal: j, desk: new CrashAfterCommit(), awaitIntentVisible: intentVisibilityGate(client, { deadlineMs: 8000 }) }, { holdAfterCommit: false }, worldVersion).catch((e) => console.log(`epoch 1 ended: ${(e as Error).message}`));
console.log(`run_id=${runId} epoch1_ms=${Math.round(performance.now() - t0)}`);
// wait for RawTree visibility (live probe: ~0.6 s)
for (let i = 0; i < 20; i++) {
  const p = await loader.load(runId);
  if (Object.values(p.commitments).some((c) => c.status === "intent")) break;
  await new Promise((r) => setTimeout(r, 300));
}
const t1 = performance.now();
const r = await recover({ loader, sink, desk: http, run_id: runId, arm: "dr" });
console.log(`recover_ms=${Math.round(performance.now() - t1)} epoch=${r.epoch} restored_rows=${r.restored_rows} reconciled=${JSON.stringify(r.reconciled)}`);
