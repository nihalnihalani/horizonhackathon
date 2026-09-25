// npm run demo:naive — the naive transcript-resume baseline alone on fixture F3 (same kill/world-edit/resume path).
process.argv.push("--arm=naive");
await import("./demo-f3.ts");
