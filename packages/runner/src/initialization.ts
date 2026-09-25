import { AckError, F3, encodeValue, resourceById, type Slot } from "@dr/shared";
import { Journal } from "@dr/kernel";
import { factsFromObservation, type CandidateX, type NimbleObservation } from "@dr/providers";

/** Each row may be the last write before a worker dies. Never reset existing progress. */
export async function seedRun(j: Journal) {
  for (const c of F3.constraints) {
    if (!j.state.constraints[c.key]) await j.append("constraints", { key: c.key, value: encodeValue(c.value), authority: "user", private: false, version: 1 });
  }
  for (const s of F3.plan) {
    if (!j.state.plan_steps[s.step_id]) await j.append("plan_steps", { step_id: s.step_id, slot: s.slot, resource: s.resource, depends_on: s.depends_on, commitment_key: null, status: "pending", reason: "initial plan" });
  }
}

export type InitResult = { ok: true } | { ok: false; reason: string };

/**
 * First-boot observation. A source failure (tunnel down, HTTP 530, Nimble error) is NOT a runner crash: the facts stay
 * missing, so every step depending on them blocks with `source_unverified: …` (P4.2 — a failed source never asserts
 * the resource closed or open). Storage failures still throw (fail closed on the single writer).
 */
export async function ensureInitialization(j: Journal, observe: () => Promise<NimbleObservation>): Promise<InitResult> {
  await seedRun(j);
  const required = ["A", "B", "C"].flatMap((s) => [`site-${s}.status`, `site-${s}.accessible`]);
  const missing = required.filter((key) => !j.state.facts[key]);
  if (!missing.length) return { ok: true };
  let obs: NimbleObservation;
  try { obs = await observe(); } catch (e) {
    if (e instanceof AckError) throw e;
    return { ok: false, reason: sourceUnverifiedReason(e) };
  }
  const fresh = new Map(factsFromObservation(obs).map((f) => [f.key, f]));
  for (const key of missing) {
    const f = fresh.get(key);
    if (!f) return { ok: false, reason: `source_unverified: initial observation lacks ${key}` };
    await j.append("facts", f);
  }
  // Existing stale/superseded evidence is left for the normal revalidation/curator path.
  return { ok: true };
}

export function sourceUnverifiedReason(e: unknown): string {
  const err = e as Error & { code?: string };
  return `source_unverified: ${err.code && err.code !== "SOURCE_UNVERIFIED" ? `${err.code}: ` : ""}${err.message}`;
}

export type SiteView = { status: "open" | "closed"; accessible: boolean; price_cents: number };

/** Campsite candidates from whatever sites have a view; a missing/unverified site is simply not a candidate. */
export function campsiteCandidatesFrom(view: Record<string, SiteView | undefined>): CandidateX[] {
  const out: CandidateX[] = [];
  for (const s of ["A", "B", "C"]) {
    const v = view[`site${s}`];
    if (!v || typeof v.price_cents !== "number") continue;
    out.push({ resource: `site-${s}`, slot: "campsite" as Slot, price_cents: v.price_cents, accessible: v.accessible, status: v.status, date: resourceById(`site-${s}`).date });
  }
  return out;
}
