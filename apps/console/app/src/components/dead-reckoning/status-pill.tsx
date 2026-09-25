import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASS, type StatusTone } from "./status";

/** A small rounded label, projector-readable — no icon-only state anywhere on this screen. */
export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone])}>
      {children}
    </span>
  );
}
