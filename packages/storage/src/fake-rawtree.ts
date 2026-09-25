// In-process fake of the RawTree HTTP API for tests: controllable ack and visibility.
// Mimics observed live behavior: ts normalized to "YYYY-MM-DD HH:MM:SS.nnnnnnnnn" (UTC); a table
// that never received a row answers 400 EMPTY_LIST_OF_COLUMNS_QUERIED; absent columns read as null.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type AckMode = "ok" | "http500" | "wrong-count" | "garbage" | "hang";

function normTs(ts: unknown): unknown {
  if (typeof ts !== "string") return ts;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace("T", " ").replace("Z", "") + "000000";
}

export class FakeRawTree {
  private server: Server;
  private tables = new Map<string, { row: Record<string, unknown>; visibleAt: number }[]>();
  url = "";
  readonly apiKey = "fake-rawtree-key";
  ackMode: AckMode = "ok";
  /** per-table one-shot ack override, consumed by the next insert into that table */
  private nextAck = new Map<string, AckMode>();
  /** new rows become visible to queries only after this delay */
  visibilityDelayMs = 0;
  insertAttempts: { table: string; rows: number; mode: AckMode }[] = [];
  queries: string[] = [];

  constructor() {
    this.server = createServer((req, res) => void this.handle(req, res));
  }

  async start(): Promise<this> {
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections?.();
    await new Promise<void>((r) => this.server.close(() => r()));
  }

  failNext(table: string, mode: AckMode): void { this.nextAck.set(table, mode); }

  rows(table: string, runId?: string): Record<string, unknown>[] {
    return (this.tables.get(table) ?? []).map((x) => x.row).filter((r) => !runId || r.run_id === runId);
  }

  /** Seed rows directly (already "acked"). */
  seed(table: string, rows: Record<string, unknown>[]): void {
    const list = this.tables.get(table) ?? [];
    for (const r of rows) list.push({ row: { ...r, ts: normTs(r.ts) }, visibleAt: 0 });
    this.tables.set(table, list);
  }

  private async body(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8");
  }

  private send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const u = new URL(req.url ?? "/", "http://x");
    if (req.headers.authorization !== `Bearer ${this.apiKey}`) return this.send(res, 401, { error: "unauthorized" });
    const text = await this.body(req);
    const m = u.pathname.match(/^\/v1\/tables\/([a-z_]+)$/);
    if (req.method === "POST" && m) {
      const table = m[1]!;
      const mode = this.nextAck.get(table) ?? this.ackMode;
      this.nextAck.delete(table);
      const rows = JSON.parse(text) as Record<string, unknown>[];
      this.insertAttempts.push({ table, rows: rows.length, mode });
      if (mode === "hang") return; // never answer; client times out
      if (mode === "http500") return this.send(res, 500, { error: "boom" });
      if (mode === "garbage") return this.send(res, 200, "<html>ok</html>");
      // wrong-count and ok both persist (a partial/ambiguous ack still may have written)
      this.seedAt(table, rows);
      if (mode === "wrong-count") return this.send(res, 200, { inserted: 0 });
      return this.send(res, 200, { inserted: rows.length });
    }
    if (req.method === "POST" && u.pathname === "/v1/query") {
      const { sql } = JSON.parse(text) as { sql: string };
      this.queries.push(sql);
      const q = sql.match(/^SELECT \* FROM ([a-z_]+) WHERE run_id = '([a-z0-9-]+)' ORDER BY rev, ts LIMIT (\d+)(?: OFFSET (\d+))?$/);
      if (!q) return this.send(res, 400, { error: "fake: unsupported sql" });
      const [, table, runId, lim, off] = q;
      const list = this.tables.get(table!);
      if (!list || list.length === 0) return this.send(res, 400, { error: "rawtree_error", message: "Code: 51. (EMPTY_LIST_OF_COLUMNS_QUERIED)" });
      const cols = new Set<string>();
      for (const x of list) for (const k of Object.keys(x.row)) cols.add(k);
      const now = Date.now();
      const data = list
        .filter((x) => x.visibleAt <= now && x.row.run_id === runId)
        .map((x) => Object.fromEntries([...cols].sort().map((c) => [c, x.row[c] ?? null])))
        .sort((a, b) => Number(a.rev) - Number(b.rev) || String(a.ts).localeCompare(String(b.ts)))
        .slice(Number(off ?? 0), Number(off ?? 0) + Number(lim));
      return this.send(res, 200, { meta: [...cols].map((name) => ({ name, type: "Dynamic" })), data, rows: data.length });
    }
    this.send(res, 404, { error: "not found" });
  }

  private seedAt(table: string, rows: Record<string, unknown>[]) {
    const list = this.tables.get(table) ?? [];
    const visibleAt = Date.now() + this.visibilityDelayMs;
    for (const r of rows) list.push({ row: { ...r, ts: normTs(r.ts) }, visibleAt });
    this.tables.set(table, list);
  }
}
