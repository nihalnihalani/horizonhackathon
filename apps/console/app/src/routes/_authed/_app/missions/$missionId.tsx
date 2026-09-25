import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { MissionBoard } from "@/components/dead-reckoning/mission-board";
import { OperatorStatus } from "@/components/dead-reckoning/operator-status";
import { ProofPanel } from "@/components/dead-reckoning/proof-panel";
import { ReceiptRail } from "@/components/dead-reckoning/receipt-rail";
import { WorkingContextTray } from "@/components/dead-reckoning/working-context-tray";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { SidebarToggleBar } from "@/components/layout/sidebar-toggle";
import { missionKeys, missionQueryOptions } from "@/lib/dead-reckoning/queries";
import { isTerminalStatus } from "@/lib/dead-reckoning/types";

export const Route = createFileRoute("/_authed/_app/missions/$missionId")({
  component: MissionDetailScreen,
});

/**
 * The canonical refresh loop (P5.5/U01/U02): poll while nonterminal, refetch after every command
 * (mutations invalidate this query key), and let SSE only *nudge* a refetch — the event payload
 * itself is never rendered as state, so an out-of-order or missing hint cannot regress the view.
 * A reload always starts from a plain GET, so a worker-death reload shows the current canonical
 * revision rather than a historical success message held in memory.
 */
function useMissionEvents(missionId: string) {
  const queryClient = useQueryClient();
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let source: EventSource;
    try {
      source = new EventSource(`/api/dead-reckoning/missions/${encodeURIComponent(missionId)}/events`);
    } catch {
      return;
    }
    sourceRef.current = source;
    const nudge = () => queryClient.invalidateQueries({ queryKey: missionKeys.detail(missionId) });
    source.addEventListener("message", nudge);
    source.addEventListener("error", () => {
      // A dropped SSE connection is not durable truth going missing — polling still carries the
      // view. Nothing to show the operator beyond what OperatorStatus/MissionBoard already render.
    });
    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [missionId, queryClient]);
}

function MissionDetailScreen() {
  const { missionId } = Route.useParams();
  const mission = useQuery({
    ...missionQueryOptions(missionId),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && isTerminalStatus(data.status) ? false : 1_500;
    },
  });
  useMissionEvents(missionId);

  return (
    <>
      <SidebarToggleBar />
      <PageShell
        title={mission.data?.missionId ?? missionId}
        description="Durable mission state, refetched after every command and on reload — never a cached historical success message."
        backButton={{ label: "Missions", linkProps: { to: "/missions" } }}
      >
        {mission.isPending ? null : mission.isError ? (
          <p className="mt-4 text-destructive text-sm" role="alert">
            Could not load this mission. It may be unavailable, or the current session may not be
            authorized to view it.
          </p>
        ) : mission.data ? (
          <>
            <PageSection title="Operator">
              <OperatorStatus mission={mission.data} />
            </PageSection>
            <PageSection title="Mission">
              <MissionBoard mission={mission.data} />
            </PageSection>
            <PageSection title="Receipts">
              <ReceiptRail receipts={mission.data.receipts} />
            </PageSection>
            <PageSection title="Working context" description="What is in the planner's current input, and why.">
              <WorkingContextTray context={mission.data.context} />
            </PageSection>
            <PageSection title="Proof">
              <ProofPanel mission={mission.data} />
            </PageSection>
          </>
        ) : null}
      </PageShell>
    </>
  );
}
