import { describe, it, expect, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AgUiMissionPort } from "@dr/shared/ports";
import { createAgUiHandler, stubMissionPort } from "../src/ag-ui/handler";

const input = { threadId: "t1", runId: "r1", messages: [{ id: "m1", role: "user", content: "hello" }], tools: [], context: [], state: {}, forwardedProps: {} };
const servers: Server[] = [];

async function serve(port: AgUiMissionPort): Promise<string> {
  const h = createAgUiHandler(port);
  const s = createServer((req, res) => void h(req, res));
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}/ag-ui`;
}
function types(sse: string): string[] {
  return sse.split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)).type);
}
afterAll(() => { for (const s of servers) s.close(); });

describe("AG-UI handler", () => {
  it("streams RUN_STARTED, text message, RUN_FINISHED for a valid RunAgentInput", async () => {
    const url = await serve(stubMissionPort);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const t = types(await res.text());
    expect(t[0]).toBe("RUN_STARTED");
    expect(t[1]).toBe("TEXT_MESSAGE_START");
    expect(t).toContain("TEXT_MESSAGE_CONTENT");
    expect(t.slice(-2)).toEqual(["TEXT_MESSAGE_END", "RUN_FINISHED"]);
  });

  it("passes the last user message text and thread id to the mission port", async () => {
    const seen: string[] = [];
    const url = await serve({ async *handle(text, threadId) { seen.push(text, threadId); yield "ok"; } });
    await (await fetch(url, { method: "POST", body: JSON.stringify(input) })).text();
    expect(seen).toEqual(["hello", "t1"]);
  });

  it("rejects an invalid RunAgentInput with 400", async () => {
    const url = await serve(stubMissionPort);
    const res = await fetch(url, { method: "POST", body: JSON.stringify({ hello: 1 }) });
    expect(res.status).toBe(400);
  });

  it("emits RUN_ERROR (not RUN_FINISHED) when the port throws", async () => {
    const url = await serve({ async *handle() { yield "partial"; throw new Error("boom"); } });
    const t = types(await (await fetch(url, { method: "POST", body: JSON.stringify(input) })).text());
    expect(t).toContain("RUN_ERROR");
    expect(t).not.toContain("RUN_FINISHED");
  });
});
