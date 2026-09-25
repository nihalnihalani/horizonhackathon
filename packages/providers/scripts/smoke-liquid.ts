// Live smoke: Liquid curator on llama-server (DR_LIQUID_BASE_URL). Prints decisions + timings only.
// Cases: F3 (site-A open → newer closed) plus the 3-case confusion set (unchanged / superseded / conflict),
// then one live context-ops proposal validated in code.
import { loadConfig, type FactRow } from "@dr/shared";
import { LiquidCurator, applyContextOps, renderWorkingContext } from "../src/index.ts";
import { f3Projection, fact } from "../test/helpers.ts";

const cfg = loadConfig("providers");
const cur = new LiquidCurator({ baseUrl: cfg.DR_LIQUID_BASE_URL, model: cfg.DR_LIQUID_MODEL });
const T0 = "2026-09-25 19:00:00";
const T1 = "2026-09-25T19:30:00.000Z";
type Case = { name: string; expected: string; old: FactRow; obs: { key: string; value: unknown; observed_at: string } };
const cases: Case[] = [
  { name: "F3 site-A open→closed (later)", expected: "superseded", old: fact("site-A.status", "open", T0), obs: { key: "site-A.status", value: "closed", observed_at: T1 } },
  { name: "unchanged (same value, later)", expected: "unchanged", old: fact("site-C.status", "open", T0), obs: { key: "site-C.status", value: "open", observed_at: T1 } },
  { name: "superseded (accessible true→false, later)", expected: "superseded", old: fact("site-B.accessible", true, T0), obs: { key: "site-B.accessible", value: false, observed_at: T1 } },
  { name: "conflict (same observed_at, differ)", expected: "conflict", old: fact("site-A.status", "open", T0), obs: { key: "site-A.status", value: "closed", observed_at: "2026-09-25T19:00:00Z" } },
];

let f3ok = false;
const confusion: Record<string, Record<string, number>> = {};
for (const c of cases) {
  const r = await cur.compareFact(c.old, c.obs);
  const md = r.model_decision ?? "?";
  confusion[c.expected] ??= {};
  confusion[c.expected]![md] = (confusion[c.expected]![md] ?? 0) + 1;
  console.log(JSON.stringify({ case: c.name, expected: c.expected, model_decision: md, decision: r.decision, accepted: r.accepted, promoted_by: r.promoted_by ?? null, reject_reason: r.reject_reason ?? null, curator_ms: r.curator_ms }));
  if (c.name.startsWith("F3")) f3ok = r.accepted && r.decision === "superseded";
}
console.log(JSON.stringify({ confusion_expected_to_model: confusion }));

// Live context-ops proposal after supersession: evidence stubs are evictable, pins are not.
const state = {
  projection: f3Projection({ ferry: "confirmed", siteA: "closed" }), step: "campsite",
  evidence: [
    { id: "fact:site-A.status@epoch1", text: "SUPERSEDED: site-A.status = open observed epoch 1 (replaced by closed)" },
    { id: "obs:task-epoch1", text: "raw Nimble observation stub from epoch 1 (world v1)" },
  ],
};
const rendered = renderWorkingContext(state);
const prop = await cur.proposeContextOps(rendered, "campsite");
const applied = applyContextOps(state, prop);
console.log(JSON.stringify({ context_ops: { proposed_by: prop.proposed_by, evict: prop.evict, accepted: applied.accepted, rejected: applied.rejected, items_before: applied.before.length, items_after: applied.after.length, tokens_before: rendered.tokens.count, tokens_after: applied.rendered.tokens.count, curator_ms: prop.curator_ms } }));
console.log(JSON.stringify({ curator_latency: cur.latencyStats() }));
console.log(f3ok ? "SMOKE LIQUID OK: F3 decision superseded" : "SMOKE LIQUID FAIL: F3 not superseded");
process.exit(f3ok ? 0 : 1);
