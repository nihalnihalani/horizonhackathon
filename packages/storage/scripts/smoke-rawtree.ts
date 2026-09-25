// Live smoke: insert one row into `smoke`, poll until visible, print ack, latency and row. No secrets printed.
import { randomBytes } from "node:crypto";
import { rawTreeFromEnv, selectSmoke } from "../src/index.ts";

const { client } = rawTreeFromEnv();
const runId = `smoke-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
const row = { run_id: runId, ts: new Date().toISOString(), epoch: 1, rev: 1, arm: "dr", kind: "wp-a-smoke", key: "hello", value: JSON.stringify({ ok: true }) };
const t0 = performance.now();
const ack = await client.insert("smoke", [row]);
const ackMs = Math.round(performance.now() - t0);
console.log(JSON.stringify(ack), `ack_ms=${ackMs}`, `run_id=${runId}`);
let found: Record<string, unknown>[] = [];
const t1 = performance.now();
for (let i = 0; i < 20 && found.length === 0; i++) {
  found = await client.query(selectSmoke(runId));
  if (!found.length) await new Promise((r) => setTimeout(r, 250));
}
const visMs = Math.round(performance.now() - t1);
if (!found.length) { console.error(`row not visible after ${visMs} ms`); process.exit(1); }
console.log(`visible_ms=${visMs}`, JSON.stringify(found[0]));
