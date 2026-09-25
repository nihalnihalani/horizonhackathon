import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  cancelMissionMutationOptions,
  pauseMissionMutationOptions,
  resumeMissionMutationOptions,
} from "@/lib/dead-reckoning/mutations";
import type { MissionSnapshot } from "@/lib/dead-reckoning/types";
import { queryClient } from "@/query-client";
import { STATUS_LABEL, statusTone } from "./status";
import { StatusPill } from "./status-pill";

/**
 * "Operator page: status enum, notice, Save, Resume" (VALIDATION_AND_DEMO.md §7). Every command
 * here carries a fresh `commandId` (duplicates dedupe at the actor, CONTRACTS §5/D02) and the
 * revision the operator is currently looking at (`expectedRevision`) — a stale click against an
 * advanced mission is a `409 REVISION_CONFLICT`, not a silent no-op or a second effect.
 */
export function OperatorStatus({ mission }: { mission: MissionSnapshot }) {
  const resume = useMutation(resumeMissionMutationOptions(queryClient));
  const pause = useMutation(pauseMissionMutationOptions(queryClient));
  const cancel = useMutation(cancelMissionMutationOptions(queryClient));

  const command = (mutation: typeof resume) =>
    mutation.mutate({ missionId: mission.missionId, commandId: crypto.randomUUID(), expectedRevision: mission.revision });

  const busy = resume.isPending || pause.isPending || cancel.isPending;
  const error = resume.error ?? pause.error ?? cancel.error;

  // CONTRACTS §3: Resume starts a created mission and restarts a paused/pausing, recoverably blocked, or
  // nonterminal mission whose worker has exited; control still rejects an active worker (WORKER_ACTIVE).
  const workerLive = ["running", "starting", "holding"].includes(mission.worker.state);
  const canResume = ["created", "paused", "pausing", "blocked"].includes(mission.status)
    || (!["cancelling", "cancelled", "valid", "failed"].includes(mission.status) && !workerLive);
  const canPause = !["paused", "pausing", "cancelling", "cancelled", "valid", "failed"].includes(mission.status);
  const canCancel = !["cancelling", "cancelled", "valid", "failed"].includes(mission.status);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <StatusPill tone={statusTone(mission.status)}>{STATUS_LABEL[mission.status]}</StatusPill>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!canResume || busy} onClick={() => command(resume)}>
            Resume
          </Button>
          <Button size="sm" variant="outline" disabled={!canPause || busy} onClick={() => command(pause)}>
            Pause
          </Button>
          <Button size="sm" variant="destructive" disabled={!canCancel || busy} onClick={() => command(cancel)}>
            Cancel
          </Button>
        </div>
      </div>
      {mission.blockedReason ? (
        <p className="text-destructive text-sm" role="alert">
          Blocked: {mission.blockedReason}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error instanceof Error ? error.message : "That command failed."}
        </p>
      ) : null}
    </div>
  );
}
