// Liquid curator (WP C.2). The local LFM2.5 model PROPOSES; code validates.
// Rule in the system prompt: a strictly later observation of the same key SUPERSEDES; conflict only for
// same-time disagreement. Known live issue: the 1.2B model sometimes answers "conflict" for old-open vs
// newer-closed, so validateCuratorDecision promotes conflict→superseded when obs.observed_at is strictly
// later (promoted_by:"validator"). Curator inputs are parsed fields only, never raw Nimble markdown.
import { z } from "zod";
import {
  DrError, decodeValue,
  type BaseRow, type CompareResult, type ContextOpsProposal, type Curator, type CuratorDecision,
  type FactRow, type MetricRow, type RenderedContext,
} from "@dr/shared";
import { isEvictable, type ContextOpBody } from "./context.ts";
import { percentile, postJson, snippet, type FetchLike } from "./http.ts";

export const CURATOR_SYSTEM_PROMPT = [
  "You are a fact curator for a trip-planning agent. You compare an OLD fact with a NEW observation of the SAME key and reply only with JSON.",
  "Rules:",
  "1. If the values are equal, decision = unchanged.",
  "2. A newer observation of the same key with a strictly later observed_at SUPERSEDES the old fact: decision = superseded and new_value = the new observation's value.",
  "3. Answer conflict only when observed_at is equal and values differ.",
  "Decision table (check in this order): values EQUAL -> unchanged. values DIFFERENT and new observed_at LATER -> superseded. values DIFFERENT and observed_at EQUAL -> conflict.",
  "Echo the key exactly. Keep reason under 20 words.",
].join("\n");

export const CONTEXT_SYSTEM_PROMPT = [
  "You manage the working context of a trip planner. Reply only with JSON.",
  "Pinned items (constraints, unresolved commitments, plan frontier) must never be evicted.",
  "Propose evicting items that are superseded, stale evidence, or raw observation stubs no longer needed for the current step.",
  "Keep receipts and active facts the current step depends on.",
].join("\n");

export const CompareSchema = z.object({
  key: z.string(),
  decision: z.enum(["unchanged", "superseded", "conflict"]),
  new_value: z.string(),
  reason: z.string(),
});
const COMPARE_JSON_SCHEMA = {
  type: "object",
  properties: {
    key: { type: "string" },
    decision: { type: "string", enum: ["unchanged", "superseded", "conflict"] },
    new_value: { type: "string" },
    reason: { type: "string" },
  },
  required: ["key", "decision", "new_value", "reason"],
  additionalProperties: false,
};

export type ObservedValue = { key: string; value: unknown; observed_at: string; task_id?: string };
export type CuratorValidation = Omit<CompareResult, "curator_ms" | "raw">;
export type CompareResultX = CompareResult & { key: string; model_decision?: CuratorDecision };

/** Default scope: the F3 status-page keys. */
export const DEFAULT_KEY_SCOPE = /^site-[ABC]\.(status|accessible|price|notice)$/;

/** RawTree normalizes ISO to "YYYY-MM-DD HH:MM:SS" (UTC); treat that form as UTC, not local time. */
export function parseObservedAt(s: string): number {
  const t = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s) ? `${s.replace(" ", "T")}Z` : s;
  return Date.parse(t);
}
const norm = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v)).trim().toLowerCase();
const decodeFact = (s: string): unknown => { try { return decodeValue(s); } catch { return s; } };
function mentions(modelValue: string, observed: unknown): boolean {
  const m = norm(modelValue).replace(/^"|"$/g, "");
  const o = norm(observed).replace(/^"|"$/g, "");
  if (m === o) return true;
  return new RegExp(`(^|[^a-z0-9])${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(m);
}

/**
 * Code validator for a curator decision (F03). Same key only; schema; key scope; observed_at sanity;
 * promotion conflict→superseded when the new observation is strictly later. new_value is always the
 * OBSERVED value (the model can never author a value).
 */
export function validateCuratorDecision(old: FactRow, obs: ObservedValue, raw: unknown, opts: { keyScope?: RegExp } = {}): CuratorValidation & { model_decision?: CuratorDecision } {
  const reject = (reason: string, decision: CuratorDecision = "conflict", model_decision?: CuratorDecision): CuratorValidation & { model_decision?: CuratorDecision } =>
    ({ decision, new_value: obs.value, reason, accepted: false, reject_reason: reason, model_decision });
  if (obs.key !== old.key) return reject(`key_mismatch: observation ${obs.key} vs fact ${old.key}`);
  const parsed = CompareSchema.safeParse(raw);
  if (!parsed.success) return reject("schema_invalid");
  const m = parsed.data;
  if (m.key.trim() !== old.key) return reject(`key_mismatch: model answered for ${m.key}`, m.decision, m.decision);
  if (!(opts.keyScope ?? DEFAULT_KEY_SCOPE).test(old.key)) return reject(`out_of_scope: ${old.key}`, m.decision, m.decision);
  const tOld = parseObservedAt(old.observed_at);
  const tNew = parseObservedAt(obs.observed_at);
  if (!Number.isFinite(tOld) || !Number.isFinite(tNew)) return reject("bad_observed_at", m.decision, m.decision);
  const same = norm(decodeFact(old.value)) === norm(obs.value);
  const later = tNew > tOld;
  const ok = (decision: CuratorDecision, reason: string, promoted = false) => ({
    decision, new_value: obs.value, reason, accepted: true, model_decision: m.decision, ...(promoted ? { promoted_by: "validator" as const } : {}),
  });
  switch (m.decision) {
    case "unchanged":
      return same ? ok("unchanged", m.reason) : reject("values_differ: model said unchanged", m.decision, m.decision);
    case "superseded":
      if (same) return reject("no_change: values equal", m.decision, m.decision);
      if (!later) return reject("not_later: observation is not strictly newer", m.decision, m.decision);
      if (!mentions(m.new_value, obs.value)) return reject("value_not_observed: model new_value differs from observation", m.decision, m.decision);
      return ok("superseded", m.reason);
    case "conflict":
      if (same) return reject("no_change: values equal", m.decision, m.decision);
      if (later) return ok("superseded", `promoted conflict→superseded: new observed_at strictly later (${m.reason})`, true);
      if (tNew === tOld) return ok("conflict", m.reason);
      return reject("older_observation", m.decision, m.decision);
  }
}

/** context_ops row body for a compare (accepted or rejected). */
export function compareOpRow(step: string, r: CompareResultX): ContextOpBody {
  return {
    step, op: "compare", key: r.key, reason: r.accepted ? r.reason : `rejected by validator: ${r.reject_reason}`,
    proposed_by: "liquid", accepted: r.accepted, decision: r.decision, promoted_by: r.promoted_by ?? null,
    curator_ms: r.curator_ms, items_before: null, items_after: null,
  };
}

export type LiquidOptions = { baseUrl?: string; model?: string; fetchImpl?: FetchLike; timeoutMs?: number; keyScope?: RegExp };

export class LiquidCurator implements Curator {
  readonly timings: number[] = [];
  private base: string;
  private model: string;
  private f: FetchLike;
  constructor(private opts: LiquidOptions = {}) {
    this.base = (opts.baseUrl ?? "http://127.0.0.1:8081/v1").replace(/\/$/, "");
    this.model = opts.model ?? "LiquidAI/LFM2.5-1.2B-Instruct-GGUF";
    this.f = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  }

  private async chat(system: string, user: string, name: string, schema: object, maxTokens: number): Promise<{ raw: unknown; ms: number; content: string }> {
    const t0 = Date.now();
    let r;
    try {
      r = await postJson(this.f, "liquid", `${this.base}/chat/completions`, {
        model: this.model, temperature: 0.1, max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name, schema } },
      }, { timeoutMs: this.opts.timeoutMs ?? 30_000 });
    } catch (e) {
      throw new DrError("CURATOR_UNAVAILABLE", `liquid unreachable: ${(e as Error).name}`, true);
    }
    const ms = Date.now() - t0;
    if (r.status !== 200) throw new DrError("CURATOR_UNAVAILABLE", `liquid http ${r.status}: ${snippet(r.text, 120)}`, true);
    const content: string = r.json?.choices?.[0]?.message?.content ?? "";
    let raw: unknown = null;
    try { raw = JSON.parse(content); } catch { raw = { unparseable: snippet(content, 200) }; }
    return { raw, ms, content };
  }

  async compareFact(old: FactRow, obs: ObservedValue): Promise<CompareResultX> {
    if (obs.key !== old.key) {
      const v = validateCuratorDecision(old, obs, null, this.opts);
      return { ...v, key: old.key, curator_ms: 0, raw: null };
    }
    const tOld = parseObservedAt(old.observed_at);
    const tNew = parseObservedAt(obs.observed_at);
    const order = !Number.isFinite(tOld) || !Number.isFinite(tNew) ? "unknown" : tNew > tOld ? "LATER than" : tNew === tOld ? "EQUAL to" : "EARLIER than";
    const user = [
      `key: ${old.key}`,
      `old_fact: ${JSON.stringify({ value: decodeFact(old.value), observed_at: old.observed_at })}`,
      `new_observation: ${JSON.stringify({ value: obs.value, observed_at: obs.observed_at })}`,
      `new observed_at is ${order} old observed_at.`,
      `values are ${norm(decodeFact(old.value)) === norm(obs.value) ? "EQUAL" : "DIFFERENT"}.`,
      "Decide.",
    ].join("\n");
    const { raw, ms } = await this.chat(CURATOR_SYSTEM_PROMPT, user, "curate", COMPARE_JSON_SCHEMA, 120);
    this.timings.push(ms);
    const v = validateCuratorDecision(old, obs, raw, this.opts);
    return { ...v, key: old.key, curator_ms: ms, raw };
  }

  /** Liquid proposes evict/keep over the CURRENT item ids (grammar-constrained to existing ids). Validate with validateContextOps. */
  async proposeContextOps(rendered: RenderedContext, step = ""): Promise<ContextOpsProposal & { curator_ms: number; raw: unknown }> {
    const ids = rendered.items.map((i) => i.id);
    const evictable = rendered.items.filter(isEvictable).map((i) => i.id);
    if (evictable.length === 0) {
      return { evict: [], keep: [], reason: "no evictable items; Liquid not called", proposed_by: "rule", curator_ms: 0, raw: null };
    }
    const schema = {
      type: "object",
      properties: {
        evict: { type: "array", items: { type: "string", enum: evictable } },
        keep: { type: "array", items: { type: "string", enum: ids } },
        reason: { type: "string" },
      },
      required: ["evict", "keep", "reason"],
      additionalProperties: false,
    };
    const list = rendered.items.map((i) => `${i.id} | ${i.class} | ${i.pinned ? "PINNED" : isEvictable(i) ? "evictable" : "protected"} | ${i.text.slice(0, 110)}`).join("\n");
    const user = `current step: ${step || "(unspecified)"}\nitems (id | class | pinned | text):\n${list}\nPropose evictions.`;
    const { raw, ms } = await this.chat(CONTEXT_SYSTEM_PROMPT, user, "context_ops", schema, 200);
    this.timings.push(ms);
    const p = z.object({ evict: z.array(z.string()), keep: z.array(z.string()), reason: z.string() }).safeParse(raw);
    if (!p.success) return { evict: [], keep: [], reason: "liquid proposal failed schema; nothing applied", proposed_by: "liquid", curator_ms: ms, raw };
    return { evict: [...new Set(p.data.evict)], keep: [...new Set(p.data.keep)], reason: p.data.reason, proposed_by: "liquid", curator_ms: ms, raw };
  }

  latencyStats(): { n: number; p50: number; p95: number } {
    return { n: this.timings.length, p50: percentile(this.timings, 50), p95: percentile(this.timings, 95) };
  }
}

export type MetricBody = Omit<MetricRow, keyof BaseRow>;
/** One metrics-shaped row per curator call (phase "curator"; context_tokens 0 — filter by phase when charting tokens). */
export function curatorMetricRows(step: string, timings: number[]): MetricBody[] {
  return timings.map((ms) => ({ step, phase: "curator", context_tokens: 0, planner_tokens_in: 0, curator_ms: ms, nimble_ms: 0, duplicate_effects: 0, stale_actions: 0 }));
}
