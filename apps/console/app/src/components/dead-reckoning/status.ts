import type { MissionStatus, ReconciliationStatus } from "@/lib/dead-reckoning/types";

/**
 * A short present-tense sentence for each mission status, for the operator page's status line
 * (VALIDATION_AND_DEMO.md §7: "Operator page: status enum, notice"). Never invents a "fully
 * booked"/"all booked" success reading — `valid` is the only terminal success, and its own label
 * still says nothing about individual commitments; `ProofPanel`/`ReceiptRail` carry that detail.
 */
export const STATUS_LABEL: Record<MissionStatus, string> = {
  created: "Created, not yet started",
  queued: "Queued",
  restoring: "Restoring from RawTree",
  reconciling: "Reconciling unresolved commitments",
  revalidating: "Revalidating stale evidence",
  planning: "Planning",
  executing: "Executing",
  curating: "Curating working context",
  waiting_approval: "Waiting on operator approval",
  pausing: "Pausing",
  paused: "Paused",
  cancelling: "Cancelling",
  cancelled: "Cancelled",
  valid: "Valid",
  blocked: "Blocked",
  failed: "Failed",
};

export type StatusTone = "neutral" | "progress" | "success" | "warning" | "danger";

export function statusTone(status: MissionStatus): StatusTone {
  switch (status) {
    case "valid":
      return "success";
    case "blocked":
    case "failed":
      return "danger";
    case "paused":
    case "cancelled":
    case "waiting_approval":
      return "warning";
    case "created":
      return "neutral";
    default:
      return "progress";
  }
}

export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  progress: "bg-primary/10 text-primary",
  success: "bg-[color-mix(in_oklch,var(--primary),transparent_80%)] text-primary",
  warning: "bg-[color-mix(in_oklch,oklch(0.7_0.15_70),transparent_75%)] text-[oklch(0.5_0.15_70)] dark:text-[oklch(0.8_0.15_70)]",
  danger: "bg-destructive/10 text-destructive",
};

export function reconciliationLabel(status: ReconciliationStatus): string | null {
  if (status === "none") return null;
  if (status === "polling") return "Reconciling an unresolved effect (bounded polling)";
  return "Reconciliation blocked — an effect's outcome could not be established";
}
