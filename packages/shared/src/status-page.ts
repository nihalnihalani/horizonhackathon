// /status.html DOM contract + Nimble parser. FROZEN at scaffold.
// WP A (desk) renders with renderStatusPage(); WP C (providers) sends NIMBLE_STATUS_PARSER and
// maps with parseStatusFields(). They agree through this file only.
import { SITE_IDS, type SiteId } from "./fixture-f3.ts";

export type SiteStatus = { id: SiteId; status: "open" | "closed"; accessible: boolean; price_dollars: number; notice: string };
export type StatusPageModel = { park_name: string; world_version: number; updated_at: string; sites: SiteStatus[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderStatusPage(m: StatusPageModel): string {
  const rows = m.sites
    .map((s) => `  <tr id="site-${s.id}"><td class="site-id">${s.id}</td><td class="status">${s.status}</td><td class="accessible">${s.accessible ? "yes" : "no"}</td><td class="price">${s.price_dollars}</td><td class="notice">${esc(s.notice)}</td></tr>`)
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Angel Island SP — Campground Status</title></head>
<body>
<h1 id="park-name">${esc(m.park_name)}</h1>
<p>World version <span id="world-version">${m.world_version}</span> · updated <time id="updated-at">${esc(m.updated_at)}</time></p>
<table id="sites">
  <tr><th>Site</th><th>Status</th><th>Accessible</th><th>Price (USD)</th><th>Notice</th></tr>
${rows}
</table>
</body></html>
`;
}

const terminal = (css: string) => ({ type: "terminal", selector: { type: "css", css_selector: css }, extractor: { type: "text" } });

/** Fourteen terminal fields (2 + 3 sites x 4); no list parser. (Plan text said eleven; arithmetic is 14.) */
export const NIMBLE_STATUS_PARSER: Record<string, unknown> = {
  world_version: terminal("#world-version"),
  updated_at: terminal("#updated-at"),
  ...Object.fromEntries(
    SITE_IDS.flatMap((x) => [
      [`site${x}_status`, terminal(`#site-${x} .status`)],
      [`site${x}_accessible`, terminal(`#site-${x} .accessible`)],
      [`site${x}_price`, terminal(`#site-${x} .price`)],
      [`site${x}_notice`, terminal(`#site-${x} .notice`)],
    ]),
  ),
};
export const NIMBLE_STATUS_FIELD_NAMES = Object.keys(NIMBLE_STATUS_PARSER);

function statusOf(v: string, x: string): "open" | "closed" {
  const s = v.toLowerCase();
  if (s === "open" || s === "closed") return s;
  throw new Error(`status page field site${x}_status has unknown value`); // never guess open
}

/** Map Nimble `data.parsing` (string fields) into the model. Throws if a required field is missing. */
export function parseStatusFields(fields: Record<string, unknown>): Omit<StatusPageModel, "park_name"> {
  const get = (k: string): string => {
    const v = fields[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s === undefined || s === null || String(s).trim() === "") throw new Error(`status page field missing: ${k}`);
    return String(s).trim();
  };
  return {
    world_version: Number(get("world_version")),
    updated_at: get("updated_at"),
    sites: SITE_IDS.map((x) => ({
      id: x,
      status: statusOf(get(`site${x}_status`), x),
      accessible: get(`site${x}_accessible`).toLowerCase() === "yes",
      price_dollars: Number(get(`site${x}_price`)),
      notice: fields[`site${x}_notice`] == null ? "" : String(fields[`site${x}_notice`]).trim(),
    })),
  };
}
