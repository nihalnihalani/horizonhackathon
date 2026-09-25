#!/usr/bin/env node
// dev:core — starts the local core services (desk 4401/4402, control 4400) as owned child handles and stops only those
// on exit. Runner children stay owned by control (manual crash/resume behavior is unchanged).
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsx = resolve(root, "node_modules/.bin/tsx");
const procs = [
  ["desk", "packages/desk/src/server.ts"],
  ["control", "packages/control/src/server.ts"],
].map(([name, file]) => {
  const p = spawn(tsx, [file], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  for (const s of [p.stdout, p.stderr]) s.on("data", (d) => process.stdout.write(String(d).replace(/^(?=.)/gm, `[${name}] `)));
  p.on("exit", (code, signal) => { console.log(`[${name}] exited code=${code} signal=${signal}`); shutdown(); });
  console.log(`[dev:core] started ${name} pid=${p.pid}`);
  return p;
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (p.exitCode === null) p.kill("SIGTERM");
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
