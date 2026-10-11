// Determinism guarantees for cross-runtime replay:
//  - the engine source never reads wall clocks, rAF timestamps, or RNG
//  - all physics values are integers (Q8 fixed point)
//  - replaying the same input log twice yields identical trajectories
//  - stored (and re-loaded) runs replay identically after a "reload"

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  INPUT_JUMP,
  INPUT_RIGHT,
  initialState,
  run,
  step,
  timeMsFromTicks,
  type SimState,
} from "../game/engine";
import { LEVEL } from "../generated/levelConfig";
import { DEMO_RUN } from "../game/demoRun";

const engineSource = readFileSync(
  fileURLToPath(new URL("../game/engine.ts", import.meta.url)),
  "utf8",
);

describe("determinism: engine source hygiene", () => {
  it("never reads wall clocks, rAF, or RNG", () => {
    for (const banned of ["Date.now", "performance.now", "requestAnimationFrame", "Math.random", "getTime"]) {
      expect(engineSource).not.toContain(banned);
    }
  });

  it("physics constants are all integers", () => {
    const values = [
      LEVEL.physics.tickRate,
      LEVEL.physics.maxInputLength,
      LEVEL.physics.moveSpeed,
      LEVEL.physics.jumpVelocity,
      LEVEL.physics.gravity,
      LEVEL.physics.terminalVelocity,
      LEVEL.physics.positionScale,
      LEVEL.player.spawnX,
      LEVEL.player.spawnY,
      LEVEL.player.width,
      LEVEL.player.height,
      LEVEL.world.width,
      LEVEL.world.height,
    ];
    for (const v of values) expect(Number.isInteger(v)).toBe(true);
    for (const r of [...LEVEL.solids, ...LEVEL.hazards, LEVEL.goal]) {
      expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
      expect(Number.isInteger(r.w) && Number.isInteger(r.h)).toBe(true);
    }
  });

  it("documents the shared tick order", () => {
    expect(engineSource).toMatch(/Tick order/);
    expect(engineSource).toMatch(/ground probe/);
  });
});

describe("determinism: identical inputs, identical trajectories", () => {
  const sampleInputs = Uint8Array.from([
    INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT | INPUT_JUMP,
    INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT, INPUT_RIGHT | INPUT_JUMP,
    ...new Array(40).fill(INPUT_RIGHT),
  ]);

  function trajectories(inputs: Uint8Array): SimState[] {
    let s = initialState();
    const out: SimState[] = [{ ...s }];
    for (const b of inputs) {
      if (s.status !== "playing") break;
      s = step(s, b);
      out.push({ ...s });
    }
    return out;
  }

  it("two fresh runs match tick-for-tick", () => {
    const a = trajectories(sampleInputs);
    const b = trajectories(sampleInputs);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  it("demo run replays deterministically after simulated reload", () => {
    const first = run(DEMO_RUN.inputs);
    // "reload": brand-new engine call from the same stored bytes
    const second = run(Uint8Array.from(DEMO_RUN.inputs));
    expect(second).toEqual(first);
    expect(first.status).toBe("won");
    expect(first.ticks).toBe(DEMO_RUN.ticks);
    expect(first.timeMs).toBe(DEMO_RUN.timeMs);
    expect(timeMsFromTicks(first.ticks)).toBe(first.timeMs);
  });
});
