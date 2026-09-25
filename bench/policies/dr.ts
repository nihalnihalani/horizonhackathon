// DR arm context policy (dr-bench). Builds the planner input FROM STATE using the real
// packages/providers Composer/renderWorkingContext + evidence stubs, asks the curator for
// proposeContextOps, validates with applyContextOps (packages/providers/src/context.ts — owned by C,
// used read-only here), and records the composition manifest of the FOLLOWING planner input.
// Pins (constraints, unresolved commitments, receipt stubs are protected-not-pinned but never evicted
// without validator approval) must survive every round.
import {
  ContextCapacity, countTokens, type ContextOpsProposal, type Projection,
} from "@dr/shared";
import {
  applyContextOps, isEvictable, LiquidCurator, renderWorkingContext, ruleProposeContextOps,
  type ComposerStateX, type EvidenceItem,
} from "@dr/providers";
import { recall, sha256, type EvidenceRegistry } from "../evidence.ts";
import type { M1Round } from "../fixtures/m1.ts";
import type { BenchMode, CallRecord, PromptManifestEntry } from "../types.ts";

export type DrArmState = { evicted: string[]; evidenceSeen: EvidenceItem[] };
export const initialDrState = (): DrArmState => ({ evicted: [], evidenceSeen: [] });

export type DrCuratorConfig = { mode: BenchMode; instance?: LiquidCurator; modelId?: string };

export type DrRoundOutcome = { manifest: PromptManifestEntry; calls: CallRecord[]; state: DrArmState; pinsPreserved: boolean };

function pinReason(cls: string): string {
  if (cls === "constraint") return "user constraint (never evictable)";
  if (cls === "commitment") return "unresolved commitment (reconcile by action_key before retry)";
  if (cls === "plan") return "plan frontier";
  return "pinned";
}

function blockedManifest(round: M1Round, mode: BenchMode, budget: number, reason: string): PromptManifestEntry {
  return {
    round: round.round, arm: "dr", mode, step: round.step, item_ids: [], pin_reasons: {},
    composition_sha256: sha256(`BLOCKED:${reason}`), token_count: 0, token_method: "n/a", cap: budget,
    blocked: true, block_reason: reason, accepted_ops: [], rejected_ops: [],
  };
}

export async function runDrRound(opts: {
  round: M1Round;
  projection: Projection;
  state: DrArmState;
  budget: number;
  curator: DrCuratorConfig;
  evidenceRegistry: EvidenceRegistry;
}): Promise<DrRoundOutcome> {
  const { round, projection, budget, curator, evidenceRegistry } = opts;
  const calls: CallRecord[] = [];
  const state: DrArmState = { evicted: [...opts.state.evicted], evidenceSeen: [...opts.state.evidenceSeen] };

  for (const e of round.evidence) {
    const rec = evidenceRegistry.put({ id: e.id, text: e.text, source_url: e.source_url, retrieval_mode: e.retrieval_mode, observed_at: e.observed_at });
    if (!state.evidenceSeen.some((x) => x.id === rec.id)) state.evidenceSeen.push({ id: rec.id, text: rec.text });
  }

  const baseState: ComposerStateX = { projection, step: round.step, evidence: state.evidenceSeen, evicted: state.evicted, budget };

  let beforeRendered;
  try {
    beforeRendered = renderWorkingContext(baseState);
  } catch (e) {
    if (e instanceof ContextCapacity) return { manifest: blockedManifest(round, curator.mode, budget, e.message), calls, state, pinsPreserved: true };
    throw e;
  }
  const pinnedBefore = beforeRendered.items.filter((i) => i.pinned).map((i) => i.id);

  let proposal: ContextOpsProposal | null = null;
  let curatorMs = 0;
  if (beforeRendered.items.some((i) => isEvictable(i))) {
    if (curator.mode === "live" && curator.instance) {
      const t0 = Date.now();
      proposal = await curator.instance.proposeContextOps(beforeRendered, round.step);
      curatorMs = Date.now() - t0;
      calls.push({ arm: "dr", round: round.round, kind: "curator", mode: "live", model: curator.modelId ?? "liquid", latency_ms: curatorMs, note: `proposed_by=${proposal.proposed_by}` });
    } else {
      proposal = ruleProposeContextOps(beforeRendered);
      calls.push({ arm: "dr", round: round.round, kind: "curator", mode: "stub", model: "rule", latency_ms: 0, note: `proposed_by=${proposal.proposed_by}` });
    }
  }

  let acceptedOps: string[] = [];
  let rejectedOps: { id: string; reason: string }[] = [];
  if (proposal && (proposal.evict.length || proposal.keep.length)) {
    const res = applyContextOps(baseState, proposal);
    state.evicted = res.evicted;
    acceptedOps = res.accepted;
    rejectedOps = res.rejected;
  }

  let recallEntry: PromptManifestEntry["recall"];
  if (round.recall_request) {
    const r = recall(evidenceRegistry, round.recall_request.id, Math.floor(budget * 0.15));
    calls.push({ arm: "dr", round: round.round, kind: "recall", mode: "stub", model: "n/a", latency_ms: 0, note: `${round.recall_request.id} found=${r.found}` });
    recallEntry = r.found ? { id: r.id, found: true, truncated: r.truncated, tokens: r.tokens.count } : { id: r.id, found: false };
  }

  const followingState: ComposerStateX = { ...baseState, evicted: state.evicted };
  let following;
  try {
    following = renderWorkingContext(followingState);
  } catch (e) {
    if (e instanceof ContextCapacity) return { manifest: blockedManifest(round, curator.mode, budget, e.message), calls, state, pinsPreserved: true };
    throw e;
  }
  const pinnedAfter = following.items.filter((i) => i.pinned).map((i) => i.id);
  const pinsPreserved = pinnedBefore.every((id) => pinnedAfter.includes(id));

  const compositionKey = following.items.map((i) => `${i.id}@${countTokens(i.text).count}`).join("|");
  const manifest: PromptManifestEntry = {
    round: round.round, arm: "dr", mode: curator.mode, step: round.step,
    item_ids: following.items.map((i) => i.id),
    pin_reasons: Object.fromEntries(following.items.filter((i) => i.pinned).map((i) => [i.id, pinReason(i.class)])),
    composition_sha256: sha256(compositionKey), token_count: following.tokens.count, token_method: following.tokens.method,
    cap: budget, blocked: false, accepted_ops: acceptedOps, rejected_ops: rejectedOps, recall: recallEntry,
    curator_call: proposal ? { proposed_by: proposal.proposed_by, ms: curatorMs, mode: curator.mode } : undefined,
  };
  return { manifest, calls, state, pinsPreserved };
}
