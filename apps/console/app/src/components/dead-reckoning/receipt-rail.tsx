import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { MissionSnapshot } from "@/lib/dead-reckoning/types";
import { StatusPill } from "./status-pill";

/**
 * Confirmed/rejected desk effects. Every row is durable evidence, not a display guess — the booking
 * desk is simulated, and every receipt row says so explicitly (AGENTS.md "Demo and scope
 * priorities": bookings are always labeled SIMULATED).
 */
export function ReceiptRail({ receipts }: { receipts: MissionSnapshot["receipts"] }) {
  if (receipts.length === 0) {
    return <p className="mt-4 text-muted-foreground text-sm">No desk receipts yet.</p>;
  }
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card dark:border-transparent [&_[data-slot=item]]:rounded-none">
      {receipts.map((r, i) => (
        <div key={r.receiptId}>
          {i > 0 ? <Separator /> : null}
          <Item size="sm">
            <ItemContent>
              <ItemTitle className="flex items-center gap-2">
                {r.resource}
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Simulated
                </span>
              </ItemTitle>
              <ItemDescription>
                {r.slot} · {(r.amountCents / 100).toFixed(2)} USD · receipt {r.receiptId}
                {r.recovered ? " · recovered after restart" : ""}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <StatusPill tone={r.outcome === "committed" ? "success" : "danger"}>{r.outcome}</StatusPill>
            </ItemActions>
          </Item>
        </div>
      ))}
    </div>
  );
}
