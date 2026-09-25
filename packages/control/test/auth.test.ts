import { describe, it, expect, vi } from "vitest";
import { verifyRunAssertion } from "../src/auth";

const BASE = { openbotUrl: "http://127.0.0.1:3001", internalToken: "shared-secret", assertion: "signed", runId: "r1", threadId: "t1" };

function fetchReturning(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  ) as unknown as typeof fetch;
}

describe("verifyRunAssertion", () => {
  it("posts to the verify-run route with the internal token and returns the verified identity", async () => {
    const fetchImpl = fetchReturning(200, { actorId: "actor-1", botId: "dead-reckoning", runId: "r1", threadId: "t1" });
    const result = await verifyRunAssertion({ ...BASE, fetchImpl });
    expect(result).toEqual({
      ok: true,
      identity: { actorId: "actor-1", botId: "dead-reckoning", runId: "r1", threadId: "t1" },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/dead-reckoning/internal/verify-run",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer shared-secret" }),
        body: JSON.stringify({ assertion: "signed", runId: "r1", threadId: "t1" }),
      }),
    );
  });

  it("strips a trailing slash from openbotUrl", async () => {
    const fetchImpl = fetchReturning(200, { actorId: "a", botId: "dead-reckoning", runId: "r1", threadId: "t1" });
    await verifyRunAssertion({ ...BASE, openbotUrl: "http://127.0.0.1:3001/", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/dead-reckoning/internal/verify-run",
      expect.anything(),
    );
  });

  it("returns ASSERTION_REJECTED on a 401 (bad token, forged/expired/wrong-Bot assertion)", async () => {
    const fetchImpl = fetchReturning(401, { error: "Not authorised." });
    const result = await verifyRunAssertion({ ...BASE, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === "ASSERTION_REJECTED") {
      expect(result.error.status).toBe(401);
      expect(result.error.message).toBe("Not authorised.");
    } else {
      expect.fail("expected ASSERTION_REJECTED");
    }
  });

  it("returns ASSERTION_REJECTED on a 403 (wrong Bot / run-thread mismatch)", async () => {
    const fetchImpl = fetchReturning(403, { error: "Wrong Bot." });
    const result = await verifyRunAssertion({ ...BASE, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ code: "ASSERTION_REJECTED", status: 403, message: "Wrong Bot." });
  });

  it("returns OPENBOT_UNAVAILABLE when the request throws (network failure)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await verifyRunAssertion({ ...BASE, fetchImpl });
    expect(result).toEqual({ ok: false, error: { code: "OPENBOT_UNAVAILABLE", message: "ECONNREFUSED" } });
  });

  it("returns OPENBOT_UNAVAILABLE when the 2xx body is not the expected shape", async () => {
    const fetchImpl = fetchReturning(200, { ok: true });
    const result = await verifyRunAssertion({ ...BASE, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("OPENBOT_UNAVAILABLE");
  });

  it("never logs or otherwise surfaces the raw assertion value", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = fetchReturning(200, { actorId: "a", botId: "dead-reckoning", runId: "r1", threadId: "t1" });
    await verifyRunAssertion({ ...BASE, assertion: "super-secret-signed-value", fetchImpl });
    const allLogged = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(" ");
    expect(allLogged).not.toContain("super-secret-signed-value");
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
