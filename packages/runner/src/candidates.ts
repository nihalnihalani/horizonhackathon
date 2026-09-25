// Deterministic pre-planner check (V01/F3b): when code filtering leaves no candidate, the step blocks with a stable
// reason instead of asking the model to narrate one. Same filter the planner applies (providers/planner.ts).
import { filterCandidates, type CandidateX, type PlannerContext } from "@dr/providers";

export const NO_ACCESSIBLE_SITE = "no_accessible_site_available";

/** null when at least one candidate survives; otherwise the explicit blocked reason. */
export function noCandidateReason(cands: CandidateX[], ctx: PlannerContext, slot: string): string | null {
  const { valid, rejected } = filterCandidates(cands, ctx, slot);
  if (valid.length) return null;
  const detail = rejected.map((r) => `${r.resource}:${r.reason}`).join(", ");
  if (slot === "campsite" && rejected.every((r) => r.reason === "closed" || r.reason === "not_accessible")) return `${NO_ACCESSIBLE_SITE} (${detail})`;
  return `no_valid_candidate (${detail || "no candidates"})`;
}
