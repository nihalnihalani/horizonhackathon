import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocalDemo } from "../src/local-server.ts";

const demos: Awaited<ReturnType<typeof startLocalDemo>>[] = [];
afterEach(async () => { for (const demo of demos.splice(0)) await demo.close(); vi.restoreAllMocks(); });
async function start() {
  const demo = await startLocalDemo({ port: 0, directory: mkdtempSync(join(tmpdir(), "dr-local-test-")) });
  demos.push(demo);
  return demo;
}
async function waitFor(predicate: () => boolean, label: string) {
  const end = Date.now() + 20_000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`Timed out: ${label}`);
    await new Promise((ok) => setTimeout(ok, 30));
  }
}
async function action(demo: Awaited<ReturnType<typeof start>>, name: string, site?: string) {
  const r = await fetch(`${demo.url}/local/action`, { method: "POST", headers: { origin: demo.url, "content-type": "application/json" }, body: JSON.stringify({ action: name, site }) });
  const body = await r.json() as { killed?: { pid: number; signal: string; alive_after: boolean }[] };
  expect(r.ok, JSON.stringify(body)).toBe(true);
  return body;
}

describe("key-free local rehearsal using the production runner", () => {
  it("commits, really kills, reloads local events and recovers the same receipt; repairs to C", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      calls.push(url.href);
      if (url.hostname !== "127.0.0.1") throw new Error(`unexpected outbound call: ${url.hostname}`);
      return originalFetch(input, init);
    });
    const demo = await start();
    await action(demo, "start");
    const mission = demo.actor.missions.dr!;
    await waitFor(() => mission.state === "holding", "post-commit hold");
    const pid = mission.pid;
    const ledgerBefore = demo.desk.store.ledger({ run_id: mission.run_id });
    expect(ledgerBefore.outcomes).toHaveLength(1);
    const ferry = ledgerBefore.outcomes[0]!;
    expect(ferry.slot).toBe("ferry");
    expect(ferry.committed).toBe(true);
    expect(demo.actor.missionSnapshot(mission.run_id)!.receipts).toHaveLength(0);
    const proof = await (await fetch(`${demo.url}/local/state`)).json() as { ledger: { outcomes: { receipt_id: string }[] }[]; snapshots: { receipts: unknown[]; availability: Record<string, string> }[] };
    expect(proof.ledger[0]!.outcomes[0]!.receipt_id).toBe(ferry.receipt_id);
    expect(proof.snapshots[0]!.receipts).toHaveLength(0);
    expect(proof.snapshots[0]!.availability).not.toHaveProperty("rawtree");
    const killed = await action(demo, "kill");
    expect(killed.killed![0]).toMatchObject({ pid, signal: "SIGKILL", alive_after: false });
    expect(() => process.kill(pid!, 0)).toThrow();
    await action(demo, "close-site");
    await action(demo, "resume");
    expect(mission.pid).not.toBe(pid);
    expect(mission.generation).toBe(2);
    await waitFor(() => mission.meta.status === "valid", "valid itinerary");
    await mission.exited;
    const snapshot = demo.actor.missionSnapshot(mission.run_id)!;
    expect(snapshot.receipts).toHaveLength(4);
    expect(snapshot.receipts.find((r) => r.slot === "ferry")).toMatchObject({ receiptId: ferry.receipt_id, recovered: true });
    expect(snapshot.receipts.find((r) => r.slot === "campsite")?.resource).toBe("site-C");
    expect(snapshot.receipts.reduce((sum, r) => sum + r.amountCents, 0)).toBe(28000);
    expect(snapshot.constraints.find((r) => r.key === "accessible_required")?.value).toBe("true");
    const finalLedger = demo.desk.store.ledger({ run_id: mission.run_id });
    expect(finalLedger.outcomes.filter((r) => r.slot === "ferry")).toHaveLength(1);
    expect(finalLedger.requests.filter((r) => (r as { action_key: string }).action_key === ferry.action_key)).toHaveLength(1);
    demo.actor.cache.clear();
    const restored = await demo.actor.projection(mission.run_id, "test");
    expect(Object.values(restored.projection.receipts)).toHaveLength(4);
    expect(calls.every((url) => new URL(url).hostname === "127.0.0.1")).toBe(true);
  });

  it("blocks when both accessible sites close; refuses cross-origin commands", async () => {
    const demo = await start();
    const forbidden = await fetch(`${demo.url}/local/action`, { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: '{"action":"start"}' });
    expect(forbidden.status).toBe(403);
    expect(demo.actor.snapshot()).toHaveLength(0);
    expect((await fetch(`${demo.url}/local/action`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"action":"start"}' })).status).toBe(403);
    await action(demo, "start");
    const mission = demo.actor.missions.dr!;
    await waitFor(() => mission.state === "holding", "post-commit hold");
    await action(demo, "kill");
    await action(demo, "close-site", "site-A");
    await action(demo, "close-site", "site-C");
    await action(demo, "resume");
    await waitFor(() => mission.meta.status === "blocked", "no accessible site block");
    await mission.exited;
    expect(mission.verdict?.reason).toContain("no_accessible_site_available");
    expect(demo.desk.store.ledger({ run_id: mission.run_id }).outcomes.filter((r) => r.slot === "campsite")).toHaveLength(0);
  });
});
