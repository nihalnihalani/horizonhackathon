// test:e2e — the mission REST path end to end against RUNNING desk + control (start them with `npm run dev:core`).
// Uses the full-plan API (POST /missions → arm-crash → resume → SIGKILL at HOLD → operator closes site A → resume)
// and checks the durable evidence: canonical mission_events in RawTree, one desk ferry effect, the same receipt
// recovered, and an honest terminal status (VALID, or BLOCKED with a reason such as curator_unavailable when the
// local Liquid server is down). Prints ids/statuses/timings only. Exit 0 = every check held.
import { randomUUID } from "node:crypto";
import { fromStoredEvent } from "@dr/shared";
import { rawTreeFromEnv } from "@dr/storage";
import { CTL, DESK, cfg, ledger, say, sleep } from "./lib.ts";

const H = { authorization: `Bearer ${cfg.DR_OPERATOR_TOKEN}`, "content-type": "application/json" };
const checks: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => { checks.push([name, ok, detail]); say(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
async function call(method: string, path: string, body?: unknown) {
  const r = await fetch(`${CTL}${path}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const snap = async (id: string) => (await call("GET", `/missions/${id}`)).body;
async function until(id: string, pred: (s: Record<string, any>) => boolean, ms: number, what: string) {
  const end = Date.now() + ms;
  for (;;) { const s = await snap(id); if (pred(s)) return s; if (Date.now() > end) throw new Error(`timeout: ${what} (status ${s.status}, worker ${s.worker?.state})`); await sleep(750); }
}

const health = await fetch(`${CTL}/health`).then((r) => r.json()).catch(() => null);
if (!health) { console.log("NOT RUN: control is not listening on 127.0.0.1:4400 (start `npm run dev:core`)"); process.exit(2); }
await fetch(`${DESK}/admin/reset`, { method: "POST", headers: H }).catch(() => undefined);

const created = await call("POST", "/missions", { commandId: `e2e-${randomUUID()}`, goal: "Angel Island accessible trip (F3)" });
check("POST /missions → 201 created, no child", created.status === 201 && created.body.status === "created", `status ${created.status}`);
const id = String(created.body.missionId);
const armed = await call("POST", `/demo/${id}/arm-crash`, { commandId: `e2e-${randomUUID()}`, point: "after_desk_commit" });
check("arm-crash after_desk_commit → 202", armed.status === 202);
const rev = (await snap(id)).revision;
const r1 = await call("POST", `/missions/${id}/resume`, { commandId: `e2e-${randomUUID()}`, expectedRevision: rev });
check("first Resume → 202", r1.status === 202, JSON.stringify(r1.body.code ?? ""));

const held = await until(id, (s) => s.worker?.state === "holding", 180_000, "HOLD after desk commit");
const pid1 = held.worker.pid as number;
const kill = await fetch(`${CTL}/demo/kill`, { method: "POST", headers: H, body: "{}" }).then((r) => r.json()) as { killed?: { pid: number; signal: string; alive_after: boolean }[] } & Record<string, any>;
const killed = (kill.killed ?? kill.results ?? []) as { pid: number; signal: string; alive_after: boolean }[];
const k = killed.find((x) => x.pid === pid1);
check("real SIGKILL of the held runner", !!k && k.signal === "SIGKILL" && !k.alive_after, `pid ${pid1}`);

const { client } = rawTreeFromEnv();
const events = (await client.query(`SELECT * FROM mission_events WHERE run_id = '${id}' ORDER BY toInt64(revision) LIMIT 5000`)).map(fromStoredEvent);
const intent = events.find((e) => e.type === "INTENT_RECORDED" && (e.payload.row as any)?.slot === "ferry");
const ferryKey = (intent?.payload.row as any)?.action_key as string | undefined;
check("RawTree mission_events holds the ferry intent + dispatch claim, no receipt", !!intent && events.some((e) => e.type === "DISPATCH_CLAIMED") && !events.some((e) => e.payload.table === "receipts" && (e.payload.row as any).action_key === ferryKey), `${events.length} events`);
const l1 = await ledger(id, "dr");
check("desk ledger: exactly one committed ferry", l1.outcomes.filter((o) => o.slot === "ferry" && o.committed).length === 1);

await fetch(`${CTL}/demo/world`, { method: "POST", headers: H, body: JSON.stringify({ site: "A", status: "closed", notice: "Storm damage (e2e)" }) });
const rev2 = (await snap(id)).revision;
const r2 = await call("POST", `/missions/${id}/resume`, { commandId: `e2e-${randomUUID()}`, expectedRevision: rev2 });
check("explicit Resume after kill → 202", r2.status === 202, JSON.stringify(r2.body.code ?? ""));
const done = await until(id, (s) => ["valid", "blocked", "failed", "cancelled"].includes(s.status) && s.worker?.state !== "running", 300_000, "terminal status");
const pid2 = done.worker.lastExit?.pid as number | undefined;
check("new PID on resume (generation 2 is a different process)", done.worker.generation === 2 && !!pid2 && pid2 > 0 && pid2 !== pid1, `pid ${pid1} → ${pid2}`);
const ferryReceipt = (done.receipts as any[]).find((x) => x.slot === "ferry");
const l2 = await ledger(id, "dr");
check("ferry receipt RECOVERED FROM DESK with the desk's receipt id", !!ferryReceipt?.recovered && ferryReceipt.receiptId === l1.outcomes.find((o) => o.slot === "ferry")?.receipt_id, ferryReceipt?.receiptId ?? "none");
check("still exactly one committed ferry at the desk", l2.outcomes.filter((o) => o.slot === "ferry" && o.committed).length === 1);
check("terminal status is VALID or BLOCKED with a reason (never silent success)", done.status === "valid" || (done.status === "blocked" && !!(done.blockedReason ?? done.verdict?.reason)), `${done.status}: ${done.blockedReason ?? done.verdict?.reason ?? ""}`);

const failed = checks.filter((c) => !c[1]);
say(`${checks.length - failed.length}/${checks.length} checks · mission ${id}`);
process.exit(failed.length ? 1 : 0);
