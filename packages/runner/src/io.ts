// Runner ↔ control plumbing. The runner never holds RawTree credentials: every row goes through
// control's acked single writer (POST /internal/rows) and every restore through GET /internal/projection.
import { AckError, type Projection, type ProjectionLoader, type RowSink, type TableName } from "@dr/shared";

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
    const j = (await res.json().catch(() => null)) as { inserted?: number; error?: string } | null;
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
