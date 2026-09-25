# Provenance

Concepts adapted from OpenMuse (MIT, Copyright (c) 2026 OpenMuse contributors), pinned commit
`f5534c77a8c8740cf792ca73b1f7737829fb7518`:

| DR file | Upstream source | What was kept | What changed |
|---|---|---|---|
| `src/task-context.ts` | `apps/server/src/engine/worker.ts` lines 6–22 (`LostLeaseError`, `TaskContext`) | `signal`, `guard()`, `event()` shape; guard throws when the task was paused, cancelled or taken over | `checkpoint(Partial<AgentTask>)` is replaced by `submit(transition)`, a typed domain transition sent to the single DR control writer. Leases are replaced by the actor's generation number. No SQL store, polling or scheduler. |
| `src/approval.ts` | `apps/server/src/actions.ts` lines 31–190 (`ActionService.propose/decide`) | exact-operation hash, expiry, ownership, "proposal changed" and "resume before approving" refusals, `outcome_unknown` on ambiguous execution | The binding hash covers mission, owner, plan revision, action key, slot, operation kind/resource and canonical `argsHash` (CONTRACTS §3). Approval is checked again at the dispatch claim; it never executes an effect itself. No mail/calendar/Google types. |

The upstream MIT license text is reproduced in the root `THIRD_PARTY_NOTICES.md`.
