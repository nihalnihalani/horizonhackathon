// Runner child (spawned by control's supervisor with the RUNNER_ENV_ALLOWLIST env only).
//   DR arm:    recovery 1–4 (kernel) → revalidate stale deps (Nimble → Liquid → validator) → repair via planner
//              → write-ahead execution → per-step metrics → terminal code validator.
//   naive arm (--resume=transcript): reloads its local transcript, no reconcile, no revalidation, attempt-derived
//              action keys, transcript appended to the planner input (tokens grow). Same planner, same desk.
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import {
  F3, REPO_ROOT, decodeValue, encodeValue, loadConfig, resourceById,
  type FactRow, type Projection, type Slot,
} from "@dr/shared";
import { HttpDeskClient, Journal, NaiveTranscript, executeBooking, recover, type BookingStep, type Transcript } from "@dr/kernel";
import {
  applyContextOps, compareOpRow, constraintsFromProjection, contextOpRows, createProviders, factsFromObservation,
  renderWorkingContext, siteMap, spentCents, type CandidateX, type EvidenceItem, type NimbleObservation, type PlannerContext,
} from "@dr/providers";
import { emptyProjection } from "@dr/storage";
import { HttpProjectionLoader, HttpRowSink, emit, httpIntentGate } from "./io.ts";
import { noCandidateReason, validateRun } from "./validator.ts";

const { values: argv } = parseArgs({
  options: { "status-url": { type: "string" }, "sim-clock": { type: "string" }, resume: { type: "string" }, transcript: { type: "string" } },
  strict: false,
});
const cfg = loadConfig("runner"); // never reads .env from disk
const runId = cfg.DR_RUN_ID;
const arm = cfg.DR_ARM;
const link = { baseUrl: cfg.DR_CONTROL_URL.replace(/\/$/, ""), token: cfg.DR_RUNNER_TOKEN };
const sink = new HttpRowSink(link);
const loader = new HttpProjectionLoader(link);
const verdictLoader = new HttpProjectionLoader(link, "verdict");
const desk = new HttpDeskClient({ baseUrl: cfg.DR_WORLD_BASE_URL, token: cfg.DR_WORLD_TOKEN, ns: { run_id: runId, arm } });
// Pass a copy of the env so the providers scope never falls back to reading .env from disk.
const prov = createProviders({ ...process.env }, { directFallback: true });
const statusUrl = String(argv["status-url"] ?? "http://127.0.0.1:4402/status.html");
const simClock = String(argv["sim-clock"] ?? F3.sim_clock);
const crash = cfg.DR_CRASH_AFTER === "after_desk_commit";
const log = (l: string) => console.log(l);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SITES = ["A", "B", "C"] as const;
// HOLD after the desk commit waits for the presenter's kill. 10 min default so narration/questions cannot expire it
// (the story is lost if the hold expires); override with DR_HOLD_MS (non-secret passthrough).
const HOLD_MS = Number(process.env.DR_HOLD_MS) > 0 ? Number(process.env.DR_HOLD_MS) : 600_000;
type StepMetrics = { curator_ms: number; nimble_ms: number };

function stepFor(step_id: string, resource: string, wv: number): BookingStep {
  const r = resourceById(resource);
  return { step_id, slot: r.slot, resource: r.id, date: r.date, party: F3.trip.party, expected_world_version: wv };
}
function fixedCandidate(resource: string): CandidateX {
  const r = resourceById(resource);
  return { resource: r.id, slot: r.slot, price_cents: r.price_cents, accessible: r.accessible, status: r.status, date: r.date };
}
type SiteView = { status: "open" | "closed"; accessible: boolean; price_cents: number };
function campsiteCandidates(view: Record<string, SiteView>): CandidateX[] {
  return SITES.map((s) => {
    const v = view[`site${s}`]!;
    return { resource: `site-${s}`, slot: "campsite" as Slot, price_cents: v.price_cents, accessible: v.accessible, status: v.status, date: resourceById(`site-${s}`).date };
  });
}
const factVal = (p: Projection, key: string): unknown => { const f = p.facts[key]; return f ? decodeValue(f.value) : undefined; };
function viewFromFacts(p: Projection): Record<string, SiteView> {
  const out: Record<string, SiteView> = {};
  for (const s of SITES) {
    const st = p.facts[`site-${s}.status`];
    // a stale or missing status is unverified — never treated as open
    const status = st && st.status === "active" ? (factVal(p, `site-${s}.status`) as "open" | "closed") : "closed";
    out[`site${s}`] = { status, accessible: factVal(p, `site-${s}.accessible`) === true, price_cents: resourceById(`site-${s}`).price_cents };
  }
  return out;
}

async function observe(): Promise<NimbleObservation> {
  const host = new URL(statusUrl).host;
  const health = await prov.sensor.health(host);
  const wv = await desk.worldVersion();
  const obs = await prov.sensor.extractStatusPage(statusUrl, { expectedWorldVersion: wv });
  const label = obs.retrieval_mode === "direct" ? "FALLBACK direct fetch (NOT Nimble)" : `Nimble extract task_id=${obs.task_id}`;
  log(`OBSERVE ${label} · parse ${obs.parse_mode} · world v${obs.world_version} · ${obs.nimble_ms} ms · domain-health ${health.status}`);
  const sites = siteMap(obs.fields);
  emit("observation", { task_id: obs.task_id, retrieval_mode: obs.retrieval_mode, parse_mode: obs.parse_mode, world_version: obs.world_version, nimble_ms: obs.nimble_ms, health: health.status, sites });
  return obs;
}

function factBody(f: FactRow) {
  return {
    key: f.key, value: f.value, source_url: f.source_url ?? null, observed_at: f.observed_at, valid_until: f.valid_until ?? null,
    volatile: f.volatile, trust: f.trust ?? null, status: f.status, superseded_by: f.superseded_by ?? null, excerpt: f.excerpt ?? null,
    nimble_request_id: f.nimble_request_id ?? null, world_version: f.world_version ?? null,
  };
}

async function blockStep(j: Journal, step_id: string, reason: string) {
  const s = j.state.plan_steps[step_id];
  const p = F3.plan.find((x) => x.step_id === step_id)!;
  await j.append("plan_steps", { step_id, slot: p.slot, resource: s?.resource ?? p.resource, depends_on: s?.depends_on ?? p.depends_on, commitment_key: s?.commitment_key ?? null, status: "blocked", reason });
  log(`STEP ${step_id} BLOCKED: ${reason}`);
  emit("step", { step_id, status: "blocked", reason });
}

async function seedRun(j: Journal) {
  for (const c of F3.constraints) await j.append("constraints", { key: c.key, value: encodeValue(c.value), authority: "user", private: false, version: 1 });
  for (const s of F3.plan) {
    await j.append("plan_steps", { step_id: s.step_id, slot: s.slot, resource: s.resource, depends_on: s.depends_on, commitment_key: null, status: "pending", reason: "initial plan" });
  }
}

async function terminal(j: Journal) {
  await sleep(1500); // RawTree visibility window (~0.6 s live)
  const p = await verdictLoader.load(runId);
  // this epoch's acked rows are authoritative even if RawTree has not surfaced them yet
  for (const t of ["commitments", "receipts", "plan_steps", "facts"] as const) Object.assign(p[t], j.state[t]);
  const v = await validateRun(p, desk);
  await j.append("metrics", { step: "verdict", phase: "verdict", context_tokens: 0, planner_tokens_in: 0, curator_ms: 0, nimble_ms: 0, duplicate_effects: v.duplicate_effects, stale_actions: 0 }); // stale actions are counted on the per-step desk rows
  await j.append("epochs", { reason: "terminal", restored_rows: 0, sim_clock: simClock, pid: process.pid, verdict: v.verdict, verdict_reason: v.reason });
  log(`VERDICT ${v.verdict} (${arm}): ${v.reason} · duplicate_effects ${v.duplicate_effects} · stale_actions ${v.stale_actions} · total $${(v.total_cents / 100).toFixed(2)}`);
  emit("verdict", { ...v });
}

// ---------------------------------------------------------------- DR arm
async function runDr() {
  const rec = await recover({ loader, sink, desk, run_id: runId, arm, sim_clock: simClock, log });
  const j = rec.journal;
  emit("recovered", { epoch: rec.epoch, restored_rows: rec.restored_rows, reconciled: rec.reconciled, stale: rec.stale, blocked: rec.blocked_steps, pid: process.pid });
  if (Object.keys(j.state.constraints).length === 0) {
    await seedRun(j);
    const obs = await observe();
    for (const f of factsFromObservation(obs)) await j.append("facts", f);
  }
  let epochObs: NimbleObservation | null = null;
  let evicted: string[] = [];

  async function revalidate(step_id: string, keys: string[], m: StepMetrics): Promise<{ ok: true; superseded: string[]; evidence: EvidenceItem[] } | { ok: false; reason: string }> {
    if (!epochObs) {
      try { epochObs = await observe(); m.nimble_ms += epochObs.nimble_ms; } catch (e) {
        return { ok: false, reason: `source_unverified: ${(e as Error).message}` };
      }
    }
    const obs = epochObs;
    const fresh = new Map(factsFromObservation(obs).map((f) => [f.key, f]));
    const superseded: string[] = [];
    const evidence: EvidenceItem[] = [];
    for (const key of keys) {
      const old = j.state.facts[key]!;
      const nf = fresh.get(key);
      if (!nf) return { ok: false, reason: `observation lacks ${key}` };
      const newVal = decodeValue(nf.value);
      let r;
      try { r = await prov.curator.compareFact(old, { key, value: newVal, observed_at: obs.fetched_at, task_id: obs.task_id }); } catch (e) {
        return { ok: false, reason: `curator_unavailable: ${(e as Error).message}` };
      }
      m.curator_ms += r.curator_ms;
      await j.append("context_ops", compareOpRow(step_id, r));
      await j.append("metrics", { step: step_id, phase: "curator", context_tokens: 0, planner_tokens_in: 0, curator_ms: r.curator_ms, nimble_ms: 0, duplicate_effects: 0, stale_actions: 0 });
      log(`LIQUID curator ${key}: ${JSON.stringify(decodeValue(old.value))} (observed ${old.observed_at}, world v${old.world_version ?? "?"}) vs ${JSON.stringify(newVal)} (world v${obs.world_version} task ${obs.task_id}) → decision ${r.decision}${r.promoted_by ? " (promoted_by validator)" : ""} · model ${r.model_decision ?? "?"} · accepted ${r.accepted} · curator_ms ${r.curator_ms}`);
      emit("curator", { key, old: decodeValue(old.value), new: newVal, decision: r.decision, model_decision: r.model_decision ?? null, promoted_by: r.promoted_by ?? null, accepted: r.accepted, curator_ms: r.curator_ms, task_id: obs.task_id });
      if (!r.accepted) return { ok: false, reason: `curator_rejected: ${r.reject_reason ?? "?"}` };
      if (r.decision === "superseded") {
        await j.append("facts", { ...factBody(old), status: "superseded", superseded_by: obs.task_id, excerpt: `superseded by ${JSON.stringify(newVal)} (Liquid ${r.decision}${r.promoted_by ? ", promoted by validator" : ""}; task ${obs.task_id})` });
        await j.append("facts", nf);
        superseded.push(key);
        evidence.push(
          { id: `fact:${key}@v${old.world_version ?? 0}`, text: `SUPERSEDED evidence, no longer true: ${key} was ${JSON.stringify(decodeValue(old.value))} at world v${old.world_version ?? "?"} (observed ${old.observed_at}); replaced by ${JSON.stringify(newVal)} (task ${obs.task_id})` },
          { id: `obs:${old.nimble_request_id ?? `v${old.world_version ?? 0}`}`, text: `raw observation stub from before the outage (world v${old.world_version ?? "?"}); superseded by task ${obs.task_id}; no longer needed for the current step` },
        );
      } else if (r.decision === "unchanged") {
        await j.append("facts", nf); // revalidated: active with the new observed_at
      } else {
        return { ok: false, reason: `curator conflict on ${key}` };
      }
    }
    // non-volatile companions (accessibility) from the same task, so candidates are built from one observation
    for (const s of SITES) {
      const k = `site-${s}.accessible`;
      const nf = fresh.get(k);
      if (nf && j.state.facts[k]?.value !== nf.value) await j.append("facts", nf);
    }
    return { ok: true, superseded, evidence };
  }

  for (const ps of F3.plan) {
    const id = ps.step_id;
    const cur = j.state.plan_steps[id];
    if (cur?.status === "done") { log(`STEP ${id} done (${cur.reason ?? ""})`); continue; }
    if (cur?.status === "blocked") { log(`STEP ${id} blocked (${cur.reason ?? ""})`); continue; }
    const m: StepMetrics = { curator_ms: 0, nimble_ms: 0 };
    let evidence: EvidenceItem[] = [];
    const deps = cur?.depends_on ?? ps.depends_on;
    const staleDeps = deps.filter((k) => j.state.facts[k]?.status === "stale");
    if (staleDeps.length) {
      log(`STEP ${id}: depends on stale ${staleDeps.join(", ")} → revalidate before acting (invariant 3)`);
      const r = await revalidate(id, staleDeps, m);
      if (!r.ok) { await blockStep(j, id, r.reason); continue; }
      evidence = r.evidence;
      if (r.superseded.length) {
        await j.append("plan_steps", { step_id: id, slot: ps.slot, resource: cur?.resource ?? ps.resource, depends_on: deps, commitment_key: null, status: "needs_repair", reason: `depends on superseded ${r.superseded.join(", ")}` });
        log(`STEP ${id} needs_repair: depends on superseded ${r.superseded.join(", ")} — repairing ONLY this step`);
        emit("step", { step_id: id, status: "needs_repair", superseded: r.superseded });
        const state = { projection: j.state, step: id, evicted, evidence };
        const rendered = renderWorkingContext(state);
        let prop;
        try { prop = await prov.curator.proposeContextOps(rendered, id); } catch (e) {
          await blockStep(j, id, `curator_unavailable: ${(e as Error).message}`); continue;
        }
        m.curator_ms += prop.curator_ms;
        const applied = applyContextOps(state, prop);
        for (const row of contextOpRows(id, prop, applied)) await j.append("context_ops", row);
        evicted = applied.evicted;
        evidence = evidence.filter((e) => !evicted.includes(e.id));
        log(`LIQUID context_ops (${prop.proposed_by}): evict [${applied.accepted.join(", ") || "none"}]${applied.rejected.length ? ` rejected [${applied.rejected.map((x) => `${x.id}: ${x.reason}`).join("; ")}]` : ""} · items ${applied.before.length}→${applied.after.length} · tokens ${rendered.tokens.count}→${applied.rendered.tokens.count}`);
        emit("context_ops", { step: id, proposed_by: prop.proposed_by, accepted: applied.accepted, rejected: applied.rejected, items_before: applied.before.length, items_after: applied.after.length, tokens_before: rendered.tokens.count, tokens_after: applied.rendered.tokens.count });
      }
    }
    let cands: CandidateX[];
    if (ps.slot === "campsite") {
      const staleCands = SITES.map((s) => `site-${s}.status`).filter((k) => j.state.facts[k]?.status === "stale");
      if (staleCands.length) {
        const r = await revalidate(id, staleCands, m);
        if (!r.ok) { await blockStep(j, id, r.reason); continue; }
      }
      cands = campsiteCandidates(viewFromFacts(j.state));
    } else {
      cands = [fixedCandidate(ps.resource)];
    }
    const rendered = renderWorkingContext({ projection: j.state, step: id, evicted, evidence });
    const ctx: PlannerContext = { constraints: constraintsFromProjection(j.state), spent_cents: spentCents(j.state, ps.slot) };
    const d = await prov.planner.decide(rendered, id, cands, ctx);
    const rej = d.rejected_candidates.map((r) => `${r.resource}:${r.reason}`).join(", ");
    log(`PLANNER ${id}: ${d.action}${d.resource ? ` ${d.resource}` : ""} — ${d.reason} · context_tokens ${d.context_tokens.count} · planner_tokens_in ${d.planner_tokens_in}${rej ? ` · code-rejected ${rej}` : ""}`);
    emit("planner", { step: id, action: d.action, resource: d.resource ?? null, reason: d.reason, context_tokens: d.context_tokens.count, planner_tokens_in: d.planner_tokens_in, rejected: d.rejected_candidates, valid: d.valid_candidates });
    await j.append("metrics", { step: id, phase: "planner", context_tokens: d.context_tokens.count, planner_tokens_in: d.planner_tokens_in, curator_ms: m.curator_ms, nimble_ms: m.nimble_ms, duplicate_effects: 0, stale_actions: 0 });
    if (d.action !== "book" || !d.resource) {
      // No code-valid candidate: the block reason is the code filter's, not the model's prose (F3b).
      const reason = d.valid_candidates.length === 0
        ? `${noCandidateReason(ps.slot, ctx.constraints.accessible_required, d.rejected_candidates)}; planner ${d.action}`
        : `planner ${d.action}: ${d.reason}`;
      await blockStep(j, id, reason); continue;
    }
    const wv = await desk.worldVersion();
    const out = await executeBooking({ journal: j, desk, log, awaitIntentVisible: httpIntentGate(link) }, stepFor(id, d.resource, wv), { holdAfterCommit: crash && id === F3.crash_step, holdMs: HOLD_MS });
    log(`DESK ${id} ${d.resource}: ${out.receipt.outcome}${out.receipt.reject_reason ? ` (${out.receipt.reject_reason})` : ""} receipt ${out.receipt.receipt_id} $${(out.receipt.amount / 100).toFixed(2)}`);
    emit("booking", { step: id, resource: d.resource, outcome: out.receipt.outcome, reject_reason: out.receipt.reject_reason ?? null, receipt_id: out.receipt.receipt_id, action_key: out.action_key, amount: out.receipt.amount });
    if (!out.receipt.committed) {
      const stale = out.receipt.reject_reason === "closed" || out.receipt.reject_reason === "stale_version" ? 1 : 0;
      await j.append("metrics", { step: id, phase: "desk", context_tokens: 0, planner_tokens_in: 0, curator_ms: 0, nimble_ms: 0, duplicate_effects: 0, stale_actions: stale });
    }
  }
  await terminal(j);
}

// ---------------------------------------------------------------- naive arm (transcript resume baseline)
async function runNaive() {
  const path = String(argv.transcript ?? resolve(REPO_ROOT, `artifacts/naive/${runId}.json`));
  const tr = new NaiveTranscript(path);
  const t: Transcript = tr.resume(runId);
  const epoch = t.attempt;
  const j = new Journal(sink, { run_id: runId, arm: "naive", epoch });
  log(`NAIVE transcript resume: attempt ${t.attempt}, ${t.lines.length - 1} transcript lines reloaded from local file; no RawTree restore, no reconcile, no revalidation`);
  emit("recovered", { epoch, restored_rows: 0, transcript_lines: t.lines.length, pid: process.pid, naive: true });
  await j.append("epochs", { reason: epoch === 1 ? "boot" : "resume", restored_rows: 0, sim_clock: simClock, pid: process.pid, verdict: null, verdict_reason: null });
  if (epoch === 1) {
    await seedRun(j);
    t.lines.push("user: Plan an Angel Island camping trip Oct 9–11 for 2 people, budget $400: ferry, campsite, permit, gear.");
    const obs = await observe();
    for (const f of factsFromObservation(obs)) await j.append("facts", f);
    const sites = siteMap(obs.fields);
    t.facts = Object.fromEntries(Object.entries(sites).map(([k, v]) => [k, JSON.stringify(v)]));
    t.world_version = obs.world_version;
    t.lines.push(`tool: status page (task ${obs.task_id}) ${JSON.stringify(sites)}`);
    t.lines.push("user: oh — one of us uses a wheelchair, the campsite must be accessible.");
    tr.save(t);
  }
  const ctxConstraints = { start: F3.trip.start_date, end: F3.trip.end_date, party: F3.trip.party, budget_cents: F3.trip.budget_cents, accessible_required: F3.trip.accessible_required };
  for (const ps of F3.plan) {
    const id = ps.step_id;
    if (t.steps[id]) { log(`NAIVE step ${id}: transcript says ${t.steps[id]!.status}`); continue; }
    const cands = ps.slot === "campsite"
      ? campsiteCandidates(Object.fromEntries(Object.entries(t.facts).map(([k, v]) => [k, JSON.parse(v) as SiteView])))
      : [fixedCandidate(ps.resource)];
    // the naive agent's working memory is its transcript only (no typed state): tokens grow with every turn
    const rendered = renderWorkingContext({ projection: emptyProjection(runId), step: id, transcript: t.lines });
    const spent = Object.values(t.steps).filter((s) => s.status === "done").reduce((a, s) => a + resourceById(s.resource).price_cents, 0);
    const d = await prov.planner.decide(rendered, id, cands, { constraints: ctxConstraints, spent_cents: spent });
    log(`NAIVE PLANNER ${id}: ${d.action}${d.resource ? ` ${d.resource}` : ""} — ${d.reason} · context_tokens ${d.context_tokens.count}`);
    emit("planner", { step: id, action: d.action, resource: d.resource ?? null, reason: d.reason, context_tokens: d.context_tokens.count, planner_tokens_in: d.planner_tokens_in, rejected: d.rejected_candidates, valid: d.valid_candidates });
    await j.append("metrics", { step: id, phase: "planner", context_tokens: d.context_tokens.count, planner_tokens_in: d.planner_tokens_in, curator_ms: 0, nimble_ms: 0, duplicate_effects: 0, stale_actions: 0 });
    t.lines.push(`user: next, the ${id}.`, `assistant: ${d.action} ${d.resource ?? ""} — ${d.reason}`);
    tr.save(t);
    if (d.action !== "book" || !d.resource) continue;
    const out = await tr.book(j, desk, t, stepFor(id, d.resource, t.world_version), { holdAfterCommit: crash && id === F3.crash_step, holdMs: HOLD_MS }, log);
    log(`NAIVE DESK ${id} ${d.resource}: ${out.receipt.outcome}${out.receipt.reject_reason ? ` (${out.receipt.reject_reason})` : ""} receipt ${out.receipt.receipt_id}`);
    emit("booking", { step: id, resource: d.resource, outcome: out.receipt.outcome, reject_reason: out.receipt.reject_reason ?? null, receipt_id: out.receipt.receipt_id, action_key: out.action_key, amount: out.receipt.amount });
    t.lines.push(`tool: desk ${out.receipt.outcome} ${d.resource}${out.receipt.reject_reason ? ` (${out.receipt.reject_reason})` : ""} receipt ${out.receipt.receipt_id}`);
    tr.save(t);
    if (!out.receipt.committed) {
      const stale = out.receipt.reject_reason === "closed" || out.receipt.reject_reason === "stale_version" ? 1 : 0;
      await j.append("metrics", { step: id, phase: "desk", context_tokens: 0, planner_tokens_in: 0, curator_ms: 0, nimble_ms: 0, duplicate_effects: 0, stale_actions: stale });
    }
  }
  await terminal(j);
}

try {
  log(`runner pid=${process.pid} run_id=${runId} arm=${arm} crash=${crash ? "after_desk_commit" : "none"} sim_clock=${simClock}`);
  emit("started", { pid: process.pid, run_id: runId, arm });
  if (arm === "naive" || argv.resume === "transcript") await runNaive();
  else await runDr();
  process.exit(0);
} catch (e) {
  const err = e as Error & { code?: string };
  log(`RUNNER ERROR ${err.code ?? err.name}: ${err.message}`);
  emit("error", { code: err.code ?? err.name, message: err.message });
  process.exit(1);
}
