// Live smoke: Nimble extract. Prints ids, statuses, timings (and the public status fields) only.
//   npm run smoke:nimble                                  → parks.ca.gov plain extract
//   npm run smoke:nimble -- https://<host>/status.html    → status-page extract (14 fields)
//   npm run smoke:nimble -- <url> --direct                → labelled direct fallback (not Nimble)
import { loadConfig } from "@dr/shared";
import { NimbleSensor, siteMap } from "../src/index.ts";

const args = process.argv.slice(2).filter((a) => a !== "--");
const direct = args.includes("--direct");
const url = args.find((a) => /^https?:/.test(a));
const cfg = loadConfig("providers");
const s = new NimbleSensor({ apiKey: cfg.NIMBLE_API_KEY });
const target = url ?? "https://www.parks.ca.gov/?page_id=468";
try {
  if (!url) {
    const r = await s.extractPage(target);
    console.log(JSON.stringify({ extract: { url: r.url, task_id: r.task_id, status: r.status, status_code: r.status_code, markdown_chars: r.markdown_chars, raw_hash: r.raw_hash.slice(0, 16), driver: (r.metadata as any)?.driver ?? null, nimble_ms: r.nimble_ms } }));
    process.exit(r.status === "success" ? 0 : 1);
  }
  const o = direct ? await s.extractStatusPageDirect(url) : await s.extractStatusPage(url);
  console.log(JSON.stringify({ extract: { url: o.url, task_id: o.task_id, status: o.status, status_code: o.status_code, retrieval_mode: o.retrieval_mode, parse_mode: o.parse_mode, render: o.render, attempts: o.attempts, world_version: o.world_version, raw_hash: o.raw_hash.slice(0, 16), nimble_ms: o.nimble_ms } }));
  console.log(JSON.stringify({ fields_count: Object.keys(o.fields).length, fields: o.fields }));
  console.log(JSON.stringify({ sites: siteMap(o.fields) }));
  if (o.retrieval_mode === "direct") console.log("FALLBACK: retrieval_mode=direct (plain fetch, not Nimble)");
} catch (e) {
  console.log(JSON.stringify({ error: (e as Error).name, code: (e as any).code ?? null, message: (e as Error).message }));
  process.exit(1);
}
