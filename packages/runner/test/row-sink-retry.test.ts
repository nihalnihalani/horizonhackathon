// Live-demo regression (merged full-plan run f3-20260925-61f4): one transient RawTree failure made control answer 503
// and the runner died. HttpRowSink now retries the IDENTICAL row on 503/unreachable (control dedupes it by the
// pending event's id/hash — see packages/control/test/pending-append.test.ts) and never retries a refusal.
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpRowSink, RunnerStopped } from "../src/io.ts";

let server: Server | null = null;
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise((r) => server!.close(r)); server = null; } });

async function control(replies: [number, Record<string, unknown>][]) {
  const bodies: string[] = [];
  server = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      bodies.push(b);
      const [status, body] = replies[Math.min(bodies.length - 1, replies.length - 1)]!;
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    });
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, bodies };
}
const row = { run_id: "f3-20260925-abcd", arm: "dr", ts: "2026-09-26T01:00:00.000Z", epoch: 1, rev: 0, key: "k" };

describe("HttpRowSink bounded retry", () => {
  it("retries the identical row after 503s and succeeds", async () => {
    const c = await control([[503, { error: "pending append unresolved" }], [503, { error: "x" }], [200, { inserted: 1, rev: 7 }]]);
    const sink = new HttpRowSink({ baseUrl: c.url, token: "t" }, { attempts: 4, backoffMs: 10 });
    await expect(sink.append("facts", row)).resolves.toEqual({ inserted: 1 });
    expect(c.bodies).toHaveLength(3);
    expect(new Set(c.bodies).size).toBe(1); // byte-identical retries
  });
  it("gives up after the bound (fail closed)", async () => {
    const c = await control([[503, { error: "down" }]]);
    const sink = new HttpRowSink({ baseUrl: c.url, token: "t" }, { attempts: 3, backoffMs: 5 });
    await expect(sink.append("commitments", row)).rejects.toThrow(/HTTP 503/);
    expect(c.bodies).toHaveLength(3);
  });
  it("never retries a refusal (409 MISSION_STOPPED, 403)", async () => {
    const stopped = await control([[409, { code: "MISSION_STOPPED", error: "cancelled" }]]);
    await expect(new HttpRowSink({ baseUrl: stopped.url, token: "t" }, { attempts: 4, backoffMs: 5 }).append("commitments", row)).rejects.toBeInstanceOf(RunnerStopped);
    expect(stopped.bodies).toHaveLength(1);
  });
});
