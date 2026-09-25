// Shared bench types (dr-bench). Not part of @dr/shared — these are bench-local result shapes only.
import type { TokenCount } from "@dr/shared";

export type BenchArm = "dr" | "baseline";
export type BenchMode = "stub" | "live";

export type RecallManifestEntry = { id: string; found: boolean; truncated?: boolean; tokens?: number };

/** One row per composed planner input (the "following" prompt after this round's accepted ops/summarization). */
export type PromptManifestEntry = {
  round: number;
  arm: BenchArm;
  mode: BenchMode;
  step: string;
  item_ids: string[];
  pin_reasons: Record<string, string>;
  composition_sha256: string;
  token_count: number;
  token_method: string;
  cap: number;
  blocked: boolean;
  block_reason?: string;
  accepted_ops: string[];
  rejected_ops: { id: string; reason: string }[];
  recall?: RecallManifestEntry;
  curator_call?: { proposed_by: "liquid" | "rule"; ms: number; mode: BenchMode };
  summary_call?: { mode: BenchMode; input_tokens: number; output_tokens: number; ms: number; prompt_hash: string };
};

export type CallKind = "curator" | "planner" | "summary" | "recall";

/** One row per actual call made (curator/planner/summary/recall), for metrics.jsonl. */
export type CallRecord = {
  arm: BenchArm;
  round: number;
  kind: CallKind;
  mode: BenchMode;
  model: string;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  note?: string;
};

export type TraceResult = {
  arm: BenchArm;
  mode: BenchMode;
  manifests: PromptManifestEntry[];
  calls: CallRecord[];
  pinsPreservedEveryRound: boolean;
  contextCapacityBlocks: number;
};

export type { TokenCount };
