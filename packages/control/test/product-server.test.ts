import { expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { startProduct } from "../src/product-server.ts";

it("a repeated startup cannot mark the active owner's preparation failed", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dr-product-owner-"));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const app = await startProduct({ port: 0, directory, sources: { async read(kind) {
    await gate;
    return { url: "https://angelislandferry.com/schedule", title: kind, retrievedAt: new Date().toISOString(), sha256: "fixture-hash", provider: "nimble", requestId: "fixture-task", markdown: kind === "schedule" ? "## October 1 - 11, 2026\nWednesdays - Fridays\nDepart TIBURON: 10 am, 11 am" : "Angel Island Ferry\n\nIs the ferry wheelchair accessible?\n\nYes." };
  } } });
  try {
    const { preparation } = app.service.start({ adults: 2, budgetCents: 10000, commandId: randomUUID() });
    expect(app.store.get(preparation.id)?.status).toBe("checking");
    await expect(startProduct({ port: Number(new URL(app.url).port), directory })).rejects.toThrow();
    expect(app.store.get(preparation.id)?.status).toBe("checking");
    release(); await app.service.idle();
    expect(app.store.get(preparation.id)?.status).toBe("ready");
  } finally { release(); await app.close(); }
});

it("keeps preparation mutations on the same loopback origin and reports unavailable keys honestly", async () => {
  const app = await startProduct({ port: 0, directory: mkdtempSync(join(tmpdir(), "dr-product-")) });
  try {
    const data = { adults: 2, budgetCents: 10000, commandId: randomUUID() };
    const post = (origin?: string) => fetch(`${app.url}/api/preparations`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(data) });
    expect((await post()).status).toBe(403);
    expect((await post("https://foreign.test")).status).toBe(403);
    expect((await post(app.url)).status).toBe(503);
    const list = await (await fetch(`${app.url}/api/preparations`)).json() as { preparations: unknown[]; readiness: { configured: boolean } };
    expect(list.preparations).toEqual([]); expect(list.readiness.configured).toBe(false);
    const page = await fetch(app.url);
    expect(page.status).toBe(200); expect(page.headers.get("content-security-policy")).toContain("frame-src https://fareharbor.com");
  } finally { await app.close(); }
});
