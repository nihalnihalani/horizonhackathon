// Fixture F3 (THREE_HOUR_CUT §4, CONTRACTS §9 prices in cents). FROZEN at scaffold.
// Source of truth: packages/shared/fixtures/f3.json. Validated on import.
import { randomBytes } from "node:crypto";
import { z } from "zod";
import raw from "../fixtures/f3.json" with { type: "json" };
import { Slot } from "./records.ts";

const Resource = z.object({
  id: z.string(), slot: Slot, price_cents: z.number().int(), date: z.string(),
  accessible: z.boolean(), status: z.enum(["open", "closed"]), notice: z.string().optional(),
});
export const FixtureSchema = z.object({
  fixture: z.literal("F3"),
  run_id_prefix: z.string(),
  sim_clock: z.string(),
  trip: z.object({ start_date: z.string(), end_date: z.string(), party: z.number().int(), budget_cents: z.number().int(), currency: z.string(), accessible_required: z.boolean() }),
  constraints: z.array(z.object({ key: z.string(), value: z.unknown() })),
  resources: z.array(Resource),
  world_edits: z.array(z.object({ world_version: z.number().int(), site: z.string(), status: z.enum(["open", "closed"]), notice: z.string() })),
  plan: z.array(z.object({ step_id: z.string(), slot: Slot, resource: z.string(), depends_on: z.array(z.string()) })),
  volatile_fact_keys: z.array(z.string()),
  crash_point: z.literal("after_desk_commit"),
  crash_step: z.string(),
  expected_dr: z.record(z.unknown()),
  expected_naive: z.record(z.unknown()),
  companion_f3b: z.record(z.unknown()),
});
export type Fixture = z.infer<typeof FixtureSchema>;
export type FixtureResource = z.infer<typeof Resource>;

export const F3: Fixture = FixtureSchema.parse(raw);

export const SITE_IDS = ["A", "B", "C"] as const;
export type SiteId = (typeof SITE_IDS)[number];

/** run_id = f3-<yyyymmdd>-<4 hex>; matches sql.assertRunId. */
export function newRunId(prefix = F3.run_id_prefix, now = new Date()): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${d}-${randomBytes(2).toString("hex")}`;
}

export function resourceById(id: string, fx: Fixture = F3): FixtureResource {
  const r = fx.resources.find((x) => x.id === id);
  if (!r) throw new Error(`unknown resource ${id}`);
  return r;
}
