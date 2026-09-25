// Batch manifest + B01 (VALIDATION_AND_DEMO.md §3 B01, §6b.6): freeze policy versions, prompt hashes,
// thresholds, cap, model config, fixture hashes and code revision before a measured batch; refuse a
// paired comparison when fixture/model/cap/tools/safety rules/crash schedule differ.
import { execSync } from "node:child_process";
import { m1FixtureHash, M1 } from "./fixtures/m1.ts";
import { COMPARATOR_VERSION, FROZEN_SUMMARY_PROMPT_HASH, SUMMARY_CAP_TOKENS } from "./policies/checkpoint-summary-v1.ts";

export type ArmManifest = {
  arm: "dr" | "baseline";
  policy_version: string;
  mode: "stub" | "live";
  planner_model: string | null;
  curator_or_summarizer_model: string | null;
  prompt_hashes: Record<string, string>;
};

export type BatchManifest = {
  batch_id: string;
  created_at: string;
  code_revision: string;
  fixture: { name: "M1"; version: string; sha256: string };
  planner_input_cap: number;
  summary_cap_tokens: number;
  tools: string[];
  safety_rules: string[];
  crash_schedule: string[];
  arms: ArmManifest[];
};

export function gitRevision(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function buildManifest(opts: {
  batchId: string;
  plannerInputCap: number;
  arms: ArmManifest[];
}): BatchManifest {
  return {
    batch_id: opts.batchId,
    created_at: new Date().toISOString(),
    code_revision: gitRevision(),
    fixture: { name: "M1", version: M1.version, sha256: m1FixtureHash() },
    planner_input_cap: opts.plannerInputCap,
    summary_cap_tokens: SUMMARY_CAP_TOKENS,
    tools: ["book", "cancel", "keep", "block"],
    safety_rules: ["desk-idempotent", "context-composer-validator", "planner-candidate-revalidation"],
    crash_schedule: [],
    arms: opts.arms,
  };
}

export const COMPARATOR_FROZEN = { policy_version: COMPARATOR_VERSION, prompt_hash: FROZEN_SUMMARY_PROMPT_HASH, summary_cap_tokens: SUMMARY_CAP_TOKENS };

export type ComparabilityCheck = { comparable: boolean; reasons: string[] };

/** B01: refuse a measured comparison when fixture, model/config, cap, tools, safety rules or crash schedule differ. */
export function assertComparable(a: BatchManifest, b: BatchManifest): ComparabilityCheck {
  const reasons: string[] = [];
  if (a.fixture.sha256 !== b.fixture.sha256) reasons.push(`fixture sha256 differs: ${a.fixture.sha256} vs ${b.fixture.sha256}`);
  if (a.fixture.version !== b.fixture.version) reasons.push(`fixture version differs: ${a.fixture.version} vs ${b.fixture.version}`);
  if (a.planner_input_cap !== b.planner_input_cap) reasons.push(`planner_input_cap differs: ${a.planner_input_cap} vs ${b.planner_input_cap}`);
  if (a.summary_cap_tokens !== b.summary_cap_tokens) reasons.push(`summary_cap_tokens differs: ${a.summary_cap_tokens} vs ${b.summary_cap_tokens}`);
  if (JSON.stringify([...a.tools].sort()) !== JSON.stringify([...b.tools].sort())) reasons.push("tools differ");
  if (JSON.stringify([...a.safety_rules].sort()) !== JSON.stringify([...b.safety_rules].sort())) reasons.push("safety_rules differ");
  if (JSON.stringify(a.crash_schedule) !== JSON.stringify(b.crash_schedule)) reasons.push("crash_schedule differs");
  const plannerA = a.arms.find((x) => x.planner_model)?.planner_model ?? null;
  const plannerB = b.arms.find((x) => x.planner_model)?.planner_model ?? null;
  if (plannerA && plannerB && plannerA !== plannerB) reasons.push(`planner model differs: ${plannerA} vs ${plannerB}`);
  return { comparable: reasons.length === 0, reasons };
}
