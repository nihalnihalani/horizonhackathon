// RowSink over RawTree: resolves only on {"inserted":1}; throws AckError otherwise (fail closed, no retry).
import { AckError, isTableName, type RowSink, type TableName } from "@dr/shared";
import { RawTreeClient } from "./client.ts";

export class RawTreeSink implements RowSink {
  constructor(private client: RawTreeClient) {}
  async append(table: TableName, row: Record<string, unknown>): Promise<{ inserted: 1 }> {
    if (!isTableName(table)) throw new AckError(`unknown table ${String(table)}`);
    const r = await this.client.insert(table, [row]);
    if (r.inserted !== 1) throw new AckError(`RawTree insert ${table}: not acked`);
    return { inserted: 1 };
  }
}

/** Metrics rows go through the same acked path (they are not gated, but we still await the ack). */
export class MetricsWriter {
  constructor(private sink: RowSink) {}
  write(row: Record<string, unknown>): Promise<{ inserted: 1 }> {
    return this.sink.append("metrics", row);
  }
}
