// Canonical booking arguments shared by caller (kernel) and desk. Desk recomputes; never trusts a supplied hash.
import { argsHash } from "@dr/shared";
import type { Arm, Slot } from "@dr/shared";

export type BookArgs = { run_id: string; arm: Arm; slot: Slot; resource: string; date: string; party: number; expected_world_version: number };

export function bookArgsHash(a: BookArgs): string {
  return argsHash({
    run_id: a.run_id, arm: a.arm, slot: a.slot, resource: a.resource,
    date: a.date, party: a.party, expected_world_version: a.expected_world_version,
  });
}
