// S06: an acked row may not be query-visible yet (live probe: ~0.6 s). Bounded polling; on deadline → AckError
// (the caller blocks the step; it never proceeds to the desk on an unobserved intent).
import { AckError, type TableName } from "@dr/shared";
import { RawTreeClient } from "./client.ts";
import { parseStoredRow } from "./projection.ts";
import { selectRunPage } from "./sql.ts";

export async function waitForRow<T extends TableName>(
  client: RawTreeClient, table: T, runId: string, match: (row: ReturnType<typeof parseStoredRow<T>>) => boolean,
  o: { deadlineMs?: number; intervalMs?: number; pageSize?: number } = {},
): Promise<{ visible_ms: number }> {
  const t0 = Date.now();
  const deadline = t0 + (o.deadlineMs ?? 5000);
  const pageSize = o.pageSize ?? 1000;
  for (;;) {
    for (let offset = 0; ; offset += pageSize) {
      const page = await client.query(selectRunPage(table, runId, pageSize, offset));
      if (page.some((raw) => { try { return match(parseStoredRow(table, raw)); } catch { return false; } })) return { visible_ms: Date.now() - t0 };
      if (page.length < pageSize) break;
    }
    if (Date.now() >= deadline) throw new AckError(`${table} row acked but not visible within ${o.deadlineMs ?? 5000} ms`);
    await new Promise((r) => setTimeout(r, o.intervalMs ?? 250));
  }
}

/** Visibility gate for the kernel's intent rows (ProtocolDeps.awaitIntentVisible). */
export function intentVisibilityGate(client: RawTreeClient, o: { deadlineMs?: number; intervalMs?: number } = {}) {
  return async (runId: string, actionKey: string): Promise<void> => {
    await waitForRow(client, "commitments", runId, (r) => r.action_key === actionKey && r.status === "intent", o);
  };
}
