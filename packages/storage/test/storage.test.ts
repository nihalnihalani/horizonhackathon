import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AckError, RestoreCapacityError, SqlGuardError } from "@dr/shared";
import { FakeRawTree, RawTreeClient, RawTreeLoader, RawTreeSink, MetricsWriter, selectRunPage, buildProjection } from "../src/index.ts";

let fake: FakeRawTree;
let client: RawTreeClient;
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning", timeoutMs: 300 });
});
afterAll(async () => { await fake.stop(); });

const base = (run_id: string, rev: number, ts = "2026-09-25T19:00:00.000Z", epoch = 1) => ({ run_id, ts, epoch, rev, arm: "dr" });
const commitment = (run_id: string, rev: number, status: string, ts?: string) => ({
  ...base(run_id, rev, ts), action_key: "k1", kind: "book", slot: "ferry", resource: "ferry-tiburon-1009", date: "2026-10-09", party: 2, args_hash: "h", status,
});

describe("storage", () => {
  it("S01: an identical duplicated row applies once", async () => {
    const run = "f3-20260925-s01a";
    const r = { ...base(run, 1), key: "site-A.status", value: '"open"', observed_at: "2026-09-25T19:00:00Z", volatile: true, status: "active" };
    fake.seed("facts", [r, r]);
    fake.seed("context_ops", [
      { ...base(run, 2), step: "ferry", op: "keep", key: "x", reason: "r", proposed_by: "rule", accepted: true },
      { ...base(run, 2), step: "ferry", op: "keep", key: "x", reason: "r", proposed_by: "rule", accepted: true },
    ]);
    const p = await new RawTreeLoader(client).load(run);
    expect(p.rows_loaded.facts).toBe(1);
    expect(p.context_ops).toHaveLength(1);
    expect(p.facts["site-A.status"]!.status).toBe("active");
  });

  it("S03: equal or skewed timestamps — revision order determines state", async () => {
    const run = "f3-20260925-s03a";
    // rev 2 has an EARLIER ts than rev 1 (clock skew); rev 3 same ts as rev 2
    fake.seed("commitments", [
      commitment(run, 2, "confirmed", "2026-09-25T18:00:00.000Z"),
      commitment(run, 1, "intent", "2026-09-25T19:00:00.000Z"),
    ]);
    const p = await new RawTreeLoader(client).load(run);
    expect(p.commitments.k1!.status).toBe("confirmed");
    expect(p.rev).toBe(2);
    // pure in-code check with equal ts
    const q = buildProjection(run, { commitments: [commitment(run, 5, "unknown", "2026-09-25T19:00:00Z"), commitment(run, 4, "intent", "2026-09-25T19:00:00Z")] });
    expect(q.commitments.k1!.status).toBe("unknown");
  });

  it("S05: non-ack / ambiguous ack / timeout → AckError (fail closed, no retry)", async () => {
    const sink = new RawTreeSink(client);
    const row = commitment("f3-20260925-s05a", 1, "intent");
    for (const mode of ["http500", "wrong-count", "garbage", "hang"] as const) {
      fake.failNext("commitments", mode);
      const before = fake.insertAttempts.length;
      await expect(sink.append("commitments", row)).rejects.toBeInstanceOf(AckError);
      expect(fake.insertAttempts.length - before).toBe(1); // exactly one attempt: no retry
    }
    await expect(sink.append("commitments", row)).resolves.toEqual({ inserted: 1 });
    await expect(new MetricsWriter(sink).write({ ...base("f3-20260925-s05a", 2), step: "ferry", phase: "p", context_tokens: 10 })).resolves.toEqual({ inserted: 1 });
  });

  it("S07: paginates across pages and refuses (never truncates) at the capacity limit", async () => {
    const run = "f3-20260925-s07a";
    fake.seed("metrics", Array.from({ length: 25 }, (_, i) => ({ ...base(run, i + 1), step: "s", phase: "p", context_tokens: i })));
    const p = await new RawTreeLoader(client, { pageSize: 10, limit: 100 }).load(run);
    expect(p.metrics).toHaveLength(25);
    expect(p.metrics.map((m) => m.context_tokens)).toEqual(Array.from({ length: 25 }, (_, i) => i));
    await expect(new RawTreeLoader(client, { pageSize: 10, limit: 20 }).load(run)).rejects.toBeInstanceOf(RestoreCapacityError);
  });

  it("empty table (never written) reads as zero rows; asOf filter excludes later rows", async () => {
    const f2 = await new FakeRawTree().start();
    const c2 = new RawTreeClient({ baseUrl: f2.url, apiKey: f2.apiKey, database: "deadreckoning" });
    const run = "f3-20260925-emty";
    f2.seed("facts", [
      { ...base(run, 1, "2026-09-25T19:00:00.000Z"), key: "site-A.status", value: '"open"', observed_at: "x", volatile: true, status: "active" },
      { ...base(run, 2, "2026-09-25T19:05:00.000Z"), key: "site-A.status", value: '"closed"', observed_at: "y", volatile: true, status: "active" },
    ]);
    const l = new RawTreeLoader(c2);
    expect((await l.load(run)).facts["site-A.status"]!.value).toBe('"closed"');
    expect((await l.load(run, { asOf: "2026-09-25T19:01:00Z" })).facts["site-A.status"]!.value).toBe('"open"');
    await f2.stop();
  });

  it("SQL templates accept only whitelisted identifiers and validated run ids", () => {
    expect(selectRunPage("facts", "f3-20260925-abcd", 10, 0)).toBe("SELECT * FROM facts WHERE run_id = 'f3-20260925-abcd' ORDER BY rev, ts LIMIT 10 OFFSET 0");
    expect(() => selectRunPage("facts; DROP" as never, "f3-20260925-abcd", 10, 0)).toThrow(SqlGuardError);
    expect(() => selectRunPage("facts", "x' OR 1=1 --", 10, 0)).toThrow(SqlGuardError);
  });
});
