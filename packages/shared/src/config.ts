// Validated config loader (CONTRACTS §8). FROZEN at scaffold.
// - Never prints values; errors name keys only.
// - Empty DR_PLANNER_MODEL is a hard error (no silent model substitution).
// - scope "runner" NEVER reads .env from disk: the child gets only RUNNER_ENV_ALLOWLIST via spawn env.
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenv } from "dotenv";
import { z } from "zod";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export class ConfigError extends Error {
  constructor(public scope: string, public keys: string[]) {
    super(`Config error (${scope}): missing or invalid ${keys.join(", ")} — set them in the root .env (see .env.example)`);
  }
}

const req = z.string().trim().min(1);
const port = z.coerce.number().int().min(1).max(65535);
const url = z.string().trim().url();
const boolish = z.preprocess((v) => v === "true" || v === "1" || v === true, z.boolean());

const providers = {
  NIMBLE_API_KEY: req,
  OPENAI_API_KEY: req,
  DR_PLANNER_MODEL: req, // empty → ConfigError
  DR_LIQUID_BASE_URL: url.default("http://127.0.0.1:8081/v1"),
  DR_LIQUID_MODEL: req.default("LiquidAI/LFM2.5-1.2B-Instruct-GGUF"),
  DR_PLANNER_CONTEXT_BUDGET: z.coerce.number().int().positive().default(6000),
};
const storage = {
  RAWTREE_API_KEY: req,
  RAWTREE_DATABASE: req.default("deadreckoning"),
  RAWTREE_BASE_URL: url.default("https://api.rawtree.com"),
};

export const SCOPES = {
  storage: z.object(storage),
  providers: z.object(providers),
  desk: z.object({
    DR_WORLD_BASE_URL: url.default("http://127.0.0.1:4401"),
    DR_FEED_PORT: port.default(4402),
    DR_WORLD_TOKEN: req,
    DR_OPERATOR_TOKEN: req,
    DR_DESK_DB: z.string().default(":memory:"),
  }),
  control: z.object({
    ...storage,
    ...providers,
    DR_CONTROL_PORT: port.default(4400),
    DR_WORLD_BASE_URL: url.default("http://127.0.0.1:4401"),
    DR_WORLD_TOKEN: req,
    DR_OPERATOR_TOKEN: req,
    DR_INTERNAL_TOKEN: req,
    DR_ENABLE_DEMO_CONTROLS: boolish.default(false),
  }),
  runner: z.object({
    ...providers,
    DR_WORLD_BASE_URL: url,
    DR_WORLD_TOKEN: req,
    DR_RUN_ID: req,
    DR_EPOCH: z.coerce.number().int().min(1),
    DR_ARM: z.enum(["dr", "naive"]),
    DR_CRASH_AFTER: z.enum(["", "after_desk_commit"]).default(""),
    DR_CONTROL_URL: url,
    DR_RUNNER_TOKEN: req,
  }),
  "console-stub": z.object({ DR_CONTROL_PORT: port.default(4400) }),
} as const;

export type Scope = keyof typeof SCOPES;
export type ConfigOf<S extends Scope> = z.infer<(typeof SCOPES)[S]>;

/** Exactly these env keys reach the runner child (plus PATH/HOME/NODE_* set by the supervisor). */
export const RUNNER_ENV_ALLOWLIST = [
  "NIMBLE_API_KEY", "OPENAI_API_KEY", "DR_PLANNER_MODEL", "DR_LIQUID_BASE_URL", "DR_LIQUID_MODEL",
  "DR_WORLD_BASE_URL", "DR_WORLD_TOKEN", "DR_PLANNER_CONTEXT_BUDGET",
  "DR_RUN_ID", "DR_EPOCH", "DR_ARM", "DR_CRASH_AFTER", "DR_CONTROL_URL", "DR_RUNNER_TOKEN",
] as const;
/** Non-secret process plumbing the supervisor may also pass. */
export const RUNNER_ENV_PASSTHROUGH = ["PATH", "HOME", "TMPDIR", "NODE_OPTIONS", "TZ", "DR_HOLD_MS"] as const;

let dotenvLoaded = false;
export function loadDotenv(path = resolve(REPO_ROOT, ".env")): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  if (existsSync(path)) dotenv({ path, override: false, quiet: true });
}

export function loadConfig<S extends Scope>(scope: S, env: NodeJS.ProcessEnv = process.env): ConfigOf<S> {
  if (scope !== "runner" && env === process.env) loadDotenv();
  const res = SCOPES[scope].safeParse(env);
  if (!res.success) throw new ConfigError(scope, [...new Set(res.error.issues.map((i) => String(i.path[0])))]);
  return res.data as ConfigOf<S>;
}

/** Build the child env from control's config + per-generation values. Nothing else leaks. */
export function buildRunnerEnv(
  cfg: ConfigOf<"control">,
  gen: { DR_RUN_ID: string; DR_EPOCH: number; DR_ARM: "dr" | "naive"; DR_CRASH_AFTER?: string; DR_CONTROL_URL: string; DR_RUNNER_TOKEN: string },
  base: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of RUNNER_ENV_PASSTHROUGH) if (base[k]) out[k] = base[k]!;
  const merged: Record<string, unknown> = { ...cfg, ...gen, DR_CRASH_AFTER: gen.DR_CRASH_AFTER ?? "" };
  for (const k of RUNNER_ENV_ALLOWLIST) if (merged[k] !== undefined) out[k] = String(merged[k]);
  return out;
}
