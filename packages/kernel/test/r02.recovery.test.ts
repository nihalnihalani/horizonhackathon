// R02: kill after desk commit, before the receipt row — REAL child process, REAL SIGKILL.
// FakeRawTree + real desk on ephemeral loopback ports; the child writes through plain fetch.
// Recovery then runs in-process from an EMPTY local directory, using RawTree (fake) + desk lookup only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { HOLD_LINE_PREFIX, REPO_ROOT, actionKey, newRunId } from "@dr/shared";
import { FakeRawTree, RawTreeClient, RawTreeLoader, RawTreeSink } from "@dr/storage";
import { startDesk, type RunningDesk } from "@dr/desk";
import { HttpDeskClient, f3FerryStep, recover } from "../src/index.ts";

const W = "r02-world-token", O = "r02-operator-token";
let fake: FakeRawTree; let desk: RunningDesk;
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  desk = await startDesk({ worldToken: W, operatorToken: O, port: 0, feedPort: null });
});
afterAll(async () => { await desk.close(); await fake.stop(); });

type ChildRun = { pid: number; holdPid: number; receiptId: string; signal: NodeJS.Signals | null; code: number | null; stdout: string };

function runChild(runId: string, workdir: string, selfKill: boolean): Promise<ChildRun> {
  const child = spawn(process.execPath, ["--import", "tsx", resolve(REPO_ROOT, "packages/kernel/src/r02-child.ts")], {
    cwd: REPO_ROOT,
    // explicit allowlist: no secrets from the parent env reach the child
    env: {
      PATH: process.env.PATH ?? "", HOME: workdir, TMPDIR: workdir,
      R02_RAWTREE_URL: fake.url, R02_RAWTREE_KEY: fake.apiKey, R02_DESK_URL: desk.url, DR_WORLD_TOKEN: W,
      DR_RUN_ID: runId, DR_ARM: "dr", DR_CRASH_AFTER: "after_desk_commit", R02_SELF_KILL: selfKill ? "1" : "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = ""; let stderr = "";
  let holdPid = 0; let receiptId = "";
  return new Promise((res, rej) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); rej(new Error(`child never held. stdout=${stdout} stderr=${stderr}`)); }, 20_000);
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString();
      const m = stdout.match(new RegExp(`${HOLD_LINE_PREFIX} pid=(\\d+) receipt_id=(\\S+)`));
      if (m && !holdPid) {
        holdPid = Number(m[1]); receiptId = m[2]!;
        console.log(`[R02] saw: ${m[0]}`);
        if (!selfKill) { console.log(`[R02] kill -9 ${child.pid}`); process.kill(child.pid!, "SIGKILL"); }
      }
    });
    child.stderr.on("data", (b: Buffer) => { stderr += b.toString(); });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      res({ pid: child.pid!, holdPid, receiptId, signal, code, stdout });
    });
  });
}

function assertGone(pid: number) {
  let err: NodeJS.ErrnoException | null = null;
  try { process.kill(pid, 0); } catch (e) { err = e as NodeJS.ErrnoException; }
  expect(err?.code).toBe("ESRCH");
}

describe.each([
  ["harness SIGKILL on HOLD line", false],
  ["child self-SIGKILL after desk 200", true],
])("R02 (%s)", (_label, selfKill) => {
  it("recovers the same committed receipt by lookup; no second reservation", async () => {
    const runId = newRunId();
    const childDir = mkdtempSync(join(tmpdir(), "dr-r02-child-"));
    const recoverDir = mkdtempSync(join(tmpdir(), "dr-r02-restore-"));
    try {
      const ferry = f3FerryStep();
      const key = actionKey(runId, ferry.step_id, ferry.resource, ferry.date, ferry.party);

      // --- epoch 1: real child, killed in the HOLD window ---
      const c = await runChild(runId, childDir, selfKill as boolean);
      console.log(`[R02] child pid=${c.pid} exit signal=${c.signal} code=${c.code}`);
      expect(c.signal).toBe("SIGKILL");
      expect(c.holdPid).toBe(c.pid); // the HOLD line came from the process we killed
      assertGone(c.pid);
      console.log(`[R02] old pid ${c.pid} gone (ESRCH)`);

      // desk: exactly one ferry effect, one request
      const l1 = desk.store.ledger({ run_id: runId });
      expect(l1.outcomes).toHaveLength(1);
      expect(l1.outcomes[0]).toMatchObject({ slot: "ferry", committed: true, receipt_id: c.receiptId, action_key: key });
      expect(l1.requests).toHaveLength(1);
      // RawTree: intent without receipt
      expect(fake.rows("commitments", runId).map((r) => r.status)).toEqual(["intent"]);
      expect(fake.rows("receipts", runId)).toHaveLength(0);
      console.log(`[R02] desk effects=1 (receipt ${c.receiptId}); rawtree: intent without receipt`);

      // --- epoch 2: restore with an EMPTY local directory ---
      expect(readdirSync(recoverDir)).toEqual([]);
      const client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning" });
      const lines: string[] = [];
      const r = await recover({
        loader: new RawTreeLoader(client), sink: new RawTreeSink(client),
        desk: new HttpDeskClient({ baseUrl: desk.url, token: W, ns: { run_id: runId, arm: "dr" } }),
        run_id: runId, arm: "dr", log: (l) => { lines.push(l); console.log(`[R02] ${l}`); },
      });
      expect(r.epoch).toBe(2);
      expect(r.restored_rows).toBeGreaterThan(0);
      expect(lines[0]).toMatch(/^RESTORING FROM RAWTREE… \d+ rows · epoch 2$/);
      expect(r.reconciled).toEqual([{ action_key: key, slot: "ferry", result: "recovered", receipt_id: c.receiptId, lookup: true }]);

      const receipts = fake.rows("receipts", runId);
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({ receipt_id: c.receiptId, recovered: true, outcome: "committed", amount: 12000 });
      const commits = fake.rows("commitments", runId);
      expect(commits.at(-1)).toMatchObject({ status: "confirmed", receipt_id: c.receiptId });
      expect(r.journal.state.commitments[key]!.status).toBe("confirmed");
      expect(fake.rows("epochs", runId).map((e) => [e.epoch, e.reason])).toEqual([[1, "boot"], [2, "resume"]]);

      const l2 = desk.store.ledger({ run_id: runId });
      expect(l2.outcomes).toHaveLength(1);
      expect(l2.requests).toHaveLength(1); // book_requests still 1: recovery never re-sent the booking
      expect(readdirSync(recoverDir)).toEqual([]); // nothing local was used or written
      console.log(`[R02] recovered receipt ${c.receiptId} recovered=true; book_requests=1; verdict: one ferry`);
    } finally {
      rmSync(childDir, { recursive: true, force: true });
      rmSync(recoverDir, { recursive: true, force: true });
    }
  });
});
