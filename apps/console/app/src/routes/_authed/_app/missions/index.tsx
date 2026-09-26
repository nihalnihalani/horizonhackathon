import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { STATUS_LABEL, statusTone } from "@/components/dead-reckoning/status";
import { StatusPill } from "@/components/dead-reckoning/status-pill";
import { PageEmpty, PageRows, PageSection, PageShell } from "@/components/layout/page-shell";
import { SidebarToggleBar } from "@/components/layout/sidebar-toggle";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createMissionMutationOptions } from "@/lib/dead-reckoning/mutations";
import { missionListQueryOptions } from "@/lib/dead-reckoning/queries";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/_app/missions/")({
  component: MissionsIndexScreen,
});

function MissionsIndexScreen() {
  const { data: missions, isPending, isError } = useQuery(missionListQueryOptions());
  const navigate = useNavigate();
  const create = useMutation(createMissionMutationOptions(queryClient));
  // Keep this identity for retries after an uncertain response: do not create another mission.
  const [commandId] = useState(() => crypto.randomUUID());

  async function createTrip() {
    try {
      const mission = await create.mutateAsync({ commandId, goal: "F3 Angel Island accessible camping trip", review: "auto" });
      await navigate({ to: "/missions/$missionId", params: { missionId: mission.missionId } });
    } catch {
      // The mutation error remains visible; its original commandId is retained for a safe retry.
    }
  }

  return (
    <>
      <SidebarToggleBar />
      <PageShell
        title="Dead Reckoning missions"
        description="Prepare a ferry booking to review with the operator, or explore a simulated mission that survives interruption."
      >
        <PageSection title="Prepare a real ferry booking">
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-base font-semibold">Tiburon → Angel Island</h2>
              <p className="text-sm text-muted-foreground">Friday, October 9, 2026 · 10:00 AM Pacific · 1–6 adult travelers</p>
              <p className="max-w-xl text-sm text-muted-foreground">
                Check current operator guidance and prepare the actual ferry booking form with your departure and party.
                Review the current fare, availability and terms, then submit and pay on the provider’s website.
                Preparation does not reserve seats.
              </p>
            </div>
            <a
              href="http://127.0.0.1:4430/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Prepare ferry booking ↗
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This opens the local preparation product in a new tab. If it is not running, start <code>npm run demo:product</code> from the repository root.
          </p>
        </PageSection>
        <PageSection title="Simulated recovery mission">
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-base font-semibold">Rehearse an accessible weekend on Angel Island</h2>
              <p className="text-sm text-muted-foreground">October 9–11 · 2 travelers · $400 budget · wheelchair access required</p>
              <p className="max-w-xl text-sm text-muted-foreground">
                Create the fixed rehearsal mission, then choose Resume on its board to start the worker.
                Running it authorizes simulated ferry, campsite, permit and gear bookings within these constraints.
                The configured backend determines which providers run.
              </p>
            </div>
            <Button disabled={create.isPending} onClick={() => void createTrip()}>
              {create.isPending ? "Creating rehearsal…" : "Create simulated mission"}
            </Button>
          </div>
          {create.error ? <p className="mt-3 text-sm text-destructive" role="alert">{create.error.message}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">
            For the standalone rehearsal with no API keys, run <code>npm run demo:local</code> from the repository root and open the local URL it prints.
          </p>
        </PageSection>
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
