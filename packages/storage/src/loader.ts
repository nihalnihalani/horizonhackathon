// RawTreeLoader: paginated per-table restore ordered by (rev, ts), in-code projection, asOf filter.
import { RESTORE_ROW_LIMIT, RestoreCapacityError, TABLES, assertRunId, type Projection, type ProjectionLoader, type TableName } from "@dr/shared";
import { RawTreeClient } from "./client.ts";
import { buildProjection } from "./projection.ts";
import { selectRunPage } from "./sql.ts";

export class RawTreeLoader implements ProjectionLoader {
  constructor(private client: RawTreeClient, private opts: { pageSize?: number; limit?: number } = {}) {}

  async loadRaw(runId: string): Promise<Record<TableName, Record<string, unknown>[]>> {
    assertRunId(runId);
    const pageSize = this.opts.pageSize ?? 1000;
    const limit = this.opts.limit ?? RESTORE_ROW_LIMIT;
    const out = {} as Record<TableName, Record<string, unknown>[]>;
    await Promise.all(TABLES.map(async (t) => {
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await this.client.query(selectRunPage(t, runId, pageSize, offset));
        rows.push(...page);
        // S07: never truncate silently — hitting the cap is an explicit capacity rejection.
        if (rows.length >= limit) throw new RestoreCapacityError(`${t}: >= ${limit} rows for run; restore refused`);
        if (page.length < pageSize) break;
      }
      out[t] = rows;
    }));
    return out;
  }

  async load(runId: string, opts: { asOf?: string } = {}): Promise<Projection> {
    return buildProjection(runId, await this.loadRaw(runId), opts);
  }
}
