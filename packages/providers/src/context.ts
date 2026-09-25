// Context composer (WP C.4): the working context is RE-RENDERED FROM STATE on every call, never appended.
// Pinned (never evictable): every constraint, every unresolved commitment (intent|unknown), the plan frontier.
// Unpinned (capped at MAX_UNPINNED_ITEMS): confirmed receipt stubs, active/stale facts the remaining plan
// depends on, and caller-supplied evidence stubs (e.g. the superseded epoch-1 observation) until evicted.
import {
  ContextCapacity, countTokens, decodeValue,
  type BaseRow, type ComposerState, type ContextComposer, type ContextItem, type ContextOpRow, type ContextOpsProposal,
  type Projection, type RenderedContext,
} from "@dr/shared";

export const MAX_UNPINNED_ITEMS = 8;
export const UNRESOLVED_COMMITMENT = new Set(["intent", "unknown"]);

/** Evidence ids must not collide with live fact ids: use `obs:<task_id>` or `fact:<key>@<version>`. */
export type EvidenceItem = { id: string; text: string };

/** Items a curator may propose to evict: unpinned evidence/transcript stubs (not receipts, not live `fact:<key>` items). */
export const isEvictable = (i: ContextItem): boolean =>
  !i.pinned && i.class !== "receipt" && !(i.class === "fact" && /^fact:[^@]+$/.test(i.id));
export type ComposerStateX = ComposerState & {
  /** Extra evictable evidence stubs (e.g. `obs:<task_id>`, `fact:site-A.status@<observed_at>`). */
  evidence?: EvidenceItem[];
  /** Naive arm only: transcript lines appended verbatim (this is what makes its tokens grow). */
  transcript?: string[];
  /** If set, render throws ContextCapacity when the pinned-only render exceeds it (C04). */
  budget?: number;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const safeDecode = (s: string): unknown => { try { return decodeValue(s); } catch { return s; } };
const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

function pendingSteps(p: Projection) {
  return Object.values(p.plan_steps).filter((s) => s.status !== "done").sort((a, b) => a.step_id.localeCompare(b.step_id));
}

/** Every item the state could show, before eviction and cap. Deterministic order. */
export function candidateItems(state: ComposerStateX): ContextItem[] {
  const p = state.projection;
  const items: ContextItem[] = [];
  for (const c of Object.values(p.constraints).sort((a, b) => a.key.localeCompare(b.key))) {
    items.push({ id: `constraint:${c.key}`, class: "constraint", pinned: true, text: `${c.key} = ${fmt(safeDecode(c.value))} (user, v${c.version})` });
  }
  for (const c of Object.values(p.commitments).sort((a, b) => a.action_key.localeCompare(b.action_key))) {
    if (!UNRESOLVED_COMMITMENT.has(c.status)) continue;
    items.push({ id: `commitment:${c.action_key}`, class: "commitment", pinned: true, text: `${c.kind} ${c.slot} ${c.resource} ${c.date} party ${c.party} status=${c.status.toUpperCase()} (unresolved; reconcile by action_key before any retry)` });
  }
  const steps = pendingSteps(p);
  const frontier = steps.length
    ? steps.map((s) => `${s.step_id}:${s.status}${s.resource ? `(${s.resource})` : ""}`).join(", ")
    : "all steps done";
  items.push({ id: "plan:frontier", class: "plan", pinned: true, text: `current step ${state.step}; remaining ${frontier}` });

  for (const r of Object.values(p.receipts).sort((a, b) => a.receipt_id.localeCompare(b.receipt_id))) {
    if (r.outcome !== "committed") continue;
    items.push({ id: `receipt:${r.receipt_id}`, class: "receipt", pinned: false, text: `${r.slot} ${r.resource} committed ${money(r.amount)}${r.recovered ? " RECOVERED FROM DESK" : ""}` });
  }
  const deps = new Set(steps.flatMap((s) => s.depends_on));
  for (const f of Object.values(p.facts).sort((a, b) => a.key.localeCompare(b.key))) {
    if (!deps.has(f.key)) continue;
    if (f.status !== "active" && f.status !== "stale") continue; // superseded/conflict rows are dropped (they stay in RawTree)
    items.push({ id: `fact:${f.key}`, class: "fact", pinned: false, text: `${f.key} = ${fmt(safeDecode(f.value))} observed ${f.observed_at}${f.status === "stale" ? " STALE (revalidate before use)" : ""}${f.nimble_request_id ? ` task ${f.nimble_request_id}` : ""}` });
  }
  for (const e of state.evidence ?? []) {
    if (/^fact:[^@]+$/.test(e.id)) throw new Error(`evidence id ${e.id} collides with live fact ids; use fact:<key>@<version> or obs:<task_id>`);
  }
  for (const e of state.evidence ?? []) items.push({ id: e.id, class: "fact", pinned: false, text: e.text });
  (state.transcript ?? []).forEach((line, i) => items.push({ id: `transcript:${i}`, class: "transcript", pinned: false, text: line }));
  return items;
}

const INSTRUCTIONS = "Working context for Dead Reckoning (re-rendered from durable state; pinned items are user constraints and unresolved commitments and can never be dropped).";

function toText(step: string, items: ContextItem[]): string {
  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);
  const lines = [INSTRUCTIONS, `## Pinned (${pinned.length})`, ...pinned.map((i) => `[${i.id}] ${i.text}`), `## Items (${rest.length})`, ...rest.map((i) => `[${i.id}] ${i.text}`)];
  return lines.join("\n");
}

export function renderWorkingContext(state: ComposerStateX): RenderedContext {
  const evicted = new Set(state.evicted ?? []);
  const all = candidateItems(state);
  const pinned = all.filter((i) => i.pinned);
  const transcript = all.filter((i) => i.class === "transcript");
  const unpinned = all.filter((i) => !i.pinned && i.class !== "transcript" && !evicted.has(i.id)).slice(0, MAX_UNPINNED_ITEMS);
  if (state.budget !== undefined) {
    const pinnedTokens = countTokens(toText(state.step, pinned)).count;
    if (pinnedTokens > state.budget) {
      throw new ContextCapacity(`pinned context ${pinnedTokens} tokens exceeds budget ${state.budget}; constraints and unresolved commitments cannot be evicted`);
    }
  }
  const items = [...pinned, ...unpinned, ...transcript];
  const text = toText(state.step, items);
  return { text, tokens: countTokens(text), items };
}

export type ContextOpsValidation = { accepted: string[]; kept: string[]; rejected: { id: string; op: "evict" | "keep"; reason: string }[] };

/** Code validator for curator proposals (C01/C02). */
export function validateContextOps(state: ComposerStateX, proposal: ContextOpsProposal, rendered = renderWorkingContext(state)): ContextOpsValidation {
  const byId = new Map(rendered.items.map((i) => [i.id, i]));
  const out: ContextOpsValidation = { accepted: [], kept: [], rejected: [] };
  for (const id of new Set(proposal.evict ?? [])) {
    const item = byId.get(id);
    if (!item) { out.rejected.push({ id, op: "evict", reason: "unknown_item (not in current context; invented ids are rejected)" }); continue; }
    if (id.startsWith("constraint:") || item.class === "constraint") { out.rejected.push({ id, op: "evict", reason: "constraint_pinned" }); continue; }
    if (item.class === "commitment") {
      const c = state.projection.commitments[id.slice("commitment:".length)];
      if (!c || UNRESOLVED_COMMITMENT.has(c.status)) { out.rejected.push({ id, op: "evict", reason: "unresolved_commitment_pinned" }); continue; }
    }
    if (item.pinned) { out.rejected.push({ id, op: "evict", reason: "pinned" }); continue; }
    if (item.class === "receipt") { out.rejected.push({ id, op: "evict", reason: "receipt_protected" }); continue; }
    if (item.class === "fact" && id.startsWith("fact:") && state.projection.facts[id.slice(5)]) {
      out.rejected.push({ id, op: "evict", reason: "live_dependency_protected (revalidate or supersede instead)" }); continue;
    }
    out.accepted.push(id);
  }
  for (const id of new Set(proposal.keep ?? [])) {
    if (!byId.has(id)) out.rejected.push({ id, op: "keep", reason: "unknown_item" });
    else if (!out.accepted.includes(id)) out.kept.push(id);
  }
  return out;
}

export type ApplyResult = { rendered: RenderedContext; accepted: string[]; rejected: { id: string; reason: string }[]; evicted: string[]; before: string[]; after: string[] };

export function applyContextOps(state: ComposerStateX, proposal: ContextOpsProposal): ApplyResult {
  const beforeR = renderWorkingContext(state);
  const v = validateContextOps(state, proposal, beforeR);
  const evicted = [...new Set([...(state.evicted ?? []), ...v.accepted])];
  const rendered = renderWorkingContext({ ...state, evicted });
  return {
    rendered, accepted: v.accepted, rejected: v.rejected.map(({ id, reason }) => ({ id, reason })), evicted,
    before: beforeR.items.map((i) => i.id), after: rendered.items.map((i) => i.id),
  };
}

export type ContextOpBody = Omit<ContextOpRow, keyof BaseRow>;
/** context_ops row bodies (caller adds run_id/ts/epoch/arm; control assigns rev). */
export function contextOpRows(step: string, proposal: ContextOpsProposal, res: ApplyResult): ContextOpBody[] {
  const common = { step, proposed_by: proposal.proposed_by, decision: null, promoted_by: null, curator_ms: null, items_before: res.before, items_after: res.after };
  return [
    ...res.accepted.map((id) => ({ ...common, op: "evict" as const, key: id, reason: proposal.reason, accepted: true })),
    ...res.rejected.map((r) => ({ ...common, op: "evict" as const, key: r.id, reason: `rejected by validator: ${r.reason}`, accepted: false })),
  ];
}

/** Rule proposer (labelled proposed_by:"rule" — a fallback, never counted as a Liquid edit). */
export function ruleProposeContextOps(rendered: RenderedContext): ContextOpsProposal {
  const evict = rendered.items.filter((i) => !i.pinned && (i.id.startsWith("obs:") || /@|superseded/i.test(i.id))).map((i) => i.id);
  return { evict, keep: [], reason: "rule: drop superseded evidence and raw observation stubs", proposed_by: "rule" };
}

export class Composer implements ContextComposer {
  render(state: ComposerStateX): RenderedContext { return renderWorkingContext(state); }
  applyContextOps(state: ComposerStateX, proposal: ContextOpsProposal) { return applyContextOps(state, proposal); }
}
