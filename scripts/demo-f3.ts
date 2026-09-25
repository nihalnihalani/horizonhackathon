// npm run demo:f3 [-- --arm=dr|naive|both] [--variant=f3|f3b]  (defaults: both, f3)
// Fixture F3 end to end against the REAL desk, control, RawTree, Nimble, Liquid and OpenAI:
//   start → ferry committed at the desk → HOLD → SIGKILL → assert 1 ferry + intent-without-receipt in RawTree →
//   sim clock +48h → operator closes Site A → resume (new pid, restore from RawTree only) → verdicts → assertions.
// --variant=f3b (npm run demo:f3b): Site C is ALSO closed while the runners are dead, so no accessible campsite remains
//   (Site B is open but inaccessible). DR must end BLOCKED (no_accessible_site_available), keep exactly 1 recovered
//   ferry, and book no campsite at all (never Site B). Naive: recorded honestly, not gated.
import { parseArgs } from "node:util";
import { decodeValue } from "@dr/shared";
import { rawTreeFromEnv } from "@dr/storage";
import { CTL, DESK, closingSql, ledger, missions, post, saveLast, say, sleep, waitMissions } from "./lib.ts";
import { VALIDATOR_RULES } from "@dr/runner";

const { values } = parseArgs({ options: { arm: { type: "string", default: "both" }, variant: { type: "string", default: "f3" } }, strict: false });
const arm = String(values.arm);
const variant = String(values.variant);
if (variant !== "f3" && variant !== "f3b") { console.error(`unknown --variant=${variant} (f3|f3b)`); process.exit(2); }
const F3B = variant === "f3b";
const { client, loader } = rawTreeFromEnv();
const checks: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => { checks.push({ name, ok, detail }); say(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };

for (const [n, u] of [["desk", `${DESK}/health`], ["control", `${CTL}/health`]]) {
  const r = await fetch(u!).catch(() => null);
  if (!r?.ok) { console.error(`${n} is not running at ${u} (start: npm run dev:desk / npm run dev:control)`); process.exit(2); }
}
say(F3B ? "== Dead Reckoning · fixture F3b (no accessible campsite left) · Angel Island Oct 9–11 · party 2 · $400 · wheelchair-accessible campsite required ==" : "== Dead Reckoning · fixture F3 · Angel Island Oct 9–11 · party 2 · $400 · wheelchair-accessible campsite required ==");
await post(`${CTL}/demo/reset`);
say("desk world reset to v1 (Site A open)");
const started = await post<{ started: { arm: string; run_id: string; pid: number }[]; status_url: string }>(`${CTL}/demo/start`, { arm, crash: true });
say(`status page observed via: ${started.status_url}`);
for (const s of started.started) say(`started ${s.arm} run ${s.run_id} pid ${s.pid} (crash armed after_desk_commit on ferry)`);
const runs = Object.fromEntries(started.started.map((s) => [s.arm, s.run_id])) as Record<string, string>;

const held = await waitMissions((ms) => ms.every((m) => m.state !== "running" && m.state !== "starting"), 180_000);
for (const m of held) say(`[${m.arm}] ${m.hold_line ?? `state ${m.state}`}`);
check("every runner reached HOLD after desk commit", held.every((m) => m.state === "holding"));

const killed = await post<{ killed: { arm: string; pid: number; signal: string; alive_after: boolean }[] }>(`${CTL}/demo/kill`);
for (const k of killed.killed) say(`[${k.arm}] kill -9 ${k.pid} → signal ${k.signal} · process alive after: ${k.alive_after}`);
check("SIGKILL delivered, old pids gone", killed.killed.length === held.length && killed.killed.every((k) => k.signal === "SIGKILL" && !k.alive_after));
const oldPids = Object.fromEntries(killed.killed.map((k) => [k.arm, k.pid]));

if (runs.dr) {
  const l = await ledger(runs.dr, "dr");
  const ferries = l.outcomes.filter((o) => o.slot === "ferry" && o.committed);
  check("[dr] desk ledger after kill: exactly one committed ferry", ferries.length === 1, ferries.map((f) => f.receipt_id).join(","));
  await sleep(1500);
  const p = await loader.load(runs.dr);
  const intent = Object.values(p.commitments).find((c) => c.slot === "ferry");
  const rc = Object.values(p.receipts).filter((r) => r.slot === "ferry");
  check("[dr] RawTree after kill: ferry intent without receipt (the orphan)", intent?.status === "intent" && rc.length === 0, `commitment ${intent?.status ?? "none"} · receipts ${rc.length}`);
}

say("sim_clock +48h SIMULATED (2026-10-08 09:00 → 2026-10-10 09:00 PT)");
const w = await post<{ world_version: number }>(`${CTL}/demo/world`, { site: "site-A", status: "closed", notice: "Storm damage" });
say(`operator edits the live status page while the runners are dead: Site A → CLOSED (Storm damage) · world v${w.world_version}`);
if (F3B) {
  const w2 = await post<{ world_version: number }>(`${CTL}/demo/world`, { site: "site-C", status: "closed", notice: "Flooded access road" });
  say(`F3b: operator also closes Site C → CLOSED (Flooded access road) · world v${w2.world_version} · Site B stays open but is NOT accessible → no valid campsite`);
}

const resumed = await post<{ resumed: { arm: string; pid: number; generation: number }[] }>(`${CTL}/demo/resume`, {});
for (const r of resumed.resumed) say(`[${r.arm}] resumed: new pid ${r.pid} (was ${oldPids[r.arm]}) · generation ${r.generation} · ${r.arm === "dr" ? "zero local state: restores from RawTree via control" : "reloads its local transcript.json (no reconcile, no revalidation)"}`);
check("resume uses new pids", resumed.resumed.every((r) => r.pid !== oldPids[r.arm]));

const done = await waitMissions((ms) => ms.every((m) => m.state === "done" || m.state === "failed"), 300_000);
await sleep(2000);
for (const m of done) say(`[${m.arm}] VERDICT ${m.verdict?.verdict ?? "none"} — ${m.verdict?.reason ?? m.state}`);

// ---------------- DR assertions (F3b)
if (runs.dr && F3B) {
  const d = done.find((m) => m.arm === "dr")!;
  const reason = String(d.verdict?.reason ?? "");
  check("[dr] verdict BLOCKED", d.verdict?.verdict === "BLOCKED", reason);
  check("[dr] BLOCKED reason is precise: campsite blocked, no_accessible_site_available, accessible=true", /campsite: blocked/.test(reason) && reason.includes("no_accessible_site_available") && reason.includes("accessible=true") && reason.includes("site-B: not_accessible"), reason);
  const l = await ledger(runs.dr, "dr");
  const ferries = l.outcomes.filter((o) => o.slot === "ferry" && o.committed);
  check("[dr] desk ledger: still exactly 1 ferry (no duplicate)", ferries.length === 1, ferries.map((f) => f.receipt_id).join(","));
  const p = await loader.load(runs.dr);
  const ferryRc = Object.values(p.receipts).filter((r) => r.slot === "ferry");
  check("[dr] ferry receipt recovered=true (RECOVERED FROM DESK)", ferryRc.length === 1 && ferryRc[0]!.recovered === true && ferryRc[0]!.receipt_id === ferries[0]?.receipt_id, ferryRc.map((r) => `${r.receipt_id} recovered=${r.recovered}`).join(","));
  const deskCamp = l.outcomes.filter((o) => o.slot === "campsite");
  check("[dr] no campsite booking attempted at the desk (never Site B)", deskCamp.length === 0 && !l.outcomes.some((o) => o.resource === "site-B"), deskCamp.map((o) => `${o.resource}:${o.outcome}`).join(",") || "none");
  const cs = p.plan_steps.campsite;
  check("[dr] plan_steps campsite = blocked with the code-filter reason", cs?.status === "blocked" && String(cs.reason ?? "").startsWith("no_accessible_site_available"), `${cs?.status}: ${cs?.reason ?? ""}`);
  const sup = await client.query(`SELECT key, status, superseded_by FROM facts WHERE run_id = '${runs.dr}' AND status = 'superseded'`);
  check("[dr] site-A.status and site-C.status superseded (revalidated after resume)", sup.some((r) => r.key === "site-A.status") && sup.some((r) => r.key === "site-C.status"), sup.map((r) => `${r.key} by task ${r.superseded_by}`).join(","));
  const obs = await client.query(`SELECT * FROM facts WHERE run_id = '${runs.dr}' AND key = 'site-A.status' AND status = 'active'`);
  const viaNimble = (o: Record<string, unknown>) => !!o.nimble_request_id && !String(o.nimble_request_id).startsWith("direct-");
  for (const o of obs) say(`  site-A.status observation: ${viaNimble(o) ? "Nimble task" : "FALLBACK direct fetch (NOT Nimble)"} ${o.nimble_request_id} · world v${o.world_version}`);
  check("[dr] both site-A observations retrieved via Nimble (not direct fallback)", obs.length >= 2 && obs.every(viaNimble), obs.map((o) => String(o.nimble_request_id)).join(","));
  const steps = Object.values(p.plan_steps).map((s) => `${s.step_id}:${s.status}`).join(" ");
  say(`  DR plan: ${steps} · committed at desk: ${l.outcomes.filter((o) => o.committed).map((o) => o.resource).join(", ")}`);
}
// ---------------- DR assertions (F3)
if (runs.dr && !F3B) {
  const d = done.find((m) => m.arm === "dr")!;
  check("[dr] verdict VALID", d.verdict?.verdict === "VALID", d.verdict?.reason);
  const l = await ledger(runs.dr, "dr");
  const ferries = l.outcomes.filter((o) => o.slot === "ferry" && o.committed);
  check("[dr] desk ledger: still exactly 1 ferry (no duplicate)", ferries.length === 1, ferries.map((f) => f.receipt_id).join(","));
  const p = await loader.load(runs.dr);
  const ferryRc = Object.values(p.receipts).filter((r) => r.slot === "ferry");
  check("[dr] ferry receipt recovered=true (RECOVERED FROM DESK)", ferryRc.length === 1 && ferryRc[0]!.recovered === true && ferryRc[0]!.receipt_id === ferries[0]?.receipt_id, ferryRc.map((r) => `${r.receipt_id} recovered=${r.recovered}`).join(","));
  const sup = await client.query(`SELECT key, status, superseded_by FROM facts WHERE run_id = '${runs.dr}' AND status = 'superseded'`);
  check("[dr] site-A.status superseded (Liquid curator, validator-accepted)", sup.some((r) => r.key === "site-A.status"), sup.map((r) => `${r.key} by task ${r.superseded_by}`).join(","));
  const cmp = await client.query(`SELECT * FROM context_ops WHERE run_id = '${runs.dr}' AND op = 'compare' AND key = 'site-A.status'`);
  for (const c of cmp) say(`  Liquid compare ${c.key}: decision ${c.decision}${c.promoted_by ? ` (promoted_by ${c.promoted_by})` : ""} accepted ${c.accepted} curator_ms ${c.curator_ms}`);
  const obs = await client.query(`SELECT * FROM facts WHERE run_id = '${runs.dr}' AND key = 'site-A.status' AND status = 'active'`);
  const viaNimble = (o: Record<string, unknown>) => !!o.nimble_request_id && !String(o.nimble_request_id).startsWith("direct-");
  for (const o of obs) say(`  site-A.status observation: ${viaNimble(o) ? "Nimble task" : "FALLBACK direct fetch (NOT Nimble)"} ${o.nimble_request_id} · world v${o.world_version}`);
  check("[dr] both site-A observations retrieved via Nimble (not direct fallback)", obs.length >= 2 && obs.every(viaNimble), obs.map((o) => String(o.nimble_request_id)).join(","));
  const camp = Object.values(p.receipts).filter((r) => r.slot === "campsite" && r.outcome === "committed");
  check("[dr] campsite repaired to site-C (accessible), not B (inaccessible) or A (closed)", camp.length === 1 && camp[0]!.resource === "site-C", camp.map((r) => r.resource).join(","));
  const steps = Object.values(p.plan_steps).map((s) => `${s.step_id}:${s.status}`).join(" ");
  say(`  DR plan: ${steps} · facts site-A.status = ${String(decodeValue(p.facts["site-A.status"]?.value ?? '""'))}`);
}
// ---------------- naive (honest outcome; the checks below describe what it did, they do not gate DR)
if (runs.naive) {
  const n = done.find((m) => m.arm === "naive")!;
  const l = await ledger(runs.naive, "naive");
  const ferries = l.outcomes.filter((o) => o.slot === "ferry" && o.committed);
  const closed = l.outcomes.filter((o) => o.reject_reason === "closed");
  say(`[naive] desk ledger: ${ferries.length} committed ferries (${ferries.map((f) => f.receipt_id).join(", ")}) · ${closed.length} booking(s) rejected as closed (${closed.map((c) => c.resource).join(",")})`);
  // Append-only transcript ablation (VALIDATION §6): recorded, never a pass/fail gate, so DR's result never depends on it failing.
  say(`[naive] ablation outcome recorded: verdict ${n.verdict?.verdict ?? "none"} — ${n.verdict?.reason ?? ""} · ${ferries.length} committed ferries · tried closed site ${closed.length}x (desk rejected) · duplicate_effects ${n.verdict?.duplicate_effects} · stale_actions ${n.verdict?.stale_actions}`);
  say(`  shared code validator rules: ${VALIDATOR_RULES.join(" | ")}`);
}

if (runs.naive && F3B) {
  const l = await ledger(runs.naive, "naive");
  const camp = l.outcomes.filter((o) => o.slot === "campsite");
  say(`[naive] F3b campsite attempts at the desk: ${camp.map((o) => `${o.resource}:${o.outcome}${o.reject_reason ? `(${o.reject_reason})` : ""}`).join(", ") || "none"}`);
}
if (runs.dr && runs.naive) {
  say(`run_ids: dr ${runs.dr} · naive ${runs.naive} · variant ${variant}`);
  if (!F3B) saveLast({ dr_run: runs.dr, naive_run: runs.naive }); // demo:numbers stays on the F3 demo pair
  await sleep(1000);
  const q = closingSql(runs.dr, runs.naive);
  say("per-step planner context tokens (live RawTree query):");
  console.table(await client.query(q[2]!));
  say("per-arm totals (live RawTree query):");
  console.table(await client.query(q[0]!));
  say("Liquid curator latency (live RawTree query):");
  console.table(await client.query(q[1]!));
}
const failed = checks.filter((c) => !c.ok);
say(`${checks.length - failed.length}/${checks.length} checks passed${failed.length ? ` · FAILED: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
