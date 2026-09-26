import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { parse as parseEnv } from "dotenv";
import { REPO_ROOT } from "@dr/shared";
import { ReservationSources } from "@dr/providers/reservation";
import { PreparationService, PreparationStore, type SourceReader } from "./preparations.ts";

const json = (res: ServerResponse, code: number, data: unknown) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(data));
};

export async function startProduct(options: { port?: number; directory?: string; sources?: SourceReader; apiKey?: string } = {}) {
  const directory = options.directory ?? resolve(REPO_ROOT, "artifacts/product");
  mkdirSync(directory, { recursive: true });
  let store: PreparationStore;
  let service: PreparationService;
  let origin = "";
  const server = createServer((req, res) => { void route(req, res).catch(() => { if (!res.headersSent) json(res, 500, { error: "The preparation service could not complete this request." }); else res.end(); }); });
  async function route(req: IncomingMessage, res: ServerResponse) {
    if (!service || !origin) return json(res, 503, { error: "The product is starting." });
    const entryNavigation = req.method === "GET" && req.url === "/" && req.headers["sec-fetch-mode"] === "navigate" && req.headers["sec-fetch-dest"] === "document" && !req.headers.origin;
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)
      || (!entryNavigation && req.headers["sec-fetch-site"] && !["same-origin", "none"].includes(String(req.headers["sec-fetch-site"])))) {
      return json(res, 403, { error: "Open the product directly on its local address." });
    }
    const path = new URL(req.url ?? "/", origin).pathname;
    if (req.method === "GET" && path === "/health") return json(res, 200, { status: "ok", mode: "reservation-preparation", configured: service.configured });
    if (req.method === "GET" && path === "/") {
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store", "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src https://fareharbor.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", "referrer-policy": "no-referrer" });
      return res.end(readFileSync(resolve(REPO_ROOT, "packages/control/public/product.html")));
    }
    if (req.method === "GET" && path === "/api/preparations") return json(res, 200, { preparations: store.list(), readiness: { configured: service.configured }, service: "reservation-preparation" });
    const match = /^\/api\/preparations\/([\da-f-]{36})(\/export)?$/.exec(path);
    if (req.method === "GET" && match) {
      const prep = store.get(match[1]!);
      if (!prep) return json(res, 404, { error: "Preparation not found." });
      if (match[2]) res.setHeader("content-disposition", `attachment; filename="ferry-preparation-${prep.id}.json"`);
      return json(res, 200, prep);
    }
    if (req.method === "POST" && path === "/api/preparations") {
      if (req.headers.origin !== origin || req.headers["content-type"]?.split(";")[0] !== "application/json") return json(res, 403, { error: "A same-origin JSON request is required." });
      let raw = "";
      for await (const chunk of req) { raw += chunk; if (raw.length > 2048) return json(res, 413, { error: "Request too large." }); }
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return json(res, 400, { error: "Invalid JSON." }); }
      try { const result = service.start(body); return json(res, result.created ? 202 : 200, result.preparation); }
      catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "BUSY") return json(res, 409, { error: "A preparation is already checking sources. Wait for it to finish." });
        if (message === "COMMAND_CONFLICT") return json(res, 409, { error: "This request ID was already used for different trip inputs. Start a new preparation." });
        if (message === "NOT_CONFIGURED") return json(res, 503, { error: "The app's Nimble service key is missing. Set NIMBLE_API_KEY in the root .env and restart the product. No coding-assistant key is needed." });
        return json(res, 400, { error: "Choose 1–6 adults and a ferry budget between $1 and $500." });
      }
    }
    json(res, 404, { error: "Not found." });
  }
  try { await new Promise<void>((ok, fail) => { server.once("error", fail); server.listen(options.port ?? 4430, "127.0.0.1", ok); }); }
  catch (error) { throw error; }
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Binding the single production port grants ownership before restart recovery touches SQLite.
  // Test-only port/directory overrides must use an isolated directory for each server.
  try {
    store = new PreparationStore(resolve(directory, "preparations.sqlite"));
    service = new PreparationService(store, options.sources ?? (options.apiKey ? new ReservationSources(options.apiKey) : undefined));
  } catch (error) { server.close(); throw error; }
  return { url: origin, service, store, async close() { await service.idle(); await new Promise<void>((ok, fail) => server.close((error) => error ? fail(error) : ok())); store.close(); } };
}

async function main() {
  // Read only the application's web-sourcing credential. No planner or coding-assistant invocation.
  let fileKey: string | undefined;
  try { fileKey = parseEnv(readFileSync(resolve(REPO_ROOT, ".env"))).NIMBLE_API_KEY; } catch { /* readiness explains missing config */ }
  const app = await startProduct({ apiKey: process.env.NIMBLE_API_KEY || fileKey });
  console.log(`Reservation product ready at ${app.url} · live source checks ${app.service.configured ? "configured" : "not configured"}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main().catch(() => { console.error("Could not start the product. Check that port 4430 is free and the artifacts directory is writable."); process.exit(1); });
