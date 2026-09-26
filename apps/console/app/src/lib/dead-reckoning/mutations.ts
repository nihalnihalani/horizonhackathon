import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { missionApiPath, missionKeys } from "./queries";

const FALLBACK = "Dead Reckoning operator command failed";

function invalidateMission(queryClient: QueryClient, missionId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: missionKeys.detail(missionId) }),
    queryClient.invalidateQueries({ queryKey: missionKeys.list() }),
  ]);
}

export type MissionOperatorCommandInput = {
  missionId: string;
  /** Every mutation carries a fresh commandId (MissionCommand, CONTRACTS §5); duplicates dedupe. */
  commandId: string;
  expectedRevision: number;
};

function operatorCommandMutation(verb: "resume" | "pause" | "cancel", queryClient: QueryClient) {
  return mutationOptions({
    // The command's durable effect is the mission's own next revision, refetched below; this
    // mutation only needs to know the request succeeded (202, per CONTRACTS §5).
    mutationFn: async (input: MissionOperatorCommandInput): Promise<void> => {
      await client(`${missionApiPath(input.missionId)}/${verb}`, {
        method: "POST",
        body: { commandId: input.commandId, expectedRevision: input.expectedRevision },
        fallback: FALLBACK,
      });
    },
    onSuccess: (_data, variables) => invalidateMission(queryClient, variables.missionId),
  });
}

export function resumeMissionMutationOptions(queryClient: QueryClient) {
  return operatorCommandMutation("resume", queryClient);
}

export function pauseMissionMutationOptions(queryClient: QueryClient) {
  return operatorCommandMutation("pause", queryClient);
}

export function cancelMissionMutationOptions(queryClient: QueryClient) {
  return operatorCommandMutation("cancel", queryClient);
}

export type CreateMissionInput = {
  commandId: string;
  goal: string;
  /** The current control API runs the fixed F3 constraints; it rejects arbitrary constraints. */
  review?: "auto" | "per_action";
};

export type CreatedMission = { missionId: string; revision: number };

export function createMissionMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: CreateMissionInput): Promise<CreatedMission> => {
      const response = await client("/api/dead-reckoning/missions", { method: "POST", body: input, fallback: FALLBACK });
      const created: unknown = await response.json();
      if (!created || typeof created !== "object"
        || !("missionId" in created) || typeof created.missionId !== "string" || !created.missionId
        || !("revision" in created) || !Number.isInteger(created.revision) || Number(created.revision) < 0) {
        throw new Error("The mission was accepted but its identifier was missing. Refresh the mission list before trying again.");
      }
      return { missionId: created.missionId, revision: Number(created.revision) };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.list() }),
  });
}
