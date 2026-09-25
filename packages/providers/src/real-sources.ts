// Real web sources read through Nimble alongside the simulated status page.
// These are the actual Angel Island pages; nothing on them changes on cue, so after a crash the honest
// result is usually "unchanged". Parsing is deterministic code over Nimble's markdown (no model), so a
// re-check compares like with like: the fingerprint covers the parsed facts, not the raw page (which
// carries tracking pixels and other per-request noise).

export type FerryDay = {
  kind: "ferry";
  date: string; // YYYY-MM-DD
  weekday: string; // e.g. "Friday"
  section: string | null; // e.g. "October 1 - 11, 2026"
  service: boolean | null; // null = the schedule for that date could not be found
  departures: string[]; // Tiburon departures, e.g. ["10 am", "11 am", "1 pm", "3 pm (campers only)"]
  notes: string[]; // lines that mention the date, e.g. "Added return at 5:20 pm on October 9 for Fleet Week"
};
export type ParkNotices = { kind: "park"; notices: string[] };
export type RealFacts = FerryDay | ParkNotices;

export type RealSource = {
  id: "ferry" | "park";
  label: string; // host shown to people
  title: string;
  url: string;
  parse(markdown: string, tripDate: string): RealFacts;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const clean = (s: string) => s.replace(/\\\*/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();

function dayIndex(token: string): number {
  return DAYS.findIndex((d) => token.toLowerCase().startsWith(d.slice(0, 3).toLowerCase()));
}

/** Days covered by a header such as "Mondays - Tuesday", "Wednesdays - Fridays", "Saturdays/Sundays/Labor Day". */
export function daysInHeader(header: string): Set<number> {
  const h = clean(header);
  const out = new Set<number>();
  const range = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s*[-–]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*/i.exec(h);
  if (range) {
    const a = dayIndex(range[1]!), b = dayIndex(range[2]!);
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  }
  for (const m of h.matchAll(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*/gi)) out.add(dayIndex(m[1]!));
  return out;
}

const DAY_HEADER = /^(?:#{1,6}\s*)?(?:\*\*)?\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*(?:\s*[-–/]\s*\w+)*[^\n]*$/i;

/** The Tiburon ferry schedule for one date, from angelislandferry.com/schedule. */
export function parseFerrySchedule(md: string, isoDate: string): FerryDay {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const month = MONTHS[d.getUTCMonth()]!, day = d.getUTCDate(), year = d.getUTCFullYear(), wd = d.getUTCDay();
  const base: FerryDay = { kind: "ferry", date: isoDate, weekday: DAYS[wd]!, section: null, service: null, departures: [], notes: [] };
  const lines = md.split("\n");
  // Section headings look like "## October 1 - 11, 2026".
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^##\s+(\w+)\s+(\d+)\s*[-–]\s*(\d+),\s*(\d{4})/.exec(lines[i]!);
    if (m && m[1] === month && Number(m[4]) === year && day >= Number(m[2]) && day <= Number(m[3])) { start = i; base.section = clean(lines[i]!); break; }
  }
  if (start < 0) return base;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^##\s/.test(lines[i]!) && !/^###/.test(lines[i]!)) { end = i; break; }
  const sec = lines.slice(start + 1, end);
  // Notes that mention this exact date anywhere in the section.
  const dateRe = new RegExp(`\\b(${month}|${month.slice(0, 3)})\\.?\\s+${day}\\b`, "i");
  base.notes = sec.filter((l) => dateRe.test(l)).map(clean).filter(Boolean);
  // Split into day-group blocks and pick the one covering this weekday.
  for (let i = 0; i < sec.length; i++) {
    const line = sec[i]!;
    if (!DAY_HEADER.test(line.trim()) || !daysInHeader(line).has(wd)) continue;
    const body: string[] = [];
    for (let k = i + 1; k < sec.length && !DAY_HEADER.test(sec[k]!.trim()); k++) body.push(sec[k]!);
    const text = body.join("\n");
    if (/no ferry service/i.test(text)) return { ...base, service: false };
    const dep = /Depart\s+TIBURON:\s*(.+)/i.exec(text);
    if (dep) {
      const departures = dep[1]!
        .replace(/\(([^)]*?)\s*[–-]\s*campers only[^)]*\)/gi, "$1 (campers only)")
        .split(/,\s*/)
        .map((t) => clean(t))
        .filter(Boolean);
      return { ...base, service: true, departures };
    }
  }
  return base;
}

/** Current notices on the Angel Island State Park page (parks.ca.gov): the advisories list plus any advisory banner. */
export function parseParkNotices(md: string): ParkNotices {
  const notices: string[] = [];
  const lines = md.split("\n");
  const i = lines.findIndex((l) => /Advisories and Notices/i.test(l));
  if (i >= 0) {
    for (let k = i + 1; k < lines.length && !/^##\s/.test(lines[k]!); k++) {
      const m = /^\s*[*-]\s+\[([^\]]+)\]/.exec(lines[k]!) ?? /^\s*[*-]\s+(.+)$/.exec(lines[k]!);
      if (m) notices.push(clean(m[1]!));
    }
  }
  for (const l of lines) {
    const t = clean(l);
    if (/^\*\*/.test(l.trim()) && /\badvisory\b/i.test(t) && t.length < 140) notices.push(t);
  }
  return { kind: "park", notices: [...new Set(notices)].sort() };
}

export const REAL_SOURCES: RealSource[] = [
  { id: "ferry", label: "angelislandferry.com", title: "Angel Island–Tiburon Ferry schedule", url: "https://angelislandferry.com/schedule", parse: (md, date) => parseFerrySchedule(md, date) },
  { id: "park", label: "parks.ca.gov", title: "Angel Island State Park", url: "https://www.parks.ca.gov/?page_id=468", parse: (md) => parseParkNotices(md) },
];

/** Stable fingerprint of the parsed facts (not the raw page). */
export function realFingerprint(f: RealFacts): string {
  return f.kind === "ferry"
    ? JSON.stringify([f.date, f.section, f.service, f.departures, f.notes])
    : JSON.stringify(f.notices);
}

/** One-line human summary, stored as the fact's excerpt and used in narration. */
export function summarizeReal(f: RealFacts): string {
  if (f.kind === "park") return f.notices.length ? `${f.notices.length} current notice${f.notices.length === 1 ? "" : "s"}: ${f.notices.join("; ")}` : "no current notices";
  const when = `${f.weekday.slice(0, 3)} ${MONTHS[Number(f.date.slice(5, 7)) - 1]!.slice(0, 3)} ${Number(f.date.slice(8, 10))}`;
  if (f.service === null) return `${when}: schedule not found on the page`;
  if (!f.service) return `${when}: no ferry service`;
  return `${when}: ferry runs · Tiburon departures ${f.departures.join(", ")}${f.notes.length ? ` · note: ${f.notes.join("; ")}` : ""}`;
}
