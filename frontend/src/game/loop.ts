// Fixed-timestep game loop. Simulation ticks are driven exclusively by an
// accumulator against a constant TICK_MS — never by wall-clock deltas — so
// the recorded input log reproduces exactly in RunnerSim.sol.

import { TICK_RATE } from "./engine";

export const TICK_MS = 1000 / TICK_RATE; // 16.666... ms at 60 Hz

/** Max wall-clock delta consumed per frame (ms) — tab-switch protection. */
const MAX_FRAME_DELTA_MS = 250;
/** Max simulation ticks executed per frame (catch-up clamp). */
const MAX_TICKS_PER_FRAME = 10;

export interface LoopCallbacks {
  /** Advance simulation by exactly one tick. */
  tick: () => void;
  /** Draw the current frame. */
  draw: () => void;
}

/**
 * requestAnimationFrame loop with a fixed-step accumulator.
 * Returns a stop function.
 */
export function startLoop(callbacks: LoopCallbacks): () => void {
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let stopped = false;

  const frame = (now: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    let delta = now - last;
    last = now;
    if (delta > MAX_FRAME_DELTA_MS) delta = MAX_FRAME_DELTA_MS;
    acc += delta;
    let ticks = 0;
    while (acc >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
      acc -= TICK_MS;
      if (stopped) return;
      callbacks.tick();
      ticks++;
    }
    callbacks.draw();
  };

  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
