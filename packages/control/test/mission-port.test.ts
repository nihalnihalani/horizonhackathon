import { afterEach, describe, expect, it, vi } from "vitest";
import { HOLD_LINE_PREFIX, type Arm } from "@dr/shared";
import type { Mission, MissionActor, MissionState } from "../src/actor.ts";
import { createMissionPort } from "../src/mission-port.ts";
import type { DemoOps } from "../src/server.ts";

function mission(arm: Arm, state: MissionState, extra: Partial<Mission> = {}): Mission {
  return { arm, state, holdLine: null, verdict: null, ...extra } as Mission;
}

async function start(missions: Mission[], text = "plan my Angel Island trip") {
  const unsubscribe = vi.fn();
  const actor = {
    startBlocker: () => null,
    reserveStart: () => ({ release: () => undefined }),
    startReserved: vi.fn(async () => missions),
    subscribe: () => unsubscribe,
  } as unknown as MissionActor;
  const ops = {
    enabled: true,
    reset: vi.fn(async () => ({})),
    statusUrl: async () => "http://127.0.0.1:4402/status.html",
  } as unknown as DemoOps;
  const chunks: string[] = [];
  for await (const chunk of createMissionPort(actor, ops).handle(text, "test-thread")) chunks.push(chunk);
  return { completion: chunks.at(-1)!, actor, unsubscribe };
}

afterEach(() => vi.useRealTimers());

describe("chat start reports observed execution", () => {
  it("confirms the crash boundary only after both workers report a post-commit hold", async () => {
    const held = ["dr", "naive"].map((arm) => mission(arm as Arm, "holding", { holdLine: `${HOLD_LINE_PREFIX} receipt_id=receipt-1` }));
    const { completion, unsubscribe } = await start(held);
    expect(completion).toContain("Both agents have committed the simulated ferry booking");
    expect(completion).toContain("Say **kill**");
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("uses the actual single worker instead of claiming both agents paused", async () => {
    const { completion, actor } = await start([mission("dr", "holding", { holdLine: HOLD_LINE_PREFIX })], "plan my trip dr only");
    expect(actor.startReserved).toHaveBeenCalledWith(["dr"], expect.anything());
    expect(completion).toContain("Dead Reckoning");
    expect(completion).toContain("has committed");
    expect(completion).not.toContain("Both agents");
  });

  it("reports a failure without claiming both ferry bookings committed", async () => {
    const { completion } = await start([
      mission("dr", "holding", { holdLine: HOLD_LINE_PREFIX }),
      mission("naive", "failed"),
    ]);
    expect(completion).toContain("worker failed");
    expect(completion).toContain("**details**");
    expect(completion).not.toContain("committed");
    expect(completion).not.toContain("Say **kill**");
  });

  it("does not mistake an intent-only hold for a committed booking", async () => {
    const { completion } = await start([mission("dr", "holding", { holdLine: "HOLDING AT after_intent" })]);
    expect(completion).toContain("paused at a test boundary");
    expect(completion).not.toContain("committed");
  });

  it("reports completed and blocked verdicts without instructing a crash", async () => {
    const { completion } = await start([
      mission("dr", "done", { verdict: { verdict: "VALID", reason: "all four simulated receipts verified", duplicate_effects: 0, stale_actions: 0 } }),
      mission("naive", "done", { verdict: { verdict: "BLOCKED", reason: "campsite closed", duplicate_effects: 0, stale_actions: 1 } }),
    ]);
    expect(completion).toContain("**VALID**: all four simulated receipts verified");
    expect(completion).toContain("**BLOCKED**: campsite closed");
    expect(completion).not.toContain("Say **kill**");
    expect(completion).not.toContain("paused before");
  });

  it("leaves running workers as running when observation times out", async () => {
    vi.useFakeTimers();
    const result = start([mission("dr", "running")]);
    await vi.advanceTimersByTimeAsync(180_001);
    const { completion, unsubscribe } = await result;
    expect(completion).toContain("is running");
    expect(completion).not.toContain("committed");
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
