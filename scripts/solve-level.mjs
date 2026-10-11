#!/usr/bin/env node
/**
 * BFS solver for Ghost Sprint.
 *
 * Proves shared/level.json is beatable and produces the canonical
 * (tick-optimal) input log written to shared/canonical-run.json, which is
 * then consumed by:
 *   - scripts/gen-vectors.mjs  (cross-runtime test vectors + demo ghost)
 *   - Foundry / vitest tests
 *
 * The solver uses a fast mutable-state simulator for search speed, then
 * VERIFIES the found log against the real frontend engine
 * (frontend/src/game/engine.ts) before writing anything, after first
 * cross-checking the fast simulator against the real engine on random
 * states so any divergence fails loudly.
 *
 * Run: npm run solve
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { LEVEL } from "../frontend/src/generated/levelConfig.ts";
import {
  initialState,
  isValidInput,
  run,
  step,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
} from "../frontend/src/game/engine.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const P = LEVEL.physics;
const PL = LEVEL.player;
const WORLD = LEVEL.world;
const SCALE = P.positionScale;
const SOLIDS = LEVEL.solids;
const HAZARDS = LEVEL.hazards;
const GOAL = LEVEL.goal;
const MAX_X = WORLD.width - PL.width;
const MAX_Y = WORLD.height - PL.height;

const INPUTS = [
  0,
  INPUT_RIGHT,
  INPUT_JUMP,
  INPUT_RIGHT | INPUT_JUMP,
  INPUT_LEFT,
  INPUT_LEFT | INPUT_JUMP,
];

function tdiv(a, b) {
  const q = a / b;
  return q < 0 ? Math.ceil(q) : Math.floor(q);
}

function overlaps(ax, ay, aw, ah, b) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

/** Fast mutable-state step — must mirror frontend/src/game/engine.ts exactly. */
function stepInto(s, input) {
  if (s.status !== "playing") return;
  if (!isValidInput(input)) throw new Error(`invalid input ${input} at tick ${s.tick}`);

  const left = (input & INPUT_LEFT) !== 0;
  const right = (input & INPUT_RIGHT) !== 0;
  const jump = (input & INPUT_JUMP) !== 0;

  if (jump && s.grounded) {
    s.vy = -P.jumpVelocity;
    s.grounded = false;
  }

  s.vx = right ? P.moveSpeed : left ? -P.moveSpeed : 0;

  s.vy += P.gravity;
  if (s.vy > P.terminalVelocity) s.vy = P.terminalVelocity;

  s.x += tdiv(s.vx, SCALE);
  for (const r of SOLIDS) {
    if (overlaps(s.x, s.y, PL.width, PL.height, r)) {
      if (s.vx > 0) s.x = r.x - PL.width;
      else if (s.vx < 0) s.x = r.x + r.w;
      s.vx = 0;
    }
  }
  if (s.x < 0) {
    s.x = 0;
    s.vx = 0;
  } else if (s.x > MAX_X) {
    s.x = MAX_X;
    s.vx = 0;
  }

  s.grounded = false;
  s.y += tdiv(s.vy, SCALE);
  for (const r of SOLIDS) {
    if (overlaps(s.x, s.y, PL.width, PL.height, r)) {
      if (s.vy > 0) {
        s.y = r.y - PL.height;
      } else if (s.vy < 0) {
        s.y = r.y + r.h;
      }
      s.vy = 0;
    }
  }
  if (s.y < 0) {
    s.y = 0;
    if (s.vy < 0) s.vy = 0;
  }

  // ground probe (mirrors engine.ts / RunnerSim.sol)
  for (const r of SOLIDS) {
    if (overlaps(s.x, s.y + 1, PL.width, PL.height, r)) {
      s.grounded = true;
      break;
    }
  }

  s.tick += 1;

  for (const h of HAZARDS) {
    if (overlaps(s.x, s.y, PL.width, PL.height, h)) {
      s.status = "dead";
      return;
    }
  }
  if (overlaps(s.x, s.y, PL.width, PL.height, GOAL)) {
    s.status = "won";
    return;
  }
  if (s.y + PL.height > WORLD.height) {
    s.status = "dead";
    return;
  }
}

/** Random-state equivalence check: fast simulator vs real engine. */
function crossCheck(iterations) {
  let rng = 0x2f6e2b1;
  const rand = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  let s = initialState();
  for (let i = 0; i < iterations; i++) {
    const input = INPUTS[Math.floor(rand() * INPUTS.length)];
    const fast = { ...s };
    stepInto(fast, input);
    const real = step(s, input);
    for (const k of ["x", "y", "vx", "vy", "grounded", "status", "tick"]) {
      if (fast[k] !== real[k]) {
        throw new Error(
          `simulator divergence at i=${i} key=${k}: fast=${fast[k]} real=${real[k]}`,
        );
      }
    }
    s = real.status !== "playing" ? initialState() : real;
  }
  console.log(`cross-check OK: ${iterations} random steps match engine.ts`);
}

// ---------------- BFS ----------------

const X_COUNT = MAX_X + 1;
const Y_COUNT = MAX_Y + 1;

const vyIndex = new Int16Array(4096).fill(-1);
const vyValues = [];
function registerVy(v) {
  const i = v + 2048;
  if (i < 0 || i >= 4096) throw new Error(`vy out of lookup range: ${v}`);
  if (vyIndex[i] === -1) {
    vyIndex[i] = vyValues.length;
    vyValues.push(v);
  }
}
registerVy(0);
for (let k = 102; k <= 1734; k += 102) registerVy(k);
registerVy(P.terminalVelocity);
for (let v = -P.jumpVelocity + P.gravity; v <= 1728; v += 102) registerVy(v);
const NVY = vyValues.length;
console.log(`state space: x=${X_COUNT} y=${Y_COUNT} vy=${NVY} grounded=2`);

const encode = (x, y, vy, grounded) =>
  ((x * Y_COUNT + y) * NVY + vyIndex[vy + 2048]) * 2 + (grounded ? 1 : 0);
const STATE_COUNT = X_COUNT * Y_COUNT * NVY * 2;

const visited = new Uint8Array(STATE_COUNT);
const parent = new Int32Array(STATE_COUNT);
const inputOf = new Uint8Array(STATE_COUNT);
const depthArr = new Uint16Array(STATE_COUNT);
let visitedCount = 0;

function decode(key, s) {
  const g = key & 1;
  const rest = (key - g) / 2;
  const vi = rest % NVY;
  const rest2 = (rest - vi) / NVY;
  const y = rest2 % Y_COUNT;
  const x = (rest2 - y) / Y_COUNT;
  s.x = x;
  s.y = y;
  s.vy = vyValues[vi];
  s.grounded = g === 1;
  s.vx = 0;
  s.status = "playing";
  s.tick = 0;
}

function reconstruct(parentKey, lastInput) {
  const inputs = [lastInput];
  let k = parentKey;
  while (parent[k] !== -1) {
    inputs.push(inputOf[k]);
    k = parent[k];
  }
  inputs.reverse();
  return inputs;
}

function solve(maxDepthTicks) {
  const scratch = { x: 0, y: 0, vx: 0, vy: 0, grounded: true, status: "playing", tick: 0 };
  const s0 = initialState();
  const start = encode(s0.x, s0.y, s0.vy, s0.grounded ? 1 : 0);
  visited[start] = 1;
  depthArr[start] = 0;
  parent[start] = -1;
  visitedCount = 1;
  let queue = new Int32Array(1 << 22);
  queue[0] = start;
  let head = 0;
  let tail = 1;
  let deepest = 0;
  let lastLogged = -50;

  while (head < tail) {
    const key = queue[head++];
    const depth = depthArr[key];
    if (depth > deepest) {
      deepest = depth;
      if (deepest >= lastLogged + 50) {
        lastLogged = deepest;
        console.log(`  depth=${deepest} visited=${visitedCount} expanded=${head} queued=${tail}`);
      }
    }
    if (deepest >= maxDepthTicks) break;

    for (const input of INPUTS) {
      decode(key, scratch);
      scratch.status = "playing";
      scratch.tick = 0;
      stepInto(scratch, input);
      if (scratch.status === "won") return reconstruct(key, input);
      if (scratch.status === "dead") continue;
      const nkey = encode(scratch.x, scratch.y, scratch.vy, scratch.grounded ? 1 : 0);
      if (visited[nkey]) continue;
      visited[nkey] = 1;
      visitedCount++;
      parent[nkey] = key;
      inputOf[nkey] = input;
      depthArr[nkey] = depth + 1;
      if (tail === queue.length) {
        const bigger = new Int32Array(queue.length * 2);
        bigger.set(queue);
        queue = bigger;
      }
      queue[tail++] = nkey;
    }
  }
  return null;
}

function main() {
  crossCheck(50000);

  const started = Date.now();
  const maxDepth = LEVEL.physics.maxInputLength;
  console.log(`solving (max depth ${maxDepth} ticks)...`);

  const solution = solve(maxDepth);
  if (!solution) {
    console.error("NO SOLUTION: level appears unbeatable within max input length");
    process.exit(1);
  }

  const res = run(solution);
  if (res.status !== "won") {
    console.error(`verification FAILED: engine says ${res.status}`);
    // lockstep debug: fast sim vs engine
    let s = initialState();
    const fast = { x: s.x, y: s.y, vx: 0, vy: 0, grounded: true, status: "playing", tick: 0 };
    for (let i = 0; i < solution.length; i++) {
      const input = solution[i];
      const before = { ...fast };
      stepInto(fast, input);
      const real = step(s, input);
      for (const k of ["x", "y", "vx", "vy", "grounded", "status", "tick"]) {
        if (fast[k] !== real[k]) {
          console.error(`diverge at i=${i} input=${input} key=${k}: fast=${fast[k]} real=${real[k]}`);
          console.error("before:", JSON.stringify(before));
          console.error("real prev:", JSON.stringify(s));
          process.exit(1);
        }
      }
      s = real;
      if (s.status !== "playing") {
        console.error(`engine ended at i=${i} status=${s.status} state=${JSON.stringify(s)}`);
        break;
      }
    }
    console.error("fast final:", JSON.stringify(fast));
    process.exit(1);
  }
  const elapsed = Date.now() - started;
  console.log(
    `SOLVED in ${(elapsed / 1000).toFixed(1)}s: ticks=${res.ticks} timeMs=${res.timeMs} inputs=${solution.length}`,
  );

  const canonical = {
    levelId: LEVEL.id,
    note: "Tick-optimal run found by scripts/solve-level.mjs (BFS); verified against frontend/src/game/engine.ts.",
    ticks: res.ticks,
    timeMs: res.timeMs,
    inputLength: solution.length,
    final: { x: res.finalState.x, y: res.finalState.y, status: res.status },
    inputs: Array.from(solution),
  };
  const outPath = join(root, "shared", "canonical-run.json");
  writeFileSync(outPath, JSON.stringify(canonical, null, 2) + "\n");
  console.log("wrote", outPath);
}

main();
