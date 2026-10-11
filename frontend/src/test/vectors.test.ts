// Cross-runtime determinism: the same input logs must produce identical
// states in the TypeScript engine and (per Foundry) in RunnerSim.sol.
// Vectors are generated once (scripts/gen-vectors.mjs) and consumed by both.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { run } from "../game/engine";

interface VectorCase {
  name: string;
  description: string;
  inputs: number[];
  status: string;
  ticks: number;
  timeMs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
}

interface VectorFile {
  levelId: string;
  tickRate: number;
  cases: VectorCase[];
}

function loadVectors(): VectorFile {
  const url = fileURLToPath(new URL("../../../shared/vectors.json", import.meta.url));
  return JSON.parse(readFileSync(url, "utf8")) as VectorFile;
}

const vectors = loadVectors();

describe("shared cross-runtime vectors", () => {
  it("file targets the right level and tick rate", () => {
    expect(vectors.levelId).toBe("ghost-sprint-v1");
    expect(vectors.tickRate).toBe(60);
    expect(vectors.cases.length).toBeGreaterThanOrEqual(10);
  });

  for (const c of vectors.cases) {
    it(`engine reproduces vector: ${c.name}`, () => {
      const result = run(Uint8Array.from(c.inputs));
      expect(result.status).toBe(c.status);
      expect(result.ticks).toBe(c.ticks);
      expect(result.timeMs).toBe(c.timeMs);
      expect(result.finalState.x).toBe(c.x);
      expect(result.finalState.y).toBe(c.y);
      expect(result.finalState.vx).toBe(c.vx);
      expect(result.finalState.vy).toBe(c.vy);
      expect(result.finalState.grounded).toBe(c.grounded);
    });
  }

  it("canonical run reaches the goal within the input bound", () => {
    const canonical = vectors.cases.find((c) => c.name === "canonical-win");
    expect(canonical).toBeDefined();
    expect(canonical!.status).toBe("won");
    expect(canonical!.inputs.length).toBeLessThanOrEqual(1200);
    expect(canonical!.inputs.length).toBe(canonical!.ticks);
  });
});
