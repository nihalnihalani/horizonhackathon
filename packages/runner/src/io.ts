// Runner ↔ control plumbing. The runner never holds RawTree credentials: every row goes through
// control's acked single writer (POST /internal/rows) and every restore through GET /internal/projection.
import { AckError, DrError, type Projection, type ProjectionLoader, type RowSink, type TableName } from "@dr/shared";

/** F3: control refused the row because the mission stopped (cancel/pause/terminal). The runner stops, exit 0. */
export class RunnerStopped extends DrError { constructor(m: string) { super("MISSION_STOPPED", m); } }

export type ControlLink = { baseUrl: string; token: string };

const h = (c: ControlLink) => ({ authorization: `Bearer ${c.token}`, "content-type": "application/json" });

export class HttpRowSink implements RowSink {
  constructor(private c: ControlLink) {}
  async append(table: TableName, row: Record<string, unknown>): Promise<{ inserted: 1 }> {
    let res: Response;
    try {
      res = await fetch(`${this.c.baseUrl}/internal/rows`, { method: "POST", headers: h(this.c), body: JSON.stringify({ table, row }), signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      throw new AckError(`control /internal/rows unreachable (${(e as Error).name})`);
    }
    const j = (await res.json().catch(() => null)) as { inserted?: number; error?: string; code?: string } | null;
    if (res.status === 409 && j?.code === "MISSION_STOPPED") throw new RunnerStopped(`${table}: ${j.error ?? "mission stopped"}`);
    if (res.status !== 200 || j?.inserted !== 1) throw new AckError(`${table}: control did not ack (HTTP ${res.status} ${j?.error ?? ""})`);
    return { inserted: 1 };
  }
}

export class HttpProjectionLoader implements ProjectionLoader {
  constructor(private c: ControlLink, private purpose: "restore" | "verdict" = "restore") {}
  async load(runId: string): Promise<Projection> {
    const res = await fetch(`${this.c.baseUrl}/internal/projection?run_id=${encodeURIComponent(runId)}&purpose=${this.purpose}`, { headers: h(this.c), signal: AbortSignal.timeout(60_000) });
    if (res.status !== 200) throw new AckError(`control /internal/projection HTTP ${res.status}`);
    const j = (await res.json()) as { projection: Projection };
    return j.projection;
  }
}

/** Invariant 1 gate: the acked intent must be query-visible in RawTree before the desk call. */
export function httpIntentGate(c: ControlLink) {
  return async (runId: string, actionKey: string): Promise<void> => {
    const q = new URLSearchParams({ run_id: runId, action_key: actionKey });
    const res = await fetch(`${c.baseUrl}/internal/visible?${q}`, { headers: h(c), signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!res || res.status !== 200) throw new AckError(`intent ${actionKey.slice(0, 12)}… not visible in RawTree (HTTP ${res?.status ?? "none"})`);
  };
}

/** Typed event line for the supervisor (stdout). */
export function emit(kind: string, data: Record<string, unknown> = {}): void {
  process.stdout.write(`@@DR ${JSON.stringify({ kind, ...data })}\n`);
}

/**
 * CONTRACTS §6 dispatch claim: POST /internal/dispatch-claim {actionKey,argsHash,slot,epoch}. A refusal is a
 * definitive "do not POST"; an unreachable control is also a refusal (fail closed: no claim, no desk request).
 */
export function httpClaimDispatch(c: ControlLink, epoch: number) {
  return async (a: { actionKey: string; argsHash: string; slot: string }): Promise<{ granted: true; dispatchId: string } | { granted: false; code: string; reason: string }> => {
    const res = await fetch(`${c.baseUrl}/internal/dispatch-claim`, { method: "POST", headers: h(c), body: JSON.stringify({ ...a, epoch }), signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!res) return { granted: false, code: "CONTROL_UNREACHABLE", reason: "control /internal/dispatch-claim unreachable" };
    const j = (await res.json().catch(() => null)) as { granted?: boolean; dispatchId?: string; code?: string; message?: string } | null;
    if (res.status === 200 && j?.granted && j.dispatchId) return { granted: true, dispatchId: j.dispatchId };
    return { granted: false, code: j?.code ?? `HTTP_${res.status}`, reason: j?.message ?? "refused" };
  };
}

/**
 * F6b: stdout to a pipe is asynchronous on macOS; process.exit() can drop the queued verdict line. Exit only after
 * every earlier write has been flushed (an empty write's callback runs after all prior chunks).
 */
export function exitAfterFlush(code: number): void {
  process.stdout.write("", () => process.stderr.write("", () => process.exit(code)));
}
