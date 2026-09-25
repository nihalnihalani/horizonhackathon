// Freely running test process: no HOLD protocol and no provider access.
const work = setInterval(() => process.stdout.write("working\n"), 50);
if (process.env.DR_ARM === "naive" && process.argv.some((a) => a.endsWith("/finish"))) {
  setTimeout(() => { clearInterval(work); process.exit(0); }, 200);
}
