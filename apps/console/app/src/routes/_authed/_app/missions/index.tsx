import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { STATUS_LABEL, statusTone } from "@/components/dead-reckoning/status";
import { StatusPill } from "@/components/dead-reckoning/status-pill";
import { PageEmpty, PageRows, PageSection, PageShell } from "@/components/layout/page-shell";
import { SidebarToggleBar } from "@/components/layout/sidebar-toggle";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { missionListQueryOptions } from "@/lib/dead-reckoning/queries";

export const Route = createFileRoute("/_authed/_app/missions/")({
  component: MissionsIndexScreen,
});

function MissionsIndexScreen() {
  const { data: missions, isPending, isError } = useQuery(missionListQueryOptions());

  return (
    <>
      <SidebarToggleBar />
      <PageShell
        title="Dead Reckoning missions"
        description="Durable trip missions: constraints, receipts and working context survive a worker restart."
      >
        <PageSection title="Missions">
          {isPending ? null : isError ? (
            <p className="mt-4 text-destructive text-sm" role="alert">
              Could not load Dead Reckoning missions.
            </p>
          ) : missions?.length === 0 ? (
            <PageEmpty>No missions yet.</PageEmpty>
          ) : (
            <PageRows>
              {missions?.map((mission, i) => (
                <div key={mission.missionId}>
                  {i > 0 ? <Separator /> : null}
                  <Item
                    size="sm"
                    render={
                      <Link to="/missions/$missionId" params={{ missionId: mission.missionId }} />
                    }
                  >
                    <ItemContent>
                      <ItemTitle>{mission.goal}</ItemTitle>
                      <ItemDescription>
                        {mission.missionId} · revision {mission.revision} · updated {mission.updatedAt}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <StatusPill tone={statusTone(mission.status)}>{STATUS_LABEL[mission.status]}</StatusPill>
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </PageRows>
          )}
        </PageSection>
      </PageShell>
    </>
  );
}
