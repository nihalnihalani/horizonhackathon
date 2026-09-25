import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import type { MissionListItem, MissionSnapshot } from "./types";

export const missionKeys = {
  all: ["dead-reckoning-missions"] as const,
  list: () => ["dead-reckoning-missions", "list"] as const,
  detail: (missionId: string) => ["dead-reckoning-missions", "detail", missionId] as const,
};

export function missionApiPath(missionId: string): string {
  return `/api/dead-reckoning/missions/${encodeURIComponent(missionId)}`;
}

/**
 * The mission REST API (`packages/control/src/{actor,server,mission-port,lifecycle}.ts`) is owned
 * and being implemented by another builder in parallel with this proxy; CONTRACTS §5 documents
 * `GET /missions/:id` returning "the canonical snapshot" but does not specify whether a list
 * endpoint wraps its array in an envelope key. Reading the raw body rather than unwrapping a
 * guessed key (`client(path, key, opts)`) keeps this working whichever shape lands; narrow this
 * once the real response is observed.
 */
export function missionListQueryOptions() {
  return queryOptions({
    queryKey: missionKeys.list(),
    queryFn: async (): Promise<MissionListItem[]> => {
      const response = await client("/api/dead-reckoning/missions", {
        fallback: "Could not load Dead Reckoning missions",
      });
      const body = (await response.json().catch(() => null)) as unknown;
      if (Array.isArray(body)) return body as MissionListItem[];
      const wrapped = (body as { missions?: unknown })?.missions;
      return Array.isArray(wrapped) ? (wrapped as MissionListItem[]) : [];
    },
    // Terminal-status missions are cheap to keep fresh, and P5.5 wants active missions polled
    // client-side (WorkingContextTray/OperatorStatus) rather than this list going stale silently.
    refetchInterval: 5_000,
  });
}

/**
 * Never let a fetch resolving out of order regress the displayed mission (U02): an SSE hint only
 * ever triggers a plain refetch, never carries state of its own, and a reconnect racing a slow
 * poll can land either response first. `undefined` current (first load, or a cleared cache after
 * a reload) always accepts the incoming snapshot — there is nothing yet to protect.
 */
export function pickNewerMissionSnapshot(
  current: MissionSnapshot | undefined,
  incoming: MissionSnapshot,
): MissionSnapshot {
  if (!current) return incoming;
  return incoming.revision < current.revision ? current : incoming;
}

/**
 * The mission board's canonical read. Polling cadence (1.5s while nonterminal, per P5.5/U01) is
 * the route component's job, not this factory's — it depends on the currently displayed status.
 *
 * `queryClient` is required (not optional) so the revision guard above is always wired in, rather
 * than being something a call site can forget: every fetched snapshot is merged against whatever
 * is already cached under this mission's key through {@link pickNewerMissionSnapshot} before it is
 * allowed to become the query's data.
 */
export function missionQueryOptions(missionId: string, queryClient: QueryClient) {
  return queryOptions({
    queryKey: missionKeys.detail(missionId),
    queryFn: async (): Promise<MissionSnapshot> => {
      const response = await client(missionApiPath(missionId), {
        fallback: "Could not load this mission",
      });
      const incoming = (await response.json()) as MissionSnapshot;
      const current = queryClient.getQueryData<MissionSnapshot>(missionKeys.detail(missionId));
      return pickNewerMissionSnapshot(current, incoming);
    },
  });
}
