import { describe, expect, it } from "vitest";
import {
  ApprovalError, assertApprovalCovers, bindingHash, createTaskContext, decideApproval, guardDecision, proposeApproval,
  type ApprovalBinding,
} from "../src/index.ts";

const binding: ApprovalBinding = {
  missionId: "f3-20260925-aaaa", ownerId: "user-1", planRevision: 3, actionKey: "k-ferry", slot: "ferry",
  operation: "book", resourceId: "ferry-tiburon-1009", argsHash: "a".repeat(64),
};
const NOW = Date.parse("2026-09-25T21:00:00Z");

describe("guard (TaskContext)", () => {
  it("refuses new work after pause/cancel or a newer generation", () => {
    expect(guardDecision({ status: "executing", generation: 2 }, 2)).toBeNull();
    expect(guardDecision({ status: "pausing", generation: 2 }, 2)?.reason).toBe("paused");
    expect(guardDecision({ status: "cancelling", generation: 2 }, 2)?.reason).toBe("cancelled");
    expect(guardDecision({ status: "executing", generation: 3 }, 2)?.reason).toBe("superseded");
  });
  it("aborts the signal once ownership is lost", async () => {
    let status: "executing" | "cancelling" = "executing";
    const ctx = createTaskContext({ generation: 1, fetchOwnership: async () => ({ status, generation: 1 }), submit: async () => ({ revision: 1 }) });
    await ctx.guard();
    status = "cancelling";
    await expect(ctx.guard()).rejects.toThrow(/cancelled/);
    expect(ctx.signal.aborted).toBe(true);
  });
});

describe("approvals (U04, U06)", () => {
  const a = proposeApproval(binding, { now: NOW, display: "Book ferry $120" });
  const ok = { actorId: "user-1", displayedBindingHash: a.bindingHash, expectedPlanRevision: 3, currentPlanRevision: 3, decision: "accept" as const, commandId: "cmd-000001", now: NOW + 1000 };

  it("accepts the exact displayed binding and is idempotent on repeat", () => {
    const d = decideApproval(a, ok);
    expect(d.status).toBe("accepted");
    expect(decideApproval(d, ok)).toBe(d);
    expect(() => decideApproval(d, { ...ok, decision: "reject", commandId: "cmd-000002" })).toThrow(ApprovalError);
  });
  it("U04: replayed card for a changed plan revision, other owner, stale hash or expiry does nothing", () => {
    expect(() => decideApproval(a, { ...ok, currentPlanRevision: 4 })).toThrow(/revision/);
    expect(() => decideApproval(a, { ...ok, actorId: "user-2" })).toThrow(/owner/);
    expect(() => decideApproval(a, { ...ok, displayedBindingHash: "x" })).toThrow(/changed/);
    expect(() => decideApproval(a, { ...ok, now: NOW + 31 * 60_000 })).toThrow(/expired/);
  });
  it("U06: an accepted approval does not cover another action key or slot with otherwise identical fields", () => {
    const d = decideApproval(a, ok);
    expect(() => assertApprovalCovers(d, binding, NOW + 2000)).not.toThrow();
    expect(() => assertApprovalCovers(d, { ...binding, actionKey: "k-ferry-2" }, NOW + 2000)).toThrow(/different/);
    expect(() => assertApprovalCovers(d, { ...binding, slot: "campsite" }, NOW + 2000)).toThrow(/different/);
    expect(() => assertApprovalCovers(d, binding, NOW + 31 * 60_000)).toThrow(/expired/);
    expect(bindingHash({ ...binding, argsHash: "b".repeat(64) })).not.toBe(a.bindingHash);
  });
});
