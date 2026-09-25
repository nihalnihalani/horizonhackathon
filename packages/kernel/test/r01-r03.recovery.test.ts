// R01 (kill after visible intent, before the desk request) and R03 (kill after the persisted receipt).
// REAL child process (r02-child), REAL SIGKILL, FakeRawTree + real desk; recovery runs in-process from RawTree only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { InvariantViolation, REPO_ROOT, actionKey, newRunId, type CrashPoint } from "@dr/shared";
import { FakeRawTree, RawTreeClient, RawTreeLoader, RawTreeSink } from "@dr/storage";
import { startDesk, type RunningDesk } from "@dr/desk";
import { HttpDeskClient, f3FerryStep, recover, runFerryStep } from "../src/index.ts";

const W = "r01-world-token", O = "r01-operator-token";
let fake: FakeRawTree; let desk: RunningDesk;
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  desk = await startDesk({ worldToken: W, operatorToken: O, port: 0, feedPort: null });
});
afterAll(async () => { await desk.close(); await fake.stop(); });

function runChild(runId: string, workdir: string, point: CrashPoint): Promise<{ pid: number; holdPid: number; signal: NodeJS.Signals | null; line: string }> {
  const child = spawn(process.execPath, ["--import", "tsx", resolve(REPO_ROOT, "packages/kernel/src/r02-child.ts")], {
    cwd: REPO_ROOT,
    env: {
      PATH: process.env.PATH ?? "", HOME: workdir, TMPDIR: workdir,
      R02_RAWTREE_URL: fake.url, R02_RAWTREE_KEY: fake.apiKey, R02_DESK_URL: desk.url, DR_WORLD_TOKEN: W,
      DR_RUN_ID: runId, DR_ARM: "dr", DR_CRASH_AFTER: point,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = ""; let stderr = ""; let holdPid = 0; let line = "";
  return new Promise((res, rej) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); rej(new Error(`child never held. stdout=${stdout} stderr=${stderr}`)); }, 20_000);
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString();
      const m = stdout.match(new RegExp(`HOLDING AT ${point} pid=(\\d+)[^\\n]*`));
      if (m && !holdPid) { holdPid = Number(m[1]); line = m[0]; process.kill(child.pid!, "SIGKILL"); }
    });
    child.stderr.on("data", (b: Buffer) => { stderr += b.toString(); });
    child.on("exit", (_code, signal) => { clearTimeout(timer); res({ pid: child.pid!, holdPid, signal, line }); });
  });
}

function assertGone(pid: number) {
  let err: NodeJS.ErrnoException | null = null;
  try { process.kill(pid, 0); } catch (e) { err = e as NodeJS.ErrnoException; }
  expect(err?.code).toBe("ESRCH");
}

const restore = (runId: string) => {
  const client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning" });
  const d = new HttpDeskClient({ baseUrl: desk.url, token: W, ns: { run_id: runId, arm: "dr" } });
  return { d, r: recover({ loader: new RawTreeLoader(client), sink: new RawTreeSink(client), desk: d, run_id: runId, arm: "dr", log: (l) => console.log(`[R0x] ${l}`) }) };
};

describe("R01: kill after visible intent, before the desk request", () => {
  it("no initial effect; the resumed request uses the original key → exactly one effect", async () => {
    const runId = newRunId();
    const dir = mkdtempSync(join(tmpdir(), "dr-r01-"));
    try {
      const f = f3FerryStep();
      const key = actionKey(runId, f.step_id, f.resource, f.date, f.party);
      const c = await runChild(runId, dir, "after_intent");
      console.log(`[R01] ${c.line} → SIGKILL pid ${c.pid}`);
      expect(c.signal).toBe("SIGKILL");
      expect(c.holdPid).toBe(c.pid);
      assertGone(c.pid);
      expect(fake.rows("commitments", runId).map((r) => [r.action_key, r.status])).toEqual([[key, "intent"]]);
      expect(desk.store.ledger({ run_id: runId }).requests).toHaveLength(0);

      const { d, r } = restore(runId);
      const rec = await r;
      expect(rec.reconciled).toEqual([{ action_key: key, slot: "ferry", result: "not_executed", lookup: true }]);
      const out = await runFerryStep({ journal: rec.journal, desk: d, log: () => {} }, { holdAfterCommit: false });
      expect(out.action_key).toBe(key);
      const l = desk.store.ledger({ run_id: runId });
      expect(l.requests).toHaveLength(1);
      expect(l.outcomes).toMatchObject([{ action_key: key, committed: true }]);
      console.log(`[R01] resumed with original key ${key.slice(0, 12)}…; desk effects=1 requests=1`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("R03: kill after the persisted receipt", () => {
  it("completed action is not resent; desk request count unchanged", async () => {
    const runId = newRunId();
    const dir = mkdtempSync(join(tmpdir(), "dr-r03-"));
    try {
      const f = f3FerryStep();
      const key = actionKey(runId, f.step_id, f.resource, f.date, f.party);
      const c = await runChild(runId, dir, "after_receipt");
      console.log(`[R03] ${c.line} → SIGKILL pid ${c.pid}`);
      expect(c.signal).toBe("SIGKILL");
      assertGone(c.pid);
      expect(fake.rows("receipts", runId)).toHaveLength(1);
      expect(fake.rows("commitments", runId).at(-1)).toMatchObject({ status: "confirmed" });
      const before = desk.store.ledger({ run_id: runId }).requests.length;
      expect(before).toBe(1);

      const { d, r } = restore(runId);
      const rec = await r;
      expect(rec.reconciled).toEqual([]); // nothing unresolved: no lookup, no request
      expect(rec.journal.state.commitments[key]!.status).toBe("confirmed");
      await expect(runFerryStep({ journal: rec.journal, desk: d, log: () => {} }, { holdAfterCommit: false })).rejects.toBeInstanceOf(InvariantViolation);
      expect(desk.store.ledger({ run_id: runId }).requests).toHaveLength(before);
      expect(desk.store.ledger({ run_id: runId }).outcomes).toHaveLength(1);
      console.log(`[R03] receipt persisted before kill; after restore book_requests still ${before}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
