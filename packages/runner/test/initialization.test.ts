import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { F3, type RowSink, type TableName } from "@dr/shared";
import { Journal } from "@dr/kernel";
import { applyRow, emptyProjection } from "@dr/storage";
import { type NimbleObservation } from "@dr/providers";
import { ensureInitialization } from "../src/initialization.ts";

const fields = JSON.parse(readFileSync(new URL("../../providers/test/fixtures/nimble-status-parsed.json", import.meta.url), "utf8")).data.parsing;
const obs = { fields, url: "https://fixture.invalid/status", fetched_at: "2026-10-08T16:00:00Z", task_id: "test-observation" } as NimbleObservation;

describe("restartable initialization", () => {
  // Lose the worker after each durable write, including before its acknowledgement arrives.
  for (let cut = 1; cut <= F3.constraints.length + F3.plan.length + 6; cut++) {
    it(`restores complete pins, plan and observations after durable write ${cut}`, async () => {
      const run_id = "f3-20260926-init";
      const durable = emptyProjection(run_id);
      let writes = 0;
      const sink: RowSink = { async append(table, row) {
        applyRow(durable, table, row as never);
        if (++writes === cut) throw new Error("worker lost before ack");
        return { inserted: 1 };
      } };
      const first = new Journal(sink, { run_id, arm: "dr", epoch: 1 });
      await expect(ensureInitialization(first, async () => obs)).rejects.toThrow("worker lost");
      const resumed = new Journal(sink, { run_id, arm: "dr", epoch: 2 }, structuredClone(durable));
      await ensureInitialization(resumed, async () => obs);
      expect(Object.keys(resumed.state.constraints)).toHaveLength(4);
      expect(Object.keys(resumed.state.plan_steps)).toHaveLength(4);
      expect(Object.keys(resumed.state.facts)).toHaveLength(6);
      expect(resumed.state.constraints.accessible_required!.value).toBe("true");
      // Re-entry must preserve progressed steps and pinned constraints, without new writes or network work.
      resumed.state.plan_steps.ferry!.status = "done";
      const before = writes;
      await ensureInitialization(resumed, async () => { throw new Error("unnecessary observation"); });
      expect(resumed.state.plan_steps.ferry!.status).toBe("done");
      expect(writes).toBe(before);
    });
  }
  it("retries an interrupted observation without reseeding existing rows", async () => {
    let writes = 0;
    const sink: RowSink = { async append(_table: TableName) { writes++; return { inserted: 1 }; } };
    const j = new Journal(sink, { run_id: "f3-20260926-obsv", arm: "dr", epoch: 1 });
    await expect(ensureInitialization(j, async () => { throw new Error("provider interrupted"); })).rejects.toThrow("provider interrupted");
    expect(writes).toBe(8);
    await ensureInitialization(j, async () => obs);
    expect(writes).toBe(14);
  });
});
