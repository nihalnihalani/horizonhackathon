// Bench evidence registry (dr-bench, VALIDATION_AND_DEMO.md §3 C03, §6a).
// Immutable store keyed by evidence id with provenance; recall() returns a bounded,
// provenance-labelled excerpt. This is a bench-local analogue of durable RawTree evidence:
// eviction from a rendered prompt (packages/providers/src/context.ts) never deletes the
// record here, so an evicted id stays recallable (C03).
import { createHash } from "node:crypto";
import { countTokens, type TokenCount } from "@dr/shared";

export type RetrievalMode = "live" | "cache" | "direct";

export type EvidenceInput = {
  id: string;
  text: string;
  source_url: string;
  retrieval_mode: RetrievalMode;
  observed_at: string;
};

export type EvidenceRecord = EvidenceInput & { content_hash: string };

export class EvidenceRedefinitionError extends Error {
  constructor(public id: string) {
    super(`evidence ${id} already registered with different content (evidence is immutable once written)`);
  }
}

/** Immutable evidence store. put() is idempotent for identical content (S01-style dedup); rejects conflicting redefinition. */
export class EvidenceRegistry {
  private store = new Map<string, EvidenceRecord>();

  put(rec: EvidenceInput): EvidenceRecord {
    const content_hash = sha256(rec.text);
    const existing = this.store.get(rec.id);
    if (existing) {
      if (existing.content_hash !== content_hash) throw new EvidenceRedefinitionError(rec.id);
      return existing;
    }
    const full: EvidenceRecord = { ...rec, content_hash };
    this.store.set(rec.id, full);
    return full;
  }

  get(id: string): EvidenceRecord | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  size(): number {
    return this.store.size;
  }

  all(): EvidenceRecord[] {
    return [...this.store.values()];
  }
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export type RecallResult =
  | {
      id: string;
      found: true;
      excerpt: string;
      tokens: TokenCount;
      truncated: boolean;
      provenance: { source_url: string; retrieval_mode: RetrievalMode; observed_at: string; content_hash: string };
    }
  | { id: string; found: false };

/**
 * Bounded recall (C03): returns the ORIGINAL evidence (never a summary) truncated to fit maxTokens,
 * always labelled with provenance. Binary-searches a character cutoff so the returned excerpt's token
 * count is <= maxTokens (accounting for the provenance label rendered alongside it).
 */
export function recall(reg: EvidenceRegistry, id: string, maxTokens: number): RecallResult {
  const rec = reg.get(id);
  if (!rec) return { id, found: false };
  const label = `[recalled ${id} | source ${rec.source_url} | ${rec.retrieval_mode} | observed ${rec.observed_at} | sha256:${rec.content_hash.slice(0, 12)}] `;
  const labelTokens = countTokens(label).count;
  const budget = Math.max(0, maxTokens - labelTokens);
  let text = rec.text;
  let truncated = false;
  if (countTokens(text).count > budget) {
    truncated = true;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = `${text.slice(0, mid)}…`;
      if (countTokens(candidate).count <= budget) lo = mid;
      else hi = mid - 1;
    }
    text = lo > 0 ? `${text.slice(0, lo)}…` : "";
  }
  const excerpt = `${label}${text}`;
  return {
    id,
    found: true,
    excerpt,
    tokens: countTokens(excerpt),
    truncated,
    provenance: { source_url: rec.source_url, retrieval_mode: rec.retrieval_mode, observed_at: rec.observed_at, content_hash: rec.content_hash },
  };
}
