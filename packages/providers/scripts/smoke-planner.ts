// Live smoke: OpenAI Responses planner on the F3 campsite repair. Prints decision, usage, timings only.
import { loadConfig } from "@dr/shared";
import { OpenAIPlanner, renderWorkingContext, type CandidateX } from "../src/index.ts";
import { f3Projection } from "../test/helpers.ts";

const cfg = loadConfig("providers");
const planner = new OpenAIPlanner({ apiKey: cfg.OPENAI_API_KEY, model: cfg.DR_PLANNER_MODEL, budget: cfg.DR_PLANNER_CONTEXT_BUDGET });
const rendered = renderWorkingContext({ projection: f3Projection({ ferry: "confirmed", siteA: "closed" }), step: "campsite" });
const candidates: CandidateX[] = [
  { resource: "site-A", slot: "campsite", price_cents: 8000, accessible: true, status: "closed", date: "2026-10-09" },
  { resource: "site-B", slot: "campsite", price_cents: 6000, accessible: false, status: "open", date: "2026-10-09" },
  { resource: "site-C", slot: "campsite", price_cents: 9000, accessible: true, status: "open", date: "2026-10-09" },
];
const d = await planner.decide(rendered, "campsite", candidates);
console.log(JSON.stringify({ action: d.action, resource: d.resource ?? null, reason: d.reason }));
console.log(JSON.stringify({
  model: cfg.DR_PLANNER_MODEL, response_id: d.response_id, planner_ms: d.planner_ms, context_tokens: d.context_tokens, budget: cfg.DR_PLANNER_CONTEXT_BUDGET,
  usage: d.usage, rejected_candidates: d.rejected_candidates, validator: d.validator,
}));
const ok = d.action === "book" && d.resource === "site-C";
console.log(ok ? "SMOKE PLANNER OK: book site-C" : "SMOKE PLANNER FAIL");
process.exit(ok ? 0 : 1);
