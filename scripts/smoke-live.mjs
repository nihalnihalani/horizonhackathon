#!/usr/bin/env node
// test:smoke:live — runs every credential-requiring provider probe. A missing prerequisite is reported as NOT RUN and
// makes the suite fail; it is never silently skipped into a green result.
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smokes = [
  ["rawtree", "packages/storage/scripts/smoke-rawtree.ts"],
  ["rawtree-events", "packages/storage/scripts/smoke-events.ts"],
  ["nimble", "packages/providers/scripts/smoke-nimble.ts"],
  ["planner", "packages/providers/scripts/smoke-planner.ts"],
  ["liquid", "packages/providers/scripts/smoke-liquid.ts"],
];
const results = [];
for (const [name, file] of smokes) {
  const t0 = Date.now();
  const r = spawnSync(resolve(root, "node_modules/.bin/tsx"), [file], { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 120_000 });
  const out = `${r.stdout}${r.stderr}`;
  const missing = /ECONNREFUSED|Config error|NOT IMPLEMENTED|Cannot find module/.test(out);
  results.push({ name, status: r.status === 0 ? "PASS" : missing ? "NOT RUN (missing prerequisite)" : "FAIL", ms: Date.now() - t0, tail: out.trim().split("\n").slice(-3).join(" | ") });
}
for (const r of results) console.log(`${r.status.padEnd(32)} ${r.name.padEnd(15)} ${String(r.ms).padStart(6)} ms  ${r.status === "PASS" ? "" : r.tail}`);
process.exit(results.every((r) => r.status === "PASS") ? 0 : 1);
