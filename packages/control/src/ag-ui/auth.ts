// Bearer gate for the AG-UI endpoint. OpenBot is the only caller and sends
// `Authorization: Bearer <DR_INTERNAL_TOKEN>`; anything else gets a 401 JSON body.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Constant-time check of `Authorization: Bearer <token>` (digests keep lengths equal). */
export function bearerMatches(header: string | undefined, token: string): boolean {
  const m = /^Bearer\s+(.+)$/i.exec((header ?? "").trim());
  const presented = m?.[1]?.trim() ?? "";
  const ok = timingSafeEqual(digest(presented), digest(token));
  return ok && presented.length > 0 && token.length > 0;
}

/** Wrap a handler so it only runs for requests carrying the expected bearer token. */
export function requireBearer(token: string, handler: Handler, onReject?: (req: IncomingMessage) => void): Handler {
  if (!token) throw new Error("requireBearer: empty token");
  return (req, res) => {
    if (!bearerMatches(req.headers.authorization, token)) {
      onReject?.(req);
      res.writeHead(401, { "content-type": "application/json", "www-authenticate": 'Bearer realm="dr-ag-ui"' });
      res.end(JSON.stringify({ error: "internal token required" }));
      return;
    }
    return handler(req, res);
  };
}
