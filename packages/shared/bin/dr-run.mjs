#!/usr/bin/env node
// Root-script dispatcher (scaffold-owned; do not edit).
// Usage: node packages/shared/bin/dr-run.mjs <owning-package> <final/path.ts> [--vitest] [-- args]
// If the final file exists, run it (tsx, or vitest with --vitest); otherwise run
// packages/<owner>/scripts/not-implemented.ts, which exits 2 "NOT IMPLEMENTED".
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const [owner, target, ...rest] = process.argv.slice(2);
const useVitest = rest[0] === "--vitest";
const args = useVitest ? rest.slice(1) : rest;
const bin = (n) => resolve(root, "node_modules/.bin", n);
let cmd, argv;
if (existsSync(resolve(root, target))) {
  if (useVitest) { cmd = bin("vitest"); argv = ["run", target, ...args]; }
  else { cmd = bin("tsx"); argv = [target, ...args]; }
} else {
  cmd = bin("tsx");
  argv = [`packages/${owner}/scripts/not-implemented.ts`, target];
}
const r = spawnSync(cmd, argv, { cwd: root, stdio: "inherit" });
if (r.signal) process.kill(process.pid, r.signal);
process.exit(r.status ?? 1);
