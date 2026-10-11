#!/usr/bin/env node
// Syncs src/GhostSprint.sol's ABI into frontend/src/abi/ghostSprint.ts.
// Usage: node scripts/sync-abi.mjs   (requires a prior `forge build`)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = join(root, "out", "GhostSprint.sol", "GhostSprint.json");
const outFile = join(root, "frontend", "src", "abi", "ghostSprint.ts");

let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
} catch (err) {
  console.error(`error: cannot read ${artifactPath}`);
  console.error("Run `forge build` first.");
  process.exit(1);
}
if (!artifact.abi || !Array.isArray(artifact.abi)) {
  console.error("error: artifact has no abi array");
  process.exit(1);
}

const abiJson = JSON.stringify(artifact.abi, null, 2);
const content = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/sync-abi.mjs from out/GhostSprint.sol/GhostSprint.json.
// Re-run \`forge build && npm run sync:abi\` after changing src/GhostSprint.sol.

export const ghostSprintAbi = ${abiJson} as const;

export type GhostSprintAbi = typeof ghostSprintAbi;
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, content);
const fns = artifact.abi.filter((e) => e.type === "function").length;
const evs = artifact.abi.filter((e) => e.type === "event").length;
const errs = artifact.abi.filter((e) => e.type === "error").length;
console.log(`wrote ${outFile} (${fns} functions, ${evs} events, ${errs} errors)`);
