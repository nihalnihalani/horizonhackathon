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
  constraints: { key: string; value: unknown }[];
};

export function createMissionMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: CreateMissionInput): Promise<void> => {
      await client("/api/dead-reckoning/missions", { method: "POST", body: input, fallback: FALLBACK });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.list() }),
  });
}
