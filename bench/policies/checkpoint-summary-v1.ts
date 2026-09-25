// checkpoint-summary-v1 (VALIDATION_AND_DEMO.md §6b) — the frozen primary comparator policy.
// Shares the same effect ledger/constraints/validators/receipt lookup/candidate info/freshness policy/
// input cap as DR (reuses packages/providers candidateItems for the mandatory block). Renders:
// mandatory block -> running summary (<=800 tok) -> most recent observations that fit the remaining cap
// (reverse-chronological SELECTION, chronological RENDER). When retained raw history no longer fits,
// the evicted batch + previous summary are summarized in a separate call to the SAME planner model with
// a frozen prompt, charged to baseline totals. No Liquid. Same bounded recall/evidence registry as DR.
import { createHash } from "node:crypto";
import { candidateItems, isEvictable } from "@dr/providers";
import { countTokens, type ComposerState, type Projection } from "@dr/shared";
import { recall, sha256, type EvidenceRegistry } from "../evidence.ts";
import type { M1Round } from "../fixtures/m1.ts";
import type { BenchMode, CallRecord, PromptManifestEntry } from "../types.ts";

export const COMPARATOR_VERSION = "checkpoint-summary-v1";
export const SUMMARY_CAP_TOKENS = 800;

export const FROZEN_SUMMARY_PROMPT = [
  "You are the memory summarizer for the checkpoint-summary-v1 trip-planning baseline.",
  "Summarize EVICTED_BATCH together with PREVIOUS_SUMMARY into one updated running summary of at most 800 tokens.",
  "Preserve every constraint, receipt id, and unresolved commitment id verbatim; never invent a fact, receipt, or action key.",
  "Never claim an action succeeded unless a receipt id for it appears in the input. Output plain text only, no markdown headers.",
].join("\n");
export const FROZEN_SUMMARY_PROMPT_HASH = sha256(FROZEN_SUMMARY_PROMPT);

const INSTRUCTIONS = "checkpoint-summary-v1 baseline working context (mandatory block, then running summary, then recent observations).";

function truncateToTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
  if (countTokens(text).count <= maxTokens) return { text, truncated: false };
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    if (countTokens(candidate).count <= maxTokens) lo = mid;
    else hi = mid - 1;
  }
  return { text: lo > 0 ? `${text.slice(0, lo)}…` : "", truncated: true };
}

export type SummarizeResult = { text: string; tokens_in: number; tokens_out: number; ms: number; mode: BenchMode };
export interface Summarizer {
  readonly mode: BenchMode;
  readonly modelId: string;
  summarize(evictedBatch: string, previousSummary: string): Promise<SummarizeResult>;
}

/** Deterministic frozen fallback: no network, mode:"stub". Never counts as the Liquid gate (there is no Liquid here). */
export class StubSummarizer implements Summarizer {
  readonly mode = "stub" as const;
  readonly modelId = "stub-summarizer-v1";
  async summarize(evictedBatch: string, previousSummary: string): Promise<SummarizeResult> {
    const t0 = Date.now();
    const merged = previousSummary ? `${previousSummary}\n--\nEvicted since: ${evictedBatch}` : `Evicted since start: ${evictedBatch}`;
    const { text } = truncateToTokens(merged, SUMMARY_CAP_TOKENS);
    return { text, tokens_in: countTokens(evictedBatch).count + countTokens(previousSummary).count, tokens_out: countTokens(text).count, ms: Date.now() - t0, mode: "stub" };
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Live summarizer: same planner model, frozen prompt, separate call from planning decisions. */
export class LivePlannerSummarizer implements Summarizer {
  readonly mode = "live" as const;
  private f: FetchLike;
  private base: string;
  constructor(readonly modelId: string, private apiKey: string, opts: { baseUrl?: string; fetchImpl?: FetchLike } = {}) {
    this.f = opts.fetchImpl ?? ((u, i) => fetch(u, i));
    this.base = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }
  async summarize(evictedBatch: string, previousSummary: string): Promise<SummarizeResult> {
    const input = `PREVIOUS_SUMMARY:\n${previousSummary || "(none yet)"}\n\nEVICTED_BATCH:\n${evictedBatch}`;
    const t0 = Date.now();
    const res = await this.f(`${this.base}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.modelId, store: false, instructions: FROZEN_SUMMARY_PROMPT, input, max_output_tokens: 1024 }),
      signal: AbortSignal.timeout(90_000),
    });
    const ms = Date.now() - t0;
    const json: any = await res.json().catch(() => ({}));
    if (res.status !== 200) throw new Error(`summarizer http ${res.status}`);
    let text = typeof json.output_text === "string" ? json.output_text : "";
    if (!text) for (const item of json.output ?? []) if (item?.type === "message") for (const c of item.content ?? []) if (c?.type === "output_text") text = c.text;
    const capped = truncateToTokens(text, SUMMARY_CAP_TOKENS);
    return {
      text: capped.text, tokens_in: Number(json.usage?.input_tokens ?? countTokens(input).count),
      tokens_out: Number(json.usage?.output_tokens ?? countTokens(capped.text).count), ms, mode: "live",
    };
  }
}

export type BaselineObservation = { id: string; text: string; round: number; ts: string };
export type BaselineState = { summary: string; retained: BaselineObservation[] };
export const initialBaselineState = (): BaselineState => ({ summary: "", retained: [] });

function blockedManifest(round: M1Round, mode: BenchMode, budget: number, reason: string): PromptManifestEntry {
  return {
    round: round.round, arm: "baseline", mode, step: round.step, item_ids: [], pin_reasons: {},
    composition_sha256: sha256(`BLOCKED:${reason}`), token_count: 0, token_method: "n/a", cap: budget,
    blocked: true, block_reason: reason, accepted_ops: [], rejected_ops: [],
  };
}

export async function runBaselineRound(opts: {
  round: M1Round;
  projection: Projection;
  state: BaselineState;
  budget: number;
  summarizer: Summarizer;
  evidenceRegistry: EvidenceRegistry;
}): Promise<{ manifest: PromptManifestEntry; calls: CallRecord[]; state: BaselineState; pinsPreserved: boolean }> {
  const { round, projection, budget, summarizer, evidenceRegistry } = opts;
  const calls: CallRecord[] = [];
  const state: BaselineState = { summary: opts.state.summary, retained: [...opts.state.retained] };

  for (const e of round.evidence) {
    const rec = evidenceRegistry.put({ id: e.id, text: e.text, source_url: e.source_url, retrieval_mode: e.retrieval_mode, observed_at: e.observed_at });
    if (!state.retained.some((x) => x.id === rec.id)) state.retained.push({ id: rec.id, text: rec.text, round: round.round, ts: rec.observed_at });
  }

  const composerState: ComposerState = { projection, step: round.step };
  const mandatory = candidateItems(composerState).filter((i) => i.pinned || i.class === "receipt");
  const mandatoryText = mandatory.map((i) => `[${i.id}] ${i.text}`).join("\n");
  const instructionsTokens = countTokens(INSTRUCTIONS).count;
  const mandatoryTokens = countTokens(mandatoryText).count;
  if (instructionsTokens + mandatoryTokens > budget) {
    return { manifest: blockedManifest(round, summarizer.mode, budget, `mandatory block ${mandatoryTokens + instructionsTokens} tokens exceeds cap ${budget}`), calls, state, pinsPreserved: true };
  }

  const summaryTokens = countTokens(state.summary).count;
  const remaining = budget - instructionsTokens - mandatoryTokens - summaryTokens;
  const sortedDesc = [...state.retained].sort((a, b) => (b.round - a.round) || b.ts.localeCompare(a.ts));
  const keep: BaselineObservation[] = [];
  const evict: BaselineObservation[] = [];
  let used = 0;
  let stillFits = true;
  for (const o of sortedDesc) {
    const t = countTokens(o.text).count;
    if (stillFits && used + t <= Math.max(0, remaining)) { keep.push(o); used += t; }
    else { stillFits = false; evict.push(o); }
  }

  let summaryCall: PromptManifestEntry["summary_call"];
  if (evict.length > 0) {
    const chronEvicted = [...evict].sort((a, b) => (a.round - b.round) || a.ts.localeCompare(b.ts));
    const evictedBatchText = chronEvicted.map((o) => `[${o.id}] ${o.text}`).join("\n");
    const r = await summarizer.summarize(evictedBatchText, state.summary);
    state.summary = r.text;
    summaryCall = { mode: r.mode, input_tokens: r.tokens_in, output_tokens: r.tokens_out, ms: r.ms, prompt_hash: FROZEN_SUMMARY_PROMPT_HASH };
    calls.push({ arm: "baseline", round: round.round, kind: "summary", mode: r.mode, model: summarizer.modelId, latency_ms: r.ms, input_tokens: r.tokens_in, output_tokens: r.tokens_out, note: `summarized ${chronEvicted.length} evicted observation(s)` });
  }
  state.retained = keep;

  let recallEntry: PromptManifestEntry["recall"];
  if (round.recall_request) {
    const r = recall(evidenceRegistry, round.recall_request.id, Math.floor(budget * 0.15));
    calls.push({ arm: "baseline", round: round.round, kind: "recall", mode: "stub", model: "n/a", latency_ms: 0, note: `${round.recall_request.id} found=${r.found}` });
    recallEntry = r.found ? { id: r.id, found: true, truncated: r.truncated, tokens: r.tokens.count } : { id: r.id, found: false };
  }

  const chron = [...state.retained].sort((a, b) => (a.round - b.round) || a.ts.localeCompare(b.ts));
  const text = [INSTRUCTIONS, "## Mandatory", mandatoryText, "## Running summary", state.summary || "(none yet)", "## Recent observations", ...chron.map((o) => `[${o.id}] ${o.text}`)].join("\n");
  const tokens = countTokens(text);
  if (tokens.count > budget) {
    return { manifest: blockedManifest(round, summarizer.mode, budget, `composed input ${tokens.count} tokens exceeds cap ${budget}`), calls, state, pinsPreserved: true };
  }

  const itemIds = [...mandatory.map((i) => i.id), "summary:running", ...chron.map((o) => o.id)];
  const compositionKey = itemIds.map((id) => `${id}`).join("|") + `#summary:${countTokens(state.summary).count}`;
  const manifest: PromptManifestEntry = {
    round: round.round, arm: "baseline", mode: summarizer.mode, step: round.step, item_ids: itemIds,
    pin_reasons: Object.fromEntries(mandatory.map((i) => [i.id, i.class === "receipt" ? "receipt (mandatory block)" : "pinned (mandatory block)"])),
    composition_sha256: sha256(compositionKey), token_count: tokens.count, token_method: tokens.method, cap: budget,
    blocked: false, accepted_ops: evict.map((o) => o.id), rejected_ops: [], recall: recallEntry, summary_call: summaryCall,
  };
  const pinsPreserved = mandatory.filter((i) => i.pinned).every((i) => itemIds.includes(i.id));
  return { manifest, calls, state, pinsPreserved };
}

export { isEvictable };
