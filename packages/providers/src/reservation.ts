import { createHash } from "node:crypto";
import { NimbleSensor } from "./nimble.ts";
import { parseFerrySchedule } from "./real-sources.ts";
import type { FetchLike } from "./http.ts";

/** A deliberately bounded pilot, observed in the operator's public booking flow.
 * The fare is a past browser observation, not a live quote or a seat guarantee.
 * FareHarbor documents `ctrs` as customer-type-RATE ID followed by quantity:
 * https://developer.fareharbor.com/api/external/v1/#booking-overlay-links
 */
export const PILOT = Object.freeze({
  date: "2026-10-09",
  time: "10:00 AM",
  timezone: "America/Los_Angeles",
  title: "Angel Island–Tiburon Ferry",
  itemId: "87227",
  availabilityId: "2117206357",
  rateId: "8991824084",
  priceCents: 1908,
  priceVerifiedAt: "2026-09-26T00:24:31Z",
  bookingBaseUrl: "https://fareharbor.com/embeds/book/angelislandferry/items/87227/availability/2117206357/book/",
  scheduleUrl: "https://angelislandferry.com/schedule",
  guidanceUrl: "https://angelislandferry.com/faqs",
});

/** Messages from this adapter are deliberately safe to display to a user. */
export class ReservationCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationCheckError";
  }
}

export type ReservationSource = {
  url: string;
  title: string;
  retrievedAt: string;
  sha256: string;
  provider: "nimble";
  requestId: string;
  /** Private evidence: expose metadata and checked summaries to the console. */
  markdown: string;
};

export function buildBookingUrl(adults: number): string {
  if (!Number.isInteger(adults) || adults < 1 || adults > 6) {
    throw new ReservationCheckError("Choose between 1 and 6 adults for this departure.");
  }
  const url = new URL(PILOT.bookingBaseUrl);
  url.searchParams.set("ref", "HomePage");
  url.searchParams.set("flow", "243179");
  url.searchParams.set("full-items", "yes");
  url.searchParams.set("ctrs", `${PILOT.rateId}:${adults}`);
  return url.toString();
}

function requireReadablePage(markdown: string, title: string): void {
  if (typeof markdown !== "string" || !markdown.trim()) {
    throw new ReservationCheckError(`${title} returned no readable content. Try the source check again.`);
  }
  if (/fareharbor did not load properly|\bno-assets\b|\bverify (?:that )?you are human\b|\bchecking your browser\b|\bjust a moment\b|(?:^|\n)\s*#{0,6}\s*(?:access denied|403 forbidden|404 not found|page not found|service unavailable)\b/im.test(markdown)) {
    throw new ReservationCheckError(`${title} returned an error or access-check page. Try the source check again.`);
  }
}

/** Confirms published service only; never promotes a timetable into live seat availability. */
export function verifySchedule(markdown: string): string {
  requireReadablePage(markdown, "The ferry schedule");
  const day = parseFerrySchedule(markdown, PILOT.date);
  if (day.service === null) {
    throw new ReservationCheckError("The official schedule could not confirm service for October 9, 2026. Check the operator's calendar before continuing.");
  }
  if (!day.service) {
    throw new ReservationCheckError("The official schedule lists no ferry service on October 9, 2026.");
  }
  // Date-specific notices override the recurring weekday table. Only the observed,
  // unqualified added-return notice is known not to invalidate this departure.
  const knownAddedReturn = /^Added return at 5:20 pm on October 9 for Fleet Week\.?$/i;
  if (day.notes.some((note) => !knownAddedReturn.test(note))) {
    throw new ReservationCheckError("The official schedule includes an exception for October 9, 2026 that may change this departure. Review the operator's notice before continuing.");
  }
  // An exact time avoids accepting 10:20, a return sailing, or a campers-only departure.
  if (!day.departures.some((departure) => /^10(?::00)?\s*a\.?m\.?$/i.test(departure.trim()))) {
    throw new ReservationCheckError("The official schedule does not list a 10:00 AM Tiburon departure for general passengers on October 9, 2026.");
  }
  const notes = day.notes.length ? ` Operator note: ${[...new Set(day.notes)].map((note) => note.replace(/\.$/, "")).join("; ")}.` : "";
  return `The operator's published schedule lists a 10:00 AM Tiburon departure on October 9, 2026 (America/Los_Angeles).${notes} Confirm seats on the booking page.`;
}

/** Only summarize a recognized answer immediately following its own FAQ question. */
function faqAnswer(markdown: string, question: string): string | undefined {
  const paragraphs = markdown.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim());
  const index = paragraphs.findIndex((paragraph) => paragraph.toLowerCase() === question.toLowerCase());
  return index >= 0 ? paragraphs[index + 1] : undefined;
}

export function verifyGuidance(markdown: string): string {
  requireReadablePage(markdown, "The operator FAQ");
  if (!/\bAngel Island\b/i.test(markdown) || !/\bferry\b/i.test(markdown)) {
    throw new ReservationCheckError("The operator FAQ could not be identified. Review the official guidance before continuing.");
  }
  const notes: string[] = [];
  const access = faqAnswer(markdown, "Is the ferry wheelchair accessible?");
  // A mere question, an unrelated "Yes", or a qualified answer is not affirmative evidence.
  if (/^yes\.?$/i.test(access ?? "")) {
    notes.push("The operator's FAQ says the ferry is wheelchair accessible.");
  }
  const booking = faqAnswer(markdown, "How can I book a trip and what forms of payment do you take?");
  if (/^advanced bookings online are recommended\s+as the ferry does have a capacity\./i.test(booking ?? "")) {
    notes.push("The operator recommends advance booking because ferry capacity is limited.");
  }
  if (!notes.length) {
    throw new ReservationCheckError("The operator FAQ was retrieved, but its booking or accessibility guidance could not be verified. Review it before continuing.");
  }
  if (!/^yes\.?$/i.test(access ?? "")) {
    notes.push("Wheelchair accessibility was not confirmed by this source check.");
  }
  return notes.join(" ");
}

export class ReservationSources {
  private readonly sensor: NimbleSensor;
  private readonly now: () => Date;

  constructor(apiKey: string, options: { fetchImpl?: FetchLike; now?: () => Date } = {}) {
    if (!apiKey.trim()) throw new ReservationCheckError("The live source-check service is not configured.");
    this.sensor = new NimbleSensor({ apiKey, fetchImpl: options.fetchImpl, timeoutMs: 60_000 });
    this.now = options.now ?? (() => new Date());
  }

  async read(kind: "schedule" | "guidance"): Promise<ReservationSource> {
    if (kind !== "schedule" && kind !== "guidance") {
      throw new ReservationCheckError("This preparation can only check the official ferry schedule and FAQ.");
    }
    const url = kind === "schedule" ? PILOT.scheduleUrl : PILOT.guidanceUrl;
    const title = kind === "schedule" ? "Angel Island–Tiburon Ferry schedule" : "Angel Island–Tiburon Ferry FAQ";
    let result: Awaited<ReturnType<NimbleSensor["extractPage"]>>;
    try {
      result = await this.sensor.extractPage(url);
    } catch {
      // Provider exceptions can contain response bodies. Never pass them to the console.
      throw new ReservationCheckError(`${title} could not be retrieved. Try the source check again.`);
    }
    if (result.status !== "success" || result.status_code < 200 || result.status_code >= 300 || !Number.isInteger(result.status_code)) {
      throw new ReservationCheckError(`${title} did not return a successful page. Try the source check again.`);
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(result.task_id) || ["undefined", "null"].includes(result.task_id)) {
      throw new ReservationCheckError(`${title} returned no valid retrieval receipt. Try the source check again.`);
    }
    requireReadablePage(result.markdown, title);
    return {
      url, title, retrievedAt: this.now().toISOString(),
      sha256: createHash("sha256").update(result.markdown).digest("hex"),
      provider: "nimble", requestId: result.task_id, markdown: result.markdown,
    };
  }
}
