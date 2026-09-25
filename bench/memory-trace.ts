#!/usr/bin/env node
// bench:memory — runs the M1 fixed same-mission memory trace through the DR arm only
// (VALIDATION_AND_DEMO.md §6a/§9). `--curator=stub|live` selects the rule fallback vs the real
// local Liquid model; `--planner=stub|live` is accepted for parity with run-paired.ts but this
// script does not itself invoke the planner (no booking decisions are made here, only context
// composition/curation/recall over the fixed trace).
import { loadDotenv } from "@dr/shared";
import { LiquidCurator } from "@dr/providers";
import { assertContextPressure } from "./fixtures/m1.ts";
import { buildManifest } from "./manifest.ts";
import { newBatchId, writeBundle } from "./report.ts";
import { checkC06, checkC07, runDrTrace } from "./trace.ts";

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

  const pressure = assertContextPressure(budget);
  console.log(`M1 context pressure: ${pressure.tokens} tokens cumulative raw evidence (required > ${pressure.required}) — ${pressure.ok ? "OK" : "context pressure insufficient"}`);
  if (!pressure.ok) {
    console.error("context pressure insufficient; aborting trace (§6a precondition not met)");
    process.exit(1);
  }

  const limitations: string[] = [`planner=${plannerArg} recorded but not invoked by bench:memory (context-only trace; run bench:paired for planner calls)`];
  let curatorMode: "stub" | "live" = "stub";
  let curatorInstance: LiquidCurator | undefined;
  const liquidBase = process.env.DR_LIQUID_BASE_URL ?? "http://127.0.0.1:8081/v1";
  const liquidModel = process.env.DR_LIQUID_MODEL ?? "LiquidAI/LFM2.5-1.2B-Instruct-GGUF";
  if (curatorArg === "live") {
    const up = await probeLiquid(liquidBase);
    if (up) {
      curatorMode = "live";
      curatorInstance = new LiquidCurator({ baseUrl: liquidBase, model: liquidModel });
    } else {
      limitations.push(`--curator=live requested but no llama-server reachable at ${liquidBase}; fell back to the rule proposer (mode:stub, C07 NOT MET)`);
    }
  }

  const trace = await runDrTrace({ budget, curator: { mode: curatorMode, instance: curatorInstance, modelId: liquidModel } });

  const c06 = checkC06(trace);
  const c07 = checkC07(trace);
  limitations.push(`C06 ${c06.pass ? "MET" : "NOT MET"}: ${c06.reasons.join("; ") || "accepted eviction removed detail; pins preserved; recall ok"}`);
  limitations.push(`C07 ${c07.pass ? "MET" : "NOT MET"}: ${c07.reasons.join("; ") || "real Liquid-authored edit accepted"}`);

  const batchId = newBatchId("m1-memory");
  const manifest = buildManifest({
    batchId, plannerInputCap: budget,
    arms: [{ arm: "dr", policy_version: "dr-context-v1", mode: curatorMode, planner_model: null, curator_or_summarizer_model: curatorMode === "live" ? liquidModel : "rule", prompt_hashes: {} }],
  });

  const dir = writeBundle({
    batchId, manifest, traces: [trace],
    summaryExtra: [
      `C03 (bounded provenance-labelled recall of evicted original): ${trace.manifests.some((m) => m.recall?.found) ? "MET (deterministic)" : "NOT observed this run"}`,
      `C06 (fixed repeated-memory trace): ${c06.pass ? "MET" : "NOT MET"} — accepted_eviction_round=${c06.acceptedEvictionRound}`,
      `C07 (positive Liquid-authored edit): ${c07.pass ? "MET (live)" : `NOT MET (mode=${c07.mode})`}`,
    ].join("\n"),
    limitations,
  });
  console.log(`wrote ${dir}`);
  console.log(`batch_id=${batchId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
