// Key-free rehearsal persistence. The surviving control actor is the only writer.
// SQLite is explicitly a local substitute; this adapter establishes no RawTree live claim.
import Database from "better-sqlite3";
import {
  AckError, EventConflictError, MissionEvent, canonicalJson, hashPayload, parseRow,
  type CanonicalEventSink, type Projection, type TableName,
} from "@dr/shared";
import { buildProjection, replay, totalRows } from "@dr/storage";
import type { ActorOptions } from "./actor.ts";

export class LocalStore implements CanonicalEventSink {
  readonly db: Database.Database;
  private watermarks = new Map<string, number>();

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        mission TEXT NOT NULL, revision INTEGER NOT NULL, event_id TEXT NOT NULL UNIQUE,
        body TEXT NOT NULL, PRIMARY KEY(mission, revision));
      CREATE TABLE IF NOT EXISTS rows (
        id INTEGER PRIMARY KEY, mission TEXT NOT NULL, table_name TEXT NOT NULL, body TEXT NOT NULL,
        UNIQUE(mission, table_name, body));
    `);
  }

  watermark(id: string): number { return this.watermarks.get(id) ?? 0; }
  pending(): null { return null; }
  async resolvePending(): Promise<"none"> { return "none"; }

  async append(input: MissionEvent): Promise<{ revision: number; visibleMs: number }> {
    const event = MissionEvent.parse(input);
    if (hashPayload(event.payload) !== event.payloadHash || event.previousRevision !== event.revision - 1) {
      throw new EventConflictError("invalid local event hash or predecessor");
    }
    // FULL synchronous commit precedes acknowledgement. A thrown error never advances the watermark.
    this.db.transaction(() => {
      const found = this.db.prepare("SELECT body FROM events WHERE mission=? AND revision=?")
        .get(event.missionId, event.revision) as { body: string } | undefined;
      if (found) {
        if (found.body !== canonicalJson(event)) throw new EventConflictError("local event revision conflict");
        if (event.revision > this.watermark(event.missionId)) throw new EventConflictError("control recovery required");
        return;
      }
      if (event.revision !== this.watermark(event.missionId) + 1) throw new EventConflictError("local event revision gap");
      this.db.prepare("INSERT INTO events(mission,revision,event_id,body) VALUES (?,?,?,?)")
        .run(event.missionId, event.revision, event.eventId, canonicalJson(event));
    })();
    this.watermarks.set(event.missionId, Math.max(this.watermark(event.missionId), event.revision));
    return { revision: event.revision, visibleMs: 0 };
  }

  async appendRow(table: TableName, row: Record<string, unknown>): Promise<{ inserted: 1 }> {
    const parsed = parseRow(table, row);
    this.db.prepare("INSERT OR IGNORE INTO rows(mission,table_name,body) VALUES (?,?,?)")
      .run(parsed.run_id, table, canonicalJson(parsed));
    return { inserted: 1 };
  }

  async load(id: string): Promise<Projection> {
    const entries = this.db.prepare("SELECT table_name,body FROM rows WHERE mission=? ORDER BY id").all(id) as { table_name: TableName; body: string }[];
    const byTable: Partial<Record<TableName, Record<string, unknown>[]>> = {};
    for (const row of entries) (byTable[row.table_name] ??= []).push(JSON.parse(row.body));
    const p = buildProjection(id, byTable);
    // A mission created before any mirror write still counts as an existing durable mission after parent loss.
    if (!totalRows(p) && this.db.prepare("SELECT 1 FROM events WHERE mission=? LIMIT 1").get(id)) p.rows_loaded.epochs = 1;
    return p;
  }

  async restore(id: string, watermark: number): Promise<Projection> {
    const entries = this.db.prepare("SELECT body FROM events WHERE mission=? AND revision<=? ORDER BY revision")
      .all(id, watermark) as { body: string }[];
    const events = entries.map(({ body }) => {
      const event = MissionEvent.parse(JSON.parse(body));
      if (hashPayload(event.payload) !== event.payloadHash) throw new EventConflictError("local event payload hash mismatch");
      return event;
    });
    return replay(id, [], events, watermark).projection;
  }

  readonly adapter: NonNullable<ActorOptions["storage"]> = {
    label: "local SQLite",
    sink: { append: (table, row) => this.appendRow(table, row) },
    loader: { load: (id) => this.load(id) },
    restore: (id, watermark) => this.restore(id, watermark),
    intentVisible: async (id, key) => {
      const p = await this.restore(id, this.watermark(id));
      if (p.commitments[key]?.status !== "intent") throw new AckError("local intent is not visible");
      return 0;
    },
  };

  close(): void { this.db.close(); }
}
