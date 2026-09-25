import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MissionBoard } from "@/components/dead-reckoning/mission-board";
import { OperatorStatus } from "@/components/dead-reckoning/operator-status";
import { ProofPanel } from "@/components/dead-reckoning/proof-panel";
import { ReceiptRail } from "@/components/dead-reckoning/receipt-rail";
import { WorkingContextTray } from "@/components/dead-reckoning/working-context-tray";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { SidebarToggleBar } from "@/components/layout/sidebar-toggle";
import { missionRefetchIntervalMs } from "@/lib/dead-reckoning/mission-rules";
import { missionQueryOptions } from "@/lib/dead-reckoning/queries";
import { useMissionEvents } from "@/lib/dead-reckoning/use-mission-events";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/_app/missions/$missionId")({
  component: MissionDetailScreen,
});

function MissionDetailScreen() {
  const { missionId } = Route.useParams();
  // A reload always starts from a plain GET against a query the router just created (no
  // `initialData`), so a worker-death reload shows the current canonical revision/status rather
  // than a historical success message held in memory (U01).
  const mission = useQuery({
    ...missionQueryOptions(missionId, queryClient),
    refetchInterval: (query) => missionRefetchIntervalMs(query.state.data?.status),
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
