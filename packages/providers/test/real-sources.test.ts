import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { daysInHeader, parseFerrySchedule, parseParkNotices, realFingerprint, summarizeReal } from "../src/real-sources.ts";

// Trimmed copies of the real pages as Nimble returned them on 2026-09-25.
const ferryMd = readFileSync(resolve(__dirname, "fixtures", "real-ferry-schedule.md"), "utf8");
const parkMd = readFileSync(resolve(__dirname, "fixtures", "real-park-page.md"), "utf8");

describe("real ferry schedule (angelislandferry.com)", () => {
  it("reads the trip date: Friday Oct 9 runs, with the campers-only boat and the Fleet Week note", () => {
    const f = parseFerrySchedule(ferryMd, "2026-10-09");
    expect(f).toMatchObject({ weekday: "Friday", section: "October 1 - 11, 2026", service: true });
    expect(f.departures).toEqual(["10 am", "11 am", "1 pm", "3 pm (campers only)"]);
    expect(f.notes).toEqual(["Added return at 5:20 pm on October 9 for Fleet Week"]);
    expect(summarizeReal(f)).toBe("Fri Oct 9: ferry runs · Tiburon departures 10 am, 11 am, 1 pm, 3 pm (campers only) · note: Added return at 5:20 pm on October 9 for Fleet Week");
  });
  it("knows Mondays have no service and weekends have more boats", () => {
    expect(parseFerrySchedule(ferryMd, "2026-10-05").service).toBe(false);
    expect(parseFerrySchedule(ferryMd, "2026-10-10").departures).toContain("5 pm (campers only)");
  });
  it("returns service null for a date the page does not cover, rather than guessing", () => {
    expect(parseFerrySchedule(ferryMd, "2027-01-01")).toMatchObject({ service: null, section: null });
  });
  it("parses day-group headers", () => {
    expect([...daysInHeader("### Mondays - Tuesday")].sort()).toEqual([1, 2]);
    expect([...daysInHeader("**Wednesdays - Fridays**")].sort()).toEqual([3, 4, 5]);
    expect([...daysInHeader("Saturdays/Sundays/Labor Day")].sort()).toEqual([0, 6]);
  });
});

describe("real park notices (parks.ca.gov)", () => {
  it("reads the advisories list and the advisory banner", () => {
    expect(parseParkNotices(parkMd).notices).toEqual(["China Cove Beach Warning", "Dock Slip Re-Opening", "Smoke Advisory - Prescribed Burns Complete on Angel Island"]);
  });
  it("fingerprints parsed facts, so page noise does not count as a change", () => {
    const a = parseParkNotices(parkMd), b = parseParkNotices(`tracking pixel ![](x?t=123)\n${parkMd}`);
    expect(realFingerprint(a)).toBe(realFingerprint(b));
    const c = parseParkNotices(parkMd.replace("China Cove Beach Warning", "Island closed: high winds"));
    expect(realFingerprint(c)).not.toBe(realFingerprint(a));
  });
});
