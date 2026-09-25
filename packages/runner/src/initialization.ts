import { F3, encodeValue } from "@dr/shared";
import { Journal } from "@dr/kernel";
import { factsFromObservation, type NimbleObservation } from "@dr/providers";

/** Each row may be the last write before a worker dies. Never reset existing progress. */
export async function seedRun(j: Journal) {
  for (const c of F3.constraints) {
    if (!j.state.constraints[c.key]) await j.append("constraints", { key: c.key, value: encodeValue(c.value), authority: "user", private: false, version: 1 });
  }
  for (const s of F3.plan) {
    if (!j.state.plan_steps[s.step_id]) await j.append("plan_steps", { step_id: s.step_id, slot: s.slot, resource: s.resource, depends_on: s.depends_on, commitment_key: null, status: "pending", reason: "initial plan" });
  }
}

export async function ensureInitialization(j: Journal, observe: () => Promise<NimbleObservation>) {
  await seedRun(j);
  const required = ["A", "B", "C"].flatMap((s) => [`site-${s}.status`, `site-${s}.accessible`]);
  const missing = required.filter((key) => !j.state.facts[key]);
  if (!missing.length) return;
  const fresh = new Map(factsFromObservation(await observe()).map((f) => [f.key, f]));
  for (const key of missing) {
    const f = fresh.get(key);
    if (!f) throw new Error(`initial observation lacks ${key}`);
    await j.append("facts", f);
  }
  // Existing stale/superseded evidence is left for the normal revalidation/curator path.
}
