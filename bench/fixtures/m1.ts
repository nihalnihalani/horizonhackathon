// M1 fixed same-mission memory trace (VALIDATION_AND_DEMO.md §6a). FROZEN: any content edit changes
// m1FixtureHash() and therefore invalidates prior manifests (see bench/manifest.ts assertComparable, B01).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { countTokens } from "@dr/shared";

const EvidenceSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  source_url: z.string(),
  retrieval_mode: z.enum(["live", "cache", "direct"]),
  observed_at: z.string(),
  relevant: z.boolean(),
  text: z.string().min(1),
});

const WorldEditSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  observed_at: z.string(),
  status: z.string(),
  world_version: z.number().int(),
  notice: z.string().optional(),
});

const RoundSchema = z.object({
  round: z.number().int().positive(),
  clock: z.string(),
  step: z.string(),
  phase: z.string(),
  evidence: z.array(EvidenceSchema),
  world_edit: WorldEditSchema.nullable(),
  recall_request: z.object({ id: z.string(), reason: z.string() }).nullable(),
  curator_expect_eviction: z.boolean().optional(),
  note: z.string(),
});

const FixtureSchema = z.object({
  fixture: z.literal("M1"),
  version: z.string(),
  description: z.string(),
  mission_step_order: z.array(z.string()),
  rounds: z.array(RoundSchema).length(12),
});

export type M1Evidence = z.infer<typeof EvidenceSchema>;
export type M1Round = z.infer<typeof RoundSchema>;
export type M1Fixture = z.infer<typeof FixtureSchema>;

const path = fileURLToPath(new URL("./m1.json", import.meta.url));
const raw = JSON.parse(readFileSync(path, "utf8"));
export const M1: M1Fixture = FixtureSchema.parse(raw);

/** sha256 of the raw fixture file bytes, frozen in every manifest (B01). */
export function m1FixtureHash(): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Cumulative raw evidence text across all 12 rounds, and its token count under the shared counting method. */
export function m1CumulativeEvidenceTokens(fx: M1Fixture = M1): { chars: number; tokens: number; method: string } {
  const all = fx.rounds.flatMap((r) => r.evidence.map((e) => e.text)).join("\n");
  const c = countTokens(all);
  return { chars: all.length, tokens: c.count, method: c.method };
}

/** Asserts the workload-size precondition (§6a): cumulative raw text must exceed 2x the planner target. */
export function assertContextPressure(target: number, fx: M1Fixture = M1): { ok: boolean; tokens: number; required: number } {
  const { tokens } = m1CumulativeEvidenceTokens(fx);
  const required = target * 2;
  return { ok: tokens > required, tokens, required };
}
