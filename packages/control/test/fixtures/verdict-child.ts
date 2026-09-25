// F6b fixture: floods stdout, writes the verdict line last and exits as soon as it is flushed (the runner's
// exitAfterFlush); the parent must still parse the verdict before its exit bookkeeping.
import { exitAfterFlush } from "@dr/runner/io";
const filler = "x".repeat(200);
let out = "";
for (let i = 0; i < 3000; i++) out += `filler ${i} ${filler}\n`;
process.stdout.write(out);
process.stdout.write(`@@DR ${JSON.stringify({ kind: "verdict", verdict: "VALID", reason: "fixture verdict after a large stdout burst", duplicate_effects: 0, stale_actions: 0 })}\n`);
exitAfterFlush(0);
