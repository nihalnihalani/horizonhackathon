// Deterministic oracle: compares one fixture's ACTUAL observed mission outcome against its frozen
// expected outcome (bench/missions/fixtures.ts). Pure and offline-testable (no network) — the orchestrator
// (bench/run-missions.ts) is the only piece that talks to a running control/desk.
import type { MissionFixture } from "./fixtures.ts";

export type ActualOutcome = {
  fixture: MissionFixture["id"];
  arm: "dr" | "naive";
  missionId: string;
  /** GET /missions/:id `status` (lowercase mission lifecycle status: valid|blocked|failed|cancelled|...). */
  terminalStatus: string;
  /** The runner's own terminal verdict line, if one was recorded (absent when the mission failed before a verdict). */
  verdict: { verdict: string; reason: string } | null;
  /** Desk ledger committed_by_slot for this run_id/arm. */
  committedBySlot: Partial<Record<string, number>>;
  campsiteBooked: boolean;
  elapsedMs: number;
};

export type OracleResult = { pass: boolean; mismatches: string[] };

function normVerdict(actual: ActualOutcome): string {
  if (actual.verdict?.verdict) return actual.verdict.verdict.toUpperCase();
  // No runner verdict line at all (e.g. the mission failed before terminal()): fall back to the lifecycle status.
  return actual.terminalStatus.toUpperCase();
}

export function score(actual: ActualOutcome, expected: MissionFixture["expected"]): OracleResult {
  const mismatches: string[] = [];
  const v = normVerdict(actual);
  if (v !== expected.verdict) mismatches.push(`verdict: expected ${expected.verdict}, got ${v} (mission status ${actual.terminalStatus})`);

  const reason = (actual.verdict?.reason ?? "").toLowerCase();
  for (const needle of expected.reasonIncludes) {
    if (!reason.includes(needle.toLowerCase())) mismatches.push(`reason missing "${needle}": got "${actual.verdict?.reason ?? "(no verdict reason; mission may have failed before terminal())"}"`);
  }

  for (const [slot, count] of Object.entries(expected.committedBySlot)) {
    const got = actual.committedBySlot[slot] ?? 0;
    if (got !== count) mismatches.push(`committed_by_slot.${slot}: expected ${count}, got ${got}`);
  }

  if (actual.campsiteBooked !== expected.campsiteBooked) mismatches.push(`campsiteBooked: expected ${expected.campsiteBooked}, got ${actual.campsiteBooked}`);

  return { pass: mismatches.length === 0, mismatches };
}

export type ScoredRun = { fixture: MissionFixture["id"]; arm: "dr" | "naive"; expectedVerdict: string; oracle: OracleResult; actual: ActualOutcome };

/** Markdown match/mismatch table for summary.md. Never hides a mismatch — this is the honesty gate. */
export function summaryTable(rows: ScoredRun[]): string {
  const header = "| fixture | arm | expected verdict | actual verdict | match | mismatches |";
  const sep = "|---|---|---|---|---|---|";
  const body = rows.map((r) => {
    const status = r.oracle.pass ? "MATCH" : "MISMATCH";
    return `| ${r.fixture} | ${r.arm} | ${r.expectedVerdict} | ${normVerdict(r.actual)} (status ${r.actual.terminalStatus}) | ${status} | ${r.oracle.mismatches.join("; ") || "-"} |`;
  });
  return [header, sep, ...body].join("\n");
}
