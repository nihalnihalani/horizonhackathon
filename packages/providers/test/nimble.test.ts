import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NIMBLE_STATUS_FIELD_NAMES, NIMBLE_STATUS_PARSER, SourceUnverified } from "@dr/shared";
import { NIMBLE_STATUS_PARSER_REQUEST, NimbleSensor, applyParserLocally, classifySource, factsFromObservation, hostOf, siteMap } from "../src/index.ts";
import { fakeFetch, statusHtml } from "./helpers.ts";

const fx = (n: string) => JSON.parse(readFileSync(resolve(__dirname, "fixtures", n), "utf8"));
const html = readFileSync(resolve(__dirname, "fixtures", "status-v2.html"), "utf8");

describe("status page parser mapping", () => {
  it("applies the 14 terminal CSS selectors locally to the frozen DOM", () => {
    const f = applyParserLocally(html, NIMBLE_STATUS_PARSER);
    expect(Object.keys(f).sort()).toEqual([...NIMBLE_STATUS_FIELD_NAMES].sort());
    expect(f.siteA_status).toBe("closed");
    expect(f.siteA_notice).toBe("Storm damage");
    expect(f.world_version).toBe("2");
  });
  it("maps fields to {siteA,siteB,siteC}", () => {
    const m = siteMap(fx("nimble-status-parsed.json").data.parsing);
    expect(m.siteA).toEqual({ status: "closed", accessible: true, price_cents: 8000, notice: "Storm damage" });
    expect(m.siteB.accessible).toBe(false);
    expect(m.siteC).toMatchObject({ status: "open", accessible: true, price_cents: 9000 });
  });
  it("unknown status never becomes open", () => {
    const f = { ...fx("nimble-status-parsed.json").data.parsing, siteA_status: "maybe" };
    expect(() => siteMap(f)).toThrow(SourceUnverified);
  });
});

describe("NimbleSensor.extractStatusPage", () => {
  it("uses Nimble parsing when present and preserves task_id/metadata", async () => {
    const saved = fx("nimble-status-parsed.json");
    const { f, calls } = fakeFetch([() => ({ json: saved })]);
    const s = new NimbleSensor({ apiKey: "k", fetchImpl: f });
    const o = await s.extractStatusPage("https://t.example/status.html");
    expect(o.task_id).toBe(saved.task_id);
    expect(o.parse_mode).toBe("nimble");
    expect(o.retrieval_mode).toBe("live");
    expect(o.metadata).toEqual(saved.metadata);
    expect(o.world_version).toBe(2);
    expect(o.raw_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[0]!.url).toBe("https://sdk.nimbleway.com/v2/extract");
    expect(calls[0]!.body).toMatchObject({ render: false, parse: true, headers: { "ngrok-skip-browser-warning": "1" } });
    // One schema node whose selector unwraps `html` from Nimble's {url, html} parse root.
    expect(calls[0]!.body.parser).toEqual({ type: "schema", selector: { type: "json", path: "html" }, fields: NIMBLE_STATUS_PARSER });
    expect(Object.keys(calls[0]!.body.parser.fields)).toHaveLength(14);
    expect(calls).toHaveLength(1);
  });
  it("request parser wraps the frozen 14 terminals without changing them", () => {
    expect(NIMBLE_STATUS_PARSER_REQUEST.fields).toBe(NIMBLE_STATUS_PARSER);
    expect(applyParserLocally(html, NIMBLE_STATUS_PARSER_REQUEST.fields)).toEqual(applyParserLocally(html, NIMBLE_STATUS_PARSER));
  });
  it("prefers Nimble parsing over the local selectors when both are available", async () => {
    const saved = fx("nimble-status-parsed.json");
    const both = { ...saved, data: { ...saved.data, html: html.replace(">closed<", ">open<") } };
    const { f } = fakeFetch([() => ({ json: both })]);
    const o = await new NimbleSensor({ apiKey: "k", fetchImpl: f }).extractStatusPage("https://t.example/status.html");
    expect(o.parse_mode).toBe("nimble");
    expect(o.fields.siteA_status).toBe("closed");
  });
  it("falls back to local CSS over Nimble-retrieved HTML when data.parsing is {}", async () => {
    const { f, calls } = fakeFetch([() => ({ json: fx("nimble-status-empty-parsing.json") })]);
    const o = await new NimbleSensor({ apiKey: "k", fetchImpl: f }).extractStatusPage("https://t.example/status.html");
    expect(o.parse_mode).toBe("local-css");
    expect(o.retrieval_mode).toBe("live");
    expect(o.fields.siteA_status).toBe("closed");
    expect(calls).toHaveLength(1);
  });
  it("retries once with render:auto when nothing parses, then SourceUnverified", async () => {
    const empty = { task_id: "t", status: "success", status_code: 200, data: { parsing: {}, html: "<html></html>" } };
    const { f, calls } = fakeFetch([() => ({ json: empty })]);
    await expect(new NimbleSensor({ apiKey: "k", fetchImpl: f }).extractStatusPage("https://t.example/s")).rejects.toThrow(SourceUnverified);
    expect(calls.map((c) => c.body.render)).toEqual([false, "auto"]);
  });
  it("non-success and target 5xx are SourceUnverified, never closed", async () => {
    const a = fakeFetch([() => ({ status: 500, json: { status: "failed" } })]);
    await expect(new NimbleSensor({ apiKey: "k", fetchImpl: a.f }).extractStatusPage("https://t/s")).rejects.toThrow(SourceUnverified);
    const b = fakeFetch([() => ({ json: { task_id: "t", status: "success", status_code: 503, data: {} } })]);
    await expect(new NimbleSensor({ apiKey: "k", fetchImpl: b.f }).extractStatusPage("https://t/s")).rejects.toThrow(/503/);
  });
  it("world_version mismatch retries once with ?v=", async () => {
    const v1 = { ...fx("nimble-status-parsed.json") };
    v1.data = { parsing: { ...v1.data.parsing, world_version: "1", siteA_status: "open" } };
    const { f, calls } = fakeFetch([() => ({ json: v1 }), () => ({ json: fx("nimble-status-parsed.json") })]);
    const o = await new NimbleSensor({ apiKey: "k", fetchImpl: f }).extractStatusPage("https://t.example/status.html", { expectedWorldVersion: 2 });
    expect(o.world_version).toBe(2);
    expect(calls[1]!.body.url).toBe("https://t.example/status.html?v=2");
  });
});

describe("classification", () => {
  it("classifies unreachable vs changed vs unchanged", () => {
    const v2 = fx("nimble-status-parsed.json").data.parsing;
    const v1 = { ...v2, siteA_status: "open", siteA_notice: "", world_version: "1" };
    expect(classifySource({ fields: v1 }, { error: new SourceUnverified("down") }).kind).toBe("unreachable");
    const c = classifySource({ fields: v1 }, { obs: { fields: v2 } });
    expect(c.kind).toBe("changed");
    expect(c.changed_fields).toEqual(["siteA_status", "siteA_notice"]);
    expect(classifySource({ fields: v2 }, { obs: { fields: v2 } }).kind).toBe("unchanged");
    expect(hostOf("https://www.parks.ca.gov/?page_id=468")).toBe("parks.ca.gov");
  });
  it("factsFromObservation emits site-X.status/accessible facts with the Nimble task id", async () => {
    const { f } = fakeFetch([() => ({ json: fx("nimble-status-parsed.json") })]);
    const o = await new NimbleSensor({ apiKey: "k", fetchImpl: f }).extractStatusPage("https://t.example/status.html");
    const facts = factsFromObservation(o);
    const a = facts.find((x) => x.key === "site-A.status")!;
    expect(a).toMatchObject({ value: '"closed"', volatile: true, nimble_request_id: o.task_id, world_version: 2, status: "active" });
    expect(facts).toHaveLength(6);
  });
});

describe("direct fallback against a throwaway local HTTP server", () => {
  let server: Server;
  let url = "";
  beforeAll(async () => {
    server = createServer((_req, res) => { res.setHeader("content-type", "text/html"); res.end(statusHtml(2, "closed")); });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/status.html`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  it("labels retrieval_mode direct and parses 14 fields", async () => {
    const s = new NimbleSensor({ apiKey: "k" });
    const o = await s.extractStatusPageDirect(url, { expectedWorldVersion: 2 });
    expect(o.retrieval_mode).toBe("direct");
    expect(o.task_id).toMatch(/^direct-/);
    expect(Object.keys(o.fields)).toHaveLength(14);
    expect(siteMap(o.fields).siteA.status).toBe("closed");
  });
  it("directFallback engages only when Nimble fails", async () => {
    const failing = async (u: string, init?: RequestInit) => (u.includes("nimbleway") ? new Response("{}", { status: 502 }) : fetch(u, init));
    const o = await new NimbleSensor({ apiKey: "k", fetchImpl: failing, directFallback: true }).extractStatusPage(url);
    expect(o.retrieval_mode).toBe("direct");
    await expect(new NimbleSensor({ apiKey: "k", fetchImpl: failing }).extractStatusPage(url)).rejects.toThrow(SourceUnverified);
  });
});
