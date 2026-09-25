// AG-UI mission port: chat verbs → actor commands; streams narrated progress as text chunks.
//   "plan my Angel Island trip" / start → start both arms (crash armed) and stream until both HOLD
//   kill / crash → SIGKILL held children · close site a → operator world edit · resume → stream until verdicts + scorecard
//   reset → desk world back to v1 (start also resets) · details → raw technical log · anything else → status markdown
// Narration: 🔵 Dead Reckoning, 🟠 Ordinary agent (the transcript-resume baseline). See narrator.ts.
import { decodeValue, type AgUiMissionPort, type Arm, type SseEnvelope } from "@dr/shared";
import type { MissionActor } from "./actor.ts";
import type { DemoOps } from "./server.ts";
import { ARMS, Narrator, scorecard, who, type ArmResult } from "./narrator.ts";

const TECHNICAL = /hold expired|FALLBACK|RESTORING|control cache|reconcile|marked stale|OBSERVE|LIQUID|PLANNER|DESK|VERDICT|HOLDING|STEP|NAIVE|ERROR|kill -9|spawned|exited/;

async function* streamUntil(actor: MissionActor, done: () => boolean, timeoutMs: number): AsyncGenerator<string> {
  const q: SseEnvelope[] = [];
  let wake: (() => void) | null = null;
  const off = actor.subscribe((e) => { q.push(e); wake?.(); });
  const narrator = new Narrator();
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      while (q.length) {
        const text = narrator.line(q.shift()!);
        if (text) yield `\n\n${text}`;
      }
      if (done()) return;
      await new Promise<void>((r) => { wake = r; setTimeout(r, 500); });
      wake = null;
    }
    yield "\n\n_(still running; ask for `status`)_";
  } finally { off(); }
}

/** Latest run of each arm, with the desk's ledger and the planner context sizes, for the scorecard. */
export async function collectResults(actor: MissionActor, ops: DemoOps): Promise<ArmResult[]> {
  const order: Arm[] = ["dr", "naive"];
  const missions = actor.snapshot().sort((a, b) => order.indexOf(a.arm) - order.indexOf(b.arm));
  return Promise.all(missions.map(async (m) => {
    const p = actor.cache.get(m.run_id);
    const tokens = (p?.metrics ?? []).filter((x) => x.phase === "planner").map((x) => Number(x.context_tokens));
    return { arm: m.arm, run_id: m.run_id, verdict: m.verdict ?? null, ledger: await ops.ledger(m.run_id, m.arm), tokens };
  }));
}

function technicalLog(actor: MissionActor): string {
  const runs = new Set(actor.snapshot().map((m) => m.run_id));
  const lines = actor.recent(2000)
    .filter((e) => e.type === "log" && (!e.run_id || runs.has(e.run_id)))
    .map((e) => ({ arm: e.arm, line: String((e.data as { line?: string }).line ?? "") }))
    .filter((x) => TECHNICAL.test(x.line))
    .map((x) => `- \`${x.arm ?? "ctl"}\` ${x.line.replace(/child env keys: .*/, "child env: allowlist only")}`);
  return lines.length ? `## Technical log (latest runs)\n\n${lines.join("\n")}` : "No technical log yet.";
}

export function statusMarkdown(actor: MissionActor): string {
  const out: string[] = ["## Dead Reckoning status"];
  const missions = actor.snapshot();
  if (!missions.length) return "No mission yet. Say **plan my Angel Island trip** to start. Two agents run side by side: 🔵 Dead Reckoning and 🟠 an ordinary agent.";
  for (const m of missions) {
    out.push(`\n### ${ARMS[m.arm].dot} ${ARMS[m.arm].name} · \`${m.run_id}\``);
    out.push(`state **${m.state}** · pid ${m.pid ?? "-"} · generation ${m.generation}${m.verdict ? ` · verdict **${m.verdict.verdict}**: ${m.verdict.reason}` : ""}`);
    const p = actor.cache.get(m.run_id);
    if (!p) continue;
    const rc = Object.values(p.receipts);
    if (rc.length) out.push("", "| booking | resource | outcome | receipt | |", "|---|---|---|---|---|", ...rc.map((r) => `| ${r.slot} | ${r.resource} | ${r.outcome}${r.reject_reason ? ` (${r.reject_reason})` : ""} | ${r.receipt_id} | ${r.recovered ? "RECOVERED FROM DESK" : ""} |`));
    const f = p.facts["site-A.status"];
    if (f) out.push(`\nSite A status as the agent believes it: **${String(decodeValue(f.value))}** (${f.nimble_request_id ? (String(f.nimble_request_id).startsWith("direct-") ? `direct fetch fallback, not Nimble` : `Nimble task ${String(f.nimble_request_id).slice(0, 8)}`) : "no source"})`);
    const toks = p.metrics.filter((x) => x.phase === "planner").map((x) => `${x.step}:${x.context_tokens}`);
    if (toks.length) out.push(`\nPlanner context per step (tokens): ${toks.join(" · ")}`);
  }
  return out.join("\n");
}

// Chunks are joined with blank lines: OpenBot renders single newlines as one paragraph, and its sidebar
// preview shows the first characters raw, so the first line starts without Markdown markup.
const MISSION_HEADER = [
  "Mission: Angel Island, Oct 9–11 · 2 people · $400 budget · **wheelchair-accessible campsite required**",
  "",
  "Plan: ferry → campsite → permit → gear",
  "",
  `Two agents run the same mission side by side, with the same planner model, booking desk and crash point:`,
  `- ${ARMS.dr.dot} **${ARMS.dr.name}**: ${ARMS.dr.blurb}`,
  `- ${ARMS.naive.dot} **${ARMS.naive.name}**: ${ARMS.naive.blurb}`,
].join("\n");

export function createMissionPort(actor: MissionActor, ops: DemoOps): AgUiMissionPort {
  return {
    async *handle(text: string) {
      const t = text.toLowerCase();
      if (/\bdetails?\b|\blog\b/.test(t)) { yield technicalLog(actor); return; }
      if (/\bscore/.test(t)) { yield scorecard(await collectResults(actor, ops)); return; }
      if (/\breset\b/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const w = (await ops.reset()) as { world_version?: number };
        yield `World reset (status page v${w?.world_version ?? 1}, all campsites open). Say **plan my Angel Island trip** to start a new take.`;
        return;
      }
      if (/\bkill\b|\bcrash\b/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled (DR_ENABLE_DEMO_CONTROLS)."; return; }
        const r = await actor.kill(/\ball\b/.test(t));
        if (!r.length) { yield "No paused agent to crash."; return; }
        const lines = r.map((k) => `${who(k.arm)} pid ${k.pid} killed (${k.signal}); still alive: ${k.alive_after ? "**yes**" : "no"}`);
        yield `💀 Crashed both agents with \`kill -9\`. Neither saved its ferry receipt.\n\n${lines.join("\n\n")}\n\n${ARMS.dr.dot} Dead Reckoning keeps nothing locally. ${ARMS.naive.dot} The ordinary agent still has its transcript file.\n\nNext: say **close site A** to change the world while they are down.`;
        return;
      }
      if (/close|storm|world/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const w = await ops.world({ site: "site-A", status: "closed", notice: "Storm damage" });
        yield `🌧 While both agents are down, the park closes **Site A** (storm damage), the accessible site they both picked. Status page is now v${w.world_version ?? "?"}.\n\nNeither agent is told. Each has to notice on its own. Say **resume** to bring them back.`;
        return;
      }
      if (/resume|restart|bring/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const ms = await actor.resume();
        if (!ms.length) { yield "Nothing to resume."; return; }
        yield `Restarting both agents (new processes: ${ms.map((m) => `${ARMS[m.arm].dot} pid ${m.pid}`).join(", ")}). Simulated clock +48 h.`;
        yield* streamUntil(actor, () => ms.every((m) => m.state !== "running"), 240_000);
        yield `\n\n${scorecard(await collectResults(actor, ops))}`;
        return;
      }
      if (/start|plan|trip|angel/.test(t)) {
        if (!ops.enabled) { yield "Demo controls are disabled."; return; }
        const arms: Arm[] = /\bdr only\b/.test(t) ? ["dr"] : ["dr", "naive"];
        const blocker = actor.startBlocker(arms);
        if (blocker) { yield `Cannot start: ${blocker}. Say **kill all** first, or wait for the verdicts.`; return; }
        // Every take starts from the v1 world (Site A open) so the later "close site A" edit is a real change.
        await ops.reset();
        const ms = await actor.start(arms, { crash: !/no crash/.test(t), statusUrl: await ops.statusUrl() });
        yield MISSION_HEADER;
        yield* streamUntil(actor, () => ms.every((m) => m.state !== "running"), 180_000);
        yield "\n\n**Both agents have paid for the ferry and are paused before recording it.** This is the most dangerous moment to crash: a restarted agent can't tell whether the payment went through. Say **kill** to crash them.";
        return;
      }
      yield statusMarkdown(actor);
    },
  };
}
