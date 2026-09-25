import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { missionKeys } from "./queries";

/**
 * The canonical refresh loop (P5.5/U01/U02): poll while nonterminal (see
 * `missionRefetchIntervalMs` in `mission-rules.ts`, wired at the call site), refetch after every
 * command (mutations invalidate this query key), and let SSE only *nudge* a refetch — every
 * message and every reconnect (a fresh `EventSource` after `error`/`close`) just calls
 * `invalidateQueries`. The event payload itself is never read or rendered as state, so an
 * out-of-order or missing hint cannot regress the view: whatever the ensuing GET returns still
 * passes through `pickNewerMissionSnapshot` in `queries.ts` before it can become the query's data.
 */
export function useMissionEvents(missionId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let source: EventSource;
    try {
      source = new EventSource(`/api/dead-reckoning/missions/${encodeURIComponent(missionId)}/events`);
    } catch {
      return;
    }
    const nudge = () => queryClient.invalidateQueries({ queryKey: missionKeys.detail(missionId) });
    source.addEventListener("message", nudge);
    source.addEventListener("error", () => {
      // A dropped SSE connection is not durable truth going missing — polling still carries the
      // view. Nothing to show the operator beyond what OperatorStatus/MissionBoard already render.
    });
    return () => source.close();
  }, [missionId, queryClient]);
}
