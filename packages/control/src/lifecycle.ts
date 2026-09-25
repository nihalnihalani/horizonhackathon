// Mission lifecycle reducer (CONTRACTS §3, §5, §6): pure decisions over MissionMeta. The actor applies them inside its
// serialized queue, so every decision here sees the state left by the previous command or claim.
import {
  TERMINAL_STATUSES, argsHash, canTransition, sha256Hex,
  type ApiError, type CommandKind, type CrashPoint, type DispatchClaim, type MissionMeta, type MissionStatus,
} from "@dr/shared";

export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 503;
export type Refusal = { code: string; message: string; status: HttpStatus; retryable?: boolean };

export type CommandInput = { commandId: string; kind: CommandKind; missionId?: string; expectedRevision?: number; args: Record<string, unknown> };

/** Hash of everything that makes two commands "the same command" (D02/D03). */
export function commandArgsHash(cmd: CommandInput): string {
  return argsHash({ kind: cmd.kind, missionId: cmd.missionId ?? null, expectedRevision: cmd.expectedRevision ?? null, args: cmd.args });
}

export type CommandDecision =
  | { kind: "accept" }
  | { kind: "duplicate"; result: unknown }
  | { kind: "conflict"; refusal: Refusal }
  | { kind: "invalid"; refusal: Refusal };

/**
 * Dedupe + optimistic concurrency, checked before the kind-specific transition rule.
 * Same id + same args → the original result (D02). Same id, different args → 409 (D03).
 * expectedRevision ≠ current revision → REVISION_CONFLICT (D04).
 */
export function decideCommand(meta: MissionMeta | null, cmd: CommandInput, hash: string, currentRevision: number): CommandDecision {
  const prior = meta?.commands[cmd.commandId];
  if (prior) {
    if (prior.argsHash === hash && prior.kind === cmd.kind) return { kind: "duplicate", result: prior.result };
    return { kind: "conflict", refusal: { code: "COMMAND_CONFLICT", status: 409, message: `commandId ${cmd.commandId} was already used with different arguments` } };
  }
  if (cmd.kind === "create") return { kind: "accept" };
  if (!meta) return { kind: "invalid", refusal: { code: "NOT_FOUND", status: 404, message: "unknown mission" } };
  if (cmd.expectedRevision !== undefined && cmd.expectedRevision !== currentRevision) {
    return { kind: "conflict", refusal: { code: "REVISION_CONFLICT", status: 409, message: `expected revision ${cmd.expectedRevision}, current ${currentRevision}` } };
  }
  return { kind: "accept" };
}

export const unresolvedClaims = (meta: MissionMeta): DispatchClaim[] => Object.values(meta.claims);
export const isTerminal = (s: MissionStatus): boolean => TERMINAL_STATUSES.includes(s);

const invalid = (message: string): Refusal => ({ code: "INVALID_TRANSITION", status: 409, message });

/**
 * Resume admission (CONTRACTS §3). Accepts the initial start (`created`), paused/pausing, a recoverable block, or any
 * nonterminal mission whose child is confirmed exited. The resulting status is always `queued`: restore/reconcile runs
 * first. The frozen TRANSITIONS table lacks pausing→queued and <active>→queued after child exit; those edges are the
 * contract's Resume rule, so they are admitted here explicitly (reported as a contract change request).
 */
export function decideResume(meta: MissionMeta, childActive: boolean): { next: MissionStatus } | Refusal {
  if (childActive) return { code: "WORKER_ACTIVE", status: 409, message: "a runner generation is still active for this mission" };
  if (meta.status === "cancelling" || meta.status === "cancelled") return invalid(`resume would revoke cancellation (status ${meta.status})`);
  if (meta.status === "valid") return invalid("mission already completed valid");
  if (meta.status === "failed") return invalid("failed mission needs a new isolated mission");
  return { next: "queued" };
}

/** Pause: stop new claims. With an in-flight claim → `pausing` (wait for reconciliation); otherwise `paused`. */
export function decidePause(meta: MissionMeta): { next: MissionStatus[] } | Refusal {
  if (meta.status === "paused") return { next: [] };
  if (meta.status === "pausing") return { next: unresolvedClaims(meta).length ? [] : ["paused"] };
  if (isTerminal(meta.status) || meta.status === "cancelling") return invalid(`cannot pause from ${meta.status}`);
  if (!canTransition(meta.status, "pausing")) return invalid(`cannot pause from ${meta.status}`);
  return { next: unresolvedClaims(meta).length ? ["pausing"] : ["pausing", "paused"] };
}

/** Cancel: stop new claims. Never promises to reverse a claimed effect; terminal only once every claim resolved. */
export function decideCancel(meta: MissionMeta): { next: MissionStatus[] } | Refusal {
  if (meta.status === "cancelled") return { next: [] };
  if (meta.status === "cancelling") return { next: unresolvedClaims(meta).length ? [] : ["cancelled"] };
  if (meta.status === "valid" || meta.status === "failed") return invalid(`cannot cancel a ${meta.status} mission`);
  if (!canTransition(meta.status, "cancelling")) return invalid(`cannot cancel from ${meta.status}`);
  return { next: unresolvedClaims(meta).length ? ["cancelling"] : ["cancelling", "cancelled"] };
}

export function decideArmCrash(meta: MissionMeta, point: CrashPoint, childActive: boolean): { point: CrashPoint } | Refusal {
  if (isTerminal(meta.status) || meta.status === "cancelling") return invalid(`cannot arm a crash on a ${meta.status} mission`);
  if (childActive) return { code: "WORKER_ACTIVE", status: 409, message: "arm the crash before the next generation starts" };
  return { point };
}

/** Statuses in which a runner may be granted a new dispatch claim. */
const CLAIMABLE: readonly MissionStatus[] = ["queued", "restoring", "reconciling", "revalidating", "planning", "executing", "curating"];

export type ClaimRequest = {
  actionKey: string; argsHash: string; slot: string; epoch: number; generation: number; currentGeneration: number;
  /** latest commitment per action key from the projection (invariant 13 applies to them too) */
  commitments?: Record<string, { action_key: string; slot: string; status: string; kind?: string }>;
};
export type ClaimDecision = { kind: "grant"; claim: DispatchClaim } | { kind: "existing"; claim: DispatchClaim } | { kind: "refuse"; refusal: Refusal };

export const dispatchIdFor = (missionId: string, actionKey: string, argsHash: string, epoch: number): string =>
  `dsp-${sha256Hex(`${missionId}|${actionKey}|${argsHash}|${epoch}`).slice(0, 20)}`;

const ACTIVE_COMMITMENT = new Set(["intent", "unknown", "confirmed"]);

/** Dispatch claim (CONTRACTS §6): serialized with pause/cancel in the actor queue. */
export function decideClaim(meta: MissionMeta, req: ClaimRequest, revision: number): ClaimDecision {
  const refuse = (code: string, message: string): ClaimDecision => ({ kind: "refuse", refusal: { code, status: 409, message } });
  if (req.generation !== req.currentGeneration) return refuse("STALE_GENERATION", `generation ${req.generation} is not the current generation ${req.currentGeneration}`);
  if (!CLAIMABLE.includes(meta.status)) return refuse("DISPATCH_REFUSED", `mission is ${meta.status}; no new dispatch claims`);
  const same = meta.claims[req.actionKey];
  if (same) {
    if (same.argsHash !== req.argsHash) return refuse("ARGS_CONFLICT", "action key already claimed with different arguments");
    return { kind: "existing", claim: same };
  }
  for (const c of Object.values(meta.claims)) {
    if (c.slot === req.slot) return refuse("SLOT_BUSY", `slot ${req.slot} already has an unresolved claim ${c.actionKey.slice(0, 12)}…`);
  }
  for (const c of Object.values(req.commitments ?? {})) {
    if (c.action_key !== req.actionKey && c.slot === req.slot && (c.kind ?? "book") === "book" && ACTIVE_COMMITMENT.has(c.status)) {
      return refuse("SLOT_BUSY", `slot ${req.slot} already has ${c.status} commitment ${c.action_key.slice(0, 12)}…`);
    }
  }
  const claim: DispatchClaim = {
    dispatchId: dispatchIdFor(meta.missionId, req.actionKey, req.argsHash, req.epoch),
    actionKey: req.actionKey, argsHash: req.argsHash, epoch: req.epoch, revision, slot: req.slot,
  };
  return { kind: "grant", claim };
}

/** Shortest status path from→to through TRANSITIONS (for runner-driven jumps such as restoring → valid). */
export function statusPath(from: MissionStatus, to: MissionStatus, graph: Record<MissionStatus, readonly MissionStatus[]>): MissionStatus[] | null {
  if (from === to) return [];
  const prev = new Map<MissionStatus, MissionStatus>();
  const q: MissionStatus[] = [from];
  while (q.length) {
    const s = q.shift()!;
    for (const n of graph[s]) {
      if (n === from || prev.has(n) || n === "pausing" || n === "cancelling") continue;
      prev.set(n, s);
      if (n === to) {
        const out: MissionStatus[] = [to];
        for (let x = s; x !== from; x = prev.get(x)!) out.unshift(x);
        return out;
      }
      q.push(n);
    }
  }
  return null;
}

export function newMissionMeta(o: { missionId: string; ownerId: string; batchId: string; goal: string }): MissionMeta {
  return {
    missionId: o.missionId, ownerId: o.ownerId, batchId: o.batchId, status: "created", reconciliationStatus: "none",
    blockedReason: null, planRevision: 0, goal: o.goal, armedCrash: null, commands: {}, claims: {},
  };
}

export function toApiError(r: Refusal, extra: { missionId?: string; currentRevision?: number } = {}): ApiError {
  return { code: r.code, message: r.message, retryable: r.retryable ?? false, ...extra };
}

export const isRefusal = (x: unknown): x is Refusal => !!x && typeof x === "object" && "code" in x && "status" in x;
