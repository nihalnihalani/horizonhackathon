import { queryOptions } from "@tanstack/react-query";
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
 * The mission board's canonical read. Polling cadence (1.5s while nonterminal, per P5.5/U01) is
 * the route component's job, not this factory's — it depends on the currently displayed status.
 */
export function missionQueryOptions(missionId: string) {
  return queryOptions({
    queryKey: missionKeys.detail(missionId),
    queryFn: async (): Promise<MissionSnapshot> => {
      const response = await client(missionApiPath(missionId), {
        fallback: "Could not load this mission",
      });
      return (await response.json()) as MissionSnapshot;
    },
  });
}
