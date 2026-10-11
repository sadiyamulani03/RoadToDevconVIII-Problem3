// Level parity: the generated TS module must be a faithful projection of
// shared/level.json (the single source of truth), so the frontend, the
// contract (via LevelConfig.sol), the solver and the vectors all describe
// exactly the same level.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEVEL } from "../generated/levelConfig";

interface LevelJson {
  meta: { name: string; id: string; description?: string };
  world: { width: number; height: number };
  player: { spawnX: number; spawnY: number; width: number; height: number };
  solids: { x: number; y: number; w: number; h: number }[];
  hazards: { x: number; y: number; w: number; h: number }[];
  goal: { x: number; y: number; w: number; h: number };
  physics: {
    tickRate: number;
    maxInputLength: number;
    moveSpeed: number;
    jumpVelocity: number;
    gravity: number;
    terminalVelocity: number;
    positionScale: number;
  };
  input: {
    bitLeft: number;
    bitRight: number;
    bitJump: number;
    invalidMask: number;
  };
}

const source: LevelJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../shared/level.json", import.meta.url)), "utf8"),
);

describe("generated levelConfig.ts vs shared/level.json", () => {
  it("matches the source of truth exactly", () => {
    // JSON solids/hazards carry an extra "name" label the generator turns
    // into comments; compare geometry only.
    const strip = (r: { x: number; y: number; w: number; h: number }) => ({
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    });
    expect(LEVEL.id).toBe(source.meta.id);
    expect(LEVEL.name).toBe(source.meta.name);
    expect({ ...LEVEL.world }).toEqual(source.world);
    expect({ ...LEVEL.player }).toEqual(source.player);
    expect(LEVEL.solids.map(strip)).toEqual(source.solids.map(strip));
    expect(LEVEL.hazards.map(strip)).toEqual(source.hazards.map(strip));
    expect(strip(LEVEL.goal)).toEqual(source.goal);
    expect({ ...LEVEL.physics }).toEqual(source.physics);
    // input block in JSON carries a documentation "note" field
    expect({ ...LEVEL.input }).toEqual({
      bitLeft: source.input.bitLeft,
      bitRight: source.input.bitRight,
      bitJump: source.input.bitJump,
      invalidMask: source.input.invalidMask,
    });
  });

  it("the level is solvable in principle (canonical run exists and wins)", async () => {
    const { run } = await import("../game/engine");
    const canonical = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../shared/canonical-run.json", import.meta.url)),
        "utf8",
      ),
    ) as { inputs: number[]; ticks: number; timeMs: number };
    const result = run(Uint8Array.from(canonical.inputs));
    expect(result.status).toBe("won");
    expect(result.ticks).toBe(canonical.ticks);
  });
});
