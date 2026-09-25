#!/usr/bin/env node
// check:lint — repository pattern lint for new DR code (no reformatting, reference/vendor trees excluded).
// This is not ESLint: it enforces whitespace hygiene plus the AGENTS.md anti-pattern search (Phase 7 step 4).
// A match is a review trigger; a clean run is not a correctness proof.
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files 'packages/*.ts' 'scripts/*.ts' 'scripts/*.mjs' 'bench/*.ts'", { encoding: "utf8" }).split("\n").filter((f) => f && f !== "scripts/lint.mjs");
const rules = [
  { id: "argmax-restore", re: /argMax\(/, allow: /closing-numbers|demo-numbers|as-of/i, why: "argMax(value, ts) must not order authoritative restore state" },
  { id: "json-patch", re: /applyPatch|jsonpatch|fast-json-patch/i, why: "no arbitrary JSON Patch into mission state" },
  { id: "planner-sql", re: /sql\s*:\s*(decision|proposal|model|planner)/i, why: "no model-authored SQL" },
  { id: "attempt-key", re: /actionKey\([^)]*(attempt|Date\.now|process\.pid|epoch)/, allow: /naive/i, why: "action keys never derive from attempt/time/pid/epoch (naive arm excepted and labeled)" },
  { id: "secret-log", re: /console\.(log|error)\([^)]*(API_KEY|_TOKEN)\b(?!["'`])/, why: "never log credentials" },
  { id: "debug-only", re: /\b(it|describe)\.only\(/, why: "focused test left in" },
];
let problems = 0;
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const r of rules) {
      if (r.re.test(line) && !(r.allow && r.allow.test(`${f} ${line}`))) { console.log(`${f}:${i + 1} [${r.id}] ${r.why}`); problems++; }
    }
    if (/[ \t]+$/.test(line)) { console.log(`${f}:${i + 1} [trailing-whitespace]`); problems++; }
  });
}
const dc = spawnSync("git", ["diff", "--check"], { encoding: "utf8" });
if (dc.stdout.trim()) { console.log(dc.stdout); problems++; }
console.log(`check:lint ${files.length} files, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
