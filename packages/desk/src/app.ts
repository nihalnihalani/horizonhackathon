// Desk HTTP app (Express 5). DR_WORLD_TOKEN guards /book, /actions, /cancel; DR_OPERATOR_TOKEN guards /admin/*.
import express, { type Request, type Response, type NextFunction } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import { Arm, F3, Slot, renderStatusPage } from "@dr/shared";
import { DeskStore } from "./store.ts";

const BookBody = z.object({
  action_key: z.string().regex(/^[a-f0-9]{64}$/),
  run_id: z.string().min(1).max(64),
  arm: Arm,
  slot: Slot,
  resource: z.string().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  party: z.number().int().min(1).max(20),
  expected_world_version: z.number().int().min(1),
  args_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
const WorldBody = z.object({ site: z.string().regex(/^(site-)?[ABC]$/), status: z.enum(["open", "closed"]), notice: z.string().max(200).optional() });

function bearer(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization !== `Bearer ${token}`) { res.status(401).json({ error: "unauthorized" }); return; }
    next();
  };
}

export type DeskOptions = { store?: DeskStore; worldToken: string; operatorToken: string; simClock?: string };

export function createDeskApp(o: DeskOptions) {
  const store = o.store ?? new DeskStore();
  let simClock = o.simClock ?? F3.sim_clock;
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  const world = bearer(o.worldToken);
  const operator = bearer(o.operatorToken);

  app.get("/health", (_req, res) => { res.json({ ok: true, world_version: store.worldVersion().version }); });
  app.get("/status.html", (_req, res) => { res.type("html").send(renderStatusPage(store.statusModel())); });
  app.get("/world", (_req, res) => { res.json(store.statusModel()); });

  app.post("/book", world, (req, res) => {
    const p = BookBody.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "invalid_request", issues: p.error.issues.map((i) => i.path.join(".")) }); return; }
    try {
      const r = store.book(p.data);
      if (r.status === 200) res.json(r.receipt);
      else res.status(r.status).json(r);
    } catch (e) {
      res.status(503).json({ error: "desk_unavailable", message: (e as Error).message });
    }
  });

  app.get("/actions/:key", world, (req, res) => {
    try {
      const ns = { run_id: typeof req.query.run_id === "string" ? req.query.run_id : undefined, arm: typeof req.query.arm === "string" ? req.query.arm : undefined };
      const r = store.lookup(String(req.params.key), ns);
      if (!r) { res.status(404).json({ status: "absent" }); return; }
      res.json(r);
    } catch (e) {
      res.status(503).json({ error: "desk_unavailable", message: (e as Error).message });
    }
  });

  app.post("/cancel", world, (req, res) => {
    const key = z.object({ action_key: z.string().min(1) }).safeParse(req.body);
    if (!key.success) { res.status(400).json({ error: "invalid_request" }); return; }
    const r = store.cancel(key.data.action_key);
    if (r.status === 404) res.status(404).json({ status: "absent" }); else res.json(r.receipt);
  });

  app.get("/time", (_req, res) => { res.json({ sim_clock: simClock }); });
  app.post("/time", operator, (req, res) => {
    const t = z.object({ sim_clock: z.string().min(1).max(64) }).safeParse(req.body);
    if (!t.success) { res.status(400).json({ error: "invalid_request" }); return; }
    simClock = t.data.sim_clock;
    res.json({ sim_clock: simClock });
  });

  app.post("/admin/world", operator, (req, res) => {
    const p = WorldBody.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "invalid_request" }); return; }
    res.json({ ...store.editWorld(p.data.site, p.data.status, p.data.notice ?? ""), site: p.data.site, status: p.data.status });
  });
  app.post("/admin/reset", operator, (_req, res) => { store.reset(); res.json({ ok: true, world_version: store.worldVersion().version }); });
  app.post("/admin/fault", operator, (req, res) => {
    store.lookupUnavailable = req.body?.lookup === "unavailable";
    res.json({ lookup_unavailable: store.lookupUnavailable });
  });
  app.get("/admin/ledger", operator, (req, res) => {
    res.json(store.ledger({ run_id: typeof req.query.run_id === "string" ? req.query.run_id : undefined, arm: typeof req.query.arm === "string" ? req.query.arm : undefined }));
  });

  return { app, store };
}

/** Public feed (ngrok target): ONLY GET /status.html. */
export function createFeedApp(store: DeskStore) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/status.html", (_req, res) => { res.type("html").send(renderStatusPage(store.statusModel())); });
  app.use((_req, res) => { res.status(404).type("text").send("not found"); });
  return app;
}

const listen = (app: express.Express, port: number, host: string) =>
  new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, host, (err?: Error) => (err ? reject(err) : resolve(s)));
    s.on("error", reject);
  });

export type RunningDesk = { store: DeskStore; server: Server; feed?: Server; url: string; feedUrl?: string; close(): Promise<void> };

/** Start desk (+ optional feed) on 127.0.0.1. Port 0 = ephemeral (tests). */
export async function startDesk(o: DeskOptions & { port: number; feedPort?: number | null; host?: string }): Promise<RunningDesk> {
  const host = o.host ?? "127.0.0.1";
  const { app, store } = createDeskApp(o);
  const server = await listen(app, o.port, host);
  const feed = o.feedPort === null || o.feedPort === undefined ? undefined : await listen(createFeedApp(store), o.feedPort, host);
  const url = `http://${host}:${(server.address() as AddressInfo).port}`;
  const feedUrl = feed ? `http://${host}:${(feed.address() as AddressInfo).port}` : undefined;
  return {
    store, server, feed, url, feedUrl,
    async close() {
      for (const s of [server, feed]) if (s) { s.closeAllConnections(); await new Promise((r) => s.close(() => r(null))); }
      store.close();
    },
  };
}
