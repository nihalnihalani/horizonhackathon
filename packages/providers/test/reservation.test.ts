import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PILOT, ReservationCheckError, ReservationSources, buildBookingUrl, verifyGuidance, verifySchedule } from "../src/reservation.ts";
import { fakeFetch } from "./helpers.ts";

const ferry = readFileSync(resolve(__dirname, "fixtures", "real-ferry-schedule.md"), "utf8");
const faq = `# Angel Island–Tiburon Ferry FAQ

Is the ferry wheelchair accessible?

Yes.

How can I book a trip and what forms of payment do you take?

Advanced bookings online are recommended as the ferry does have a capacity. You can book online from our website for ferry tickets.
`;

describe("bounded ferry preparation", () => {
  it("uses the verified departure and documented rate quantities without creating a booking", () => {
    for (const adults of [1, 2, 6]) {
      const url = new URL(buildBookingUrl(adults));
      expect(url.origin).toBe("https://fareharbor.com");
      expect(url.pathname).toBe("/embeds/book/angelislandferry/items/87227/availability/2117206357/book/");
      expect(url.searchParams.get("ctrs")).toBe(`8991824084:${adults}`);
      expect([...url.searchParams.keys()].sort()).toEqual(["ctrs", "flow", "full-items", "ref"]);
    }
    expect(PILOT.priceCents * 2).toBe(3816);
  });
  it.each([0, -1, 7, 1.5, NaN, Infinity, "2", "2&ctrs=other:99", null, undefined])("rejects an unsupported or injected adult quantity: %s", (adults) => {
    expect(() => buildBookingUrl(adults as number)).toThrow(ReservationCheckError);
  });
  it("confirms the published October 9 general passenger departure without promising capacity", () => {
    expect(verifySchedule(ferry)).toContain("10:00 AM Tiburon departure on October 9, 2026");
    expect(verifySchedule(ferry)).toContain("Operator note: Added return at 5:20 pm on October 9 for Fleet Week.");
    expect(verifySchedule(ferry)).toContain("Confirm seats on the booking page");
  });
  it.each([
    "10 am departure cancelled on October 9.",
    "Special service arrangements on October 9; contact the operator.",
    "Added return at 5:20 pm on October 9 for Fleet Week has been cancelled.",
  ])("blocks a date-specific exception despite an unchanged recurring timetable: %s", (notice) => {
    const changed = ferry.replace("## October 1 - 11, 2026", `## October 1 - 11, 2026\n\n${notice}`);
    expect(changed).toContain("Depart TIBURON: 10 am, 11 am, 1 pm");
    expect(() => verifySchedule(changed)).toThrow("includes an exception for October 9, 2026");
  });
  it("does not apply an exception for a different date to the pilot", () => {
    const changed = ferry.replace("## October 1 - 11, 2026", "## October 1 - 11, 2026\n\n10 am departure cancelled on October 10.");
    expect(verifySchedule(changed)).toContain("10:00 AM Tiburon departure on October 9, 2026");
  });
  it("blocks an explicit closure of the relevant weekday", () => {
    const closed = ferry.replaceAll("Wednesdays - Fridays\nDepart TIBURON:", "Wednesdays - Fridays\nNo ferry service.\nDepart TIBURON:");
    expect(() => verifySchedule(closed)).toThrow("no ferry service on October 9, 2026");
  });
  it("does not infer service from another date or an unreadable page", () => {
    expect(() => verifySchedule(ferry.replace("## October 1 - 11, 2026", "## October 1 - 11, 2027"))).toThrow("could not confirm service");
    expect(() => verifySchedule("Angel Island ferry timetable unavailable")).toThrow("could not confirm service");
  });
  it.each(["10 am (campers only)", "10:20 am", "10 pm", "11 am"])("does not accept %s or the separate return sailing", (replacement) => {
    const changed = ferry.replaceAll("Depart TIBURON: 10 am,", `Depart TIBURON: ${replacement},`);
    expect(() => verifySchedule(changed)).toThrow("does not list a 10:00 AM Tiburon departure for general passengers");
  });
  it("uses affirmative accessibility evidence tied to the exact FAQ question", () => {
    expect(verifyGuidance(faq)).toContain("says the ferry is wheelchair accessible");
    expect(verifyGuidance(faq)).toContain("recommends advance booking");
    expect(verifyGuidance(faq.replace("Yes.", "No."))).toContain("Wheelchair accessibility was not confirmed");
    expect(verifyGuidance(faq.replace("Yes.", "Yes, only on selected vessels."))).not.toContain("says the ferry is wheelchair accessible");
  });
  it("does not turn unrelated yes answers, a question alone, or navigation into guidance", () => {
    expect(() => verifyGuidance("Angel Island ferry\n\nIs the ferry wheelchair accessible?\n\nCan I bring a bicycle?\n\nYes.")).toThrow("could not be verified");
    expect(() => verifyGuidance("Angel Island ferry FAQ navigation")).toThrow("could not be verified");
    expect(() => verifyGuidance("Another ferry FAQ\n\nIs the ferry wheelchair accessible?\n\nYes.")).toThrow("could not be identified");
  });
});

describe("live source boundary with offline transport", () => {
  const success = (markdown = ferry, overrides: Record<string, unknown> = {}) => ({
    status: "success", status_code: 200, task_id: "nimble-task-1", data: { markdown }, ...overrides,
  });

  it("only reads the two fixed sources and returns dated, hashed retrieval evidence", async () => {
    const mock = fakeFetch([() => ({ json: success() }), () => ({ json: success(faq) })]);
    const sources = new ReservationSources("test-service-key", { fetchImpl: mock.f, now: () => new Date("2026-09-26T00:30:00Z") });
    const schedule = await sources.read("schedule");
    await sources.read("guidance");
    expect(schedule).toEqual({
      url: PILOT.scheduleUrl, title: "Angel Island–Tiburon Ferry schedule", retrievedAt: "2026-09-26T00:30:00.000Z",
      sha256: createHash("sha256").update(ferry).digest("hex"), provider: "nimble", requestId: "nimble-task-1", markdown: ferry,
    });
    expect(mock.calls.map((call) => call.body)).toEqual([
      { url: PILOT.scheduleUrl, render: false, formats: ["markdown"] },
      { url: PILOT.guidanceUrl, render: false, formats: ["markdown"] },
    ]);
    expect(mock.calls.every((call) => call.url === "https://sdk.nimbleway.com/v2/extract")).toBe(true);
    await expect(sources.read("https://example.com" as "schedule")).rejects.toThrow("only check the official");
    expect(mock.calls).toHaveLength(2);
  });
  it.each([0, 301, 403, 404, 500])("rejects target HTTP %s despite a successful provider response", async (status_code) => {
    const mock = fakeFetch([() => ({ json: success(ferry, { status_code }) })]);
    await expect(new ReservationSources("test", { fetchImpl: mock.f }).read("schedule")).rejects.toThrow("did not return a successful page");
  });
  it.each(["", "FareHarbor did not load properly: no-assets", "# Access denied", "Just a moment, checking your browser"])("rejects empty or error-page content: %s", async (markdown) => {
    const mock = fakeFetch([() => ({ json: success(markdown) })]);
    await expect(new ReservationSources("test", { fetchImpl: mock.f }).read("schedule")).rejects.toBeInstanceOf(ReservationCheckError);
  });
  it("rejects a missing task receipt", async () => {
    const mock = fakeFetch([() => ({ json: success(ferry, { task_id: undefined }) })]);
    await expect(new ReservationSources("test", { fetchImpl: mock.f }).read("schedule")).rejects.toThrow("no valid retrieval receipt");
  });
  it("never exposes provider error payloads or exception text", async () => {
    const mock = fakeFetch([() => ({ status: 401, json: { status: "secret-payload-test-key" } })]);
    const fetchImpl = async () => { throw new Error("secret-transport-test-key"); };
    for (const transport of [mock.f, fetchImpl]) {
      const error = await new ReservationSources("test", { fetchImpl: transport }).read("schedule").catch((e: Error) => e);
      expect(error).toBeInstanceOf(ReservationCheckError);
      expect((error as Error).message).toBe("Angel Island–Tiburon Ferry schedule could not be retrieved. Try the source check again.");
    }
  });
});
