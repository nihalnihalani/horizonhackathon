// @dr/providers — Nimble sensor, Liquid curator, OpenAI planner, context composer (WP C).
export * from "./nimble.ts";
export * from "./curator.ts";
export * from "./planner.ts";
export * from "./context.ts";
export { applyParserLocally, selectText } from "./html-select.ts";
export { percentile, type FetchLike } from "./http.ts";

import { loadConfig } from "@dr/shared";
import { LiquidCurator } from "./curator.ts";
import { NimbleSensor } from "./nimble.ts";
import { OpenAIPlanner } from "./planner.ts";
import { Composer } from "./context.ts";

/** Build all providers from the `providers` config scope (or any env object carrying the same keys). */
export function createProviders(env?: NodeJS.ProcessEnv, opts: { directFallback?: boolean } = {}) {
  const cfg = loadConfig("providers", env);
  return {
    sensor: new NimbleSensor({ apiKey: cfg.NIMBLE_API_KEY, directFallback: opts.directFallback }),
    curator: new LiquidCurator({ baseUrl: cfg.DR_LIQUID_BASE_URL, model: cfg.DR_LIQUID_MODEL }),
    planner: new OpenAIPlanner({ apiKey: cfg.OPENAI_API_KEY, model: cfg.DR_PLANNER_MODEL, budget: cfg.DR_PLANNER_CONTEXT_BUDGET }),
    composer: new Composer(),
    budget: cfg.DR_PLANNER_CONTEXT_BUDGET,
  };
}
