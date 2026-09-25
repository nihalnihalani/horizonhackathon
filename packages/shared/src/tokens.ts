// Token counter. FROZEN at scaffold.
// Method: gpt-tokenizer o200k_base (the GPT-4o/5 family encoding) — an estimate of the
// OpenAI planner input, not provider billing. Falls back to ceil(chars/4) if encoding throws.
import { countTokens as o200kCount } from "gpt-tokenizer/encoding/o200k_base";

export type TokenCount = { count: number; method: "gpt-tokenizer/o200k_base" | "chars/4" };

export function countTokens(text: string): TokenCount {
  try {
    return { count: o200kCount(text), method: "gpt-tokenizer/o200k_base" };
  } catch {
    return { count: Math.ceil(text.length / 4), method: "chars/4" };
  }
}
