// OpenAI Responses planner (WP C.3). Bounded action set {book, cancel, keep, block}; strict json_schema.
// Candidates are filtered IN CODE (dates, party, budget, accessible, open) before the call; the model only
// sees valid candidates (its `resource` is grammar-constrained to them) and its book is re-validated on return.
import {
  ContextCapacity, DrError, InvariantViolation, Slot, countTokens,
  type Candidate, type Planner, type PlannerDecision, type Projection, type RenderedContext, type TokenCount,
} from "@dr/shared";
import { postJson, snippet, type FetchLike } from "./http.ts";

export type TripConstraints = { start: string; end: string; party: number; budget_cents: number; accessible_required: boolean };
export type CandidateX = Candidate & { date?: string; capacity?: number };
export type RejectedCandidate = { resource: string; reason: "wrong_slot" | "closed" | "not_accessible" | "over_budget" | "outside_dates" | "party_exceeds_capacity" };
export type PlannerContext = { constraints: TripConstraints; spent_cents: number; known_action_keys?: string[] };
export type PlannerDecisionX = PlannerDecision & {
  rejected_candidates: RejectedCandidate[];
  valid_candidates: string[];
  validator: { ok: boolean; reason: string };
  model_action: PlannerDecision["action"];
  response_id: string | null;
  planner_ms: number;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null;
};

const SLOT_NAMES = new Set<string>(Slot.options);
const decode = (s: string): unknown => { try { return JSON.parse(s); } catch { return s; } };

export function constraintsFromProjection(p: Projection): TripConstraints {
  const get = (k: string) => { const r = p.constraints[k]; return r ? decode(r.value) : undefined; };
  return toTrip({ dates: get("dates"), party_size: get("party_size"), budget_cents: get("budget_cents"), accessible_required: get("accessible_required") });
}
function toTrip(raw: Record<string, unknown>): TripConstraints {
  const d = raw.dates as { start?: string; end?: string } | undefined;
  const t = { start: d?.start, end: d?.end, party: Number(raw.party_size), budget_cents: Number(raw.budget_cents), accessible_required: raw.accessible_required === true };
  if (!t.start || !t.end || !Number.isFinite(t.party) || !Number.isFinite(t.budget_cents) || raw.accessible_required === undefined) {
    throw new InvariantViolation(3, "constraints unavailable for candidate filter (dates, party_size, budget_cents, accessible_required)");
  }
  return t as TripConstraints;
}

/** Sum of distinct committed receipts, excluding the slot being (re)planned. */
export function spentCents(p: Projection, excludeSlot?: string): number {
  return Object.values(p.receipts).filter((r) => r.outcome === "committed" && r.slot !== excludeSlot).reduce((a, r) => a + r.amount, 0);
}

/** Recover constraints/spend from the rendered context's items (used when decide() gets no PlannerContext). */
export function plannerContextFromRendered(rendered: RenderedContext, step: string): PlannerContext {
  const raw: Record<string, unknown> = {};
  for (const i of rendered.items) {
    if (i.class !== "constraint") continue;
    const m = /^(\w+) = (.*) \(user, v\d+\)$/.exec(i.text);
    if (m) raw[m[1]!] = decode(m[2]!);
  }
  let spent = 0;
  const keys: string[] = [];
  for (const i of rendered.items) {
    if (i.class === "receipt" && !i.text.startsWith(`${step} `)) {
      const m = /committed \$(\d+(?:\.\d+)?)/.exec(i.text);
      if (m) spent += Math.round(Number(m[1]) * 100);
    }
    if (i.class === "commitment") keys.push(i.id.slice("commitment:".length));
  }
  return { constraints: toTrip(raw), spent_cents: spent, known_action_keys: keys };
}

export function filterCandidates(cands: CandidateX[], ctx: PlannerContext, slot?: string): { valid: CandidateX[]; rejected: RejectedCandidate[] } {
  const valid: CandidateX[] = [];
  const rejected: RejectedCandidate[] = [];
  const remaining = ctx.constraints.budget_cents - ctx.spent_cents;
  for (const c of cands) {
    let reason: RejectedCandidate["reason"] | null = null;
    if (slot && SLOT_NAMES.has(slot) && c.slot !== slot) reason = "wrong_slot";
    else if (c.status !== "open") reason = "closed";
    else if (ctx.constraints.accessible_required && c.accessible !== true) reason = "not_accessible";
    else if (c.price_cents > remaining) reason = "over_budget";
    else if (c.date && (c.date < ctx.constraints.start || c.date > ctx.constraints.end)) reason = "outside_dates";
    else if (c.capacity !== undefined && c.capacity < ctx.constraints.party) reason = "party_exceeds_capacity";
    if (reason) rejected.push({ resource: c.resource, reason });
    else valid.push(c);
  }
  return { valid, rejected };
}

export const PLANNER_INSTRUCTIONS = [
  "You are the Dead Reckoning trip planner. Choose exactly one action for the affected step, using only the working context and the candidate list.",
  "Candidates were already filtered by code against the user's constraints (dates, party, budget, accessibility, open status).",
  "book: reserve one listed candidate (resource = its id). keep: an existing receipt for this step already satisfies it (resource = null).",
  "cancel: cancel an existing unresolved commitment (action_key = its key from the context). block: no valid candidate; say why.",
  "Never invent resources, receipts or action keys. Prefer the cheapest valid candidate unless the context says otherwise.",
].join("\n");

export function plannerSchema(validIds: string[]) {
  return {
    type: "object",
    properties: {
      action: { type: "string", enum: ["book", "cancel", "keep", "block"] },
      resource: { type: ["string", "null"], enum: [...validIds, null] },
      action_key: { type: ["string", "null"] },
      reason: { type: "string" },
    },
    required: ["action", "resource", "action_key", "reason"],
    additionalProperties: false,
  };
}

export function buildPlannerRequest(rendered: RenderedContext, step: string, valid: CandidateX[]) {
  const lines = valid.map((c) => `- ${c.resource} (${c.slot}) $${(c.price_cents / 100).toFixed(2)} accessible=${c.accessible ? "yes" : "no"} status=${c.status}${c.date ? ` date=${c.date}` : ""}`);
  const input = `${rendered.text}\n\n## Affected step\n${step}\n\n## Candidates (pre-filtered by code)\n${lines.length ? lines.join("\n") : "(none — no candidate satisfies the constraints)"}`;
  const schema = plannerSchema(valid.map((c) => c.resource));
  const counted = `${PLANNER_INSTRUCTIONS}\n${input}\n${JSON.stringify(schema)}`;
  return { instructions: PLANNER_INSTRUCTIONS, input, schema, counted, context_tokens: countTokens(counted) as TokenCount };
}

export type ModelDecision = { action: PlannerDecision["action"]; resource: string | null; action_key: string | null; reason: string };
export function parseModelDecision(raw: unknown): ModelDecision {
  const r = raw as Partial<ModelDecision> | null;
  const actions = ["book", "cancel", "keep", "block"];
  if (!r || typeof r !== "object" || !actions.includes(r.action as string) || typeof r.reason !== "string") {
    throw new DrError("PLANNER_SCHEMA", "planner output failed schema");
  }
  return { action: r.action!, resource: r.resource ?? null, action_key: r.action_key ?? null, reason: r.reason };
}

/** Re-validation of the model's decision against the code-filtered candidates (invariants 3/4 hooks). */
export function validatePlannerDecision(d: ModelDecision, valid: CandidateX[], ctx: PlannerContext): { ok: boolean; reason: string } {
  if (d.action === "book") {
    if (!d.resource) return { ok: false, reason: "book without resource" };
    const c = valid.find((v) => v.resource === d.resource);
    if (!c) return { ok: false, reason: `book of ${d.resource} not among code-validated candidates` };
    return { ok: true, reason: "book validated against filtered candidates" };
  }
  if (d.action === "cancel") {
    if (!d.action_key || !(ctx.known_action_keys ?? []).includes(d.action_key)) return { ok: false, reason: "cancel with unknown action_key" };
    return { ok: true, reason: "cancel of a known commitment" };
  }
  return { ok: true, reason: `${d.action} accepted` };
}

export type PlannerOptions = { apiKey: string; model: string; budget: number; baseUrl?: string; fetchImpl?: FetchLike; timeoutMs?: number; reasoningEffort?: "minimal" | "low" | "medium" | "high" };

function outputText(j: any): string {
  if (typeof j?.output_text === "string") return j.output_text;
  for (const item of j?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const c of item.content ?? []) if (c?.type === "output_text" && typeof c.text === "string") return c.text;
  }
  return "";
}

export class OpenAIPlanner implements Planner {
  private f: FetchLike;
  private base: string;
  constructor(private opts: PlannerOptions) {
    if (!opts.model) throw new Error("OpenAIPlanner: model required (no silent substitution)");
    this.f = opts.fetchImpl ?? ((u, i) => fetch(u, i));
    this.base = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  async decide(rendered: RenderedContext, step: string, candidates: CandidateX[], ctx?: PlannerContext): Promise<PlannerDecisionX> {
    const pctx = ctx ?? plannerContextFromRendered(rendered, step);
    const { valid, rejected } = filterCandidates(candidates, pctx, step);
    const req = buildPlannerRequest(rendered, step, valid);
    if (req.context_tokens.count > this.opts.budget) {
      throw new ContextCapacity(`planner input ${req.context_tokens.count} tokens > budget ${this.opts.budget}; not sent`);
    }
    const t0 = Date.now();
    const body: Record<string, unknown> = {
      model: this.opts.model, store: false, instructions: req.instructions, input: req.input,
      text: { format: { type: "json_schema", name: "dr_decision", strict: true, schema: req.schema } },
    };
    if (this.opts.reasoningEffort) body.reasoning = { effort: this.opts.reasoningEffort };
    let r;
    try {
      r = await postJson(this.f, "openai", `${this.base}/responses`, body, { headers: { Authorization: `Bearer ${this.opts.apiKey}` }, timeoutMs: this.opts.timeoutMs ?? 90_000 });
    } catch (e) {
      throw new DrError("PLANNER_UNAVAILABLE", `planner transport error: ${(e as Error).name}`, true);
    }
    const planner_ms = Date.now() - t0;
    if (r.status !== 200) throw new DrError("PLANNER_UNAVAILABLE", `planner http ${r.status}: ${snippet(String(r.json?.error?.message ?? r.text), 160)}`, r.status >= 500 || r.status === 429);
    const text = outputText(r.json);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new DrError("PLANNER_SCHEMA", "planner output not JSON"); }
    const d = parseModelDecision(raw);
    const v = validatePlannerDecision(d, valid, pctx);
    const usage = r.json?.usage ? { input_tokens: Number(r.json.usage.input_tokens ?? 0), output_tokens: Number(r.json.usage.output_tokens ?? 0), total_tokens: Number(r.json.usage.total_tokens ?? 0) } : null;
    const base = {
      context_tokens: req.context_tokens, planner_tokens_in: usage?.input_tokens ?? 0, rejected_candidates: rejected,
      valid_candidates: valid.map((c) => c.resource), validator: v, model_action: d.action, response_id: r.json?.id ?? null, planner_ms, usage,
    };
    if (!v.ok) return { ...base, action: "block", reason: `validator rejected planner ${d.action}: ${v.reason}` };
    return {
      ...base, action: d.action, reason: d.reason,
      ...(d.action === "book" && d.resource ? { resource: d.resource } : {}),
      ...(d.action === "cancel" && d.action_key ? { action_key: d.action_key } : {}),
    };
  }
}
