// A preparation is a saved handoff, never a booking receipt or a mission event.
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PILOT, buildBookingUrl, verifySchedule, verifyGuidance, type ReservationSource } from "@dr/providers/reservation";

export const PreparationInput = z.object({
  adults: z.number().int().min(1).max(6),
  budgetCents: z.number().int().min(100).max(50_000),
  commandId: z.string().uuid(),
}).strict();
export type PreparationRequest = z.infer<typeof PreparationInput>;
export type Preparation = {
  id: string; createdAt: string; updatedAt: string;
  status: "checking" | "ready" | "blocked" | "failed";
  input: { adults: number; budgetCents: number };
  steps: { id: string; label: string; status: "pending" | "running" | "done" | "failed"; detail?: string }[];
  booking?: { url: string; date: string; time: string; title: string; adults: number; totalCents: number; currency: "USD"; provider: "FareHarbor"; checkedAt: string; priceVerifiedAt: string };
  error?: string;
  evidence: (Omit<ReservationSource, "markdown"> & { id: string })[];
  notes: string[];
};
export type SourceReader = { read(kind: "schedule" | "guidance"): Promise<ReservationSource> };

export class PreparationStore {
  readonly db: Database.Database;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.exec("CREATE TABLE IF NOT EXISTS preparations (id TEXT PRIMARY KEY, command_id TEXT UNIQUE NOT NULL, request TEXT NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS preparation_sources (id TEXT PRIMARY KEY, preparation_id TEXT NOT NULL, body TEXT NOT NULL)");
    // A process restart does not silently replay a hosted call or invent a completed check.
    for (const p of this.list()) if (p.status === "checking") {
      p.status = "failed"; p.error = "The service restarted during a source check. Start a new preparation to check again.";
      for (const step of p.steps) if (step.status === "running") step.status = "failed";
      this.save(p);
    }
  }
  list(): Preparation[] { return (this.db.prepare("SELECT body FROM preparations ORDER BY rowid DESC LIMIT 100").all() as { body: string }[]).map((r) => JSON.parse(r.body)); }
  get(id: string): Preparation | undefined {
    const row = this.db.prepare("SELECT body FROM preparations WHERE id=?").get(id) as { body: string } | undefined;
    return row ? JSON.parse(row.body) : undefined;
  }
  create(input: PreparationRequest): { preparation: Preparation; created: boolean } {
    const request = JSON.stringify({ adults: input.adults, budgetCents: input.budgetCents });
    const prior = this.db.prepare("SELECT request,body FROM preparations WHERE command_id=?").get(input.commandId) as { request: string; body: string } | undefined;
    if (prior) {
      if (prior.request !== request) throw new Error("COMMAND_CONFLICT");
      return { preparation: JSON.parse(prior.body), created: false };
    }
    const now = new Date().toISOString();
    const preparation: Preparation = {
      id: randomUUID(), createdAt: now, updatedAt: now, status: "checking", input: { adults: input.adults, budgetCents: input.budgetCents },
      steps: [
        { id: "schedule", label: "Check ferry schedule", status: "pending" },
        { id: "guidance", label: "Check operator guidance", status: "pending" },
        { id: "handoff", label: "Prepare provider form", status: "pending" },
      ], evidence: [], notes: [
        "This prepares the official ferry form. No seats are held and no reservation has been submitted.",
        "The estimate uses the last browser-verified adult fare. Confirm the current total and availability on the ferry website before paying.",
        "This departure is a day-trip ferry pilot. Overnight camping requires a separate reservation; campsite availability has not been checked by this preparation.",
      ],
    };
    this.db.prepare("INSERT INTO preparations(id,command_id,request,body) VALUES (?,?,?,?)").run(preparation.id, input.commandId, request, JSON.stringify(preparation));
    return { preparation, created: true };
  }
  save(p: Preparation) { p.updatedAt = new Date().toISOString(); this.db.prepare("UPDATE preparations SET body=? WHERE id=?").run(JSON.stringify(p), p.id); }
  source(p: Preparation, source: ReservationSource) {
    const id = randomUUID();
    const { markdown: _, ...publicEvidence } = source;
    this.db.prepare("INSERT INTO preparation_sources(id,preparation_id,body) VALUES (?,?,?)").run(id, p.id, JSON.stringify(source));
    p.evidence.push({ id, ...publicEvidence }); this.save(p);
  }
  close() { this.db.close(); }
}

export class PreparationService {
  private active: Promise<void> | undefined;
  constructor(readonly store: PreparationStore, private sources?: SourceReader) {}
  get configured() { return Boolean(this.sources); }
  start(raw: unknown) {
    const input = PreparationInput.parse(raw);
    // Deduplicated requests are safe even while another source check is running.
    const prior = this.store.db.prepare("SELECT command_id FROM preparations WHERE command_id=?").get(input.commandId);
    if (!prior && this.active) throw new Error("BUSY");
    if (!this.sources && !prior) throw new Error("NOT_CONFIGURED");
    const result = this.store.create(input);
    if (result.created) {
      this.active = this.run(result.preparation).finally(() => { this.active = undefined; });
    }
    return result;
  }
  async idle() { await this.active; }
  private async run(p: Preparation) {
    let step = p.steps[0]!;
    try {
      if (new Date() >= new Date(`${PILOT.date}T17:00:00Z`)) throw new Error("This pilot departure has passed. Choose a new departure on the ferry website.");
      const total = PILOT.priceCents * p.input.adults;
      if (total > p.input.budgetCents) {
        p.status = "blocked"; p.error = `The last verified estimate of $${(total / 100).toFixed(2)} exceeds your ferry budget. Increase the budget or reduce the adult count.`;
        step.status = "failed"; step.detail = p.error; this.store.save(p); return;
      }
      for (const kind of ["schedule", "guidance"] as const) {
        step = p.steps.find((s) => s.id === kind)!;
        step.status = "running"; this.store.save(p);
        const source = await this.sources!.read(kind);
        this.store.source(p, source);
        step.detail = kind === "schedule" ? verifySchedule(source.markdown) : verifyGuidance(source.markdown);
        step.status = "done"; this.store.save(p);
      }
      step = p.steps[2]!; step.status = "running"; this.store.save(p);
      p.booking = { url: buildBookingUrl(p.input.adults), date: PILOT.date, time: PILOT.time, title: PILOT.title, adults: p.input.adults,
        totalCents: total, currency: "USD", provider: "FareHarbor", checkedAt: new Date().toISOString(), priceVerifiedAt: PILOT.priceVerifiedAt };
      step.status = "done"; step.detail = "Official departure link prepared with your adult count. Review the current form to confirm availability and price.";
      p.status = "ready"; this.store.save(p);
    } catch (error) {
      // Provider errors are deliberately reduced to approved messages; response bodies/keys never reach the UI.
      p.status = "failed";
      p.error = error instanceof Error && error.name === "ReservationCheckError" ? error.message : "The live source check could not be completed. No reservation was made. Try a new preparation or check the ferry website.";
      if (error instanceof Error && error.message.startsWith("This pilot departure")) p.error = error.message;
      step.status = "failed"; step.detail = p.error; this.store.save(p);
    }
  }
}
