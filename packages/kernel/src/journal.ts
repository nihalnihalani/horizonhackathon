// Journal: fills BaseRow fields, assigns the next rev, awaits the sink ack, then applies the row to local state.
// Nothing is applied locally unless RawTree acked it (fail closed).
import { AckError, parseRow, type Arm, type Projection, type RowOf, type RowSink, type TableName } from "@dr/shared";
import { applyRow, emptyProjection } from "@dr/storage/projection";

export type DraftFields<T extends TableName> = Omit<RowOf<T>, "run_id" | "ts" | "epoch" | "rev" | "arm">;

export class Journal {
  readonly state: Projection;
  private nextRev: number;
  constructor(
    private sink: RowSink,
    readonly ctx: { run_id: string; arm: Arm; epoch: number },
    state?: Projection,
  ) {
    this.state = state ?? emptyProjection(ctx.run_id);
    this.nextRev = this.state.rev + 1;
  }

  get epoch(): number { return this.ctx.epoch; }

  async append<T extends TableName>(table: T, fields: DraftFields<T>): Promise<RowOf<T>> {
    const row = parseRow(table, {
      ...fields, run_id: this.ctx.run_id, ts: new Date().toISOString(), epoch: this.ctx.epoch, rev: this.nextRev, arm: this.ctx.arm,
    });
    const ack = await this.sink.append(table, row as Record<string, unknown>);
    if (!ack || ack.inserted !== 1) throw new AckError(`${table}: sink did not ack`);
    this.nextRev++;
    applyRow(this.state, table, row);
    return row;
  }
}
