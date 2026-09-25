// Dead Reckoning console integration (AGENTS.md "OpenBot adoption"; CONTRACTS §5).
//
// Two doors, two different authorities:
//
//  - `/api/dead-reckoning/missions*` is a plain authenticated browser proxy behind `requireUser`.
//    It forwards to DR control with the server's own `DR_INTERNAL_TOKEN` and the signed-in
//    person's actor id in a trusted header; it never forwards a browser-supplied owner, and it
//    only forwards the exact allowlisted mission paths below — this is not an open proxy.
//
//  - `/api/dead-reckoning/internal/verify-run` is authenticated ONLY by `DR_INTERNAL_TOKEN`
//    (constant-time compared), never by the browser session. DR control calls this to turn the
//    opaque `forwardedProps.openbotRun` a remote AG-UI run carries into a verified actor/Bot/run
//    identity, using the same `readRunAssertion` helper and signing key every other tool-call
//    verification in this server uses. See agents/callback-token.ts and copilot.ts (~L1216-1249)
//    for where that assertion is minted.
import type { Context, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { readRunAssertion, sameToken } from "../agents/callback-token";
import type { AppVariables } from "../auth/guards";

/**
 * The registered `remote-ag-ui` Dead Reckoning agent's Bot id (P5.1 tenant configuration).
 *
 * Fixed rather than configurable: this route exists to answer one question — is this run for
 * *the* Dead Reckoning Bot — and a deployment running more than one would need a real per-Bot
 * registry lookup, not a second env var.
 */
const DEAD_RECKONING_BOT_ID = "dead-reckoning";

/** Headers that must never be copied from an upstream (DR control) response back to the browser. */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "content-encoding",
  "content-length",
]);

export type DeadReckoningConfig = {
  /** DR control's base URL, e.g. `http://127.0.0.1:4400`. */
  drControlUrl: string;
  /** Shared with DR control only; absent means every route below refuses (503/401). */
  drInternalToken?: string;
  /** OpenBot's own signing key, for `readRunAssertion` (same key `mintRunAssertion` used). */
  keyEncryptionKey: string;
};

/** Whether this actor may act as the Dead Reckoning Bot, if a checker was supplied. Fails open when absent, matching `canUseBot`'s posture for a deployment with no access rules to check. */
export type DeadReckoningBotAccessCheck = (actorId: string, botId: string) => Promise<boolean>;

function notConfigured(context: Context) {
  return context.json({ error: "Dead Reckoning is not configured.", code: "DR_NOT_CONFIGURED" }, 503);
}

async function proxyJson(
  context: Context<{ Variables: AppVariables }>,
  config: DeadReckoningConfig,
  controlPath: string,
  fetchImpl: typeof fetch,
) {
  if (!config.drInternalToken) return notConfigured(context);
  const base = config.drControlUrl.replace(/\/+$/, "");
  const method = context.req.method;
  const query = context.req.query();
  const qs = Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : "";
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";

  let upstream: Response;
  try {
    upstream = await fetchImpl(`${base}${controlPath}${qs}`, {
      method,
      headers: {
        authorization: `Bearer ${config.drInternalToken}`,
        "x-dr-actor-id": context.var.actor.id,
        ...(hasBody ? { "content-type": "application/json" } : {}),
      },
      // The browser never controls the actor identity: only this trusted header does, built above
      // from the session, never from anything in the forwarded body.
      body: hasBody ? await context.req.text() : undefined,
    });
  } catch {
    return context.json(
      { code: "STORAGE_UNAVAILABLE", message: "Dead Reckoning control is unreachable.", retryable: true },
      503,
    );
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

/** Streams an SSE response through rather than buffering it (events are a refresh hint, not truth). */
async function proxySse(
  context: Context<{ Variables: AppVariables }>,
  config: DeadReckoningConfig,
  controlPath: string,
  fetchImpl: typeof fetch,
) {
  if (!config.drInternalToken) return notConfigured(context);
  const base = config.drControlUrl.replace(/\/+$/, "");
  const query = context.req.query();
  const qs = Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : "";

  let upstream: Response;
  try {
    upstream = await fetchImpl(`${base}${controlPath}${qs}`, {
      method: "GET",
      headers: { authorization: `Bearer ${config.drInternalToken}`, "x-dr-actor-id": context.var.actor.id },
    });
  } catch {
    return context.json(
      { code: "STORAGE_UNAVAILABLE", message: "Dead Reckoning control is unreachable.", retryable: true },
      503,
    );
  }

  const headers = new Headers();
  for (const [key, value] of upstream.headers) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export function createDeadReckoningRoutes(
  requireUser: MiddlewareHandler<{ Variables: AppVariables }>,
  config: DeadReckoningConfig,
  /** Present when the deployment can re-check actor/Bot access (see app.ts's `canUseBot`). */
  checkBotAccess?: DeadReckoningBotAccessCheck,
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl: typeof fetch = fetch,
) {
  const routes = new Hono<{ Variables: AppVariables }>();

  // ---- authenticated browser proxy: explicit allowlist, no open proxy ----
  routes.post("/missions", requireUser, (c) => proxyJson(c, config, "/missions", fetchImpl));
  routes.get("/missions", requireUser, (c) => proxyJson(c, config, "/missions", fetchImpl));
  routes.get("/missions/:id", requireUser, (c) =>
    proxyJson(c, config, `/missions/${encodeURIComponent(c.req.param("id"))}`, fetchImpl),
  );
  routes.post("/missions/:id/resume", requireUser, (c) =>
    proxyJson(c, config, `/missions/${encodeURIComponent(c.req.param("id"))}/resume`, fetchImpl),
  );
  routes.post("/missions/:id/pause", requireUser, (c) =>
    proxyJson(c, config, `/missions/${encodeURIComponent(c.req.param("id"))}/pause`, fetchImpl),
  );
  routes.post("/missions/:id/cancel", requireUser, (c) =>
    proxyJson(c, config, `/missions/${encodeURIComponent(c.req.param("id"))}/cancel`, fetchImpl),
  );
  routes.get("/missions/:id/events", requireUser, (c) =>
    proxySse(c, config, `/missions/${encodeURIComponent(c.req.param("id"))}/events`, fetchImpl),
  );

  // ---- service-authenticated verify-run: DR_INTERNAL_TOKEN only, never requireUser ----
  routes.post("/internal/verify-run", async (context) => {
    const offered = context.req.header("authorization");
    const expected = config.drInternalToken ? `Bearer ${config.drInternalToken}` : null;
    // The no-token-configured case is refused here, before any comparison, with the same response
    // as a wrong token — mirrors /internal/routines/run's posture in app.ts.
    if (!expected || !offered || !sameToken(offered, expected)) {
      return context.json({ error: "Not authorised." }, 401);
    }

    const raw = await context.req.json().catch(() => null);
    if (!raw || typeof raw !== "object") return context.json({ error: "Invalid request." }, 400);
    const { assertion, runId, threadId } = raw as { assertion?: unknown; runId?: unknown; threadId?: unknown };
    if (assertion === undefined || typeof runId !== "string" || typeof threadId !== "string") {
      return context.json({ error: "Invalid request." }, 400);
    }

    // Never logged: readRunAssertion fails closed (bad signature, expired, wrong shape → null).
    const verified = readRunAssertion(assertion, config.keyEncryptionKey);
    if (!verified) return context.json({ error: "Not authorised." }, 401);
    if (verified.botId !== DEAD_RECKONING_BOT_ID) {
      return context.json({ error: "This assertion is not for the Dead Reckoning Bot." }, 403);
    }
    if (verified.runId !== runId || (verified.threadId ?? "") !== threadId) {
      return context.json({ error: "Run/thread binding does not match." }, 403);
    }
    if (checkBotAccess && !(await checkBotAccess(verified.actorId, verified.botId))) {
      return context.json({ error: "This actor may not act as the Dead Reckoning Bot." }, 403);
    }

    return context.json({ actorId: verified.actorId, botId: verified.botId, runId, threadId }, 200);
  });

  return routes;
}
