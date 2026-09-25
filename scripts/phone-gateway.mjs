#!/usr/bin/env node
// Phone gateway: an allowlisted front for the DR proof board so a phone can operate the demo through ONE public
// tunnel without exposing the control service. Listens on 127.0.0.1:4410 (put a tunnel in front of it, e.g.
// `cloudflared tunnel --url http://127.0.0.1:4410`) and forwards ONLY:
//   GET  /            → 302 /board
//   GET  /board       (static page; contains no data)
//   GET  /events      (SSE; control requires the operator bearer or the dr_op session cookie)
//   GET  /scorecard   (control requires the operator bearer or the dr_op session cookie)
//   POST /demo/{session,reset,start,kill,world,resume}  (control requires the operator bearer)
// Everything else is 404 here and never reaches control: /internal/*, /missions*, /ag-ui, /status.md, /health, …
// Failed operator auth is rate-limited per client address. No request bodies or headers are logged.
import http from "node:http";

const LISTEN = Number(process.env.DR_PHONE_GATEWAY_PORT || 4410);
const CONTROL = { host: "127.0.0.1", port: Number(process.env.DR_CONTROL_PORT || 4400) };
const DEMO = new Set(["session", "reset", "start", "kill", "world", "resume"]);
const MAX_BODY = 16 * 1024;
const FAIL_LIMIT = 10, FAIL_WINDOW_MS = 60_000, BLOCK_MS = 5 * 60_000;
const fails = new Map(); // client → {count, since, blockedUntil}

function allowed(method, path) {
  if (method === "GET" && (path === "/board" || path === "/events" || path === "/scorecard")) return true;
  const m = /^\/demo\/([a-z]+)$/.exec(path);
  return method === "POST" && !!m && DEMO.has(m[1]);
}
const client = (req) => String(req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?").split(",")[0].trim();
function blocked(c) { const f = fails.get(c); return !!f && f.blockedUntil > Date.now(); }
function noteStatus(c, status) {
  if (status !== 401) return;
  const now = Date.now();
  const f = fails.get(c) ?? { count: 0, since: now, blockedUntil: 0 };
  if (now - f.since > FAIL_WINDOW_MS) { f.count = 0; f.since = now; }
  if (++f.count >= FAIL_LIMIT) { f.blockedUntil = now + BLOCK_MS; console.warn(`phone-gateway: blocking ${c} for ${BLOCK_MS / 60000} min after ${f.count} failed auth attempts`); }
  fails.set(c, f);
}
const SECURITY = {
  "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer",
  "cache-control": "no-store", "strict-transport-security": "max-age=600",
};

http.createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  const c = client(req);
  if (req.method === "GET" && path === "/") { res.writeHead(302, { location: "/board", ...SECURITY }); return res.end(); }
  if (!allowed(req.method, path)) { res.writeHead(404, { "content-type": "text/plain", ...SECURITY }); return res.end("not found"); }
  if (blocked(c)) { res.writeHead(429, { "content-type": "text/plain", ...SECURITY }); return res.end("too many failed attempts; try again later"); }
  if (Number(req.headers["content-length"] ?? 0) > MAX_BODY) { res.writeHead(413, SECURITY); return res.end(); }
  // Forward only the headers control needs; the query string is dropped (no route here uses one).
  const headers = { host: `${CONTROL.host}:${CONTROL.port}` };
  for (const h of ["authorization", "cookie", "content-type", "accept", "last-event-id"]) if (req.headers[h]) headers[h] = req.headers[h];
  let size = 0;
  const up = http.request({ ...CONTROL, method: req.method, path, headers }, (r) => {
    noteStatus(c, r.statusCode ?? 0);
    const out = { ...SECURITY };
    for (const h of ["content-type", "set-cookie", "www-authenticate", "cache-control", "connection"]) if (r.headers[h]) out[h] = r.headers[h];
    if (path === "/events") out["x-accel-buffering"] = "no"; // keep SSE streaming through proxies
    res.writeHead(r.statusCode ?? 502, out);
    r.pipe(res);
  });
  up.on("error", () => { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain", ...SECURITY }); res.end("control unavailable"); });
  req.on("data", (d) => { size += d.length; if (size > MAX_BODY) { up.destroy(); res.writeHead(413, SECURITY); res.end(); } });
  res.on("close", () => { if (!res.writableFinished) up.destroy(); }); // client went away (SSE disconnect)
  req.pipe(up);
}).listen(LISTEN, "127.0.0.1", () => console.log(`DR phone gateway on http://127.0.0.1:${LISTEN} → control :${CONTROL.port} (board, events, scorecard, demo/{${[...DEMO].join(",")}} only)`));
