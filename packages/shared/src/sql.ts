// SQL guards. FROZEN at scaffold. RawTree has NO bind params: build SQL only from validated values.
// Nothing outside packages/storage builds SQL.
export class SqlGuardError extends Error {}

const RUN_ID_RE = /^[a-z0-9-]{6,64}$/;

export function assertRunId(runId: string): string {
  if (!RUN_ID_RE.test(runId)) throw new SqlGuardError(`invalid run_id for SQL: must match ${RUN_ID_RE}`);
  return runId;
}

export function assertEnum<T extends string>(value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) throw new SqlGuardError(`value not in whitelist: ${JSON.stringify(value)}`);
  return value as T;
}

/** Quote an already-validated identifier-safe literal (defense in depth; still validate first). */
export function sqlLiteral(validated: string): string {
  if (/['\\\n\r\0]/.test(validated)) throw new SqlGuardError("refusing to quote unsafe literal");
  return `'${validated}'`;
}
