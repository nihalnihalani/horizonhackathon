// Terminal code validator (invariant 6), shared by BOTH arms. Input: the arm's RawTree projection plus the
// desk looked up by every action_key the run ever wrote (the desk ledger is the tie-breaker for effects).
import { F3, type DeskClient, type Projection } from "@dr/shared";

export type Verdict = {
  verdict: "VALID" | "INVALID" | "BLOCKED";
  reason: string;
  duplicate_effects: number;
  stale_actions: number;
  committed: Record<string, { receipt_id: string; resource: string; amount: number }[]>;
  total_cents: number;
  rules: string[];
};

export const VALIDATOR_RULES = [
  "INVALID if any slot has >= 2 distinct committed desk receipts (invariant 4; counted as duplicate_effects)",
  "INVALID if a committed campsite is not accessible while accessible_required=true",
  "INVALID if committed total exceeds budget_cents",
  "BLOCKED if any desk lookup is unavailable (effects unknown, never inferred)",
  "BLOCKED if any plan step is not done (reason from plan_steps)",
  "VALID otherwise",
];

export async function validateRun(p: Projection, desk: DeskClient): Promise<Verdict> {
  const committed: Verdict["committed"] = {};
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const c of Object.values(p.commitments)) {
    if (c.kind !== "book") continue;
    const r = await desk.lookup(c.action_key);
    if (r.status === "unavailable") { unknown.push(c.action_key); continue; }
    if (r.status !== "found" || !r.receipt.committed) continue;
    if (seen.has(r.receipt.receipt_id)) continue;
    seen.add(r.receipt.receipt_id);
    (committed[c.slot] ??= []).push({ receipt_id: r.receipt.receipt_id, resource: r.receipt.resource, amount: r.receipt.amount });
  }
  const duplicate_effects = Object.values(committed).reduce((a, l) => a + Math.max(0, l.length - 1), 0);
  const stale_actions = Object.values(p.receipts).filter((r) => r.outcome === "rejected" && (r.reject_reason === "closed" || r.reject_reason === "stale_version")).length;
  const total_cents = Object.values(committed).flat().reduce((a, x) => a + x.amount, 0);
  const base = { duplicate_effects, stale_actions, committed, total_cents, rules: VALIDATOR_RULES };

  const dup = Object.entries(committed).filter(([, l]) => l.length > 1);
  if (dup.length) {
    return { ...base, verdict: "INVALID", reason: `invariant 4: ${dup.map(([s, l]) => `${l.length} distinct committed ${s} receipts (${l.map((x) => x.receipt_id).join(", ")})`).join("; ")}` };
  }
  for (const c of committed.campsite ?? []) {
    const res = F3.resources.find((r) => r.id === c.resource);
    if (F3.trip.accessible_required && !res?.accessible) return { ...base, verdict: "INVALID", reason: `campsite ${c.resource} is not accessible` };
  }
  if (total_cents > F3.trip.budget_cents) return { ...base, verdict: "INVALID", reason: `total ${total_cents} > budget ${F3.trip.budget_cents}` };
  // Invariant 6: an unavailable lookup is unknown, never inferred as "no effect". INVALIDs above rest on confirmed
  // desk effects (unknown effects can only add to them), so only VALID/step-BLOCKED must wait for the desk.
  if (unknown.length) return { ...base, verdict: "BLOCKED", reason: `desk unavailable for ${unknown.length} action_key(s); effects unknown, not inferred` };
  const notDone = Object.values(p.plan_steps).filter((s) => s.status !== "done");
  if (notDone.length) return { ...base, verdict: "BLOCKED", reason: notDone.map((s) => `${s.step_id}: ${s.status} (${s.reason ?? "?"})`).join("; ") };
  return { ...base, verdict: "VALID", reason: `all ${Object.keys(p.plan_steps).length} steps done; total $${(total_cents / 100).toFixed(2)} <= $${(F3.trip.budget_cents / 100).toFixed(2)}; one receipt per slot` };
}
