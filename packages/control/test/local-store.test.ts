import { describe, expect, it } from "vitest";
import { buildRunnerEnv, loadConfig, makeEvent } from "@dr/shared";
import { LocalStore } from "../src/local-store.ts";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "@dr/shared";

describe("local persistence boundaries", () => {
  it("the child preload rejects hosted fetch before opening a connection", () => {
    const result = spawnSync(process.execPath, ["--import", "./scripts/local-network-guard.mjs", "--input-type=module", "-e",
      'try { await fetch("https://api.openai.com/v1/responses"); process.exit(2); } catch (error) { if (!error.message.includes("LOCAL_NETWORK_ONLY")) process.exit(3); }'],
    { cwd: REPO_ROOT, env: { PATH: process.env.PATH }, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
  });
  it("rejects gaps, conflicts and corrupted persisted payloads", async () => {
    const store = new LocalStore(":memory:");
    try {
      const event = makeEvent({ missionId: "local-test", batchId: "local", arm: "dr", revision: 1, epoch: 0, type: "MISSION_CREATED", payload: { ownerId: "operator", goal: "test" } });
      await store.append(event);
      await store.append(event);
      expect(store.watermark(event.missionId)).toBe(1);
      await expect(store.append(makeEvent({ ...event, payload: { goal: "changed" } }))).rejects.toThrow("conflict");
      await expect(store.append(makeEvent({ ...event, revision: 3 }))).rejects.toThrow("gap");
      const corrupted = { ...event, payload: { ownerId: "forged" } };
      store.db.prepare("UPDATE events SET body=?").run(JSON.stringify(corrupted));
      await expect(store.restore(event.missionId, 1)).rejects.toThrow("hash mismatch");
    } finally { store.close(); }
  });

  it("local child config does not forward hosted credentials or Node preload hooks", () => {
    const cfg = loadConfig("control", { DR_DEMO_MODE: "local", DR_PLANNER_MODEL: "local-rules", DR_WORLD_TOKEN: "local-world", DR_INTERNAL_TOKEN: "local-internal", DR_OPERATOR_TOKEN: "local-operator", RAWTREE_API_KEY: "sentinel", NIMBLE_API_KEY: "sentinel", OPENAI_API_KEY: "sentinel" });
    expect(cfg.RAWTREE_API_KEY).toBe("");
    const env = buildRunnerEnv(cfg, { DR_RUN_ID: "local-test", DR_EPOCH: 1, DR_ARM: "dr", DR_CONTROL_URL: "http://127.0.0.1:1", DR_RUNNER_TOKEN: "local-runner" }, { DR_DEMO_MODE: "local", NODE_OPTIONS: "--import bad-file", OPENAI_API_KEY: "sentinel", INTELLIGENCE_API_KEY: "sentinel" });
    expect(env.DR_DEMO_MODE).toBe("local");
    for (const key of ["OPENAI_API_KEY", "NIMBLE_API_KEY", "RAWTREE_API_KEY", "INTELLIGENCE_API_KEY", "NODE_OPTIONS"]) expect(env).not.toHaveProperty(key);
    expect(loadConfig("runner", env).OPENAI_API_KEY).toBe("");
  });
});
