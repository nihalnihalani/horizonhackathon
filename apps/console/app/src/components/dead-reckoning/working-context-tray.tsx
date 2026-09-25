import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { MissionSnapshot } from "@/lib/dead-reckoning/types";
import { StatusPill } from "./status-pill";

/**
 * What is currently in the planner's working context, and the curator/Liquid ops that shaped it.
 * The canonical snapshot exposes item IDs (not full text) plus a bounded operation log; the full
 * text of an evicted item is durable evidence recallable through EvidenceDrawer, never re-appended
 * here (AGENTS.md: "Eviction removes material from the next prompt, not from durable provenance").
 */
export function WorkingContextTray({ context }: { context: MissionSnapshot["context"] }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {context.items.length} item{context.items.length === 1 ? "" : "s"} in the current planner input
        </span>
        <span className="text-muted-foreground">
          {context.tokens === null ? "token count unavailable" : `${context.tokens.toLocaleString()} tokens`}
        </span>
      </div>

      {context.lastOps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No context operations proposed yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card dark:border-transparent [&_[data-slot=item]]:rounded-none">
          {context.lastOps.map((op, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lastOps is an ordered, append-only log with no id field; op+key can repeat, and the log is never reordered or filtered.
            <div key={`${op.op}:${op.key}:${i}`}>
              {i > 0 ? <Separator /> : null}
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>
                    {op.op} · {op.key}
                  </ItemTitle>
                  <ItemDescription>
                    proposed by {op.proposedBy} · {op.reason}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusPill tone={op.accepted ? "success" : "warning"}>
                    {op.accepted ? "accepted" : "rejected"}
                  </StatusPill>
                </ItemActions>
              </Item>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
