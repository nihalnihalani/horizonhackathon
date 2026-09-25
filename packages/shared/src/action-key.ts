// Stable business-intent identity. FROZEN at scaffold.
// actionKey never includes retry number, timestamp, PID or epoch (CONTRACTS §2).
// NOTE: THREE_HOUR_CUT §5 specifies sha256 (an older task text said sha1; sha256 is used).
import { createHash } from "node:crypto";

/** Canonical JSON: sorted keys, no whitespace, undefined fields omitted, null kept. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") {
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error("canonicalJson: non-finite number");
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export const sha256Hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

/** action_key = sha256(canonical {v:1, run_id, step_id, resource, date, party}). */
export function actionKey(runId: string, stepId: string, resource: string, date: string, party: number): string {
  return sha256Hex(canonicalJson({ v: 1, run_id: runId, step_id: stepId, resource, date, party }));
}

/**
 * Naive arm ONLY: transcript-resume baseline derives a fresh key from the attempt number.
 * This is deliberately the wrong behavior (it is how the naive arm double-books).
 */
export function naiveActionKey(runId: string, stepId: string, resource: string, date: string, party: number, attempt: number): string {
  return sha256Hex(canonicalJson({ v: 1, run_id: runId, step_id: stepId, resource, date, party, attempt }));
}

/** args_hash = sha256(canonical JSON of all effect-relevant args). Desk recomputes; never trust a caller's hash. */
export function argsHash(args: Record<string, unknown>): string {
  return sha256Hex(canonicalJson({ v: 1, ...args }));
}
