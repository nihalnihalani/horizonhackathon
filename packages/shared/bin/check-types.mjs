#!/usr/bin/env node
// Type-check every package (scaffold-owned; do not edit).
import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
let failed = 0;
for (const p of readdirSync(resolve(root, "packages"))) {
  const cfg = resolve(root, "packages", p, "tsconfig.json");
  if (!existsSync(cfg)) continue;
  const r = spawnSync(resolve(root, "node_modules/.bin/tsc"), ["-p", cfg, "--noEmit"], { cwd: root, stdio: "inherit" });
  console.log(`check:types ${p} ${r.status === 0 ? "ok" : "FAIL"}`);
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
