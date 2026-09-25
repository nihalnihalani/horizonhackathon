#!/usr/bin/env node
// Mission batch harness (VALIDATION_AND_DEMO.md §6, F1-F6). Drives a RUNNING control + desk over the real
// mission REST API — like scripts/e2e.ts does — for every fixture in bench/missions/fixtures.ts, for both
// arms. Missions run strictly sequentially: the desk world (packages/desk/src/store.ts) is a single shared
// SQLite instance, not namespaced by run_id, so two fixtures with different preconditions cannot be in
// flight at once. No root script wires this in yet; run directly:
//   node packages/shared/bin/dr-run.mjs shared bench/run-missions.ts
// Proposed root script name: `bench:missions` → `node packages/shared/bin/dr-run.mjs shared bench/run-missions.ts`.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "@dr/shared";
import { MISSION_FIXTURES, type MissionFixture } from "./missions/fixtures.ts";
import {
  armCrash, createMission, demoKill, demoReset, demoWorld, factProvenanceForRun, health, ledger, metricsForRun,
  resumeMission, say, snap, until,
} from "./missions/client.ts";
import { score, summaryTable, type ActualOutcome, type ScoredRun } from "./missions/oracle.ts";
import { gitRevision } from "./manifest.ts";
import { newBatchId, resultsDir } from "./report.ts";

const ARMS = ["dr", "naive"] as const;
const HOLD_TIMEOUT_MS = 180_000;
const TERMINAL_TIMEOUT_MS = 300_000;
const isTerminal = (s: Record<string, any>) => ["valid", "blocked", "failed", "cancelled"].includes(s.status) && s.worker?.state !== "running" && s.worker?.state !== "starting";

async function runOne(fixture: MissionFixture, arm: "dr" | "naive", batchId: string): Promise<{ actual: ActualOutcome; providerModes: string[] }> {
  const t0 = Date.now();
  await demoReset();
  for (const e of fixture.worldEditsBeforeStart) await demoWorld(e.site, e.status, e.notice);

  const created = await createMission({ arm, goal: `mission-batch ${fixture.id} (${arm})`, statusUrl: fixture.statusUrlOverride ?? undefined, batchId });
  const missionId = created.missionId;
  say(`[${fixture.id}/${arm}] created ${missionId}`);

  if (fixture.crashPoint) {
    await armCrash(missionId, fixture.crashPoint);
    say(`[${fixture.id}/${arm}] armed crash ${fixture.crashPoint}`);
    const rev0 = (await snap(missionId)).revision;
    const r1 = await resumeMission(missionId, rev0);
    if (r1.status !== 202) throw new Error(`[${fixture.id}/${arm}] first Resume refused: ${JSON.stringify(r1.body)}`);
    const held = await until(missionId, (s) => s.worker?.state === "holding" || isTerminal(s), HOLD_TIMEOUT_MS, "HOLD");
    if (held.worker?.state !== "holding") {
      say(`[${fixture.id}/${arm}] WARNING: mission reached terminal (${held.status}) without ever holding — the crash point never fired (see limitations.md)`);
    } else {
      const pidBefore = held.worker.pid as number;
      const killed = await demoKill();
      const k = killed.killed.find((x) => x.pid === pidBefore);
      say(`[${fixture.id}/${arm}] killed pid ${pidBefore} → ${k ? `${k.signal} alive_after=${k.alive_after}` : "NOT FOUND in kill response"}`);
      for (const e of fixture.worldEditsWhileStopped) await demoWorld(e.site, e.status, e.notice);
      const rev2 = (await snap(missionId)).revision;
      const r2 = await resumeMission(missionId, rev2);
      if (r2.status !== 202) throw new Error(`[${fixture.id}/${arm}] explicit Resume after kill refused: ${JSON.stringify(r2.body)}`);
    }
  } else {
    const rev0 = (await snap(missionId)).revision;
    const r1 = await resumeMission(missionId, rev0);
    if (r1.status !== 202) throw new Error(`[${fixture.id}/${arm}] Resume refused: ${JSON.stringify(r1.body)}`);
  }

  const done = await until(missionId, isTerminal, TERMINAL_TIMEOUT_MS, "terminal status");
  const elapsedMs = Date.now() - t0;
  say(`[${fixture.id}/${arm}] terminal status=${done.status} verdict=${done.verdict?.verdict ?? "(none)"} reason=${done.verdict?.reason ?? done.blockedReason ?? ""} elapsed=${elapsedMs}ms`);

  const l = await ledger(missionId, arm);
  const facts = await factProvenanceForRun(missionId).catch((e) => { say(`[${fixture.id}/${arm}] fact provenance query failed: ${(e as Error).message}`); return []; });
  const providerModes = facts.map((f) => `${f.key}: ${f.nimble_request_id ? (f.nimble_request_id.startsWith("direct-") ? "FALLBACK direct" : `Nimble ${f.nimble_request_id}`) : "no observation"}`);

  const actual: ActualOutcome = {
    fixture: fixture.id, arm, missionId, terminalStatus: String(done.status),
    verdict: done.verdict ? { verdict: String(done.verdict.verdict), reason: String(done.verdict.reason) } : null,
    committedBySlot: l.committed_by_slot, campsiteBooked: l.outcomes.some((o) => o.slot === "campsite" && o.committed && !o.cancelled),
    elapsedMs,
  };
  return { actual, providerModes };
}

async function main() {
  const h = await health();
  if (!h.control || !h.desk) {
    console.log(`NOT RUN: control(${h.control}) desk(${h.desk}) not both reachable on 127.0.0.1 — start them first (not this harness's job to start/stop services)`);
    process.exit(2);
  }

  const batchId = newBatchId("missions");
  const dir = resultsDir(batchId);
  const missionsPath = resolve(dir, "missions.jsonl");
  writeFileSync(missionsPath, "");

  const rows: ScoredRun[] = [];
  const limitations: string[] = [
    "packages/runner/src/main.ts only wires a hold hook at the ferry step (F3.crash_step); every crashPoint fixture (F2/F3/F4) crashes at the ferry step specifically, not at the step named in its description if that ever differs.",
    "The naive arm's NaiveTranscript.book() only honors holdAfterCommit (after_desk_commit); F2 (after_intent) and F4 (after_receipt) armed against the naive arm will NOT actually hold — the naive run for those fixtures completes without a real crash, and is reported as such rather than a fabricated match.",
    "F5 points statusUrl at a closed loopback port from mission creation. packages/runner/src/initialization.ts's ensureInitialization() calls observe() unguarded on the first generation (facts don't exist yet); a fully unreachable source can throw there BEFORE any step runs, producing a FAILED mission with zero committed effects rather than the BLOCKED/source_unverified-with-ferry-committed oracle. This is reported as an honest mismatch if it occurs, not silently corrected.",
  ];

  for (const fixture of MISSION_FIXTURES) {
    for (const arm of ARMS) {
      try {
        const { actual, providerModes } = await runOne(fixture, arm, batchId);
        const oracle = score(actual, fixture.expected);
        rows.push({ fixture: fixture.id, arm, expectedVerdict: fixture.expected.verdict, oracle, actual });
        const metrics = await metricsForRun(actual.missionId).catch((e) => { say(`[${fixture.id}/${arm}] metrics query failed: ${(e as Error).message}`); return []; });
        writeFileSync(missionsPath, JSON.stringify({ fixture: fixture.id, arm, actual, oracle, providerModes, metrics }) + "\n", { flag: "a" });
      } catch (e) {
        say(`[${fixture.id}/${arm}] RUN FAILED: ${(e as Error).message}`);
        const actual: ActualOutcome = { fixture: fixture.id, arm, missionId: "(none)", terminalStatus: "harness_error", verdict: null, committedBySlot: {}, campsiteBooked: false, elapsedMs: 0 };
        const oracle = { pass: false, mismatches: [`harness error: ${(e as Error).message}`] };
        rows.push({ fixture: fixture.id, arm, expectedVerdict: fixture.expected.verdict, oracle, actual });
        writeFileSync(missionsPath, JSON.stringify({ fixture: fixture.id, arm, actual, oracle }) + "\n", { flag: "a" });
      }
    }
  }

  const manifest = {
    batch_id: batchId, created_at: new Date().toISOString(), code_revision: gitRevision(),
    fixtures: MISSION_FIXTURES,
    crash_schedule: MISSION_FIXTURES.filter((f) => f.crashPoint).map((f) => ({ fixture: f.id, point: f.crashPoint })),
    model_ids: { planner: process.env.DR_PLANNER_MODEL ?? null, liquid: process.env.DR_LIQUID_MODEL ?? null },
  };
  writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const failed = rows.filter((r) => !r.oracle.pass);
  const summary = [
    `# Mission batch ${batchId}`,
    "",
    `${rows.length - failed.length}/${rows.length} fixture x arm runs matched the oracle.`,
    "",
    summaryTable(rows),
    "",
    "Evidence level: local integration (real running control + desk + RawTree + provider adapters against a shared loopback world; not a live-demo recording).",
  ].join("\n");
  writeFileSync(resolve(dir, "summary.md"), summary + "\n");
  writeFileSync(resolve(dir, "limitations.md"), limitations.map((l) => `- ${l}`).join("\n") + "\n");

  say(`wrote ${dir}`);
  say(`batch_id=${batchId}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
