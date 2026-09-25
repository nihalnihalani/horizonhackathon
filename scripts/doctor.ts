// demo:doctor — readiness checks only. Prints presence/status, never credential contents. Exit 1 if a required item fails.
import { config as loadDotenv } from "dotenv";
import { execSync } from "node:child_process";
import { REPO_ROOT } from "@dr/shared";

loadDotenv({ path: `${REPO_ROOT}/.env`, quiet: true });
type Row = { item: string; ok: boolean; required: boolean; detail: string };
const rows: Row[] = [];
const add = (item: string, ok: boolean, required: boolean, detail: string) => rows.push({ item, ok, required, detail });

const REQUIRED_ENV = ["RAWTREE_API_KEY", "RAWTREE_DATABASE", "NIMBLE_API_KEY", "OPENAI_API_KEY", "DR_PLANNER_MODEL", "DR_LIQUID_BASE_URL", "DR_LIQUID_MODEL", "DR_WORLD_TOKEN", "DR_OPERATOR_TOKEN", "DR_INTERNAL_TOKEN"];
for (const k of REQUIRED_ENV) add(`env ${k}`, !!process.env[k], true, process.env[k] ? "set" : "missing");
add("env DR_ENABLE_DEMO_CONTROLS", process.env.DR_ENABLE_DEMO_CONTROLS === "true", false, process.env.DR_ENABLE_DEMO_CONTROLS === "true" ? "true" : "not true (demo buttons disabled)");

async function probe(url: string, init?: RequestInit, ms = 2500): Promise<number | string> {
  try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) }); return r.status; } catch (e) { return (e as Error).cause ? String((e as { cause: { code?: string } }).cause.code ?? "error") : "error"; }
}

function listeners(port: number): string {
  try { return execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, { encoding: "utf8" }).split("\n").slice(1).filter(Boolean).map((l) => l.split(/\s+/)[8]).join(" "); } catch { return ""; }
}

const liquid = (process.env.DR_LIQUID_BASE_URL ?? "http://127.0.0.1:8080/v1").replace(/\/$/, "");
const checks: [string, string, boolean][] = [
  ["desk 4401 /status.html", "http://127.0.0.1:4401/status.html", true],
  ["public feed 4402 /status.html", "http://127.0.0.1:4402/status.html", true],
  ["control 4400 /health", "http://127.0.0.1:4400/health", true],
  ["Liquid llama-server /models", `${liquid}/models`, true],
  ["OpenBot API 3001 /health", "http://127.0.0.1:3001/health", false],
  ["OpenBot app 3010", "http://127.0.0.1:3010/", false],
];
for (const [item, url, req] of checks) { const s = await probe(url); add(item, s === 200, req, String(s)); }

const tunnels = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(1500) }).then((r) => r.json() as Promise<{ tunnels: { public_url: string; config: { addr: string } }[] }>).catch(() => null);
const feed = tunnels?.tunnels.find((t) => /4402/.test(t.config.addr));
add("ngrok tunnel → 4402 only", !!feed && !tunnels!.tunnels.some((t) => /4400|4401|3001|3010/.test(t.config.addr)), false, feed ? "feed tunnel up" : "no feed tunnel (runner labels direct-fetch FALLBACK)");

for (const port of [3001, 3010, 4400, 4401, 4402, 8080, 8081]) {
  const l = listeners(port);
  if (l) add(`U07 socket :${port}`, l.split(" ").every((a) => a.startsWith("127.0.0.1:")), true, l);
}

if (process.env.RAWTREE_API_KEY) {
  const s = await probe(`${process.env.RAWTREE_BASE_URL ?? "https://api.rawtree.com"}/v1/query?database=${encodeURIComponent(process.env.RAWTREE_DATABASE ?? "")}`, {
    method: "POST", headers: { authorization: `Bearer ${process.env.RAWTREE_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ sql: "SELECT 1 AS ok", format: "JSON" }),
  }, 6000);
  add("RawTree read-only SELECT 1", s === 200, true, String(s));
}

const w = Math.max(...rows.map((r) => r.item.length));
for (const r of rows) console.log(`${r.ok ? "ok  " : r.required ? "FAIL" : "warn"}  ${r.item.padEnd(w)}  ${r.detail}`);
const failed = rows.filter((r) => r.required && !r.ok);
console.log(failed.length ? `\n${failed.length} required item(s) not ready` : "\nall required items ready");
process.exit(failed.length ? 1 : 0);
