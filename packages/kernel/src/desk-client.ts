// HTTP DeskClient against the desk (127.0.0.1:4401). Lookups: 200 found / 404 absent / else unavailable.
import { DrError, type BookRequest, type DeskClient, type DeskReceipt, type LookupResult } from "@dr/shared";

export class DeskConflict extends DrError {
  constructor(public original: DeskReceipt | undefined) { super("DESK_ARGS_CONFLICT", "desk 409: action_key already bound to different args"); }
}
export class DeskUnavailable extends DrError {
  constructor(m: string) { super("DESK_UNAVAILABLE", m, true); }
}

export class HttpDeskClient implements DeskClient {
  constructor(private o: { baseUrl: string; token: string; timeoutMs?: number; ns?: { run_id?: string; arm?: string } }) {}
  private h() { return { authorization: `Bearer ${this.o.token}`, "content-type": "application/json" }; }
  private base() { return this.o.baseUrl.replace(/\/+$/, ""); }

  async book(req: BookRequest): Promise<DeskReceipt> {
    let res: Response;
    try {
      res = await fetch(`${this.base()}/book`, { method: "POST", headers: this.h(), body: JSON.stringify(req), signal: AbortSignal.timeout(this.o.timeoutMs ?? 8000) });
    } catch (e) {
      throw new DeskUnavailable(`desk /book: no response (${(e as Error).name}); outcome unknown`);
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 200) return body as DeskReceipt;
    if (res.status === 409) throw new DeskConflict((body as { original?: DeskReceipt }).original);
    throw new DeskUnavailable(`desk /book HTTP ${res.status}: ${(body as { error?: string }).error ?? "?"}`);
  }

  async lookup(actionKey: string): Promise<LookupResult> {
    const q = new URLSearchParams();
    if (this.o.ns?.run_id) q.set("run_id", this.o.ns.run_id);
    if (this.o.ns?.arm) q.set("arm", this.o.ns.arm);
    try {
      const res = await fetch(`${this.base()}/actions/${encodeURIComponent(actionKey)}${q.size ? `?${q}` : ""}`, { headers: this.h(), signal: AbortSignal.timeout(this.o.timeoutMs ?? 5000) });
      if (res.status === 200) return { status: "found", receipt: (await res.json()) as DeskReceipt };
      if (res.status === 404) return { status: "absent" };
      return { status: "unavailable", reason: `HTTP ${res.status}` };
    } catch (e) {
      return { status: "unavailable", reason: (e as Error).name };
    }
  }

  async worldVersion(): Promise<number> {
    const res = await fetch(`${this.base()}/world`, { signal: AbortSignal.timeout(this.o.timeoutMs ?? 5000) });
    if (!res.ok) throw new DeskUnavailable(`desk /world HTTP ${res.status}`);
    return ((await res.json()) as { world_version: number }).world_version;
  }
}
