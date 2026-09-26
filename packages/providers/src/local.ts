// Explicit key-free demo adapters. The feed is real loopback HTTP; planning and curation are rules.
// These adapters never load configuration, read credentials, or contact a hosted provider.
import { createHash } from "node:crypto";
import {
  ContextCapacity, NIMBLE_STATUS_FIELD_NAMES, NIMBLE_STATUS_PARSER, SourceUnverified, decodeValue,
  type ContextOpsProposal, type Curator, type FactRow, type Planner, type RenderedContext, type Sensor,
} from "@dr/shared";
import { Composer, isEvictable, ruleProposeContextOps } from "./context.ts";
import { parseObservedAt, validateCuratorDecision, type CompareResultX, type ObservedValue } from "./curator.ts";
import { applyParserLocally } from "./html-select.ts";
import { type FetchLike } from "./http.ts";
import { hasRequiredFields, mapStatusFields, type NimbleObservation, type NimbleSensor } from "./nimble.ts";
import {
  buildPlannerRequest, filterCandidates, plannerContextFromRendered, validatePlannerDecision,
  type CandidateX, type ModelDecision, type PlannerContext, type PlannerDecisionX,
} from "./planner.ts";

export class LocalStatusSensor implements Sensor {
  private readonly feed: string;
  private readonly fetchImpl: FetchLike;

  constructor(statusUrl: string, opts: { fetchImpl?: FetchLike } = {}) {
    let url: URL;
    try { url = new URL(statusUrl); } catch { throw new SourceUnverified("local demo requires a valid loopback status feed URL"); }
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.hash || url.pathname !== "/status.html") {
      throw new SourceUnverified("local demo only permits the configured http://127.0.0.1 status.html feed");
    }
    this.feed = statusUrl;
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  }

  async extractStatusPage(url: string, opts: { expectedWorldVersion?: number } = {}): Promise<NimbleObservation> {
    if (url !== this.feed) throw new SourceUnverified("local demo refused a source other than its configured loopback feed");
    let response: Response;
    let html: string;
    try {
      response = await this.fetchImpl(this.feed, {
        headers: { Accept: "text/html" }, redirect: "error", credentials: "omit", cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok || response.redirected) throw new SourceUnverified(`local feed http ${response.status}; redirects are forbidden`);
      html = await response.text();
    } catch (e) {
      if (e instanceof SourceUnverified) throw e;
      throw new SourceUnverified(`local feed transport error: ${(e as Error).name}`);
    }
    if (Buffer.byteLength(html, "utf8") > 256 * 1024) throw new SourceUnverified("local feed exceeds 256 KiB limit");
    const parsed = applyParserLocally(html, NIMBLE_STATUS_PARSER);
    if (!hasRequiredFields(parsed)) throw new SourceUnverified("local feed is missing required status fields");
    const model = mapStatusFields(parsed);
    if (opts.expectedWorldVersion !== undefined && model.world_version !== opts.expectedWorldVersion) {
      throw new SourceUnverified(`local feed world_version mismatch: page ${model.world_version} vs desk ${opts.expectedWorldVersion}`);
    }
    const raw_hash = createHash("sha256").update(html).digest("hex");
    return {
      url, fields: Object.fromEntries(NIMBLE_STATUS_FIELD_NAMES.map((key) => [key, parsed[key] ?? ""])),
      task_id: `local-${raw_hash.slice(0, 12)}`, status: "success", status_code: response.status,
      fetched_at: new Date().toISOString(), retrieval_mode: "direct", raw_hash, nimble_ms: 0,
      metadata: { provider: "local", source: "simulated_operator", external_provider_calls: 0 },
      parse_mode: "local-css", render: false, world_version: model.world_version, attempts: 1, model,
    };
  }

  // Present only for the runner's provider interface. Local mode must never fetch public pages.
  async extractPage(_url: string): ReturnType<NimbleSensor["extractPage"]> {
    throw new SourceUnverified("public web reads are disabled in local demo mode");
  }
}

export class LocalPlanner implements Planner {
  constructor(private readonly budget: number) {
    if (!Number.isFinite(budget) || budget <= 0) throw new Error("LocalPlanner: a positive context budget is required");
  }

  async decide(rendered: RenderedContext, step: string, candidates: CandidateX[], ctx?: PlannerContext): Promise<PlannerDecisionX> {
    const started = Date.now();
    const context = ctx ?? plannerContextFromRendered(rendered, step);
    const { valid, rejected } = filterCandidates(candidates, context, step);
    const request = buildPlannerRequest(rendered, step, valid);
    if (request.context_tokens.count > this.budget) {
      throw new ContextCapacity(`local planner input ${request.context_tokens.count} tokens > budget ${this.budget}; required context retained`);
    }
    const selected = [...valid].sort((a, b) => a.price_cents - b.price_cents || a.resource.localeCompare(b.resource))[0];
    const decision: ModelDecision = selected
      ? { action: "book", resource: selected.resource, action_key: null, reason: "local rule: cheapest candidate satisfying the current constraints" }
      : { action: "block", resource: null, action_key: null, reason: `local rule: no valid candidate${rejected.length ? ` (${rejected.map((r) => `${r.resource}: ${r.reason}`).join(", ")})` : ""}` };
    const validator = validatePlannerDecision(decision, valid, context);
    return {
      action: validator.ok ? decision.action : "block",
      ...(validator.ok && selected ? { resource: selected.resource } : {}),
      reason: validator.ok ? decision.reason : `local decision rejected: ${validator.reason}`,
      context_tokens: request.context_tokens, planner_tokens_in: 0, usage: null, response_id: null,
      planner_ms: Date.now() - started, rejected_candidates: rejected, valid_candidates: valid.map((c) => c.resource),
      validator, model_action: decision.action,
    };
  }
}

export class RuleCurator implements Curator {
  async compareFact(old: FactRow, observation: ObservedValue): Promise<CompareResultX & { proposed_by: "rule" }> {
    let oldValue: unknown;
    try { oldValue = decodeValue(old.value); } catch { oldValue = old.value; }
    const normalize = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value) ?? "").trim().toLowerCase();
    const same = normalize(oldValue) === normalize(observation.value);
    const later = parseObservedAt(observation.observed_at) > parseObservedAt(old.observed_at);
    const raw = {
      key: observation.key, decision: same ? "unchanged" : later ? "superseded" : "conflict",
      new_value: typeof observation.value === "string" ? observation.value : JSON.stringify(observation.value) ?? "",
      reason: same ? "local rule: observed value unchanged" : later ? "local rule: newer observation replaces old value" : "local rule: differing observation requires time validation",
    };
    const { model_decision: _unusedModelDecision, ...validated } = validateCuratorDecision(old, observation, raw);
    return { ...validated, key: old.key, curator_ms: 0, raw, proposed_by: "rule" };
  }

  async proposeContextOps(rendered: RenderedContext, _step = ""): Promise<ContextOpsProposal & { curator_ms: number; raw: null }> {
    const proposed = ruleProposeContextOps(rendered);
    const evictable = new Set(rendered.items.filter(isEvictable).map((item) => item.id));
    return { ...proposed, evict: proposed.evict.filter((id) => evictable.has(id)), curator_ms: 0, raw: null };
  }
}

export function createLocalProviders(statusUrl: string, budget: number) {
  return { sensor: new LocalStatusSensor(statusUrl), planner: new LocalPlanner(budget), curator: new RuleCurator(), composer: new Composer(), budget };
}
