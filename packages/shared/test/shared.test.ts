import { describe, expect, it } from "vitest";
import {
  actionKey, argsHash, naiveActionKey, canonicalJson, countTokens, F3, newRunId, assertRunId,
  renderStatusPage, parseStatusFields, NIMBLE_STATUS_FIELD_NAMES, loadConfig, ConfigError, buildRunnerEnv,
  RUNNER_ENV_ALLOWLIST, parseRow, TABLES, ROW_SCHEMAS,
} from "../src/index.ts";

describe("action-key", () => {
  it("is stable, sha256 hex, and independent of attempt", () => {
    const a = actionKey("f3-20260925-ab12", "ferry", "ferry-tiburon-1009", "2026-10-09", 2);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(actionKey("f3-20260925-ab12", "ferry", "ferry-tiburon-1009", "2026-10-09", 2)).toBe(a);
    expect(naiveActionKey("f3-20260925-ab12", "ferry", "ferry-tiburon-1009", "2026-10-09", 2, 2)).not.toBe(a);
  });
  it("canonical JSON sorts keys; argsHash ignores key order", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: null, c: "x" }] })).toBe('{"a":[2,{"c":"x","d":null}],"b":1}');
    expect(argsHash({ x: 1, y: "z" })).toBe(argsHash({ y: "z", x: 1 }));
  });
});

describe("fixture + status page", () => {
  it("F3 totals 28000 on the expected path", () => {
    const price = (id: string) => F3.resources.find((r) => r.id === id)!.price_cents;
    expect(price("ferry-tiburon-1009") + price("site-C") + price("permit") + price("gear")).toBe(28000);
    expect(F3.trip.budget_cents).toBe(40000);
    expect(assertRunId(newRunId())).toMatch(/^f3-\d{8}-[0-9a-f]{4}$/);
  });
  it("renders the DOM contract with eleven parser fields", () => {
    const html = renderStatusPage({
      park_name: "Angel Island SP — Campground Status", world_version: 2, updated_at: "2026-10-11T09:00:00Z",
      sites: [
        { id: "A", status: "closed", accessible: true, price_dollars: 80, notice: "Storm damage" },
        { id: "B", status: "open", accessible: false, price_dollars: 60, notice: "" },
        { id: "C", status: "open", accessible: true, price_dollars: 90, notice: "" },
      ],
    });
    expect(html.match(/id="site-A"/g)).toHaveLength(1);
    expect(NIMBLE_STATUS_FIELD_NAMES).toHaveLength(14);
    const m = parseStatusFields({ world_version: "2", updated_at: "x", siteA_status: "closed", siteA_accessible: "yes", siteA_price: "80", siteA_notice: "Storm damage",
      siteB_status: "open", siteB_accessible: "no", siteB_price: "60", siteC_status: "open", siteC_accessible: "yes", siteC_price: "90" });
    expect(m.sites[0]).toMatchObject({ id: "A", status: "closed", accessible: true });
    expect(m.sites[1].accessible).toBe(false);
  });
});

describe("records", () => {
  it("coerces RawTree Dynamic values on read", () => {
    const r = parseRow("receipts", { run_id: "f3-x", ts: "2026-09-25 12:00:00", epoch: "2", rev: "7", arm: "dr", action_key: "k", receipt_id: "r1",
      slot: "ferry", resource: "ferry-tiburon-1009", outcome: "committed", service_ts: "t", amount: "12000", recovered: "true" });
    expect(r.rev).toBe(7);
    expect(r.recovered).toBe(true);
    expect(Object.keys(ROW_SCHEMAS).sort()).toEqual([...TABLES].sort());
  });
});

describe("config + tokens", () => {
  it("fails on empty DR_PLANNER_MODEL and names keys only", () => {
    expect(() => loadConfig("providers", { NIMBLE_API_KEY: "n", OPENAI_API_KEY: "o", DR_PLANNER_MODEL: "" })).toThrow(ConfigError);
    try { loadConfig("providers", { NIMBLE_API_KEY: "secret-n", OPENAI_API_KEY: "secret-o", DR_PLANNER_MODEL: " " }); } catch (e) {
      expect((e as Error).message).toContain("DR_PLANNER_MODEL");
      expect((e as Error).message).not.toContain("secret");
    }
  });
  it("runner env contains only the allowlist (+ passthrough)", () => {
    const ctl = loadConfig("control", {
      RAWTREE_API_KEY: "rt", NIMBLE_API_KEY: "n", OPENAI_API_KEY: "o", DR_PLANNER_MODEL: "m", DR_WORLD_TOKEN: "w",
      DR_OPERATOR_TOKEN: "op", DR_INTERNAL_TOKEN: "in",
    });
    const env = buildRunnerEnv(ctl, { DR_RUN_ID: "f3-x", DR_EPOCH: 1, DR_ARM: "dr", DR_CONTROL_URL: "http://127.0.0.1:4400", DR_RUNNER_TOKEN: "t" }, {});
    expect(Object.keys(env).every((k) => (RUNNER_ENV_ALLOWLIST as readonly string[]).includes(k))).toBe(true);
    expect(env).not.toHaveProperty("RAWTREE_API_KEY");
    expect(env).not.toHaveProperty("DR_OPERATOR_TOKEN");
    expect(loadConfig("runner", env).DR_EPOCH).toBe(1);
  });
  it("counts tokens with o200k_base", () => {
    const t = countTokens("Angel Island ferry, party of 2");
    expect(t.method).toBe("gpt-tokenizer/o200k_base");
    expect(t.count).toBeGreaterThan(3);
  });
});
