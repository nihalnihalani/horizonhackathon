// Adapted from OpenMuse apps/server/src/actions.ts ActionService.propose/decide (MIT, pin f5534c77). See ../NOTICE.md.
// Pure functions: the control actor persists the resulting APPROVAL_* events; nothing here executes an effect.
import { canonicalJson, sha256Hex } from "@dr/shared";

export type ApprovalBinding = {
  missionId: string;
  ownerId: string;
  planRevision: number;
  actionKey: string;
  slot: string;
  operation: "book" | "cancel";
  resourceId: string;
  argsHash: string;
};

export type Approval = ApprovalBinding & {
  approvalId: string;
  bindingHash: string;
  display: string;
  expiresAt: string;
  status: "awaiting_review" | "accepted" | "rejected" | "expired";
  decidedBy?: string;
  decisionCommandId?: string;
};

export const bindingHash = (b: ApprovalBinding): string => sha256Hex(canonicalJson({ v: 1, ...b }));

export function proposeApproval(b: ApprovalBinding, o: { now: number; ttlMs?: number; display: string }): Approval {
  const h = bindingHash(b);
  return {
    ...b, approvalId: `ap-${h.slice(0, 20)}`, bindingHash: h, display: o.display,
    expiresAt: new Date(o.now + (o.ttlMs ?? 30 * 60_000)).toISOString(), status: "awaiting_review",
  };
}

export class ApprovalError extends Error {
  constructor(public code: "APPROVAL_CHANGED" | "APPROVAL_EXPIRED" | "APPROVAL_FORBIDDEN" | "REVISION_CONFLICT" | "APPROVAL_NOT_ACCEPTED", m: string) {
    super(m); this.name = code;
  }
}

/**
 * Decide a review (U04). The caller must show the binding hash it displayed; any difference means the proposal
 * changed. Repeating an identical decision is idempotent; a different decision after one is recorded is refused.
 */
export function decideApproval(a: Approval, d: {
  actorId: string; displayedBindingHash: string; expectedPlanRevision: number; currentPlanRevision: number;
  decision: "accept" | "reject"; commandId: string; now: number;
}): Approval {
  if (d.actorId !== a.ownerId) throw new ApprovalError("APPROVAL_FORBIDDEN", "only the mission owner can decide");
  if (d.displayedBindingHash !== a.bindingHash) throw new ApprovalError("APPROVAL_CHANGED", "this proposal changed; open its latest review");
  if (d.expectedPlanRevision !== a.planRevision || d.currentPlanRevision !== a.planRevision) {
    throw new ApprovalError("REVISION_CONFLICT", `plan revision is ${d.currentPlanRevision}, review was for ${a.planRevision}`);
  }
  const want = d.decision === "accept" ? "accepted" : "rejected";
  if (a.status !== "awaiting_review") {
    if (a.status === want && a.decisionCommandId === d.commandId) return a;
    throw new ApprovalError("APPROVAL_CHANGED", `review already ${a.status}`);
  }
  if (Date.parse(a.expiresAt) <= d.now) throw new ApprovalError("APPROVAL_EXPIRED", "this review expired; create a fresh proposal");
  return { ...a, status: want, decidedBy: d.actorId, decisionCommandId: d.commandId };
}

/**
 * Checked again at the dispatch claim (invariant 17, U06): the accepted approval must bind exactly this commitment.
 * Expiry matters only before the claim; reconciliation of an already-claimed key never consults it.
 */
export function assertApprovalCovers(a: Approval | undefined, b: ApprovalBinding, now: number): void {
  if (!a || a.status !== "accepted") throw new ApprovalError("APPROVAL_NOT_ACCEPTED", "no accepted approval for this action");
  if (a.bindingHash !== bindingHash(b)) throw new ApprovalError("APPROVAL_CHANGED", "approval was granted for a different action key, slot, resource, arguments or plan revision");
  if (Date.parse(a.expiresAt) <= now) throw new ApprovalError("APPROVAL_EXPIRED", "approval expired before dispatch claim");
}
