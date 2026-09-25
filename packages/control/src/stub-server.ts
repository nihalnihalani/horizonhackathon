// WP B stub: binds 127.0.0.1:DR_CONTROL_PORT (default 4400) with GET /health and POST /ag-ui
// (canned reply) so OpenBot can register the Dead Reckoning agent before integration.
// Replaced by packages/control/src/server.ts (integration) which reuses createAgUiHandler.
import { createServer } from "node:http";
import { loadConfig } from "@dr/shared";
import { createAgUiHandler, stubMissionPort } from "./ag-ui/handler";

const cfg = loadConfig("console-stub");
const port = Number(cfg.DR_CONTROL_PORT);
const HOST = "127.0.0.1";
const agUi = createAgUiHandler(stubMissionPort);

const server = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", mode: "stub" }));
    return;
  }
  if (path === "/ag-ui") {
    agUi(req, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "internal", detail: String(err?.message ?? err) }));
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, HOST, () => {
  console.log(`DR control STUB listening on http://${HOST}:${port} (GET /health, POST /ag-ui)`);
});
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => server.close(() => process.exit(0)));
