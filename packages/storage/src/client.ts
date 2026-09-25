// Plain-fetch RawTree HTTP client. Never logs the API key.
import { AckError, DrError } from "@dr/shared";
import { assertInsertable } from "./sql.ts";

export type RawTreeClientOptions = {
  baseUrl: string; // e.g. https://api.rawtree.com
  apiKey: string;
  database: string;
  timeoutMs?: number; // default 8000
  fetchImpl?: typeof fetch;
};

export class RawTreeQueryError extends DrError {
  constructor(public status: number, public body: string) {
    super("RAWTREE_QUERY", `RawTree query failed (${status})`, status >= 500);
  }
}

export class RawTreeClient {
  readonly timeoutMs: number;
  private f: typeof fetch;
  constructor(private o: RawTreeClientOptions) {
    this.timeoutMs = o.timeoutMs ?? 8000;
    this.f = o.fetchImpl ?? fetch;
  }

  private url(path: string): string {
    return `${this.o.baseUrl.replace(/\/+$/, "")}${path}?database=${encodeURIComponent(this.o.database)}`;
  }

  private headers() {
    return { authorization: `Bearer ${this.o.apiKey}`, "content-type": "application/json" };
  }

  /**
   * Insert rows; resolves only when the response is exactly {"inserted": rows.length}.
   * Anything else (timeout, non-2xx, malformed body, wrong count) throws AckError. No retry.
   */
  async insert(table: string, rows: Record<string, unknown>[]): Promise<{ inserted: number }> {
    const t = assertInsertable(table);
    let res: Response;
    try {
      res = await this.f(this.url(`/v1/tables/${t}`), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(rows),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new AckError(`RawTree insert ${t}: no response (${(e as Error).name})`);
    }
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new AckError(`RawTree insert ${t}: HTTP ${res.status}`);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new AckError(`RawTree insert ${t}: unparseable ack`); }
    const n = (body as { inserted?: unknown })?.inserted;
    if (n !== rows.length) throw new AckError(`RawTree insert ${t}: ack ${JSON.stringify(body)} != ${rows.length}`);
    return { inserted: n };
  }

  /** Read-only SQL (built only by sql.ts templates). Returns data rows. */
  async query(sql: string): Promise<Record<string, unknown>[]> {
    let res: Response;
    try {
      res = await this.f(this.url("/v1/query"), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ sql, format: "JSON" }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new RawTreeQueryError(0, `no response (${(e as Error).name})`);
    }
    const text = await res.text();
    if (!res.ok) {
      // A table that never received a row has no columns: RawTree answers 400 EMPTY_LIST_OF_COLUMNS_QUERIED.
      if (res.status === 400 && text.includes("EMPTY_LIST_OF_COLUMNS_QUERIED")) return [];
      throw new RawTreeQueryError(res.status, text.slice(0, 300));
    }
    const j = JSON.parse(text) as { data?: Record<string, unknown>[] };
    return j.data ?? [];
  }
}
