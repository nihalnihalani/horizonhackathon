// npm run demo:numbers [-- <dr_run_id> <naive_run_id>] — live RawTree closing numbers (defaults to artifacts/last-demo.json).
import { rawTreeFromEnv } from "@dr/storage";
import { closingSql, loadLast } from "./lib.ts";

const last = loadLast();
const [dr = last.dr_run, naive = last.naive_run] = process.argv.slice(2);
if (!dr || !naive) { console.error("usage: demo:numbers -- <dr_run_id> <naive_run_id> (or run demo:f3 first)"); process.exit(2); }
const { client } = rawTreeFromEnv();
const titles = ["per-arm totals", "Liquid curator latency (DR)", "planner context tokens per step", "as-of: site-A.status history (DR)", "DR receipts"];
const qs = closingSql(dr, naive);
for (let i = 0; i < qs.length; i++) {
  const rows = await client.query(qs[i]!);
  console.log(`\n## ${titles[i] ?? `query ${i + 1}`}  (live RawTree query)`);
  console.table(rows);
}
