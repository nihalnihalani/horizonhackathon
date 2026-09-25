// AG-UI endpoint for the Dead Reckoning mission actor.
// createAgUiHandler(port) returns a Node request handler for POST /ag-ui that validates a
// RunAgentInput, then streams RUN_STARTED, TEXT_MESSAGE_START/CONTENT*/END and RUN_FINISHED as SSE.
// The integration agent passes the real AgUiMissionPort; stub-server.ts passes a canned one.
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { EventType, RunAgentInputSchema, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import type { AgUiMissionPort } from "@dr/shared/ports";

const MAX_BODY_BYTES = 1_000_000;

/** Last user message text, whatever content shape the client sent. */
export function lastUserText(input: RunAgentInput): string {
  for (let i = input.messages.length - 1; i >= 0; i--) {
    const m = input.messages[i] as { role: string; content?: unknown };
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .map((p) => (p && typeof p === "object" && "text" in p ? String((p as { text: unknown }).text) : ""))
        .join("");
    }
    return "";
  }
  return "";
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    const b = typeof c === "string" ? Buffer.from(c) : (c as Buffer);
    size += b.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(b);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function jsonError(res: ServerResponse, status: number, error: string, detail?: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ error, detail }));
}

/** Pure event generator, exported for tests: the full AG-UI event sequence for one run. */
export async function* runEvents(port: AgUiMissionPort, input: RunAgentInput): AsyncGenerator<BaseEvent> {
  const { threadId, runId } = input;
  const messageId = randomUUID();
  yield { type: EventType.RUN_STARTED, threadId, runId } as BaseEvent;
  yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" } as BaseEvent;
  try {
    for await (const chunk of port.handle(lastUserText(input), threadId)) {
      if (chunk) yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: chunk } as BaseEvent;
    }
  } catch (err) {
    yield { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent;
    yield { type: EventType.RUN_ERROR, message: err instanceof Error ? err.message : String(err) } as BaseEvent;
    return;
  }
  yield { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent;
  yield { type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent;
}

export function createAgUiHandler(port: AgUiMissionPort) {
  const encoder = new EventEncoder();
  return async function agUiHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") return jsonError(res, 405, "method not allowed");
    let input: RunAgentInput;
    try {
      const raw = JSON.parse(await readBody(req));
      const parsed = RunAgentInputSchema.safeParse(raw);
      if (!parsed.success) return jsonError(res, 400, "invalid RunAgentInput", parsed.error.issues);
      input = parsed.data;
    } catch (err) {
      const status = (err as { status?: number }).status ?? 400;
      return jsonError(res, status, status === 413 ? "body too large" : "invalid JSON");
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    let closed = false;
    res.on("close", () => { closed = true; });
    for await (const ev of runEvents(port, input)) {
      if (closed) break;
      res.write(encoder.encodeSSE(ev));
    }
    res.end();
  };
}

/** Canned port used by the stub server until the integrator wires the real mission actor. */
export const stubMissionPort: AgUiMissionPort = {
  async *handle(text: string, threadId: string) {
    yield "Dead Reckoning (stub) is online. ";
    yield `You said: "${text.slice(0, 200)}". `;
    yield `Thread ${threadId}. The mission actor is not wired yet; verbs will be start | status | resume | kill.`;
  },
};
