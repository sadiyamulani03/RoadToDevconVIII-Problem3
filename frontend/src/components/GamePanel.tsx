import { useCallback, useEffect, useRef } from "react";
import type { GameApi } from "../game/useGame";
import { WORLD_H, WORLD_W } from "../game/render";
import { Hud } from "./Hud";
import { RunResultOverlay } from "./RunResultOverlay";
import { RunSubmit } from "./RunSubmit";
import { saveLocalRun } from "../lib/localRuns";

export interface GamePanelProps {
  game: GameApi;
  onRunVerified: () => void;
}

export function GamePanel({ game, onRunVerified }: GamePanelProps): JSX.Element {
  const savedRef = useRef<string | null>(null);

  // persist won runs as local practice ghosts (once per outcome)
  useEffect(() => {
    const o = game.outcome;
    if (o && o.status === "won" && savedRef.current !== null) {
      savedRef.current = null;
    }
    if (o && o.status === "won" && savedRef.current === null) {
      savedRef.current = `${o.ticks}:${o.timeMs}:${o.inputs.length}`;
      saveLocalRun({
        label: `practice ${o.timeMs}ms`,
        ticks: o.ticks,
        timeMs: o.timeMs,
        inputs: Array.from(o.inputs),
      });
    }
  }, [game.outcome]);

  const touch = useCallback(
    (flag: "left" | "right" | "jump", down: boolean) => (e: React.PointerEvent) => {
      e.preventDefault();
      game.touchFlags(flag, down);
    },
    [game],
  );

  return (
    <div className="game-panel" data-testid="game-panel">
      <div className="canvas-wrap">
        <canvas
          ref={game.canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          className="game-canvas"
          data-testid="game-canvas"
          aria-label="Ghost Sprint game canvas"
        />
        {game.outcome && (
          <RunResultOverlay
            outcome={game.outcome}
            onRetry={game.start}
            onDismiss={game.dismissOutcome}
            submission={
              game.outcome.status === "won" ? (
                <RunSubmit
                  inputs={game.outcome.inputs}
                  localTimeMs={game.outcome.timeMs}
                  onVerified={onRunVerified}
                />
              ) : undefined
            }
          />
        )}
        {game.status === "idle" && !game.outcome && (
          <div className="overlay overlay--start">
            <div className="overlay-card">
              <h2 className="overlay-title">Ghost Sprint</h2>
              <p className="overlay-note">Beat the clock to the flag. Then verify your run onchain.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={game.start}
                data-testid="start-button"
              >
                Start run
              </button>
            </div>
          </div>
        )}
      </div>

      <Hud
        status={game.status}
        ticks={game.ticks}
        timeMs={game.timeMs}
        ghostLabel={game.ghost?.label ?? null}
        ghostVerified={game.ghost?.verified ?? null}
      />

      <div className="controls-row">
        <div className="key-hints">
          <kbd>←</kbd>
          <kbd>→</kbd> move · <kbd>Space</kbd> jump · <kbd>R</kbd> restart
        </div>
        <div className="touch-controls">
          <button
            type="button"
            className="touch-btn"
            onPointerDown={touch("left", true)}
            onPointerUp={touch("left", false)}
            onPointerLeave={touch("left", false)}
            onPointerCancel={touch("left", false)}
            aria-label="Move left"
          >
            ←
          </button>
          <button
            type="button"
            className="touch-btn"
            onPointerDown={touch("jump", true)}
            onPointerUp={touch("jump", false)}
            onPointerLeave={touch("jump", false)}
            onPointerCancel={touch("jump", false)}
            aria-label="Jump"
          >
            jump
          </button>
          <button
            type="button"
            className="touch-btn"
            onPointerDown={touch("right", true)}
            onPointerUp={touch("right", false)}
            onPointerLeave={touch("right", false)}
            onPointerCancel={touch("right", false)}
            aria-label="Move right"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
