// AG-UI endpoint for the Dead Reckoning mission actor.
// createAgUiHandler(port, opts?) returns a Node request handler for POST /ag-ui that validates a
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

/** The `id` of the last user message, used as half of the transport-retry dedupe key. */
function lastUserMessageId(input: RunAgentInput): string | undefined {
  for (let i = input.messages.length - 1; i >= 0; i--) {
    const m = input.messages[i] as { role: string; id?: unknown };
    if (m.role !== "user") continue;
    return typeof m.id === "string" ? m.id : undefined;
  }
  return undefined;
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

/** What the port receives about the caller once an assertion has been verified. */
export type AgUiHandlerCtx = { actorId: string };

/**
 * `port.handle` extended with an optional third context argument.
 *
 * `@dr/shared/ports` (owned by the lead, FROZEN at scaffold) still declares the two-argument
 * `AgUiMissionPort.handle(text, threadId)`. Adding the verified actor id is additive and backward
 * compatible — an implementation that ignores a third argument works exactly as before — but the
 * type itself is not this package's file to edit. This local cast is the seam until the shared
 * contract is updated; flagged as an open contract request (see WORKLOG / handoff).
 */
type PortHandle = (text: string, threadId: string, ctx?: AgUiHandlerCtx) => AsyncIterable<string>;

/**
 * CopilotKit's Intelligence runtime names a new thread by re-running the agent with a system prompt that starts
 * "You generate short, specific conversation titles." and the user's text (retrying up to 3 times on a non-JSON
 * answer). That is not a user command: answering it through the mission port would execute "plan" again.
 */
export function isThreadTitleRequest(input: RunAgentInput): boolean {
  return input.messages.some((m) => {
    const x = m as { role: string; content?: unknown };
    return x.role === "system" && typeof x.content === "string" && x.content.startsWith("You generate short, specific conversation titles.");
  });
}
export const THREAD_TITLE_JSON = JSON.stringify({ title: "Dead Reckoning mission" });

/** Pure event generator, exported for tests: the full AG-UI event sequence for one run. */
export async function* runEvents(
  port: AgUiMissionPort,
  input: RunAgentInput,
  ctx?: AgUiHandlerCtx,
): AsyncGenerator<BaseEvent> {
  const { threadId, runId } = input;
  const messageId = randomUUID();
  yield { type: EventType.RUN_STARTED, threadId, runId } as BaseEvent;
  yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" } as BaseEvent;
  if (isThreadTitleRequest(input)) {
    yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: THREAD_TITLE_JSON } as BaseEvent;
    yield { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent;
    yield { type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent;
    return;
  }
  try {
    const handle = port.handle as PortHandle;
    for await (const chunk of handle(lastUserText(input), threadId, ctx)) {
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

/** A small bounded FIFO of `"threadId:messageId"` keys already admitted (R06-style transport dedupe). */
class BoundedSeenSet {
  private readonly max: number;
  private readonly order: string[] = [];
  private readonly set = new Set<string>();

  constructor(max: number) {
    this.max = max;
  }

  has(key: string): boolean {
    return this.set.has(key);
  }

  add(key: string): void {
    if (this.set.has(key)) return;
    this.set.add(key);
    this.order.push(key);
    if (this.order.length > this.max) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.set.delete(evicted);
    }
  }
}

const DEDUPE_CAPACITY = 500;

export type AgUiHandlerOptions = {
  /**
   * Verifies `forwardedProps.openbotRun` and returns the caller's identity, or `null`/throws to
   * refuse. Only consulted when `requireAssertion` resolves true.
   */
  verify?: (input: { assertion: unknown; runId: string; threadId: string }) => Promise<AgUiHandlerCtx | null>;
  /**
   * Gate for the assertion check (U05). Defaults to `process.env.DR_REQUIRE_AGUI_ASSERTION ===
   * "true"` so an unset/false env var keeps today's unauthenticated demo behavior — the handler
   * still logs once that verification is disabled, so the gap is visible rather than silent.
   */
  requireAssertion?: boolean;
};

export function createAgUiHandler(port: AgUiMissionPort, opts: AgUiHandlerOptions = {}) {
  const encoder = new EventEncoder();
  const requireAssertion = opts.requireAssertion ?? process.env.DR_REQUIRE_AGUI_ASSERTION === "true";
  if (!requireAssertion) {
    // Logged once at handler creation, not per-request: this is a standing posture, not an event.
    console.log("AG-UI assertion verification: disabled");
  }
  const seen = new BoundedSeenSet(DEDUPE_CAPACITY);

  function writeSse(res: ServerResponse) {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
  }

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

    let ctx: AgUiHandlerCtx | undefined;
    if (requireAssertion) {
      const forwardedProps = input.forwardedProps as Record<string, unknown> | undefined;
      const assertion = forwardedProps?.openbotRun;
      let verified: AgUiHandlerCtx | null = null;
      if (assertion !== undefined && opts.verify) {
        try {
          verified = await opts.verify({ assertion, runId: input.runId, threadId: input.threadId });
        } catch {
          verified = null;
        }
      }
      if (!verified) {
        // U05: no mission read/mutation. The port is never called; emit RUN_ERROR over a normal
        // AG-UI SSE lifecycle rather than a bare HTTP 401, matching how the port's own errors surface.
        writeSse(res);
        res.write(
          encoder.encodeSSE({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId } as BaseEvent),
        );
        res.write(
          encoder.encodeSSE({
            type: EventType.RUN_ERROR,
            message: "AG-UI run assertion missing or invalid.",
          } as BaseEvent),
        );
        res.end();
        return;
      }
      ctx = verified;
    }

    // Transport-retry dedupe: a repeated identical (threadId, last-user-message-id) must not start
    // a second business command. Registered before dispatch so a fast duplicate arriving while the
    // first is still streaming is also caught, not just a retry after completion.
    const messageId = lastUserMessageId(input);
    const dedupeKey = messageId !== undefined ? `${input.threadId}:${messageId}` : undefined;
    if (dedupeKey !== undefined && seen.has(dedupeKey)) {
      writeSse(res);
      const replayId = randomUUID();
      res.write(
        encoder.encodeSSE({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId } as BaseEvent),
      );
      res.write(
        encoder.encodeSSE({ type: EventType.TEXT_MESSAGE_START, messageId: replayId, role: "assistant" } as BaseEvent),
      );
      res.write(
        encoder.encodeSSE({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: replayId,
          delta: "Already accepted.",
        } as BaseEvent),
      );
      res.write(encoder.encodeSSE({ type: EventType.TEXT_MESSAGE_END, messageId: replayId } as BaseEvent));
      res.write(
        encoder.encodeSSE({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId } as BaseEvent),
      );
      res.end();
      return;
    }
    if (dedupeKey !== undefined) seen.add(dedupeKey);

    writeSse(res);
    let closed = false;
    res.on("close", () => { closed = true; });
    for await (const ev of runEvents(port, input, ctx)) {
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
