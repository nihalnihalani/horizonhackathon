// Orchestrates the M1 fixture through one arm, round by round, against the shared canonical
// world ledger (bench/world.ts). Used by bench/memory-trace.ts (DR only) and bench/run-paired.ts
// (both arms under one manifest).
import { EvidenceRegistry } from "./evidence.ts";
import { M1, type M1Fixture } from "./fixtures/m1.ts";
import { initialBaselineState, runBaselineRound, type Summarizer } from "./policies/checkpoint-summary-v1.ts";
import { initialDrState, runDrRound, type DrCuratorConfig } from "./policies/dr.ts";
import { worldAtRound } from "./world.ts";
import type { CallRecord, PromptManifestEntry, TraceResult } from "./types.ts";

export async function runDrTrace(opts: {
  budget: number;
  curator: DrCuratorConfig;
  evidenceRegistry?: EvidenceRegistry;
  fixture?: M1Fixture;
}): Promise<TraceResult> {
  const fx = opts.fixture ?? M1;
  const registry = opts.evidenceRegistry ?? new EvidenceRegistry();
  let state = initialDrState();
  const manifests: PromptManifestEntry[] = [];
  const calls: CallRecord[] = [];
  let pinsPreservedEveryRound = true;
  let contextCapacityBlocks = 0;
  for (const round of fx.rounds) {
    const projection = worldAtRound(round.round);
    const out = await runDrRound({ round, projection, state, budget: opts.budget, curator: opts.curator, evidenceRegistry: registry });
    manifests.push(out.manifest);
    calls.push(...out.calls);
    state = out.state;
    pinsPreservedEveryRound &&= out.pinsPreserved;
    if (out.manifest.blocked) contextCapacityBlocks++;
  }
  return { arm: "dr", mode: opts.curator.mode, manifests, calls, pinsPreservedEveryRound, contextCapacityBlocks };
}

export async function runBaselineTrace(opts: {
  budget: number;
  summarizer: Summarizer;
  evidenceRegistry?: EvidenceRegistry;
  fixture?: M1Fixture;
}): Promise<TraceResult> {
  const fx = opts.fixture ?? M1;
  const registry = opts.evidenceRegistry ?? new EvidenceRegistry();
  let state = initialBaselineState();
  const manifests: PromptManifestEntry[] = [];
  const calls: CallRecord[] = [];
  let pinsPreservedEveryRound = true;
  let contextCapacityBlocks = 0;
  for (const round of fx.rounds) {
    const projection = worldAtRound(round.round);
    const out = await runBaselineRound({ round, projection, state, budget: opts.budget, summarizer: opts.summarizer, evidenceRegistry: registry });
    manifests.push(out.manifest);
    calls.push(...out.calls);
    state = out.state;
    pinsPreservedEveryRound &&= out.pinsPreserved;
    if (out.manifest.blocked) contextCapacityBlocks++;
  }
  return { arm: "baseline", mode: opts.summarizer.mode, manifests, calls, pinsPreservedEveryRound, contextCapacityBlocks };
}

// ---- C06/C07 checks over a completed DR trace ----
export type C06Result = { pass: boolean; acceptedEvictionRound: number | null; pinsPreserved: boolean; recallOk: boolean; reasons: string[] };

export function checkC06(trace: TraceResult): C06Result {
  const reasons: string[] = [];
  let acceptedEvictionRound: number | null = null;
  for (let i = 0; i < trace.manifests.length - 1; i++) {
    const m = trace.manifests[i]!;
    const next = trace.manifests[i + 1]!;
    if (m.accepted_ops.length > 0) {
      const removed = m.accepted_ops.some((id) => !next.item_ids.includes(id));
      if (removed) { acceptedEvictionRound = m.round; break; }
    }
  }
  if (acceptedEvictionRound === null) reasons.push("no accepted eviction removed raw detail from the following planner input");
  if (!trace.pinsPreservedEveryRound) reasons.push("a pin did not survive every round");
  const recalls = trace.manifests.map((m) => m.recall).filter((r): r is NonNullable<typeof r> => !!r);
  const recallOk = recalls.length > 0 && recalls.every((r) => r.found);
  if (!recallOk) reasons.push("no successful bounded recall of an evicted original was recorded");
  return { pass: acceptedEvictionRound !== null && trace.pinsPreservedEveryRound && recallOk, acceptedEvictionRound, pinsPreserved: trace.pinsPreservedEveryRound, recallOk, reasons };
}

export type C07Result = { pass: boolean; mode: "live" | "stub"; reasons: string[] };

export function checkC07(trace: TraceResult): C07Result {
  const reasons: string[] = [];
  if (trace.mode !== "live") reasons.push("curator mode is stub/rule, not the real local Liquid model");
  const liquidCalls = trace.calls.filter((c) => c.kind === "curator" && c.mode === "live");
  if (liquidCalls.length === 0) reasons.push("no live curator (Liquid) call was made");
  const liquidAcceptedEviction = trace.manifests.some((m) => m.curator_call?.proposed_by === "liquid" && m.accepted_ops.length > 0);
  if (!liquidAcceptedEviction) reasons.push("no Liquid-proposed eviction was accepted and reflected in a following item-set change");
  return { pass: reasons.length === 0, mode: trace.mode, reasons };
}
