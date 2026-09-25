#!/usr/bin/env node
// Single-origin front for the OpenBot dev console, so one public tunnel can serve it.
//
// OpenBot dev runs as two loopback servers: the Vite app (APP_PORT, 3010) and the API server
// (SERVER_PORT, 3001). The app normally opens its WebSockets directly on :3001, which a single
// tunnel URL cannot expose. This proxy listens on 127.0.0.1:3020 and:
//   - routes /api (HTTP and WebSocket upgrades) to the API server, everything else to Vite;
//   - rewrites Host and Origin to the loopback values OpenBot already trusts, so neither Vite's
//     host check nor TRUSTED_ORIGINS needs changing and OpenBot does not need a restart;
//   - blanks window.__OPENBOT_WS_PORT__ in served HTML, so socketUrl() falls back to same-origin.
//
// Exposing this publicly gives anyone with the URL admin access (OPENBOT_SINGLE_USER=true).
// Run only for the event demo:  node scripts/openbot-public-proxy.mjs
import http from "node:http";
import net from "node:net";

const LISTEN = Number(process.env.OPENBOT_PROXY_PORT || 3020);
const APP = Number(process.env.APP_PORT || 3010);
const API = Number(process.env.SERVER_PORT || 3001);
const LOCAL_ORIGIN = `http://127.0.0.1:${APP}`;

const targetPort = (url = "/") => (url.startsWith("/api") ? API : APP);

function rewriteHeaders(headers, port) {
  const out = { ...headers, host: `127.0.0.1:${port}` };
  if (out.origin) out.origin = LOCAL_ORIGIN;
  if (out.referer) out.referer = out.referer.replace(/^https?:\/\/[^/]+/, LOCAL_ORIGIN);
  return out;
}

const server = http.createServer((req, res) => {
  const port = targetPort(req.url);
  const headers = rewriteHeaders(req.headers, port);
  if (port === APP) delete headers["accept-encoding"]; // keep HTML uncompressed so it can be rewritten
  const upstream = http.request(
    { host: "127.0.0.1", port, method: req.method, path: req.url, headers },
    (up) => {
      const isHtml = String(up.headers["content-type"] || "").includes("text/html");
      if (port !== APP || !isHtml) {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
        return;
      }
      const chunks = [];
      up.on("data", (c) => chunks.push(c));
      up.on("end", () => {
        const body = Buffer.concat(chunks)
          .toString("utf8")
          .replace(/window\.__OPENBOT_WS_PORT__=("[^"]*")/g, 'window.__OPENBOT_WS_PORT__=""');
        const h = { ...up.headers, "content-length": Buffer.byteLength(body) };
        delete h["transfer-encoding"];
        res.writeHead(up.statusCode || 502, h);
        res.end(body);
      });
    },
  );
  upstream.on("error", (e) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`upstream ${port} unavailable: ${e.code || e.message}`);
  });
  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const port = targetPort(req.url);
  const headers = rewriteHeaders(req.headers, port);
  const upstream = net.connect(port, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [k, v] of Object.entries(headers)) {
      for (const val of Array.isArray(v) ? v : [v]) lines.push(`${k}: ${val}`);
    }
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const close = () => { socket.destroy(); upstream.destroy(); };
  upstream.on("error", close);
  socket.on("error", close);
});

server.listen(LISTEN, "127.0.0.1", () => {
  console.log(`OpenBot single-origin proxy on http://127.0.0.1:${LISTEN} → app :${APP}, /api :${API}`);
});
