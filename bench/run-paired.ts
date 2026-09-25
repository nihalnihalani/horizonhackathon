#!/usr/bin/env node
// bench:paired — runs M1 through BOTH arms (DR context policy vs checkpoint-summary-v1) under one
// manifest (VALIDATION_AND_DEMO.md §6/§6b/§9), sequentially, sharing one EvidenceRegistry (§6b.5:
// "the same bounded recall operation and evidence registry"). `--planner=live|stub` selects whether
// the summarizer's separate calls use the real OpenAI Responses endpoint (frozen prompt) or a
// deterministic stub; `--curator=live|stub` selects DR's real local Liquid model vs the rule fallback.
// A stub/rule curator never counts as the Liquid gate (C07 stays NOT MET in stub mode).
import { loadDotenv } from "@dr/shared";
import { LiquidCurator } from "@dr/providers";
import { EvidenceRegistry } from "./evidence.ts";
import { assertContextPressure } from "./fixtures/m1.ts";
import { assertComparable, buildManifest, gitRevision } from "./manifest.ts";
import { FROZEN_SUMMARY_PROMPT_HASH, LivePlannerSummarizer, StubSummarizer, type Summarizer } from "./policies/checkpoint-summary-v1.ts";
import { newBatchId, writeBundle } from "./report.ts";
import { checkC06, checkC07, runBaselineTrace, runDrTrace } from "./trace.ts";

loadDotenv();

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function probeLiquid(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, { signal: AbortSignal.timeout(timeoutMs) });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  const curatorArg = arg("curator", "stub") as "stub" | "live";
  const plannerArg = arg("planner", "stub") as "stub" | "live";
  const budget = Number(process.env.DR_PLANNER_CONTEXT_BUDGET ?? 6000);
  const limitations: string[] = [];

  const pressure = assertContextPressure(budget);
  console.log(`M1 context pressure: ${pressure.tokens} tokens (required > ${pressure.required}) — ${pressure.ok ? "OK" : "context pressure insufficient"}`);
  if (!pressure.ok) { console.error("context pressure insufficient; aborting"); process.exit(1); }

  let curatorMode: "stub" | "live" = "stub";
  let curatorInstance: LiquidCurator | undefined;
  const liquidBase = process.env.DR_LIQUID_BASE_URL ?? "http://127.0.0.1:8081/v1";
  const liquidModel = process.env.DR_LIQUID_MODEL ?? "LiquidAI/LFM2.5-1.2B-Instruct-GGUF";
  if (curatorArg === "live") {
    if (await probeLiquid(liquidBase)) { curatorMode = "live"; curatorInstance = new LiquidCurator({ baseUrl: liquidBase, model: liquidModel }); }
    else limitations.push(`--curator=live requested but no llama-server reachable at ${liquidBase}; DR arm fell back to the rule proposer (mode:stub, C07 NOT MET)`);
  }

  const plannerModel = process.env.DR_PLANNER_MODEL ?? "";
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  let summarizer: Summarizer = new StubSummarizer();
  if (plannerArg === "live") {
    if (apiKey && plannerModel) summarizer = new LivePlannerSummarizer(plannerModel, apiKey);
    else limitations.push(`--planner=live requested but OPENAI_API_KEY/DR_PLANNER_MODEL not configured; baseline summarizer fell back to the deterministic stub`);
  }

  // Shared evidence registry: both arms see the same durable evidence and recall operation (§6b.5).
  const sharedRegistry = new EvidenceRegistry();
  const drTrace = await runDrTrace({ budget, curator: { mode: curatorMode, instance: curatorInstance, modelId: liquidModel }, evidenceRegistry: sharedRegistry });
  const baselineTrace = await runBaselineTrace({ budget, summarizer, evidenceRegistry: sharedRegistry });

  const c06 = checkC06(drTrace);
  const c07 = checkC07(drTrace);

  const batchId = newBatchId("m1-paired");
  const drManifest = buildManifest({
    batchId, plannerInputCap: budget,
    arms: [{ arm: "dr", policy_version: "dr-context-v1", mode: curatorMode, planner_model: plannerArg === "live" ? plannerModel || null : null, curator_or_summarizer_model: curatorMode === "live" ? liquidModel : "rule", prompt_hashes: {} }],
  });
  const baselineManifest = buildManifest({
    batchId, plannerInputCap: budget,
    arms: [{ arm: "baseline", policy_version: "checkpoint-summary-v1", mode: summarizer.mode, planner_model: plannerArg === "live" ? plannerModel || null : null, curator_or_summarizer_model: summarizer.modelId, prompt_hashes: { summary_prompt: FROZEN_SUMMARY_PROMPT_HASH } }],
  });
  const cmp = assertComparable(drManifest, baselineManifest);
  if (!cmp.comparable) {
    console.error(`B01: refusing paired comparison — ${cmp.reasons.join("; ")}`);
    limitations.push(`B01 refused this comparison: ${cmp.reasons.join("; ")}`);
  }

  const pairedManifest = {
    batch_id: batchId, created_at: new Date().toISOString(), code_revision: gitRevision(),
    comparable: cmp.comparable, comparability_reasons: cmp.reasons,
    dr: drManifest, baseline: baselineManifest,
  };

  limitations.push(`C06 ${c06.pass ? "MET" : "NOT MET"}: ${c06.reasons.join("; ") || "ok"}`);
  limitations.push(`C07 ${c07.pass ? "MET" : "NOT MET"}: ${c07.reasons.join("; ") || "ok"}`);
  limitations.push("Single M1 run per arm; no repeated-batch statistics (sample size 1). Not a claim of days-long or continuous multi-mission reliability.");
  limitations.push("Both arms share one EvidenceRegistry and canonical world ledger (bench/world.ts); no live desk/kernel/control process is exercised by this bench.");

  const dir = writeBundle({
    batchId, manifest: pairedManifest, traces: [drTrace, baselineTrace],
    summaryExtra: [
      `B01 comparability: ${cmp.comparable ? "OK" : `REFUSED — ${cmp.reasons.join("; ")}`}`,
      `C06 (fixed repeated-memory trace, DR arm): ${c06.pass ? "MET" : "NOT MET"} — accepted_eviction_round=${c06.acceptedEvictionRound}`,
      `C07 (positive Liquid-authored edit): ${c07.pass ? "MET (live)" : `NOT MET (mode=${c07.mode})`}`,
      `Baseline summary calls: ${baselineTrace.calls.filter((c) => c.kind === "summary").length} (mode=${summarizer.mode})`,
    ].join("\n"),
    limitations,
  });
  console.log(`wrote ${dir}`);
  console.log(`batch_id=${batchId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
