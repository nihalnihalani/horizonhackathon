// Fixed SQL templates. RawTree has NO bind params: every interpolated value is validated first.
// Nothing outside packages/storage builds SQL.
import { CHECKPOINTS_TABLE, EVENTS_TABLE, TABLES, type TableName, assertEnum, assertRunId, sqlLiteral } from "@dr/shared";

const SAFE_INT = (n: number, name: string): number => {
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new Error(`sql: invalid ${name}`);
  return n;
};

/** Restore page: one table, one run, ordered by (rev, ts). */
export function selectRunPage(table: TableName, runId: string, limit: number, offset: number): string {
  const t = assertEnum(table, TABLES);
  const r = sqlLiteral(assertRunId(runId));
  return `SELECT * FROM ${t} WHERE run_id = ${r} ORDER BY rev, ts LIMIT ${SAFE_INT(limit, "limit")} OFFSET ${SAFE_INT(offset, "offset")}`;
}

/** Smoke table readback (smoke table is not part of TABLES). */
export function selectSmoke(runId: string): string {
  return `SELECT * FROM smoke WHERE run_id = ${sqlLiteral(assertRunId(runId))} ORDER BY rev, ts LIMIT 10`;
}

/** Tables a caller may insert into through the raw client (TABLES + the smoke table + canonical events/checkpoints). */
export const INSERTABLE = [...TABLES, "smoke", EVENTS_TABLE, CHECKPOINTS_TABLE] as const;
export type InsertableTable = (typeof INSERTABLE)[number];
export function assertInsertable(t: string): InsertableTable {
  return assertEnum(t, INSERTABLE);
}
