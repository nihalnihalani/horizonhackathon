import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MissionSnapshot } from "@/lib/dead-reckoning/types";

/**
 * A bounded excerpt of one fact's provenance — source/task id, retrieval mode, observed time — the
 * durable evidence a recalled or evicted item still points back to. Simple by design (P5.4): this
 * reads straight from the already-fetched snapshot's `facts`, rather than calling a separate
 * `GET /missions/:id/evidence/:evidenceId` proxy route, which is out of this slice's scope.
 */
export function EvidenceDrawer({
  fact,
  onClose,
}: {
  fact: MissionSnapshot["facts"][number] | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={fact !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fact?.key ?? "Evidence"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="mt-4 overflow-y-auto">
          {fact ? (
            <dl className="space-y-3 text-sm">
              <Row label="Value" value={formatValue(fact.value)} />
              <Row label="Status" value={fact.status} />
              <Row label="Observed at" value={fact.observedAt} />
              <Row
                label="Retrieval mode"
                value={
                  fact.retrievalMode === "cache"
                    ? "cache (not live — cannot authorize a freshness-dependent action)"
                    : (fact.retrievalMode ?? "unknown")
                }
              />
              <Row label="Task ID" value={fact.taskId ?? "—"} />
            </dl>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
