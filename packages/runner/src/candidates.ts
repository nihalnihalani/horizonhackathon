// Deterministic pre-planner check (V01/F3b): when code filtering leaves no candidate, the step blocks with a stable
// reason instead of asking the model to narrate one. Same filter the planner applies (providers/planner.ts).
import { filterCandidates, type CandidateX, type PlannerContext } from "@dr/providers";
import { noCandidateReason } from "./validator.ts";

export const NO_ACCESSIBLE_SITE = "no_accessible_site_available";

/** null when at least one candidate survives; otherwise the explicit blocked reason. */
/** Same reason text as the post-planner F3b path (validator.noCandidateReason), so demo:f3b checks either path. */
export function preplannerBlock(cands: CandidateX[], ctx: PlannerContext, slot: string): string | null {
  const { valid, rejected } = filterCandidates(cands, ctx, slot);
  if (valid.length) return null;
  // Only an accessibility/availability shortfall is "no accessible site"; e.g. budget exhaustion is labelled generically.
  const accessOnly = slot === "campsite" && rejected.length > 0 && rejected.every((r) => r.reason === "closed" || r.reason === "not_accessible");
  if (accessOnly) return noCandidateReason(slot, ctx.constraints.accessible_required, rejected);
  const why = rejected.map((r) => `${r.resource}: ${r.reason}`).join(", ") || "no candidates";
  return `no_valid_${slot}_candidate: (${why})`;
}
