// No dotenv, provider keys, Node preloads, database setup, or external service startup.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
if (!existsSync(resolve(root, "node_modules/tsx"))) {
  console.error("Dependencies missing. Run npm install, then npm run demo:local.");
  process.exit(1);
}
const env = { DR_DEMO_MODE: "local" };
for (const key of ["PATH", "HOME", "TMPDIR", "TZ"]) if (process.env[key]) env[key] = process.env[key];
const child = spawn(process.execPath, ["--import", "./scripts/local-network-guard.mjs", "--import", "tsx", "packages/control/src/local-server.ts"], { cwd: root, env, stdio: "inherit" });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
