// Chat narration for the AG-UI stream: turns the runners' typed events into short, readable lines.
// Dead Reckoning is 🔵 and the transcript-resume baseline ("Ordinary agent") is 🟠 everywhere.
// The raw technical log is still available through the `details` verb (see mission-port.ts).
import type { Arm, SseEnvelope } from "@dr/shared";

export const ARMS: Record<Arm, { dot: string; name: string; blurb: string }> = {
  dr: { dot: "🔵", name: "Dead Reckoning", blurb: "keeps its state in RawTree, re-checks stale facts with Nimble, local Liquid curator trims memory" },
  naive: { dot: "🟠", name: "Ordinary agent", blurb: "resumes from its own chat transcript, the way most agents do today" },
};
export const who = (arm: Arm) => `${ARMS[arm].dot} **${ARMS[arm].name}**`;

const SITE_ACCESSIBLE: Record<string, boolean> = { "site-A": true, "site-B": false, "site-C": true };

export function resourceName(r: string | null | undefined): string {
  if (!r) return "?";
  if (r.startsWith("ferry")) return "the ferry (Tiburon → Angel Island, Oct 9)";
  const m = /^site-([A-Z])$/.exec(r);
  if (m) return `Site ${m[1]}`;
  if (r === "permit") return "the camping permit";
  if (r === "gear") return "the gear rental";
  return r;
}
const shortName = (r: string) => resourceName(r).replace(/^the /, "").replace(/ \(.*\)$/, "");
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const shortId = (id: unknown) => String(id ?? "").replace(/^rcpt-/, "").slice(0, 8);

function siteLine(sites: Record<string, { status?: string; accessible?: boolean; notice?: string }> | undefined): string {
  if (!sites) return "";
  return Object.entries(sites)
    .map(([k, s]) => {
      const name = `Site ${k.replace(/^site/, "")}`;
      const st = s.status === "closed" ? `**closed**${s.notice ? ` (${s.notice})` : ""}` : String(s.status ?? "?");
      return `${name} ${st}, ${s.accessible ? "accessible" : "not accessible"}`;
    })
    .join(" · ");
}

function rejectWhy(reason: string): string {
  if (reason === "not_accessible") return "not wheelchair accessible";
  if (reason === "closed") return "closed";
  if (/budget/.test(reason)) return "over budget";
  return reason.replace(/_/g, " ");
}

/** Plain-ish rendering of a validator or block reason. */
export function explainReason(reason: string): string {
  const dup = /(\d+) distinct committed (\w+) receipts/.exec(reason);
  if (dup) return `paid for ${dup[2] === "ferry" ? "the ferry" : dup[2]} ${dup[1]} times (duplicate charge)`;
  const noSite = /^no_accessible_site_available: .*?\(([^)]*)\)/.exec(reason);
  if (noSite) {
    const parts = noSite[1]!.split(",").map((s) => s.trim().replace(/^site-([A-Z]): /, "Site $1 ").replace("not_accessible", "not accessible"));
    return `no open, wheelchair-accessible campsite is left (${parts.join(", ")})`;
  }
  const valid = /all (\d+) steps done; total \$([\d.]+) <= \$([\d.]+)/.exec(reason);
  if (valid) return `all ${valid[1]} steps booked · $${Number(valid[2]).toFixed(0)} of $${Number(valid[3]).toFixed(0)} budget · one receipt per booking`;
  return reason;
}

function factName(key: string): string {
  if (key === "real.ferry") return "real ferry schedule";
  if (key === "real.park") return "real park notices";
  return key.replace(/^site-([A-Z])\.status$/, "Site $1 status");
}

function evictedName(id: string): string {
  const f = /^fact:site-([A-Z])\.status@/.exec(id);
  if (f) return `the pre-outage Site ${f[1]} status`;
  if (id.startsWith("obs:")) return "the pre-outage page snapshot";
  return id;
}

type Ev = Record<string, any>;

/** Stateful per chat turn: remembers each arm's latest planner context size to attach it to the booking line. */
export class Narrator {
  private tokens: Partial<Record<Arm, number>> = {};

  line(e: SseEnvelope): string | null {
    const arm = e.arm;
    const d = (e.data ?? {}) as Ev;
    if (e.type === "log") {
      const l = String(d.line ?? "");
      if (/RUNNER ERROR|hold expired|FALLBACK/.test(l)) return `${arm ? who(arm) : "control"} ⚠ ${l}`;
      return null;
    }
    if (e.type !== "worker" || !arm) return null;
    if (d.state === "holding") {
      const rc = /receipt_id=(\S+)/.exec(String(d.line ?? ""))?.[1];
      return arm === "dr"
        ? `${who(arm)} ⏸ Ferry paid (receipt ${shortId(rc)}). Paused **before** the receipt is written to RawTree: the crash point.`
        : `${who(arm)} ⏸ Ferry paid (receipt ${shortId(rc)}). Paused before it saves this to its transcript.`;
    }
    switch (d.kind) {
      case "recovered": {
        if (Number(d.epoch) <= 1) return null;
        if (d.naive) {
          return `${who(arm)} Back online. Reloads its chat transcript (${Math.max(0, Number(d.transcript_lines) - 1)} lines) and carries on: no log restore, no check with the booking desk, no re-read of the park page.`;
        }
        const out = [`${who(arm)} Back online with **no local state**. Rebuilt its memory from the RawTree log: ${d.restored_rows} records.`];
        for (const r of (d.reconciled ?? []) as Ev[]) {
          const what = resourceName(r.slot === "ferry" ? "ferry" : r.slot);
          if (r.result === "recovered") out.push(`${who(arm)} Found an unfinished booking in the log: an intent for ${what}, with no receipt. Asked the booking desk by its idempotency key: **already paid**. Receipt ${shortId(r.receipt_id)} recovered, so it does not book again.`);
          else if (r.result === "not_executed") out.push(`${who(arm)} Unfinished booking for ${what}: the desk has no record, so it is safe to retry with the same key.`);
          else if (r.result === "unknown") out.push(`${who(arm)} Unfinished booking for ${what}: the desk is unreachable, so that step is blocked rather than guessed.`);
          else if (r.result === "confirmed_from_projection") out.push(`${who(arm)} ${what}: receipt already in the log, marked done.`);
        }
        const stale = (d.stale ?? []) as string[];
        if (stale.length) out.push(`${who(arm)} Marked ${stale.length} facts **stale**, because they were observed before the outage: ${stale.map(factName).join(", ")}.`);
        return out.join("\n\n");
      }
      case "real_source": {
        if (!d.ok) return `${who(arm)} 🌐 Couldn't read the real ${d.label} page (${d.error}); continuing without it.`;
        const secs = (Number(d.nimble_ms) / 1000).toFixed(1);
        if (d.mode === "first" || d.first) return `${who(arm)} 🌐 Real web via Nimble: **${d.label}** (${d.title}, ${secs} s): ${d.summary}.`;
        return d.changed
          ? `${who(arm)} 🌐 Re-checked the real **${d.label}** page after the outage: **changed**. Now: ${d.summary}. Before: ${d.before}.`
          : `${who(arm)} 🌐 Re-checked the real **${d.label}** page after the outage: unchanged (${d.summary}).`;
      }
      case "real_gate":
        return d.ok
          ? `${who(arm)} 🌐 Checked the real ferry schedule before booking: ${d.reason}.`
          : `${who(arm)} ⛔ Ferry not booked: ${d.reason}.`;
      case "observation": {
        if (arm !== "dr") return null; // the ordinary agent never re-reads after the crash; its first read adds nothing here
        const src = d.retrieval_mode === "direct" ? "a direct fetch (fallback, not Nimble)" : `Nimble (${d.parse_mode === "nimble" ? "parsed server-side" : "parsed locally from Nimble's HTML"}, ${(Number(d.nimble_ms) / 1000).toFixed(1)} s)`;
        return `${who(arm)} Read the park status page via ${src}: ${siteLine(d.sites)}.`;
      }
      case "curator": {
        const key = String(d.key).replace(/^site-([A-Z])\.status$/, "Site $1");
        if (!d.accepted) return `${who(arm)} Liquid curator proposed "${d.decision}" for ${key}; the code validator **rejected** it, so nothing changed.`;
        if (d.decision === "superseded") return `${who(arm)} Liquid curator (local LFM2.5-1.2B, ${d.curator_ms} ms): **${key} ${d.old} → ${d.new}**. The old fact is superseded; the code validator agreed.`;
        return `${who(arm)} Liquid curator: ${key} unchanged (${d.new}).`;
      }
      case "context_ops": {
        const acc = (d.accepted ?? []) as string[];
        if (!acc.length) return `${who(arm)} Liquid kept every item in working memory this step.`;
        return `${who(arm)} Liquid trimmed working memory: dropped ${acc.map(evictedName).join(" and ")} · ${d.items_before} → ${d.items_after} items · ${d.tokens_before} → ${d.tokens_after} tokens.`;
      }
      case "step": {
        if (d.status === "needs_repair") return `${who(arm)} The campsite plan relied on the old Site A status, so it re-plans **only the campsite**. The ferry booking stays.`;
        if (d.status === "blocked") return `${who(arm)} ⛔ ${String(d.step_id)} step blocked: ${explainReason(String(d.reason ?? ""))}.`;
        return null;
      }
      case "planner": {
        this.tokens[arm] = Number(d.context_tokens);
        const rej = ((d.rejected ?? []) as Ev[]).filter((r) => /^site-/.test(String(r.resource)));
        if (d.action !== "book") return `${who(arm)} Planner (GPT-5.5) chose to ${d.action}: ${d.reason}`;
        if (arm === "dr" && rej.length) {
          return `${who(arm)} Planner (GPT-5.5) chose **${resourceName(d.resource)}**. Ruled out in code: ${rej.map((r) => `${resourceName(r.resource)} (${rejectWhy(String(r.reason))})`).join(", ")}.`;
        }
        return null; // folded into the booking line
      }
      case "booking": {
        const ctx = this.tokens[arm] ? ` · planner context ${this.tokens[arm]} tokens` : "";
        const name = resourceName(d.resource);
        if (d.outcome === "committed") {
          if (arm === "naive" && Number(d.epoch) >= 2 && String(d.resource).startsWith("ferry")) {
            return `${who(arm)} ⚠ Booked the ferry **again**: ${money(Number(d.amount))}. That is a second ticket; the first was paid before the crash${ctx}.`;
          }
          return `${who(arm)} ✓ Booked ${name}: ${money(Number(d.amount))}${ctx}.`;
        }
        const why = d.reject_reason === "closed" ? "closed" : String(d.reject_reason ?? "rejected");
        const belief = arm === "naive" && why === "closed" ? " (it still believes the site is open)" : "";
        return `${who(arm)} ✗ Tried to book ${name}${belief}. The desk rejected it: **${why}**${ctx}.`;
      }
      case "verdict": {
        const v = String(d.verdict);
        const icon = v === "VALID" ? "✅" : v === "BLOCKED" ? "⛔" : "❌";
        const label = v === "VALID" ? "Trip valid" : v === "BLOCKED" ? "Blocked (nothing booked that breaks the rules)" : "Trip invalid";
        return `${who(arm)} ${icon} **${label}**: ${explainReason(String(d.reason))}.`;
      }
      default:
        return null;
    }
  }
}

// ---------------------------------------------------------------- scorecard

export type LedgerOutcome = { slot: string; resource: string; outcome: string; reject_reason: string | null; amount: number; committed: boolean; cancelled?: boolean };
export type ArmResult = {
  arm: Arm;
  run_id: string;
  verdict?: { verdict: string; reason: string; duplicate_effects: number; stale_actions: number } | null;
  ledger: LedgerOutcome[] | null;
  tokens: number[];
  /** Real websites re-read after the restart (read-only; they rarely change on cue). */
  realChecks?: { checked: number; changed: number; labels: string[] };
};

function campsiteCell(r: ArmResult): string {
  const l = r.ledger ?? [];
  const ok = l.filter((o) => o.slot === "campsite" && o.committed && !o.cancelled);
  const bad = l.filter((o) => o.slot === "campsite" && !o.committed);
  const parts = ok.map((o) => `${resourceName(o.resource)} (${SITE_ACCESSIBLE[o.resource] ? "accessible" : "**not accessible**"})`);
  if (bad.length) parts.push(`tried ${bad.map((o) => `${resourceName(o.resource)}, rejected: ${o.reject_reason}`).join("; ")}`);
  return parts.length ? parts.join(" · ") : "none booked";
}

export function scorecard(results: ArmResult[]): string {
  const cols = results.map((r) => `${ARMS[r.arm].dot} ${ARMS[r.arm].name}`);
  const row = (label: string, f: (r: ArmResult) => string) => `| ${label} | ${results.map(f).join(" | ")} |`;
  const ferries = (r: ArmResult) => {
    if (!r.ledger) return "?";
    const n = r.ledger.filter((o) => o.slot === "ferry" && o.committed && !o.cancelled).length;
    return n > 1 ? `**${n}** (charged twice)` : String(n);
  };
  const total = (r: ArmResult) => (r.ledger ? money(r.ledger.filter((o) => o.committed && !o.cancelled).reduce((a, o) => a + o.amount, 0)) : "?");
  const stale = (r: ArmResult) => (r.ledger ? String(r.ledger.filter((o) => !o.committed && (o.reject_reason === "closed" || o.reject_reason === "stale_version")).length) : "?");
  const verdict = (r: ArmResult) => {
    const v = r.verdict?.verdict ?? "…";
    return v === "VALID" ? "✅ VALID" : v === "BLOCKED" ? "⛔ BLOCKED" : v === "INVALID" ? "❌ INVALID" : v;
  };
  const toks = (r: ArmResult) => (r.tokens.length ? r.tokens.join(" → ") : "–");
  const real = (r: ArmResult) => {
    const c = r.realChecks;
    if (!c || !c.checked) return "none";
    return `${c.checked} (${c.labels.join(", ")}): ${c.changed ? `**${c.changed} changed**` : "unchanged"}`;
  };
  return [
    "### Scorecard",
    "",
    `| | ${cols.join(" | ")} |`,
    `|---|${results.map(() => "---").join("|")}|`,
    row("Verdict", verdict),
    row("Ferry tickets paid (desk ledger)", ferries),
    row("Campsite", campsiteCell),
    row("Bookings made on stale info", stale),
    row("Real websites re-checked after restart", real),
    row("Total charged", total),
    row("Planner context per step (tokens)", toks),
    "",
    "_Counts come from the booking desk's own ledger, not from the agents. Say **details** for the technical log or **status** for receipts._",
  ].join("\n");
}
