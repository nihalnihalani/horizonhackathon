// Verifies an AG-UI run assertion against OpenBot's internal verify-run route (CONTRACTS §5).
// DR control never holds the OpenBot signing/encryption key and never trusts an unsigned
// `openbotRun`/actorId supplied by the model or the transport; it calls the authenticated
// loopback service boundary (`POST {openbotUrl}/api/dead-reckoning/internal/verify-run`) with its
// own `DR_INTERNAL_TOKEN` and trusts only the verified identity that route returns.

/** Successful, server-verified identity for one AG-UI run. */
export type VerifiedRun = {
  actorId: string;
  botId: string;
  runId: string;
  threadId: string;
};

export type VerifyRunError =
  /** OpenBot rejected the assertion, token, Bot identity, or run/thread binding. */
  | { code: "ASSERTION_REJECTED"; status: number; message: string }
  /** OpenBot could not be reached, or answered with something that is not the expected shape. */
  | { code: "OPENBOT_UNAVAILABLE"; message: string };

export type VerifyRunResult =
  | { ok: true; identity: VerifiedRun }
  | { ok: false; error: VerifyRunError };

export type VerifyRunAssertionInput = {
  /** OpenBot's server origin, e.g. `http://127.0.0.1:3001`. No trailing slash required. */
  openbotUrl: string;
  /** DR control's copy of the shared `DR_INTERNAL_TOKEN` (also held by OpenBot). */
  internalToken: string;
  /** The opaque signed value from `forwardedProps.openbotRun`. Never logged. */
  assertion: unknown;
  runId: string;
  threadId: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

function isVerifiedShape(value: unknown): value is VerifiedRun {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.actorId === "string" &&
    typeof v.botId === "string" &&
    typeof v.runId === "string" &&
    typeof v.threadId === "string"
  );
}

/**
 * Ask OpenBot to verify one AG-UI run assertion.
 *
 * Never throws: a network failure, a non-2xx response, and an unrecognized 2xx body are all
 * returned as a typed `{ok:false}` so the caller (the AG-UI handler) fails closed without needing
 * a try/catch of its own.
 */
export async function verifyRunAssertion(
  input: VerifyRunAssertionInput,
): Promise<VerifyRunResult> {
  const { openbotUrl, internalToken, assertion, runId, threadId, fetchImpl = fetch } = input;
  const url = `${openbotUrl.replace(/\/+$/, "")}/api/dead-reckoning/internal/verify-run`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${internalToken}`,
      },
      body: JSON.stringify({ assertion, runId, threadId }),
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "OPENBOT_UNAVAILABLE",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (!response.ok) {
    let message = `verify-run refused (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // no JSON body; keep the generic message
    }
    return { ok: false, error: { code: "ASSERTION_REJECTED", status: response.status, message } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      error: { code: "OPENBOT_UNAVAILABLE", message: "verify-run returned a non-JSON body" },
    };
  }

  if (!isVerifiedShape(body)) {
    return {
      ok: false,
      error: { code: "OPENBOT_UNAVAILABLE", message: "verify-run returned an unexpected shape" },
    };
  }

  return { ok: true, identity: body };
}
