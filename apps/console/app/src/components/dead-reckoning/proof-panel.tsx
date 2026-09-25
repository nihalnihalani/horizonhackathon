import type { MissionSnapshot } from "@/lib/dead-reckoning/types";
import { StatusPill } from "./status-pill";

/**
 * "These records and measurements are from the run, not generated narration"
 * (VALIDATION_AND_DEMO.md §7). Every value here is a direct field off the canonical snapshot —
 * revision, epoch, worker identity, action/receipt/task IDs — nothing summarized or reworded.
 */
export function ProofPanel({ mission }: { mission: MissionSnapshot }) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Field label="Revision" value={String(mission.revision)} />
        <Field label="Epoch" value={String(mission.epoch)} />
        <Field label="Updated" value={mission.updatedAt} />
        <Field label="Arm" value={mission.arm} />
        <Field label="Worker PID" value={mission.worker.pid === null ? "no worker" : `${mission.worker.pid} (gen ${mission.worker.generation})`} />
        <Field label="Worker state" value={mission.worker.state} />
        <Field
          label="Last exit"
          value={
            mission.worker.lastExit
              ? `pid ${mission.worker.lastExit.pid} · ${mission.worker.lastExit.signal ?? mission.worker.lastExit.code ?? "unknown"}`
              : "—"
          }
        />
        <Field
          label="Sources"
          value={`RawTree ${mission.availability.rawtree}${mission.availability.lastKnown ? " (last known)" : ""} · desk ${mission.availability.desk}`}
        />
      </dl>

      {mission.commitments.length > 0 ? (
        <div>
          <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Commitments</h4>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {mission.commitments.map((c) => (
              <li key={c.actionKey} className="flex items-center gap-2">
                <StatusPill tone={c.status === "confirmed" ? "success" : c.status === "rejected" ? "danger" : "progress"}>
                  {c.status}
                </StatusPill>
                <span className="truncate">{c.actionKey}</span>
                <span className="text-muted-foreground">{c.receiptId ?? "no receipt"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mission.facts.length > 0 ? (
        <div>
          <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Evidence sources</h4>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {mission.facts.map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <span className="truncate">{f.key}</span>
                <span className="text-muted-foreground">
                  {f.retrievalMode ?? "unknown"} · task {f.taskId ?? "—"} · {f.observedAt}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mission.verdict ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="font-medium">{mission.verdict.verdict}</span>
          <p className="mt-1 text-muted-foreground">{mission.verdict.reason}</p>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  );
}
