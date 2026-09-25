// AG-UI mission port: chat verbs → actor commands; streams narrated progress as text chunks.
//   "plan my Angel Island trip" / start → start both arms (crash armed) and stream until both HOLD
//   kill → SIGKILL held children · close site a → operator world edit · resume → stream until verdicts
//   reset → desk world back to v1 (start also resets) · anything else → status markdown
import { decodeValue, type AgUiMissionPort, type Arm, type SseEnvelope } from "@dr/shared";
import type { MissionActor } from "./actor.ts";
import type { DemoOps } from "./server.ts";

const INTERESTING = /hold expired|FALLBACK|RESTORING|control cache|reconcile|marked stale|OBSERVE|LIQUID|PLANNER|DESK|VERDICT|HOLDING|STEP|NAIVE|ERROR|kill -9|spawned|exited/;

async function* streamUntil(actor: MissionActor, done: () => boolean, timeoutMs: number): AsyncGenerator<string> {
  const q: SseEnvelope[] = [];
  let wake: (() => void) | null = null;
  const off = actor.subscribe((e) => { q.push(e); wake?.(); });
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      while (q.length) {
        const e = q.shift()!;
        if (e.type !== "log") continue;
        const line = String((e.data as { line?: string }).line ?? "");
        if (INTERESTING.test(line)) yield `\n- \`${e.arm ?? "ctl"}\` ${line.replace(/child env keys: .*/, "child env: allowlist only")}`;
      }
      if (done()) return;
      await new Promise<void>((r) => { wake = r; setTimeout(r, 500); });
      wake = null;
    }
    yield "\n\n_(still running — ask for `status`)_";
  } finally { off(); }
}

export function statusMarkdown(actor: MissionActor): string {
  const out: string[] = ["## Dead Reckoning status"];
  const missions = actor.snapshot();
  if (!missions.length) return "No mission yet. Say **plan my Angel Island trip** to start (both arms: Dead Reckoning and the naive transcript-resume baseline).";
  for (const m of missions) {
    out.push(`\n### ${m.arm === "dr" ? "Dead Reckoning" : "Naive transcript-resume baseline"} · \`${m.run_id}\``);
    out.push(`state **${m.state}** · pid ${m.pid ?? "-"} · generation ${m.generation}${m.verdict ? ` · verdict **${m.verdict.verdict}** — ${m.verdict.reason}` : ""}`);
    const p = actor.cache.get(m.run_id);
    if (!p) continue;
    const rc = Object.values(p.receipts);
    if (rc.length) out.push("", "| slot | resource | outcome | receipt | |", "|---|---|---|---|---|", ...rc.map((r) => `| ${r.slot} | ${r.resource} | ${r.outcome}${r.reject_reason ? ` (${r.reject_reason})` : ""} | ${r.receipt_id} | ${r.recovered ? "RECOVERED FROM DESK" : ""} |`));
    const f = p.facts["site-A.status"];
    if (f) out.push(`\nsite-A.status = ${String(decodeValue(f.value))} (${f.status}${f.nimble_request_id ? (String(f.nimble_request_id).startsWith("direct-") ? `, FALLBACK direct fetch (NOT Nimble) ${f.nimble_request_id}` : `, Nimble task ${f.nimble_request_id}`) : ""})`);
    const toks = p.metrics.filter((x) => x.phase === "planner").map((x) => `${x.step}@e${x.epoch}:${x.context_tokens}`);
    if (toks.length) out.push(`\ncontext_tokens per planner call: ${toks.join(" · ")}`);
  }
  return out.join("\n");
}

export function createMissionPort(actor: MissionActor, ops: DemoOps): AgUiMissionPort {
  return {
    async *handle(text: string) {
      const t = text.toLowerCase();
      if (/\breset\b/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const w = (await ops.reset()) as { world_version?: number };
        yield `Desk world reset to v${w?.world_version ?? 1} (Site A open). Say **plan my Angel Island trip** to start a new take.`;
        return;
      }
      if (/\bkill\b/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled (DR_ENABLE_DEMO_CONTROLS)."; return; }
        const r = await actor.kill(/\ball\b/.test(t));
        yield r.length ? r.map((k) => `\`${k.arm}\` kill -9 pid ${k.pid} → signal ${k.signal}, alive after: ${k.alive_after}`).join("\n") : "No held runner to kill.";
        return;
      }
      if (/close|storm|world/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const w = await ops.world({ site: "site-A", status: "closed", notice: "Storm damage" });
        yield `Operator edit: **Site A → CLOSED** (Storm damage) · world v${w.world_version ?? "?"}. The runners are not told; they must notice on their own.`;
        return;
      }
      if (/resume|restart/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const ms = actor.resume();
        if (!ms.length) { yield "Nothing to resume."; return; }
        yield `Resuming ${ms.map((m) => `\`${m.arm}\` (new pid ${m.pid})`).join(", ")} · sim_clock +48h SIMULATED`;
        yield* streamUntil(actor, () => ms.every((m) => m.state !== "running"), 240_000);
        yield `\n\n${statusMarkdown(actor)}`;
        return;
      }
      if (/start|plan|trip|angel/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const arms: Arm[] = /\bdr only\b/.test(t) ? ["dr"] : ["dr", "naive"];
        const blocker = actor.startBlocker(arms);
        if (blocker) { yield `Cannot start: ${blocker}. Say **kill all** first, or wait for the verdicts.`; return; }
        // Every take starts from the v1 world (Site A open) so the later "close site A" edit is a real change.
        const w = (await ops.reset()) as { world_version?: number };
        yield `Desk world reset to v${w?.world_version ?? 1} (Site A open).\n\n`;
        const ms = actor.start(arms, { crash: !/no crash/.test(t), statusUrl: await ops.statusUrl() });
        yield `Mission started: ${ms.map((m) => `\`${m.arm}\` run ${m.run_id} pid ${m.pid}`).join(" · ")}. Angel Island Oct 9–11, party of 2, $400, wheelchair-accessible campsite required.`;
        yield* streamUntil(actor, () => ms.every((m) => m.state !== "running"), 180_000);
        yield "\n\nBoth runners are holding after the desk committed the ferry. Say **kill** to SIGKILL them.";
        return;
      }
      yield statusMarkdown(actor);
    },
  };
}
