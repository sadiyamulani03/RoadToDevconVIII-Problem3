// Ghost data guarantees:
//  - the bundled demo run is locally computed, clearly labeled unverified,
//    and actually reaches the goal
//  - local practice runs survive a storage round-trip (simulating reload)
//  - input logs always respect the contract's encoding rules

import { describe, expect, it, beforeEach } from "vitest";
import { DEMO_RUN } from "../game/demoRun";
import { run, isValidInput, MAX_INPUT_LENGTH } from "../game/engine";
import { clearLocalRuns, loadLocalRuns, saveLocalRun } from "../lib/localRuns";

// minimal localStorage stub for the node test environment
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

describe("demo run (bundled ghost)", () => {
  it("is explicitly labeled as not onchain-verified", () => {
    expect(DEMO_RUN.verified).toBe(false);
    expect(DEMO_RUN.label).toMatch(/not onchain-verified/i);
  });

  it("reaches the goal and matches its declared metadata", () => {
    const result = run(DEMO_RUN.inputs);
    expect(result.status).toBe("won");
    expect(result.ticks).toBe(DEMO_RUN.ticks);
    expect(result.timeMs).toBe(DEMO_RUN.timeMs);
    expect(DEMO_RUN.inputs.length).toBeLessThanOrEqual(MAX_INPUT_LENGTH);
    for (const b of DEMO_RUN.inputs) expect(isValidInput(b)).toBe(true);
  });
});

describe("local practice ghosts", () => {
  beforeEach(() => {
    clearLocalRuns();
  });

  it("round-trips through storage and replays identically", () => {
    const inputs = Array.from(DEMO_RUN.inputs);
    const saved = saveLocalRun({
      label: "practice",
      ticks: DEMO_RUN.ticks,
      timeMs: DEMO_RUN.timeMs,
      inputs,
    });
    expect(saved[0]!.verified).toBe(false); // never claim verification locally

    // simulated page reload
    const loaded = loadLocalRuns();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.inputs).toEqual(inputs);
    const replay = run(Uint8Array.from(loaded[0]!.inputs));
    expect(replay.status).toBe("won");
    expect(replay.ticks).toBe(DEMO_RUN.ticks);
  });

  it("keeps only the most recent runs, capped", () => {
    for (let i = 0; i < 15; i++) {
      saveLocalRun({ label: `p${i}`, ticks: 1, timeMs: 16, inputs: [0] });
    }
    expect(loadLocalRuns().length).toBeLessThanOrEqual(10);
  });

  it("survives corrupted storage gracefully", () => {
    store.set("ghostsprint.localruns.v1", "{not json");
    expect(loadLocalRuns()).toEqual([]);
  });
});
