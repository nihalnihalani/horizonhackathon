import { type ReactNode, useState } from "react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { allBookableStepsConfirmed } from "@/lib/dead-reckoning/mission-rules";
import type { MissionSnapshot } from "@/lib/dead-reckoning/types";
import { ConstraintStrip } from "./constraint-strip";
import { EvidenceDrawer } from "./evidence-drawer";
import { reconciliationLabel } from "./status";
import { StatusPill } from "./status-pill";

/**
 * The route/current-step view. Reads `plan` + `commitments` straight off the canonical snapshot —
 * never labels a step "booked" from a plan decision alone, only from a `commitments[].status ===
 * "confirmed"` row, and never renders a summary claiming everything is booked unless every plan
 * step with a resource has a confirmed commitment (AGENTS.md invariant 11 / U01).
 */
export function MissionBoard({ mission }: { mission: MissionSnapshot }) {
  const [openFactKey, setOpenFactKey] = useState<string | null>(null);
  const openFact = mission.facts.find((f) => f.key === openFactKey) ?? null;

  const reconciliation = reconciliationLabel(mission.reconciliationStatus);
  const allConfirmed = allBookableStepsConfirmed(mission.plan, mission.commitments);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium text-sm">Constraints</h3>
        <div className="mt-2">
          <ConstraintStrip constraints={mission.constraints} />
        </div>
      </section>

      {mission.worker.state === "stopped" || mission.worker.pid === null ? (
        <Notice tone="warning">
          Worker stopped. Durable mission state is shown; nothing is currently executing.
        </Notice>
      ) : null}
      {mission.availability.rawtree === "unavailable" ? (
        <Notice tone="danger">
          RawTree is unavailable{mission.availability.lastKnown ? " — showing the last known snapshot" : ""}.
        </Notice>
      ) : null}
      {mission.availability.desk === "unavailable" ? (
        <Notice tone="danger">Desk is unavailable. No new simulated effect can be authorized right now.</Notice>
      ) : null}
      {reconciliation ? <Notice tone="warning">{reconciliation}</Notice> : null}
      {mission.status === "blocked" && mission.blockedReason ? (
        <Notice tone="danger">Blocked: {mission.blockedReason}</Notice>
      ) : null}
      {allConfirmed ? (
        <Notice tone="success">Every bookable step has a confirmed simulated receipt.</Notice>
      ) : null}

      <section>
        <h3 className="font-medium text-sm">Route</h3>
        {mission.plan.length === 0 ? (
          <p className="mt-2 text-muted-foreground text-sm">No plan steps yet.</p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card dark:border-transparent [&_[data-slot=item]]:rounded-none">
            {mission.plan.map((step, i) => {
              const commitment = mission.commitments.find((c) => c.slot === step.slot);
              return (
                <div key={step.stepId}>
                  {i > 0 ? <Separator /> : null}
                  <Item size="sm">
                    <ItemContent>
                      <ItemTitle className="flex items-center gap-2">
                        {step.slot}
                        {step.resource ? (
                          <span className="text-muted-foreground font-normal">→ {step.resource}</span>
                        ) : null}
                        {commitment ? (
                          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Simulated
                          </span>
                        ) : null}
                      </ItemTitle>
                      {step.reason ? <ItemDescription>{step.reason}</ItemDescription> : null}
                    </ItemContent>
                    <ItemActions>
                      <StatusPill tone={planStepTone(step.status, commitment?.status)}>
                        {commitment ? commitment.status : step.status}
                      </StatusPill>
                    </ItemActions>
                  </Item>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {mission.facts.length > 0 ? (
        <section>
          <h3 className="font-medium text-sm">Evidence</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {mission.facts.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setOpenFactKey(f.key)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted"
              >
                {f.key}
                {f.retrievalMode === "cache" ? <span className="ml-1 text-muted-foreground">(cache)</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <EvidenceDrawer fact={openFact} onClose={() => setOpenFactKey(null)} />
    </div>
  );
}

function planStepTone(stepStatus: string, commitmentStatus: string | undefined) {
  if (commitmentStatus === "confirmed") return "success" as const;
  if (commitmentStatus === "rejected" || stepStatus === "blocked") return "danger" as const;
  if (commitmentStatus) return "progress" as const;
  return "neutral" as const;
}

function Notice({ tone, children }: { tone: "warning" | "danger" | "success"; children: ReactNode }) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "success"
        ? "border-primary/30 bg-primary/5 text-primary"
        : "border-border bg-muted text-foreground";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${toneClass}`} role="status">{children}</div>;
}
