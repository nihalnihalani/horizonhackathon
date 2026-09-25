// Minimal fetch helpers shared by the provider clients. Never logs request bodies or auth headers.
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  constructor(public status: number, public service: string, message: string) {
    super(`${service} HTTP ${status}: ${message}`);
    this.name = "HttpError";
  }
}

export async function postJson(
  fetchImpl: FetchLike,
  service: string,
  url: string,
  body: unknown,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });
  const text = await res.text();
  let json: any = undefined;
  try { json = text ? JSON.parse(text) : undefined; } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

/** Error-body snippet safe to surface: truncated, never includes request headers. */
export const snippet = (s: string, n = 200) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx]!;
}
