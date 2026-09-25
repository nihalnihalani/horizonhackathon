// Desk SQLite ledger — the authority on effects. Idempotent on action_key; attempts recorded separately.
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { F3, type DeskReceipt, type Slot, type SiteId, SITE_IDS, type StatusPageModel } from "@dr/shared";
import { bookArgsHash, type BookArgs } from "./args.ts";

export type BookInput = BookArgs & { action_key: string; args_hash: string };
export type BookResult =
  | { status: 200; receipt: DeskReceipt }
  | { status: 400; error: "args_hash_mismatch" | "invalid_request" }
  | { status: 409; error: "action_key_args_conflict"; original: DeskReceipt };

type ResourceRow = { id: string; slot: string; price_cents: number; date: string; accessible: number; status: string; notice: string; changed_at_version: number };
type OutcomeRow = {
  action_key: string; run_id: string; arm: string; args_hash: string; args_json: string; receipt_id: string; slot: string; resource: string;
  outcome: string; reject_reason: string | null; amount: number; service_ts: string; committed: number; cancelled: number;
};

export const PARK_NAME = "Angel Island SP — Campground Status";

export class DeskStore {
  readonly db: Database.Database;
  /** fault injection for tests/demo: lookups answer 503 */
  lookupUnavailable = false;

  constructor(path = ":memory:") {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_versions (version INTEGER PRIMARY KEY, ts TEXT NOT NULL, note TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, slot TEXT NOT NULL, price_cents INTEGER NOT NULL, date TEXT NOT NULL,
        accessible INTEGER NOT NULL, status TEXT NOT NULL, notice TEXT NOT NULL DEFAULT '', changed_at_version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS action_outcomes (action_key TEXT PRIMARY KEY, run_id TEXT NOT NULL, arm TEXT NOT NULL, args_hash TEXT NOT NULL,
        args_json TEXT NOT NULL, receipt_id TEXT NOT NULL UNIQUE, slot TEXT NOT NULL, resource TEXT NOT NULL, outcome TEXT NOT NULL,
        reject_reason TEXT, amount INTEGER NOT NULL, service_ts TEXT NOT NULL, committed INTEGER NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS book_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, action_key TEXT NOT NULL, run_id TEXT NOT NULL,
        arm TEXT NOT NULL, args_hash_supplied TEXT NOT NULL, args_hash_computed TEXT NOT NULL, result TEXT);
      CREATE INDEX IF NOT EXISTS ix_outcomes_run ON action_outcomes(run_id, arm);
      CREATE INDEX IF NOT EXISTS ix_requests_run ON book_requests(run_id, arm);
    `);
    const n = (this.db.prepare("SELECT count(*) AS n FROM resources").get() as { n: number }).n;
    if (n === 0) this.seed();
  }

  /** Seed fixture F3 world version 1. */
  seed(): void {
    const tx = this.db.transaction(() => {
      this.db.exec("DELETE FROM resources; DELETE FROM world_versions;");
      this.db.prepare("INSERT INTO world_versions (version, ts, note) VALUES (1, ?, 'seed F3')").run(new Date().toISOString());
      const ins = this.db.prepare("INSERT INTO resources (id, slot, price_cents, date, accessible, status, notice, changed_at_version) VALUES (?,?,?,?,?,?,?,1)");
      for (const r of F3.resources) ins.run(r.id, r.slot, r.price_cents, r.date, r.accessible ? 1 : 0, r.status, r.notice ?? "");
    });
    tx();
  }

  /** POST /admin/reset: wipe ledger + world (tests / fresh demo). */
  reset(): void {
    this.db.exec("DELETE FROM action_outcomes; DELETE FROM book_requests;");
    this.seed();
  }

  worldVersion(): { version: number; ts: string } {
    return this.db.prepare("SELECT version, ts FROM world_versions ORDER BY version DESC LIMIT 1").get() as { version: number; ts: string };
  }

  resource(id: string): ResourceRow | undefined {
    return this.db.prepare("SELECT * FROM resources WHERE id = ?").get(id) as ResourceRow | undefined;
  }

  /** Operator world edit: set a site's status/notice and bump the world version. */
  editWorld(site: string, status: "open" | "closed", notice = ""): { world_version: number } {
    const id = site.startsWith("site-") ? site : `site-${site}`;
    const tx = this.db.transaction(() => {
      if (!this.resource(id)) throw new Error(`unknown site ${site}`);
      const v = this.worldVersion().version + 1;
      this.db.prepare("INSERT INTO world_versions (version, ts, note) VALUES (?, ?, ?)").run(v, new Date().toISOString(), `${id} -> ${status}`);
      this.db.prepare("UPDATE resources SET status = ?, notice = ?, changed_at_version = ? WHERE id = ?").run(status, notice, v, id);
      return { world_version: v };
    });
    return tx();
  }

  statusModel(): StatusPageModel {
    const w = this.worldVersion();
    return {
      park_name: PARK_NAME,
      world_version: w.version,
      updated_at: w.ts,
      sites: SITE_IDS.map((x: SiteId) => {
        const r = this.resource(`site-${x}`)!;
        return { id: x, status: r.status as "open" | "closed", accessible: !!r.accessible, price_dollars: r.price_cents / 100, notice: r.notice };
      }),
    };
  }

  private toReceipt(o: OutcomeRow, dedupeHit?: boolean): DeskReceipt {
    return {
      action_key: o.action_key, receipt_id: o.receipt_id, slot: o.slot as Slot, resource: o.resource,
      outcome: o.outcome as "committed" | "rejected", reject_reason: o.reject_reason, amount: o.amount,
      service_ts: o.service_ts, committed: !!o.committed, ...(dedupeHit ? { dedupeHit: true } : {}),
    };
  }

  /**
   * Idempotent booking, one SQLite transaction:
   *  record attempt → recompute hash (mismatch 400, attempt kept) → existing key: identical args → original
   *  outcome with dedupeHit BEFORE any world check; different args → 409 → new key: check resource
   *  status/version; a rejection is recorded (committed:false), not thrown.
   */
  book(b: BookInput): BookResult {
    const computed = bookArgsHash(b);
    const tx = this.db.transaction((): BookResult => {
      const reqId = Number(this.db.prepare(
        "INSERT INTO book_requests (ts, action_key, run_id, arm, args_hash_supplied, args_hash_computed) VALUES (?,?,?,?,?,?)",
      ).run(new Date().toISOString(), b.action_key, b.run_id, b.arm, b.args_hash, computed).lastInsertRowid);
      const mark = (result: string) => this.db.prepare("UPDATE book_requests SET result = ? WHERE id = ?").run(result, reqId);
      if (b.args_hash !== computed) { mark("args_hash_mismatch"); return { status: 400, error: "args_hash_mismatch" }; }

      const existing = this.db.prepare("SELECT * FROM action_outcomes WHERE action_key = ?").get(b.action_key) as OutcomeRow | undefined;
      if (existing) {
        if (existing.args_hash === computed && existing.run_id === b.run_id && existing.arm === b.arm) {
          mark("dedupe_hit");
          return { status: 200, receipt: this.toReceipt(existing, true) };
        }
        mark("conflict_409");
        return { status: 409, error: "action_key_args_conflict", original: this.toReceipt(existing) };
      }

      const r = this.resource(b.resource);
      let reject: string | null = null;
      if (!r) reject = "unknown_resource";
      else if (r.slot !== b.slot) reject = "slot_mismatch";
      else if (r.date !== b.date) reject = "date_mismatch";
      else if (r.status !== "open") reject = "closed";
      else if (r.changed_at_version > b.expected_world_version) reject = "stale_version";
      const outcome: OutcomeRow = {
        action_key: b.action_key, run_id: b.run_id, arm: b.arm, args_hash: computed,
        args_json: JSON.stringify({ slot: b.slot, resource: b.resource, date: b.date, party: b.party, expected_world_version: b.expected_world_version }),
        receipt_id: `rcpt-${randomBytes(6).toString("hex")}`, slot: b.slot, resource: b.resource,
        outcome: reject ? "rejected" : "committed", reject_reason: reject,
        amount: reject || !r ? 0 : r.price_cents, // desk derives price from trusted resources
        service_ts: new Date().toISOString(), committed: reject ? 0 : 1, cancelled: 0,
      };
      this.db.prepare(`INSERT INTO action_outcomes (action_key, run_id, arm, args_hash, args_json, receipt_id, slot, resource, outcome,
        reject_reason, amount, service_ts, committed, cancelled) VALUES (@action_key, @run_id, @arm, @args_hash, @args_json, @receipt_id,
        @slot, @resource, @outcome, @reject_reason, @amount, @service_ts, @committed, @cancelled)`).run(outcome);
      mark(outcome.outcome);
      return { status: 200, receipt: this.toReceipt(outcome) };
    });
    return tx();
  }

  /** Authoritative lookup. Throws when the desk cannot answer (route maps to 503). */
  lookup(actionKey: string, ns?: { run_id?: string; arm?: string }): DeskReceipt | null {
    if (this.lookupUnavailable) throw new Error("desk lookup unavailable (fault injected)");
    const o = this.db.prepare("SELECT * FROM action_outcomes WHERE action_key = ?").get(actionKey) as OutcomeRow | undefined;
    if (!o) return null;
    if (ns?.run_id && ns.run_id !== o.run_id) return null; // no cross-run lookup
    if (ns?.arm && ns.arm !== o.arm) return null;
    return this.toReceipt(o);
  }

  /** Cancel a committed outcome (recorded, never deleted). */
  cancel(actionKey: string): { status: 200; receipt: DeskReceipt } | { status: 404 } {
    const o = this.db.prepare("SELECT * FROM action_outcomes WHERE action_key = ?").get(actionKey) as OutcomeRow | undefined;
    if (!o) return { status: 404 };
    this.db.prepare("UPDATE action_outcomes SET cancelled = 1 WHERE action_key = ?").run(actionKey);
    return { status: 200, receipt: { ...this.toReceipt(o), committed: false, reject_reason: "cancelled" } };
  }

  ledger(ns: { run_id?: string; arm?: string } = {}) {
    const where: string[] = []; const args: string[] = [];
    if (ns.run_id) { where.push("run_id = ?"); args.push(ns.run_id); }
    if (ns.arm) { where.push("arm = ?"); args.push(ns.arm); }
    const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const outcomes = (this.db.prepare(`SELECT * FROM action_outcomes ${w} ORDER BY service_ts`).all(...args) as OutcomeRow[])
      .map((o) => ({ ...this.toReceipt(o), run_id: o.run_id, arm: o.arm, cancelled: !!o.cancelled }));
    const requests = this.db.prepare(`SELECT id, ts, action_key, run_id, arm, result FROM book_requests ${w} ORDER BY id`).all(...args);
    const committedBySlot: Record<string, number> = {};
    for (const o of outcomes) if (o.committed && !o.cancelled) committedBySlot[o.slot] = (committedBySlot[o.slot] ?? 0) + 1;
    return { world_version: this.worldVersion().version, outcomes, requests, committed_by_slot: committedBySlot };
  }

  close(): void { this.db.close(); }
}
