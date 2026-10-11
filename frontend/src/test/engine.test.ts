import { describe, expect, it } from "vitest";
import {
  InvalidInputError,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  MAX_INPUT_LENGTH,
  TICK_RATE,
  encodeInput,
  initialState,
  isValidInput,
  run,
  step,
  timeMsFromTicks,
  validateInputLog,
} from "../game/engine";
import { LEVEL } from "../generated/levelConfig";

describe("engine physics semantics", () => {
  it("rests stably: grounded stays true while idle on the spawn platform", () => {
    let s = initialState();
    expect(s.grounded).toBe(true);
    for (let i = 0; i < 10; i++) {
      s = step(s, 0);
      expect(s.grounded).toBe(true);
      expect(s.y).toBe(LEVEL.player.spawnY); // snapped back every cycle
      expect(s.vy).toBeLessThanOrEqual(LEVEL.physics.gravity * 3);
    }
  });

  it("jump is honoured on every resting tick (ground probe)", () => {
    for (let pad = 0; pad < 3; pad++) {
      let s = initialState();
      for (let i = 0; i < pad; i++) s = step(s, 0);
      expect(s.grounded).toBe(true);
      const jumped = step(s, INPUT_JUMP);
      expect(jumped.vy).toBe(-LEVEL.physics.jumpVelocity + LEVEL.physics.gravity);
      expect(jumped.grounded).toBe(false);
      expect(jumped.y).toBeLessThan(s.y);
    }
  });

  it("tdiv truncates toward zero (Solidity parity)", () => {
    expect(timeMsFromTicks(141)).toBe(2350);
    expect(timeMsFromTicks(1)).toBe(16);
    expect(timeMsFromTicks(60)).toBe(1000);
    expect(timeMsFromTicks(0)).toBe(0);
  });

  it("rejects left+right and out-of-range bytes", () => {
    expect(isValidInput(0)).toBe(true);
    expect(isValidInput(INPUT_LEFT)).toBe(true);
    expect(isValidInput(INPUT_RIGHT)).toBe(true);
    expect(isValidInput(INPUT_JUMP)).toBe(true);
    expect(isValidInput(INPUT_LEFT | INPUT_JUMP)).toBe(true);
    expect(isValidInput(INPUT_RIGHT | INPUT_JUMP)).toBe(true);
    expect(isValidInput(3)).toBe(false); // left+right
    expect(isValidInput(7)).toBe(false); // left+right+jump
    expect(isValidInput(8)).toBe(false); // invalid mask bit
    expect(isValidInput(255)).toBe(false);
    expect(isValidInput(-1)).toBe(false);
    expect(isValidInput(256)).toBe(false);
  });

  it("encodeInput never emits left+right", () => {
    expect(encodeInput(true, true, false)).toBe(0);
    expect(encodeInput(true, true, true)).toBe(0);
    expect(encodeInput(false, true, true)).toBe(INPUT_RIGHT | INPUT_JUMP);
  });

  it("walls stop horizontal movement", () => {
    const wall = LEVEL.solids.find((r) => r.w === 12 && r.h === 32)!; // wallW1
    let s = { ...initialState(), x: 250, y: 232, vx: 0, vy: 0, grounded: true };
    for (let i = 0; i < 10 && s.status === "playing"; i++) {
      s = step(s, INPUT_RIGHT);
    }
    expect(s.status).toBe("playing");
    expect(s.x).toBe(wall.x - LEVEL.player.width); // pressed against the wall
    expect(s.vx).toBe(0);
  });

  it("spike hazard kills on contact", () => {
    let s = initialState();
    for (let i = 0; i < 60 && s.status === "playing"; i++) {
      s = step(s, INPUT_RIGHT); // walk straight into spikesA at x=56
    }
    expect(s.status).toBe("dead");
  });

  it("falling out of the world kills", () => {
    let s = { ...initialState(), x: 160, y: LEVEL.world.height - 8, grounded: false };
    s = step(s, 0);
    expect(s.status).toBe("dead");
  });

  it("goal overlap wins", () => {
    const g = LEVEL.goal;
    let s = {
      ...initialState(),
      x: g.x + 2,
      y: g.y + 10,
      grounded: false,
    };
    s = step(s, 0);
    expect(s.status).toBe("won");
  });

  it("terminal velocity clamp holds", () => {
    let s = { ...initialState(), y: 40, grounded: false, vy: LEVEL.physics.terminalVelocity - 10 };
    for (let i = 0; i < 30 && s.status === "playing"; i++) s = step(s, 0);
    expect(s.vy).toBeLessThanOrEqual(LEVEL.physics.terminalVelocity);
  });

  it("input log validation bounds", () => {
    expect(() => validateInputLog(new Uint8Array(0))).toThrow(/empty/);
    expect(() => validateInputLog(new Uint8Array(MAX_INPUT_LENGTH + 1))).toThrow(/too long/);
    expect(() => validateInputLog(Uint8Array.from([0, 3]))).toThrow(InvalidInputError);
    expect(() => validateInputLog(new Uint8Array(MAX_INPUT_LENGTH))).not.toThrow();
  });

  it("step refuses to advance finished runs", () => {
    const dead = { ...initialState(), status: "dead" as const };
    expect(step(dead, 0)).toBe(dead);
  });

  it("constants are the shared level's integers", () => {
    expect(TICK_RATE).toBe(60);
    expect(MAX_INPUT_LENGTH).toBe(1200);
    expect(LEVEL.physics.positionScale).toBe(256);
  });

  it("run() reports the canonical win", () => {
    // simple smoke: a straight walk dies; the engine surfaces status, not time
    const walk = new Uint8Array(50).fill(INPUT_RIGHT);
    const result = run(walk);
    expect(result.status).toBe("dead");
    expect(result.ticks).toBeGreaterThan(0);
  });
});
