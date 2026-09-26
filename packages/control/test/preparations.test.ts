import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PreparationService, PreparationStore } from "../src/preparations.ts";

export const source = (kind: "schedule" | "guidance") => ({
  url: `https://angelislandferry.com/${kind === "schedule" ? "schedule" : "faqs"}`, title: kind, retrievedAt: new Date().toISOString(),
  sha256: "test-hash", provider: "nimble" as const, requestId: "fixture-task",
  markdown: kind === "schedule" ? "## October 1 - 11, 2026\n### Wednesdays - Fridays\nDepart TIBURON: 10 am, 11 am, 1 pm, 3 pm (campers only)" : "Angel Island Tiburon Ferry\n\nIs the ferry wheelchair accessible?\n\nYes.",
});
const request = () => ({ adults: 2, budgetCents: 10000, commandId: randomUUID() });

describe("real reservation preparation records", () => {
  it("persists checks and a documented quantity-prefilled handoff, without creating a reservation receipt", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "dr-prep-")), "prep.sqlite");
    const store = new PreparationStore(path);
    const calls: string[] = [];
    const service = new PreparationService(store, { async read(kind) { calls.push(kind); return source(kind); } });
    const input = request();
    const started = service.start(input);
    expect(started.created).toBe(true);
    expect(service.start(input).created).toBe(false);
    await service.idle();
    const saved = store.get(started.preparation.id)!;
    expect(saved.status).toBe("ready");
    expect(saved.evidence).toHaveLength(2);
    expect(saved.evidence[0]).not.toHaveProperty("markdown");
    expect(new URL(saved.booking!.url).searchParams.get("ctrs")).toBe("8991824084:2");
    expect(saved.booking?.totalCents).toBe(3816);
    expect(saved).not.toHaveProperty("receipt");
    expect(calls).toEqual(["schedule", "guidance"]);
    store.close();
    const restored = new PreparationStore(path);
    expect(restored.get(saved.id)).toEqual(saved);
    expect(new PreparationService(restored).start(input).created).toBe(false);
    restored.close();
  });

  it("deduplicates uncertain requests, rejects changed retries and bounds concurrent hosted work", async () => {
    const store = new PreparationStore(":memory:");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const service = new PreparationService(store, { async read(kind) { await gate; return source(kind); } });
    const input = request(); service.start(input);
    expect(service.start(input).created).toBe(false);
    expect(() => service.start({ ...input, adults: 3 })).toThrow("COMMAND_CONFLICT");
    expect(() => service.start(request())).toThrow("BUSY");
    release(); await service.idle(); store.close();
  });

  it("blocks over-budget estimates without hosted calls and never converts missing sources to ready", async () => {
    const store = new PreparationStore(":memory:");
    let calls = 0;
    const service = new PreparationService(store, { async read() { calls++; throw new Error("private-provider-response-secret"); } });
    const blocked = service.start({ ...request(), budgetCents: 100 }); await service.idle();
    expect(store.get(blocked.preparation.id)?.status).toBe("blocked"); expect(calls).toBe(0);
    const failed = service.start(request()); await service.idle();
    expect(store.get(failed.preparation.id)?.status).toBe("failed");
    expect(JSON.stringify(store.get(failed.preparation.id))).not.toContain("private-provider-response-secret");
    expect(store.get(failed.preparation.id)?.booking).toBeUndefined(); store.close();
  });

  it("marks interrupted checks failed on restart without automatically replaying them", () => {
    const path = join(mkdtempSync(join(tmpdir(), "dr-prep-")), "prep.sqlite");
    const store = new PreparationStore(path); const p = store.create(request()).preparation;
    store.close(); const reopened = new PreparationStore(path);
    expect(reopened.get(p.id)?.status).toBe("failed"); expect(reopened.get(p.id)?.booking).toBeUndefined(); reopened.close();
  });
});
