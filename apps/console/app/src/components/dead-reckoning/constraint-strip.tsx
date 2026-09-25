import type { MissionSnapshot } from "@/lib/dead-reckoning/types";

/**
 * The mission's typed constraints (accessibility, budget, dates, …), always visible and never
 * something the model can weaken or delete from working context (AGENTS.md invariant 7). This is
 * a straight read of `constraints` from the canonical snapshot — nothing here is model-authored.
 */
export function ConstraintStrip({ constraints }: { constraints: MissionSnapshot["constraints"] }) {
  if (constraints.length === 0) {
    return <p className="text-muted-foreground text-sm">No constraints recorded yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {constraints.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
        >
          <span className="font-medium">{c.key}</span>
          <span className="text-muted-foreground">{formatConstraintValue(c.value)}</span>
        </span>
      ))}
    </div>
  );
}

function formatConstraintValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "required" : "not required";
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
