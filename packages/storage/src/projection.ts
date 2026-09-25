// In-code projection: last row per PROJECTION_KEY by (rev, ts); append-log tables keep all rows.
import {
  PROJECTION_KEY, ROW_SCHEMAS, TABLES, canonicalJson,
  type Projection, type RowOf, type TableName,
} from "@dr/shared";

/** Normalize RawTree ("YYYY-MM-DD HH:MM:SS[.nnn]", UTC) and ISO timestamps to epoch millis. */
export function tsMillis(ts: string): number {
  let s = String(ts).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
    // trim nanoseconds to milliseconds
    s = s.replace(/(\.\d{3})\d+/, "$1");
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  }
  const n = Date.parse(s);
  return Number.isNaN(n) ? 0 : n;
}

export function emptyProjection(runId: string): Projection {
  return {
    run_id: runId, arm: null, epoch: 0, rev: 0,
    constraints: {}, facts: {}, commitments: {}, receipts: {}, plan_steps: {},
    epochs: [], context_ops: [], metrics: [],
    rows_loaded: Object.fromEntries(TABLES.map((t) => [t, 0])) as Record<TableName, number>,
  };
}

/** Drop nulls (RawTree returns null for columns a row never had) so schema defaults apply. */
export function stripNulls(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && v !== undefined));
}

export function parseStoredRow<T extends TableName>(table: T, raw: Record<string, unknown>): RowOf<T> {
  return ROW_SCHEMAS[table].parse(stripNulls(raw)) as RowOf<T>;
}

const cmp = (a: { rev: number; ts: string }, b: { rev: number; ts: string }) =>
  a.rev - b.rev || tsMillis(a.ts) - tsMillis(b.ts);

/** Apply one (already parsed) row to a projection in place. Caller supplies rows in (rev, ts) order. */
export function applyRow<T extends TableName>(p: Projection, table: T, row: RowOf<T>): void {
  const base = row as unknown as { epoch: number; rev: number; arm: Projection["arm"] };
  p.epoch = Math.max(p.epoch, base.epoch);
  p.rev = Math.max(p.rev, base.rev);
  if (!p.arm) p.arm = base.arm;
  switch (table) {
    case "epochs": {
      const r = row as RowOf<"epochs">;
      const i = p.epochs.findIndex((e) => e.epoch === r.epoch);
      if (i >= 0) p.epochs[i] = r; else p.epochs.push(r);
      p.epochs.sort((a, b) => a.epoch - b.epoch);
      return;
    }
    case "context_ops": p.context_ops.push(row as RowOf<"context_ops">); return;
    case "metrics": p.metrics.push(row as RowOf<"metrics">); return;
    default: {
      const keyField = PROJECTION_KEY[table]!;
      const k = String((row as Record<string, unknown>)[keyField]);
      (p[table as "facts"] as Record<string, unknown>)[k] = row;
    }
  }
}

/**
 * Build a projection from raw rows per table.
 * S01: byte-identical duplicate rows apply once. S03: order is (rev, ts), never ts alone.
 */
export function buildProjection(
  runId: string,
  rawByTable: Partial<Record<TableName, Record<string, unknown>[]>>,
  opts: { asOf?: string } = {},
): Projection {
  const p = emptyProjection(runId);
  const asOf = opts.asOf ? tsMillis(opts.asOf) : null;
  for (const table of TABLES) {
    const raws = rawByTable[table] ?? [];
    const seen = new Set<string>();
    const rows: RowOf<TableName>[] = [];
    for (const raw of raws) {
      const row = parseStoredRow(table, raw);
      if (row.run_id !== runId) continue;
      if (asOf !== null && tsMillis(row.ts) > asOf) continue;
      const fp = canonicalJson({ ...stripNulls(raw), ts: tsMillis(row.ts) });
      if (seen.has(fp)) continue;
      seen.add(fp);
      rows.push(row);
    }
    rows.sort(cmp);
    for (const r of rows) applyRow(p, table, r);
    p.rows_loaded[table] = rows.length;
  }
  return p;
}

export const totalRows = (p: Projection): number => Object.values(p.rows_loaded).reduce((a, b) => a + b, 0);
