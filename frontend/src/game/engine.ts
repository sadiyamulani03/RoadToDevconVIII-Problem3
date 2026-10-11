// Deterministic integer physics engine for Ghost Sprint.
//
// Mirrors src/RunnerSim.sol tick-for-tick. Integer-only math:
//   - Positions are whole world units (integers, y grows downward).
//   - Velocities are Q8 fixed point (units * 256 per tick).
//   - Displacement per tick is trunc(velocity / POSITION_SCALE) using
//     truncation toward zero — identical to Solidity integer division.
//   - Simulation state never depends on wall-clock timestamps, animation
//     frame callbacks, or random numbers (integer math only).
//
// Tick order (must match Solidity exactly):
//   1. validate + decode input byte (bit0 left, bit1 right, bit2 jump)
//   2. jump (only when grounded)
//   3. horizontal velocity from input
//   4. gravity + terminal clamp
//   5. horizontal move + solid resolution + world-edge clamp
//   6. vertical move (grounded cleared first) + solid resolution
//   6b. ground probe: grounded iff a 1-unit probe below the player touches a
//       solid (keeps jump input responsive on every resting tick)
//   7. hazard check -> dead
//   8. goal check -> won
//   9. fall out of world -> dead

import { LEVEL } from "../generated/levelConfig";

export type Rect = { x: number; y: number; w: number; h: number };

export type SimStatus = "playing" | "dead" | "won";

export interface SimState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  status: SimStatus;
  tick: number;
}

export const INPUT_LEFT = LEVEL.input.bitLeft;
export const INPUT_RIGHT = LEVEL.input.bitRight;
export const INPUT_JUMP = LEVEL.input.bitJump;
export const INPUT_INVALID_MASK = LEVEL.input.invalidMask;

export const MAX_INPUT_LENGTH = LEVEL.physics.maxInputLength;
export const TICK_RATE = LEVEL.physics.tickRate;

/** Truncating integer division toward zero — matches Solidity `a / b`. */
export function tdiv(a: number, b: number): number {
  const q = a / b;
  return q < 0 ? Math.ceil(q) : Math.floor(q);
}

export function initialState(): SimState {
  return {
    x: LEVEL.player.spawnX,
    y: LEVEL.player.spawnY,
    vx: 0,
    vy: 0,
    grounded: true,
    status: "playing",
    tick: 0,
  };
}

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  b: Rect,
): boolean {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

export function isValidInput(byte: number): boolean {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255) return false;
  if ((byte & INPUT_INVALID_MASK) !== 0) return false;
  const directions = INPUT_LEFT | INPUT_RIGHT;
  if ((byte & directions) === directions) return false;
  return true;
}

export class InvalidInputError extends Error {
  constructor(public readonly tick: number, public readonly byte: number) {
    super(`invalid input byte ${byte} at tick ${tick}`);
    this.name = "InvalidInputError";
  }
}

/** Advance the simulation by exactly one tick. Returns a new state. */
export function step(prev: SimState, input: number): SimState {
  if (prev.status !== "playing") return prev;
  if (!isValidInput(input)) throw new InvalidInputError(prev.tick, input);

  const s: SimState = { ...prev };
  const p = LEVEL.player;
  const P = LEVEL.physics;

  // 1. decode
  const left = (input & INPUT_LEFT) !== 0;
  const right = (input & INPUT_RIGHT) !== 0;
  const jump = (input & INPUT_JUMP) !== 0;

  // 2. jump
  if (jump && s.grounded) {
    s.vy = -P.jumpVelocity;
    s.grounded = false;
  }

  // 3. horizontal velocity
  s.vx = right ? P.moveSpeed : left ? -P.moveSpeed : 0;

  // 4. gravity
  s.vy += P.gravity;
  if (s.vy > P.terminalVelocity) s.vy = P.terminalVelocity;

  // 5. horizontal move + resolve
  const dx = tdiv(s.vx, P.positionScale);
  s.x += dx;
  for (const r of LEVEL.solids) {
    if (overlaps(s.x, s.y, p.width, p.height, r)) {
      if (s.vx > 0) s.x = r.x - p.width;
      else if (s.vx < 0) s.x = r.x + r.w;
      s.vx = 0;
    }
  }
  const maxX = LEVEL.world.width - p.width;
  if (s.x < 0) {
    s.x = 0;
    s.vx = 0;
  } else if (s.x > maxX) {
    s.x = maxX;
    s.vx = 0;
  }

  // 6. vertical move + resolve
  s.grounded = false;
  const dy = tdiv(s.vy, P.positionScale);
  s.y += dy;
  for (const r of LEVEL.solids) {
    if (overlaps(s.x, s.y, p.width, p.height, r)) {
      if (s.vy > 0) {
        s.y = r.y - p.height;
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

  // 6b. ground probe: a 1-unit rect below the player must intersect a solid.
  //     Probing (instead of requiring an overlap this tick) keeps `grounded`
  //     stable while resting, so a jump input is honoured on every tick the
  //     player stands on a surface.
  for (const r of LEVEL.solids) {
    if (overlaps(s.x, s.y + 1, p.width, p.height, r)) {
      s.grounded = true;
      break;
    }
  }

  s.tick = prev.tick + 1;

  // 7. hazards
  for (const h of LEVEL.hazards) {
    if (overlaps(s.x, s.y, p.width, p.height, h)) {
      s.status = "dead";
      return s;
    }
  }

  // 8. goal
  if (overlaps(s.x, s.y, p.width, p.height, LEVEL.goal)) {
    s.status = "won";
    return s;
  }

  // 9. fell out of world
  if (s.y + p.height > LEVEL.world.height) {
    s.status = "dead";
    return s;
  }

  return s;
}

export interface RunResult {
  status: SimStatus;
  ticks: number;
  timeMs: number;
  finalState: SimState;
}

/** Authoritative completion time in ms: trunc(ticks * 1000 / tickRate). */
export function timeMsFromTicks(ticks: number): number {
  return tdiv(ticks * 1000, TICK_RATE);
}

export function validateInputLog(inputs: Uint8Array): void {
  if (inputs.length === 0) throw new Error("empty input log");
  if (inputs.length > MAX_INPUT_LENGTH) {
    throw new Error(`input log too long: ${inputs.length} > ${MAX_INPUT_LENGTH}`);
  }
  for (let i = 0; i < inputs.length; i++) {
    if (!isValidInput(inputs[i]!)) throw new InvalidInputError(i, inputs[i]!);
  }
}

/**
 * Run a full input log from a fresh spawn. Mirrors the Solidity
 * GhostSprint.runSimulation exactly, including early stop conditions.
 */
export function run(inputs: Uint8Array | number[]): RunResult {
  const bytes = inputs instanceof Uint8Array ? inputs : Uint8Array.from(inputs);
  validateInputLog(bytes);
  let s = initialState();
  for (let i = 0; i < bytes.length; i++) {
    if (s.status !== "playing") break;
    s = step(s, bytes[i]!);
  }
  return {
    status: s.status,
    ticks: s.tick,
    timeMs: timeMsFromTicks(s.tick),
    finalState: s,
  };
}

/** Encode combined flags into a validated input byte. */
export function encodeInput(left: boolean, right: boolean, jump: boolean): number {
  if (left && right) return 0;
  return (left ? INPUT_LEFT : 0) | (right ? INPUT_RIGHT : 0) | (jump ? INPUT_JUMP : 0);
}
