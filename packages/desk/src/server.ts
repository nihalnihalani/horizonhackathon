// dev:desk entrypoint — 127.0.0.1:<DR_WORLD_BASE_URL port> + feed 127.0.0.1:<DR_FEED_PORT> (status.html only).
import { loadConfig } from "@dr/shared";
import { DeskStore } from "./store.ts";
import { startDesk } from "./app.ts";

const cfg = loadConfig("desk");
const port = Number(new URL(cfg.DR_WORLD_BASE_URL).port || 4401);
const store = new DeskStore(cfg.DR_DESK_DB);
const desk = await startDesk({ store, worldToken: cfg.DR_WORLD_TOKEN, operatorToken: cfg.DR_OPERATOR_TOKEN, port, feedPort: cfg.DR_FEED_PORT });
console.log(`desk listening ${desk.url} (db ${cfg.DR_DESK_DB === ":memory:" ? "memory" : "file"}) · feed ${desk.feedUrl} (GET /status.html only) · world v${store.worldVersion().version}`);
const stop = async () => { await desk.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
