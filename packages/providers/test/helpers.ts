import {
  F3, encodeValue, renderStatusPage, type CommitmentRow, type ConstraintRow, type FactRow, type PlanStepRow, type Projection, type ReceiptRow, type StatusPageModel,
} from "@dr/shared";

export const RUN = "f3-20260925-abcd";
const base = (rev: number, epoch = 1) => ({ run_id: RUN, ts: `2026-09-25T19:00:${String(rev).padStart(2, "0")}Z`, epoch, rev, arm: "dr" as const });

export function fact(key: string, value: unknown, observed_at: string, over: Partial<FactRow> = {}): FactRow {
  return {
    ...base(10), key, value: encodeValue(value), source_url: "http://127.0.0.1:4402/status.html", observed_at, valid_until: null,
    volatile: key.endsWith(".status"), trust: "extract", status: "active", superseded_by: null, excerpt: null, nimble_request_id: "task-epoch1", world_version: 1, ...over,
  };
}

export function f3Projection(opts: { ferry?: "intent" | "confirmed"; siteA?: "open" | "closed"; siteAStatus?: FactRow["status"] } = {}): Projection {
  const constraints: Record<string, ConstraintRow> = {};
  F3.constraints.forEach((c, i) => { constraints[c.key] = { ...base(i + 1), key: c.key, value: encodeValue(c.value), authority: "user", private: false, version: 1 }; });
  const ferryKey = "a".repeat(64);
  const commitments: Record<string, CommitmentRow> = {
    [ferryKey]: { ...base(6), action_key: ferryKey, kind: "book", slot: "ferry", resource: "ferry-tiburon-1009", date: "2026-10-09", party: 2, args_hash: "h", status: opts.ferry ?? "intent", receipt_id: opts.ferry === "confirmed" ? "rcpt-ferry-1" : null, reversible: false, compensates: null, reason: null },
  };
  const receipts: Record<string, ReceiptRow> = {};
  if (opts.ferry === "confirmed") {
    receipts["rcpt-ferry-1"] = { ...base(7, 2), action_key: ferryKey, receipt_id: "rcpt-ferry-1", slot: "ferry", resource: "ferry-tiburon-1009", outcome: "committed", reject_reason: null, service_ts: "2026-09-25T19:00:00Z", amount: 12000, recovered: true };
  }
  const plan_steps: Record<string, PlanStepRow> = {};
  F3.plan.forEach((s, i) => {
    plan_steps[s.step_id] = { ...base(20 + i), step_id: s.step_id, slot: s.slot, resource: s.resource, depends_on: s.depends_on, commitment_key: null, status: s.step_id === "ferry" && opts.ferry === "confirmed" ? "done" : s.step_id === "campsite" ? "needs_repair" : "pending", reason: null };
  });
  const facts: Record<string, FactRow> = {
    "site-A.status": fact("site-A.status", opts.siteA ?? "open", "2026-09-25T19:00:00.000Z", { status: opts.siteAStatus ?? "active" }),
    "site-A.accessible": fact("site-A.accessible", true, "2026-09-25T19:00:00.000Z"),
  };
  return {
    run_id: RUN, arm: "dr", epoch: 2, rev: 30, constraints, facts, commitments, receipts, plan_steps, epochs: [], context_ops: [], metrics: [],
    rows_loaded: { epochs: 0, constraints: 4, facts: 2, commitments: 1, receipts: 0, plan_steps: 4, context_ops: 0, metrics: 0 },
  };
}

export function statusModel(worldVersion: number, siteAStatus: "open" | "closed"): StatusPageModel {
  return {
    park_name: "Angel Island State Park", world_version: worldVersion, updated_at: "2026-10-08T09:00:00-07:00",
    sites: [
      { id: "A", status: siteAStatus, accessible: true, price_dollars: 80, notice: siteAStatus === "closed" ? "Storm damage" : "" },
      { id: "B", status: "open", accessible: false, price_dollars: 60, notice: "" },
      { id: "C", status: "open", accessible: true, price_dollars: 90, notice: "" },
    ],
  };
}
export const statusHtml = (v: number, a: "open" | "closed") => renderStatusPage(statusModel(v, a));

/** Fake fetch: queue of responders; records calls (url + parsed body). */
export function fakeFetch(responders: Array<(url: string, body: any) => { status?: number; json?: unknown; text?: string }>) {
  const calls: { url: string; body: any; headers: Record<string, string> }[] = [];
  const f = async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = responders[Math.min(calls.length - 1, responders.length - 1)]!(url, body);
    const text = r.text ?? JSON.stringify(r.json);
    return new Response(text, { status: r.status ?? 200 });
  };
  return { f, calls };
}
