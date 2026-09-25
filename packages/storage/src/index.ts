// @dr/storage — RawTree client, acked sink, paginated projection loader, fake server for tests.
import { loadConfig } from "@dr/shared";
import { RawTreeClient } from "./client.ts";
import { RawTreeLoader } from "./loader.ts";
import { RawTreeSink } from "./sink.ts";

export * from "./client.ts";
export * from "./sink.ts";
export * from "./loader.ts";
export * from "./projection.ts";
export * from "./sql.ts";
export * from "./visibility.ts";
export * from "./event-sql.ts";
export * from "./event-log.ts";
export * from "./checkpoint.ts";
export * from "./event-restore.ts";
export { FakeRawTree, type AckMode } from "./fake-rawtree.ts";

/** Build client/sink/loader from the validated storage config (reads root .env; never prints values). */
export function rawTreeFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const cfg = loadConfig("storage", env);
  const client = new RawTreeClient({ baseUrl: cfg.RAWTREE_BASE_URL, apiKey: cfg.RAWTREE_API_KEY, database: cfg.RAWTREE_DATABASE });
  return { client, sink: new RawTreeSink(client), loader: new RawTreeLoader(client) };
}
