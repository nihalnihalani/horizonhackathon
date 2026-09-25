// Result-bundle writer (VALIDATION_AND_DEMO.md §9). Writes the sanitized evidence bundle under
// docs/results/<batch-id>/. No secrets: only manifest config keys and call metadata are recorded.
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { REPO_ROOT } from "@dr/shared";
import type { CallRecord, PromptManifestEntry, TraceResult } from "./types.ts";

export function newBatchId(prefix: string): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${d}-${randomBytes(3).toString("hex")}`;
}

export function resultsDir(batchId: string): string {
  const dir = resolve(REPO_ROOT, "docs/results", batchId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function jsonl(rows: unknown[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
}

export function armTable(traces: TraceResult[]): string {
  const header = "| arm | mode | rounds | max input tokens | mean input tokens | curator/summary calls | recall ok | pins preserved | CONTEXT_CAPACITY blocks |";
  const sep = "|---|---|---|---|---|---|---|---|---|";
  const rows = traces.map((t) => {
    const tokenCounts = t.manifests.filter((m) => !m.blocked).map((m) => m.token_count);
    const max = tokenCounts.length ? Math.max(...tokenCounts) : 0;
    const mean = tokenCounts.length ? Math.round(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length) : 0;
    const curatorCalls = t.calls.filter((c) => c.kind === "curator" || c.kind === "summary").length;
    const recalls = t.manifests.map((m) => m.recall).filter((r): r is NonNullable<typeof r> => !!r);
    const recallOk = recalls.length > 0 && recalls.every((r) => r.found) ? "yes" : recalls.length === 0 ? "n/a" : "no";
    return `| ${t.arm} | ${t.mode} | ${t.manifests.length} | ${max} | ${mean} | ${curatorCalls} | ${recallOk} | ${t.pinsPreservedEveryRound ? "yes" : "no"} | ${t.contextCapacityBlocks} |`;
  });
  return [header, sep, ...rows].join("\n");
}

export function writeBundle(opts: {
  batchId: string;
  manifest: unknown;
  traces: TraceResult[];
  summaryExtra: string;
  limitations: string[];
}): string {
  const dir = resultsDir(opts.batchId);
  writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(opts.manifest, null, 2) + "\n");
  const allManifests: PromptManifestEntry[] = opts.traces.flatMap((t) => t.manifests);
  writeFileSync(resolve(dir, "prompt-manifests.jsonl"), jsonl(allManifests));
  const allCalls: CallRecord[] = opts.traces.flatMap((t) => t.calls);
  writeFileSync(resolve(dir, "metrics.jsonl"), jsonl(allCalls));
  const summary = [
    `# Batch ${opts.batchId}`,
    "",
    "Evidence levels: deterministic unit test / local integration in stub mode; live smoke only for rows whose `mode` is `live` (see VALIDATION_AND_DEMO.md §1).",
    "",
    armTable(opts.traces),
    "",
    opts.summaryExtra,
  ].join("\n");
  writeFileSync(resolve(dir, "summary.md"), summary + "\n");
  writeFileSync(resolve(dir, "limitations.md"), opts.limitations.map((l) => `- ${l}`).join("\n") + "\n");
  return dir;
}
