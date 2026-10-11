#!/usr/bin/env node
/**
 * Cross-runtime test vector generator.
 *
 * Builds deterministic input-log cases from shared/canonical-run.json plus
 * parameterized probes (deaths, walls, clamps, length boundaries), runs them
 * through the authoritative frontend engine, and emits:
 *
 *   - shared/vectors.json              (consumed by vitest)
 *   - test/generated/Vectors.sol       (consumed by forge test)
 *   - frontend/src/game/demoRun.ts     (bundled demo ghost, clearly labelled)
 *
 * Every emitted expectation is produced by the engine and re-asserted here,
 * so a divergence between this script and the engine fails the build.
 *
 * Run:   npm run gen:vectors
 * Check: npm run check:vectors   (regenerates in memory, fails if stale)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { LEVEL } from "../frontend/src/generated/levelConfig.ts";
import {
  run,
  step,
  initialState,
  timeMsFromTicks,
  validateInputLog,
} from "../frontend/src/game/engine.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const R = LEVEL;
const P = R.player;

function expect(cond, msg) {
  if (!cond) {
    console.error(`EXPECTATION FAILED: ${msg}`);
    process.exit(1);
  }
}

function record(name, inputs, description) {
  const bytes = Uint8Array.from(inputs);
  validateInputLog(bytes);
  const res = run(bytes);
  const case_ = {
    name,
    description,
    inputs: Array.from(bytes),
    status: res.status,
    ticks: res.ticks,
    timeMs: res.timeMs,
    x: res.finalState.x,
    y: res.finalState.y,
    vx: res.finalState.vx,
    vy: res.finalState.vy,
    grounded: res.finalState.grounded,
  };
  return case_;
}

// ------------------------------------------------------------------
// 1. canonical run + truncations
// ------------------------------------------------------------------
const canonical = JSON.parse(readFileSync(join(root, "shared", "canonical-run.json"), "utf8"));
expect(canonical.levelId === R.id, "canonical run is for this level");
const canon = canonical.inputs;
const canonRes = run(canon);
expect(canonRes.status === "won", "canonical run must win");

const cases = [];

cases.push(
  record("canonical-win", canon, "Tick-optimal verified reference run from scripts/solve-level.mjs."),
);
expect(canonRes.ticks === canonical.ticks, "canonical ticks match stored artifact");

cases.push(
  record("stop-before-goal", canon.slice(0, canon.length - 1), "Final input removed: stops just before the goal and must stay incomplete."),
);
expect(
  cases[cases.length - 1].status === "playing",
  "truncated run must be incomplete (proof that reaching the goal is required)",
);

cases.push(
  record("short-incomplete", canon.slice(0, 30), "Early prefix: still playing, far from goal."),
);
expect(cases[cases.length - 1].status === "playing", "short prefix incomplete");

// 2. idle / clamp probes
cases.push(record("neutral-idle", new Array(60).fill(0), "60 neutral ticks: player stands at spawn."));
expect(cases[cases.length - 1].status === "playing", "idle stays playing");
expect(cases[cases.length - 1].ticks === 60, "idle tick count");

cases.push(record("left-clamp", new Array(40).fill(1), "Holding left clamps at world edge x=0."));
expect(cases[cases.length - 1].status === "playing", "left clamp alive");
expect(cases[cases.length - 1].x === 0, "left clamp position");

// 3. hazard death: walk right from spawn into the first spike cluster
cases.push(record("spikes-death", new Array(40).fill(2), "Walking right from spawn runs into spikes A."));
expect(cases[cases.length - 1].status === "dead", "spike walk must die");

// 4. wall block: prefix of the canonical run onto wallW1's top, walk off it,
//    land beside the wall on groundB, then walk right into the wall.
let wallIdx = -1;
let wallState = null;
{
  let st = initialState();
  for (let i = 0; i < canon.length; i++) {
    st = step(st, canon[i]);
    if (st.status !== "playing") break;
    const wallTop = 216; // wallW1.y == ledgeP1.y
    if (st.grounded && st.y === wallTop - P.height && st.x >= 264 && st.x <= 276) {
      wallIdx = i;
      wallState = st;
      break;
    }
  }
}
expect(wallIdx >= 0, "canonical run lands on wallW1 top");
const wallInputs = [...canon.slice(0, wallIdx + 1)];
{
  let st = wallState;
  // walk left until we step off the wall (x <= 250 means no support)
  while (st.status === "playing" && st.x > 250) {
    st = step(st, 1);
    wallInputs.push(1);
  }
  // fall straight down onto groundB beside the wall
  let guard = 0;
  while (st.status === "playing" && !st.grounded && guard++ < 120) {
    st = step(st, 0);
    wallInputs.push(0);
  }
  expect(st.status === "playing", "drop beside wall must be alive");
  expect(st.x > 192 && st.x < 252, "drop lands on groundB left of the wall");
  // walk right into wallW1: solid collision must pin the player
  for (let i = 0; i < 10 && st.status === "playing"; i++) {
    st = step(st, 2);
    wallInputs.push(2);
  }
}
cases.push(record("wall-block-right", wallInputs, "Walking right into wallW1 pins the player at x=252."));
expect(cases[cases.length - 1].status === "playing", "wall walk alive");
expect(
  cases[cases.length - 1].x === 252,
  `wall pins player at x=252 (got ${cases[cases.length - 1].x})`,
);

// 5. fall out of world: prefix of canonical run while airborne over gap 1, then neutral
let gapIdx = -1;
{
  let st = initialState();
  const gapA = R.solids[0].x + R.solids[0].w; // end of groundA/ledge
  const gapB = R.solids[1].x - P.width; // last x with feet fully over groundB
  for (let i = 0; i < canon.length; i++) {
    st = step(st, canon[i]);
    if (st.status !== "playing") break;
    // no solid exists strictly between the two ground segments, so any state
    // whose full width sits over the gap is airborne and unrecoverable
    if (st.x > gapA && st.x < gapB) {
      gapIdx = i;
      break;
    }
  }
}
expect(gapIdx >= 0, "canonical run is airborne over gap 1");
const gapInputs = [...canon.slice(0, gapIdx + 1), ...new Array(60).fill(0)];
cases.push(record("gap-death", gapInputs, "Airborne over gap 1 with neutral input: falls out of the world."));
expect(cases[cases.length - 1].status === "dead", "gap fall must die");
expect(
  cases[cases.length - 1].y + P.height > R.world.height,
  "gap death must be an out-of-world fall",
);

// 6. max length boundary: neutral log of exactly MAX_INPUT_LENGTH
const maxLen = R.physics.maxInputLength;
cases.push(record("max-length-neutral", new Array(maxLen).fill(0), `Exactly ${maxLen} neutral ticks: accepted, still incomplete.`));
expect(cases[cases.length - 1].status === "playing", "max length neutral incomplete");
expect(cases[cases.length - 1].ticks === maxLen, "max length neutral ticks");

// 7. goal at the last permitted tick: pad the canonical run to exactly maxLen
const pad = maxLen - canon.length;
expect(pad >= 0, "canonical run fits in max input length");
const lastTickInputs = [...new Array(pad).fill(0), ...canon];
expect(lastTickInputs.length === maxLen, "padded log is exactly max length");
cases.push(record("goal-last-tick", lastTickInputs, `Goal reached at the last permitted tick (${maxLen}).`));
expect(cases[cases.length - 1].status === "won", "last-tick goal must win");
expect(cases[cases.length - 1].ticks === maxLen, "last-tick goal tick count");
expect(cases[cases.length - 1].timeMs === timeMsFromTicks(maxLen), "last-tick goal time");

console.log(`built ${cases.length} vector cases`);

// ------------------------------------------------------------------
// Emit: shared/vectors.json
// ------------------------------------------------------------------
const vectors = {
  generated: "scripts/gen-vectors.mjs",
  note: "Cross-runtime reference vectors. Expectations are produced by frontend/src/game/engine.ts and asserted by both forge and vitest.",
  levelId: R.id,
  tickRate: R.physics.tickRate,
  cases,
};
const vectorsJson = JSON.stringify(vectors, null, 2) + "\n";

// ------------------------------------------------------------------
// Emit: test/generated/Vectors.sol
// ------------------------------------------------------------------
const solCases = cases
  .map((c, idx) => {
    const hex = Buffer.from(Uint8Array.from(c.inputs)).toString("hex");
    return (
      `        cs[${idx}] = Case({\n` +
      `            name: ${JSON.stringify(c.name)},\n` +
      `            inputs: hex"${hex}",\n` +
      `            status: "${c.status}",\n` +
      `            ticks: ${c.ticks},\n` +
      `            timeMs: ${c.timeMs},\n` +
      `            x: ${c.x},\n` +
      `            y: ${c.y},\n` +
      `            vx: ${c.vx},\n` +
      `            vy: ${c.vy},\n` +
      `            grounded: ${c.grounded}\n` +
      `        });`
    );
  })
  .join("\n");

const sol = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ============================================================
// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: shared/canonical-run.json + engine simulation
// Regenerate:      npm run gen:vectors
// Verify:          npm run check:vectors
// ============================================================

library Vectors {
    struct Case {
        string name;
        bytes inputs;
        string status;
        uint256 ticks;
        uint256 timeMs;
        int256 x;
        int256 y;
        int256 vx;
        int256 vy;
        bool grounded;
    }

    function cases() internal pure returns (Case[] memory cs) {
        cs = new Case[](${cases.length});
${solCases}
    }
}
`;

// ------------------------------------------------------------------
// Emit: frontend/src/game/demoRun.ts
// ------------------------------------------------------------------
const demo = `// ============================================================
// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: shared/canonical-run.json
// Regenerate:      npm run gen:vectors
// Verify:          npm run check:vectors
// ============================================================

/**
 * Bundled demo run for ghost racing before/without an onchain deployment.
 *
 * This run is NOT onchain-verified: it is a locally computed reference run.
 * The UI must label it as such. Ghosts sourced from the GhostSprint contract
 * are marked verified because their input log was re-simulated onchain.
 */
export const DEMO_RUN = {
  runId: 0,
  label: "Demo run (bundled, not onchain-verified)",
  verified: false,
  levelId: ${JSON.stringify(canonical.levelId)},
  ticks: ${canonRes.ticks},
  timeMs: ${canonRes.timeMs},
  inputs: Uint8Array.from([${Array.from(canon).join(", ")}]),
} as const;

export default DEMO_RUN;
`;

// ------------------------------------------------------------------
// Write or check
// ------------------------------------------------------------------
const outputs = [
  [join(root, "shared", "vectors.json"), vectorsJson],
  [join(root, "test", "generated", "Vectors.sol"), sol],
  [join(root, "frontend", "src", "game", "demoRun.ts"), demo],
];

let stale = false;
for (const [path, content] of outputs) {
  let existing = null;
  try {
    existing = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  } catch {
    existing = null;
  }
  const normalized = content.replace(/\r\n/g, "\n");
  if (CHECK) {
    if (existing !== normalized) {
      stale = true;
      console.error(`STALE generated file: ${path}`);
    }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log("generated:", path);
  }
}

if (CHECK) {
  if (stale) {
    console.error("Run `npm run gen:vectors` and commit the result.");
    process.exit(1);
  }
  console.log("OK: generated vector files are up to date");
}
