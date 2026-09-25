import { describe, expect, test } from "bun:test";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { mintRunAssertion } from "../src/agents/callback-token";
import type { AppVariables } from "../src/auth/guards";
import {
  createDeadReckoningRoutes,
  type DeadReckoningConfig,
} from "../src/dead-reckoning/routes";

const KEY = "test-key-encryption-key";
const INTERNAL_TOKEN = "dr-internal-token";

const actor = { id: "user-1", email: "person@openbot.test", role: "user" } as const;

const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (context, next) => {
  context.set("actor", actor);
  await next();
};

const denied: MiddlewareHandler<{ Variables: AppVariables }> = (context) =>
  Promise.resolve(context.json({ error: "denied" }, 401));

function config(overrides: Partial<DeadReckoningConfig> = {}): DeadReckoningConfig {
  return { drControlUrl: "http://127.0.0.1:4400", drInternalToken: INTERNAL_TOKEN, keyEncryptionKey: KEY, ...overrides };
}

function appFor(
  cfg: DeadReckoningConfig,
  fetchImpl: typeof fetch,
  middleware: MiddlewareHandler<{ Variables: AppVariables }> = requireUser,
  checkBotAccess?: (actorId: string, botId: string) => Promise<boolean>,
) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.route("/api/dead-reckoning", createDeadReckoningRoutes(middleware, cfg, checkBotAccess, fetchImpl));
  return app;
}

/** Records every call the router made to "DR control" and answers with a fixed body/status. */
function recordingFetch(status: number, body: unknown): { fetchImpl: typeof fetch; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("browser proxy (requireUser)", () => {
  test("forwards GET /missions/:id to DR control with the server's own bearer token and the trusted actor header", async () => {
    const { fetchImpl, calls } = recordingFetch(200, { missionId: "m1", revision: 3 });
    const response = await appFor(config(), fetchImpl).request("http://openbot.test/api/dead-reckoning/missions/m1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ missionId: "m1", revision: 3 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://127.0.0.1:4400/missions/m1");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${INTERNAL_TOKEN}`);
    expect(headers["x-dr-actor-id"]).toBe(actor.id);
  });

  test("never forwards a browser-supplied x-dr-actor-id header, only the session's own actor id", async () => {
    const { fetchImpl, calls } = recordingFetch(200, { missionId: "m1" });
    const app = appFor(config(), fetchImpl);
    await app.request("http://openbot.test/api/dead-reckoning/missions/m1", {
      headers: { "x-dr-actor-id": "attacker-supplied-id" },
    });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-dr-actor-id"]).toBe(actor.id);
  });

  test("POST /missions forwards the body and method", async () => {
    const { fetchImpl, calls } = recordingFetch(201, { missionId: "m2", revision: 0 });
    const response = await appFor(config(), fetchImpl).request("http://openbot.test/api/dead-reckoning/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commandId: "cmd-1", goal: "trip" }),
    });
    expect(response.status).toBe(201);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ commandId: "cmd-1", goal: "trip" });
  });

  test("POST /missions/:id/resume, /pause, /cancel proxy to the matching control path", async () => {
    for (const verb of ["resume", "pause", "cancel"]) {
      const { fetchImpl, calls } = recordingFetch(202, { missionId: "m1", revision: 4 });
      await appFor(config(), fetchImpl).request(`http://openbot.test/api/dead-reckoning/missions/m1/${verb}`, {
        method: "POST",
        body: "{}",
      });
      expect(calls[0].url).toBe(`http://127.0.0.1:4400/missions/m1/${verb}`);
    }
  });

  test("refuses a non-allowlisted mission path (no open proxy)", async () => {
    const { fetchImpl, calls } = recordingFetch(200, {});
    const response = await appFor(config(), fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/missions/m1/not-a-real-route",
    );
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  test("denies before any proxy call when requireUser refuses", async () => {
    const { fetchImpl, calls } = recordingFetch(200, { missionId: "m1" });
    const response = await appFor(config(), fetchImpl, denied).request(
      "http://openbot.test/api/dead-reckoning/missions/m1",
    );
    expect(response.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test("returns 503 DR_NOT_CONFIGURED and never calls fetch when no internal token is configured", async () => {
    const { fetchImpl, calls } = recordingFetch(200, { missionId: "m1" });
    const response = await appFor(config({ drInternalToken: undefined }), fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/missions/m1",
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("DR_NOT_CONFIGURED");
    expect(calls).toHaveLength(0);
  });

  test("returns 503 STORAGE_UNAVAILABLE when DR control is unreachable", async () => {
    const throwingFetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const response = await appFor(config(), throwingFetch).request("http://openbot.test/api/dead-reckoning/missions/m1");
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("STORAGE_UNAVAILABLE");
  });
});

describe("POST /internal/verify-run (service token only, not requireUser)", () => {
  function signedRun(overrides: Partial<Parameters<typeof mintRunAssertion>[0]> = {}) {
    return mintRunAssertion(
      { botId: "dead-reckoning", actorId: "actor-1", runId: "run-1", threadId: "thread-1", ...overrides },
      KEY,
    );
  }

  test("401s a missing bearer token, without touching requireUser at all", async () => {
    const response = await appFor(config(), recordingFetch(200, {}).fetchImpl, denied).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      { method: "POST", body: JSON.stringify({ assertion: signedRun(), runId: "run-1", threadId: "thread-1" }) },
    );
    expect(response.status).toBe(401);
  });

  test("401s a wrong bearer token", async () => {
    const response = await appFor(config(), recordingFetch(200, {}).fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      {
        method: "POST",
        headers: { authorization: "Bearer wrong-token" },
        body: JSON.stringify({ assertion: signedRun(), runId: "run-1", threadId: "thread-1" }),
      },
    );
    expect(response.status).toBe(401);
  });

  test("401s when no internal token is configured at all", async () => {
    const response = await appFor(config({ drInternalToken: undefined }), recordingFetch(200, {}).fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      {
        method: "POST",
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
        body: JSON.stringify({ assertion: signedRun(), runId: "run-1", threadId: "thread-1" }),
      },
    );
    expect(response.status).toBe(401);
  });

  test("401s a forged assertion (wrong signing key)", async () => {
    const forged = mintRunAssertion({ botId: "dead-reckoning", actorId: "actor-1", runId: "run-1", threadId: "thread-1" }, "wrong-key");
    const response = await appFor(config(), recordingFetch(200, {}).fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      {
        method: "POST",
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
        body: JSON.stringify({ assertion: forged, runId: "run-1", threadId: "thread-1" }),
      },
    );
    expect(response.status).toBe(401);
  });

  test("401s an expired assertion", async () => {
    const expired = mintRunAssertion(
      { botId: "dead-reckoning", actorId: "actor-1", runId: "run-1", threadId: "thread-1" },
      KEY,
      Date.now() - 20 * 60 * 1000, // minted 20 minutes ago; TTL is 10 minutes
    );
    const response = await appFor(config(), recordingFetch(200, {}).fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      {
        method: "POST",
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
        body: JSON.stringify({ assertion: expired, runId: "run-1", threadId: "thread-1" }),
      },
    );
    expect(response.status).toBe(401);
  });

  test("403s an assertion signed for a different Bot", async () => {
    const wrongBot = signedRun({ botId: "some-other-bot" });
    const response = await appFor(config(), recordingFetch(200, {}).fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      {
        method: "POST",
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
        body: JSON.stringify({ assertion: wrongBot, runId: "run-1", threadId: "thread-1" }),
      },
    );
    expect(response.status).toBe(403);
  });

  test("403s a run/thread id mismatch", async () => {
    const response = await appFor(config(), recordingFetch(200, {}).fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      {
        method: "POST",
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
        body: JSON.stringify({ assertion: signedRun(), runId: "run-1", threadId: "a-different-thread" }),
      },
    );
    expect(response.status).toBe(403);
  });

  test("accepts a valid assertion signed with the same helper and returns the verified identity", async () => {
    const response = await appFor(config(), recordingFetch(200, {}).fetchImpl).request(
      "http://openbot.test/api/dead-reckoning/internal/verify-run",
      {
        method: "POST",
        headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
        body: JSON.stringify({ assertion: signedRun(), runId: "run-1", threadId: "thread-1" }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ actorId: "actor-1", botId: "dead-reckoning", runId: "run-1", threadId: "thread-1" });
  });

  test("403s when checkBotAccess refuses the resolved actor", async () => {
    const app = appFor(config(), recordingFetch(200, {}).fetchImpl, requireUser, async () => false);
    const response = await app.request("http://openbot.test/api/dead-reckoning/internal/verify-run", {
      method: "POST",
      headers: { authorization: `Bearer ${INTERNAL_TOKEN}` },
      body: JSON.stringify({ assertion: signedRun(), runId: "run-1", threadId: "thread-1" }),
    });
    expect(response.status).toBe(403);
  });
});
