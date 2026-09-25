// Nimble sensor: status-page extract (POST /v2/extract).
// Invariants: a non-success extract NEVER becomes "closed" — it throws SourceUnverified.
// Parser shape (verified live 2026-09-25): /v2/extract's `parser` is ONE parser node, not a flat
// {field: terminal} map, and its root input is the JSON object {url, html} — not a DOM. A flat map
// (the documented shape, also what `nimble extract run --parser` sends) and a bare
// {type:"schema",fields} both return `data.parsing: {}`, because a CSS selector applied to that JSON
// root matches nothing. Working request: `parse: true, parser: {type:"schema", selector:{type:"json",
// path:"html"}, fields: NIMBLE_STATUS_PARSER}` — all 14 fields come back in data.parsing
// (parse_mode:"nimble"). If Nimble's parsing is ever incomplete we still apply the same selectors
// locally to the HTML *Nimble retrieved* (parse_mode:"local-css", retrieval_mode stays "live").
import { createHash } from "node:crypto";
import {
  NIMBLE_STATUS_PARSER, NIMBLE_STATUS_FIELD_NAMES, SITE_IDS, SourceUnverified, encodeValue, parseStatusFields,
  type BaseRow, type FactRow, type Observation, type Sensor, type SiteId, type StatusPageModel,
} from "@dr/shared";
import { applyParserLocally } from "./html-select.ts";
import { postJson, snippet, type FetchLike } from "./http.ts";

export const NIMBLE_BASE_URL = "https://sdk.nimbleway.com";
/** Sent on every status-page extract so an ngrok free tunnel serves the page, not its interstitial. */
export const STATUS_PAGE_HEADERS = { "ngrok-skip-browser-warning": "1" } as const;
/**
 * The request-side parser: NIMBLE_STATUS_PARSER's 14 terminals wrapped in a schema whose selector
 * first unwraps the `html` string from Nimble's {url, html} parse root. Without that json->html step
 * every CSS terminal comes back empty.
 */
export const NIMBLE_STATUS_PARSER_REQUEST = {
  type: "schema",
  selector: { type: "json", path: "html" },
  fields: NIMBLE_STATUS_PARSER,
} as const;
export const REQUIRED_STATUS_FIELDS = NIMBLE_STATUS_FIELD_NAMES.filter((f) => !f.endsWith("_notice"));

export type ParseMode = "nimble" | "local-css";
export type NimbleObservation = Observation & {
  metadata: unknown;
  parse_mode: ParseMode;
  render: false | "auto";
  world_version: number;
  attempts: number;
  model: Omit<StatusPageModel, "park_name">;
};

export type NimbleOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Labelled fallback (THREE_HOUR_CUT §8, 1:30): plain fetch when Nimble cannot reach the page. Off by default. */
  directFallback?: boolean;
  now?: () => Date;
};

export const hostOf = (urlOrHost: string): string => {
  try { return new URL(urlOrHost).hostname.replace(/^www\./, ""); } catch { return urlOrHost.replace(/^www\./, ""); }
};
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function normalizeParsing(p: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!p || typeof p !== "object") return out;
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === null || x === undefined) continue;
    out[k] = String(x).trim();
  }
  return out;
}
export const hasRequiredFields = (f: Record<string, string>) => REQUIRED_STATUS_FIELDS.every((k) => (f[k] ?? "") !== "");

/** Pure mapping used by the sensor and tests: Nimble `data.parsing`-style fields → typed model. */
export function mapStatusFields(fields: Record<string, string>): Omit<StatusPageModel, "park_name"> {
  try { return parseStatusFields(fields); } catch (e) { throw new SourceUnverified(`status page unparseable: ${(e as Error).message}`); }
}

export type SiteView = { status: "open" | "closed"; accessible: boolean; price_cents: number; notice: string };
/** {siteA:{status,accessible,…}, siteB:…, siteC:…} */
export function siteMap(fields: Record<string, string>): Record<`site${SiteId}`, SiteView> {
  const m = mapStatusFields(fields);
  return Object.fromEntries(
    m.sites.map((s) => [`site${s.id}`, { status: s.status, accessible: s.accessible, price_cents: Math.round(s.price_dollars * 100), notice: s.notice }]),
  ) as Record<`site${SiteId}`, SiteView>;
}

export type FactDraft = Omit<FactRow, keyof BaseRow>;
/** Facts for the run's volatile keys: `site-X.status` (volatile) and `site-X.accessible`. Value JSON-encoded. */
export function factsFromObservation(obs: Observation): FactDraft[] {
  const m = mapStatusFields(obs.fields);
  const base = {
    source_url: obs.url, observed_at: obs.fetched_at, valid_until: null, trust: "extract" as const, status: "active" as const,
    superseded_by: null, nimble_request_id: obs.task_id, world_version: m.world_version,
  };
  return m.sites.flatMap((s) => [
    { ...base, key: `site-${s.id}.status`, value: encodeValue(s.status), volatile: true, excerpt: `site-${s.id} ${s.status}${s.notice ? ` (${s.notice})` : ""}` },
    { ...base, key: `site-${s.id}.accessible`, value: encodeValue(s.accessible), volatile: false, excerpt: `site-${s.id} accessible=${s.accessible ? "yes" : "no"}` },
  ]);
}

export type SourceClass = { kind: "unreachable" | "changed" | "unchanged" | "first"; changed_fields: string[]; reason: string };
/** Classify a revalidation: a failed fetch is "unreachable" (never "closed"); otherwise diff the fields. */
export function classifySource(prev: Pick<Observation, "fields"> | null | undefined, result: { obs?: Pick<Observation, "fields">; error?: unknown }): SourceClass {
  if (!result.obs) {
    const why = result.error instanceof Error ? result.error.message : String(result.error ?? "no observation");
    return { kind: "unreachable", changed_fields: [], reason: why };
  }
  if (!prev) return { kind: "first", changed_fields: [], reason: "no prior observation" };
  const keys = NIMBLE_STATUS_FIELD_NAMES.filter((k) => k !== "updated_at" && k !== "world_version");
  const changed = keys.filter((k) => (prev.fields[k] ?? "") !== (result.obs!.fields[k] ?? ""));
  return changed.length
    ? { kind: "changed", changed_fields: changed, reason: `changed: ${changed.join(", ")}` }
    : { kind: "unchanged", changed_fields: [], reason: "fields identical" };
}

const withVersionParam = (url: string, v: number) => {
  const u = new URL(url);
  u.searchParams.set("v", String(v));
  return u.toString();
};

export class NimbleSensor implements Sensor {
  private base: string;
  private f: FetchLike;
  private now: () => Date;
  constructor(private opts: NimbleOptions) {
    if (!opts.apiKey) throw new Error("NimbleSensor: apiKey required");
    this.base = (opts.baseUrl ?? NIMBLE_BASE_URL).replace(/\/$/, "");
    this.f = opts.fetchImpl ?? ((u, i) => fetch(u, i));
    this.now = opts.now ?? (() => new Date());
  }
  private get auth() { return { Authorization: `Bearer ${this.opts.apiKey}` }; }

  private async attempt(url: string, render: false | "auto") {
    const t0 = Date.now();
    let r;
    try {
      r = await postJson(this.f, "nimble-extract", `${this.base}/v2/extract`, {
        url, render, formats: ["html", "markdown"], parse: true, parser: NIMBLE_STATUS_PARSER_REQUEST, headers: STATUS_PAGE_HEADERS,
      }, { headers: this.auth, timeoutMs: this.opts.timeoutMs ?? 60_000 });
    } catch (e) {
      throw new SourceUnverified(`nimble extract transport error: ${(e as Error).name}`);
    }
    const ms = Date.now() - t0;
    const j = r.json;
    if (r.status !== 200 || !j || j.status !== "success") {
      throw new SourceUnverified(`nimble extract not successful (http ${r.status}, status ${j?.status ?? "?"}): ${snippet(r.text, 120)}`);
    }
    if (typeof j.status_code === "number" && j.status_code >= 400) {
      throw new SourceUnverified(`target returned ${j.status_code} via nimble task ${j.task_id}`);
    }
    let fields = normalizeParsing(j.data?.parsing);
    let parse_mode: ParseMode = "nimble";
    if (!hasRequiredFields(fields) && typeof j.data?.html === "string" && j.data.html) {
      fields = applyParserLocally(j.data.html, NIMBLE_STATUS_PARSER);
      parse_mode = "local-css";
    }
    const body: string = j.data?.html ?? j.data?.markdown ?? "";
    return { j, fields, parse_mode, ms, raw_hash: sha256(body) };
  }

  private async extractOnce(url: string): Promise<NimbleObservation> {
    let a = await this.attempt(url, false);
    let render: false | "auto" = false;
    let attempts = 1;
    let ms = a.ms;
    if (!hasRequiredFields(a.fields)) {
      a = await this.attempt(url, "auto");
      render = "auto";
      attempts++;
      ms += a.ms;
    }
    if (!hasRequiredFields(a.fields)) {
      const missing = REQUIRED_STATUS_FIELDS.filter((k) => !(a.fields[k] ?? ""));
      throw new SourceUnverified(`status page fields missing after render:auto retry (task ${a.j.task_id}): ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`);
    }
    const model = mapStatusFields(a.fields);
    const fields = Object.fromEntries(NIMBLE_STATUS_FIELD_NAMES.map((k) => [k, a.fields[k] ?? ""]));
    return {
      url, fields, task_id: String(a.j.task_id), status: String(a.j.status), status_code: Number(a.j.status_code ?? 0),
      fetched_at: this.now().toISOString(), retrieval_mode: "live", raw_hash: a.raw_hash, nimble_ms: ms,
      metadata: a.j.metadata ?? null, parse_mode: a.parse_mode, render, world_version: model.world_version, attempts, model,
    };
  }

  /**
   * Extract the frozen /status.html contract. If `expectedWorldVersion` is given and the page reports a
   * different version, retry once with `?v=<version>` (cache bust); a second mismatch is SourceUnverified.
   */
  async extractStatusPage(url: string, opts: { expectedWorldVersion?: number } = {}): Promise<NimbleObservation> {
    let obs: NimbleObservation;
    try {
      obs = await this.extractOnce(url);
      if (opts.expectedWorldVersion !== undefined && obs.world_version !== opts.expectedWorldVersion) {
        const first = obs;
        obs = await this.extractOnce(withVersionParam(url, opts.expectedWorldVersion));
        obs.nimble_ms += first.nimble_ms;
        obs.attempts += first.attempts;
        if (obs.world_version !== opts.expectedWorldVersion) {
          throw new SourceUnverified(`world_version mismatch: page ${obs.world_version} vs desk ${opts.expectedWorldVersion} (task ${obs.task_id})`);
        }
      }
      return obs;
    } catch (e) {
      if (this.opts.directFallback && e instanceof SourceUnverified && !/world_version mismatch/.test(e.message)) {
        return this.extractStatusPageDirect(url, opts);
      }
      throw e;
    }
  }

  /** FALLBACK (labelled retrieval_mode:"direct"): plain HTTP fetch + local CSS parse. Not a Nimble retrieval. */
  async extractStatusPageDirect(url: string, opts: { expectedWorldVersion?: number } = {}): Promise<NimbleObservation> {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await this.f(url, { headers: { ...STATUS_PAGE_HEADERS, "User-Agent": "Mozilla/5.0 dead-reckoning" }, signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      throw new SourceUnverified(`direct fetch transport error: ${(e as Error).name}`);
    }
    const html = await res.text();
    if (!res.ok) throw new SourceUnverified(`direct fetch http ${res.status}`);
    const parsed = applyParserLocally(html, NIMBLE_STATUS_PARSER);
    if (!hasRequiredFields(parsed)) throw new SourceUnverified("direct fetch: status page fields missing");
    const model = mapStatusFields(parsed);
    if (opts.expectedWorldVersion !== undefined && model.world_version !== opts.expectedWorldVersion) {
      throw new SourceUnverified(`world_version mismatch (direct): page ${model.world_version} vs desk ${opts.expectedWorldVersion}`);
    }
    const raw_hash = sha256(html);
    const fields = Object.fromEntries(NIMBLE_STATUS_FIELD_NAMES.map((k) => [k, parsed[k] ?? ""]));
    return {
      url, fields, task_id: `direct-${raw_hash.slice(0, 12)}`, status: "success", status_code: res.status, fetched_at: this.now().toISOString(),
      retrieval_mode: "direct", raw_hash, nimble_ms: Date.now() - t0, metadata: { fallback: "direct" }, parse_mode: "local-css", render: false,
      world_version: model.world_version, attempts: 1, model,
    };
  }

  /** Plain extract of a public page (no parser) — live proof on the real source (e.g. parks.ca.gov). */
  async extractPage(url: string): Promise<{ url: string; task_id: string; status: string; status_code: number; markdown_chars: number; raw_hash: string; metadata: unknown; nimble_ms: number }> {
    const t0 = Date.now();
    const r = await postJson(this.f, "nimble-extract", `${this.base}/v2/extract`, { url, render: false, formats: ["markdown"] }, { headers: this.auth, timeoutMs: this.opts.timeoutMs ?? 60_000 });
    const j = r.json;
    if (r.status !== 200 || !j || j.status !== "success") throw new SourceUnverified(`nimble extract not successful (http ${r.status}, status ${j?.status ?? "?"})`);
    const md: string = j.data?.markdown ?? "";
    return { url, task_id: String(j.task_id), status: String(j.status), status_code: Number(j.status_code ?? 0), markdown_chars: md.length, raw_hash: sha256(md), metadata: j.metadata ?? null, nimble_ms: Date.now() - t0 };
  }
}

export { SITE_IDS };
