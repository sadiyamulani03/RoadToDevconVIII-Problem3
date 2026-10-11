// React binding for the game: keyboard/touch input, fixed-step loop,
// ghost racing, local replay. The simulation itself lives in engine.ts and
// is completely deterministic — this hook only sequences it.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  encodeInput,
  initialState,
  run as runInputs,
  step,
  timeMsFromTicks,
  type SimState,
} from "./engine";
import { startLoop } from "./loop";
import {
  burstParticles,
  createRenderState,
  drawFrame,
  updateParticles,
  type RenderState,
} from "./render";

export type GameStatus = "idle" | "playing" | "won" | "dead";

export interface GhostRun {
  id: string;
  label: string;
  verified: boolean;
  ticks: number;
  timeMs: number;
  inputs: Uint8Array;
}

export interface RunOutcome {
  status: "won" | "dead";
  ticks: number;
  timeMs: number;
  inputs: Uint8Array;
  /** Delta vs the ghost raced in this run (negative = faster). */
  ghostDeltaMs: number | null;
  ghostLabel: string | null;
  ghostVerified: boolean | null;
}

interface Flags {
  left: boolean;
  right: boolean;
  jump: boolean;
}

const HUD_UPDATE_EVERY_TICKS = 3;

export interface GameApi {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  status: GameStatus;
  ticks: number;
  timeMs: number;
  outcome: RunOutcome | null;
  ghost: GhostRun | null;
  ghostReady: boolean;
  start: () => void;
  reset: () => void;
  setGhost: (ghost: GhostRun | null) => void;
  dismissOutcome: () => void;
  /** On-screen touch controls (mobile). */
  touchFlags: (flag: "left" | "right" | "jump", down: boolean) => void;
}

export function useGame(): GameApi {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const flagsRef = useRef<Flags>({ left: false, right: false, jump: false });
  const simRef = useRef<SimState>(initialState());
  const inputsRef = useRef<number[]>([]);
  const renderRef = useRef<RenderState>(createRenderState(simRef.current));
  const ghostRef = useRef<GhostRun | null>(null);
  const ghostSimRef = useRef<SimState | null>(null);
  const ghostIndexRef = useRef(0);
  const ghostFinishTickRef = useRef<number | null>(null);
  const statusRef = useRef<GameStatus>("idle");
  const lastHudTickRef = useRef(0);
  const outcomeGhostRef = useRef<GhostRun | null>(null);

  const [status, setStatusState] = useState<GameStatus>("idle");
  const [ticks, setTicks] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [ghost, setGhostState] = useState<GhostRun | null>(null);
  const [ghostReady, setGhostReady] = useState(false);

  const setStatus = useCallback((s: GameStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const finishRun = useCallback((finalSim: SimState) => {
    const inputs = Uint8Array.from(inputsRef.current);
    const g = outcomeGhostRef.current;
    const ghostTicks = g ? runInputs(g.inputs).ticks : null;
    const ghostDelta =
      g && ghostTicks !== null
        ? timeMsFromTicks(finalSim.tick) - timeMsFromTicks(ghostTicks)
        : null;
    setOutcome({
      status: finalSim.status === "won" ? "won" : "dead",
      ticks: finalSim.tick,
      timeMs: timeMsFromTicks(finalSim.tick),
      inputs,
      ghostDeltaMs: ghostDelta,
      ghostLabel: g ? g.label : null,
      ghostVerified: g ? g.verified : null,
    });
    const rs = renderRef.current;
    if (finalSim.status === "won") {
      rs.won = true;
      rs.wonAt = performance.now();
      rs.flashColor = "#f0b429";
      rs.flashAlpha = 0.35;
      burstParticles(rs, "#f0b429", 28);
      setStatus("won");
    } else {
      rs.dead = true;
      rs.flashColor = "#d05252";
      rs.flashAlpha = 0.4;
      burstParticles(rs, "#d05252", 20);
      setStatus("dead");
    }
  }, [setStatus]);

  const tick = useCallback(() => {
    if (statusRef.current !== "playing") return;
    const f = flagsRef.current;
    const byte = encodeInput(f.left, f.right, f.jump);
    inputsRef.current.push(byte);
    const next = step(simRef.current, byte);
    simRef.current = next;
    renderRef.current.player = next;

    // ghost advances one tick in lockstep
    const gSim = ghostSimRef.current;
    if (gSim && gSim.status === "playing" && ghostIndexRef.current < ghostRef.current!.inputs.length) {
      const gi = ghostIndexRef.current;
      ghostSimRef.current = step(gSim, ghostRef.current!.inputs[gi]!);
      ghostIndexRef.current = gi + 1;
      renderRef.current.ghost = ghostSimRef.current;
      if (ghostSimRef.current.status !== "playing") {
        ghostFinishTickRef.current = ghostSimRef.current.tick;
      }
    } else if (gSim) {
      renderRef.current.ghost = gSim;
    }

    if (next.tick - lastHudTickRef.current >= HUD_UPDATE_EVERY_TICKS) {
      lastHudTickRef.current = next.tick;
      setTicks(next.tick);
      setTimeMs(timeMsFromTicks(next.tick));
    }

    if (next.status !== "playing") {
      setTicks(next.tick);
      setTimeMs(timeMsFromTicks(next.tick));
      finishRun(next);
    }
  }, [finishRun]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const now = performance.now();
    updateParticles(renderRef.current, 1 / 60);
    drawFrame(ctx, renderRef.current, now);
  }, [canvasRef]);

  // start the rAF loop once
  useEffect(() => {
    const stop = startLoop({ tick, draw });
    return stop;
  }, [tick, draw]);

  // keyboard
  useEffect(() => {
    const setKey = (code: string, down: boolean): boolean => {
      const f = flagsRef.current;
      switch (code) {
        case "ArrowLeft":
        case "KeyA":
          f.left = down;
          return true;
        case "ArrowRight":
        case "KeyD":
          f.right = down;
          return true;
        case "Space":
        case "ArrowUp":
        case "KeyW":
        case "KeyZ":
          f.jump = down;
          return true;
        default:
          return false;
      }
    };
    const onKey = (e: KeyboardEvent, down: boolean): void => {
      if (e.repeat && down) return;
      if (setKey(e.code, down)) e.preventDefault();
    };
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    const blur = (): void => {
      flagsRef.current.left = false;
      flagsRef.current.right = false;
      flagsRef.current.jump = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const start = useCallback(() => {
    simRef.current = initialState();
    inputsRef.current = [];
    lastHudTickRef.current = 0;
    outcomeGhostRef.current = ghostRef.current;
    setOutcome(null);
    setTicks(0);
    setTimeMs(0);
    const rs = createRenderState(simRef.current);
    if (ghostRef.current) {
      ghostSimRef.current = initialState();
      ghostIndexRef.current = 0;
      ghostFinishTickRef.current = null;
      rs.ghost = ghostSimRef.current;
    } else {
      ghostSimRef.current = null;
      ghostIndexRef.current = 0;
    }
    renderRef.current = rs;
    setStatus("playing");
  }, [setStatus]);

  const reset = useCallback(() => {
    simRef.current = initialState();
    inputsRef.current = [];
    const rs = createRenderState(simRef.current);
    if (ghostRef.current) {
      ghostSimRef.current = initialState();
      ghostIndexRef.current = 0;
      rs.ghost = ghostSimRef.current;
    }
    renderRef.current = rs;
    setOutcome(null);
    setTicks(0);
    setTimeMs(0);
    setStatus("idle");
  }, [setStatus]);

  const setGhost = useCallback(
    (g: GhostRun | null) => {
      ghostRef.current = g;
      setGhostState(g);
      // validate the ghost replays cleanly (defense-in-depth; engine throws
      // on invalid logs) and capture its length for the UI
      if (g) {
        runInputs(g.inputs); // throws if the log is invalid
        setGhostReady(true);
      } else {
        setGhostReady(false);
      }
      // switching ghosts restarts the race so both start at tick 0
      start();
    },
    [start],
  );

  const dismissOutcome = useCallback(() => {
    setOutcome(null);
    reset();
  }, [reset]);

  // touch controls helper (used by on-screen buttons)
  const touchFlags = useCallback((flag: keyof Flags, down: boolean) => {
    flagsRef.current[flag] = down;
  }, []);

  return {
    canvasRef,
    status,
    ticks,
    timeMs,
    outcome,
    ghost,
    ghostReady,
    start,
    reset,
    setGhost,
    dismissOutcome,
    touchFlags,
  };
}
