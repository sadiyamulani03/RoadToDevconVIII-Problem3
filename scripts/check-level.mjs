#!/usr/bin/env node
/**
 * Freshness check: regenerates level artifacts into memory from shared/level.json
 * and fails (exit 1) if the committed generated files are stale.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

const targets = [
  join(root, "src", "generated", "LevelConfig.sol"),
  join(root, "frontend", "src", "generated", "levelConfig.ts"),
];

const before = targets.map((p) => normalize(readFileSync(p, "utf8")));

// Regenerate in place, compare, then restore if changed would be same anyway.
execFileSync(process.execPath, [join(root, "scripts", "generate-level.mjs")], {
  stdio: "pipe",
});

const after = targets.map((p) => normalize(readFileSync(p, "utf8")));

let ok = true;
for (let i = 0; i < targets.length; i++) {
  if (before[i] !== after[i]) {
    ok = false;
    console.error(`STALE generated file: ${targets[i]}`);
    console.error("Run `npm run generate:level` and commit the result.");
  }
}

if (ok) {
  console.log("OK: generated level files are up to date with shared/level.json");
  process.exit(0);
} else {
  process.exit(1);
}
