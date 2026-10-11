import type { RunOutcome } from "../game/useGame";
import { formatDelta, formatTimeMs } from "../lib/format";

export interface RunResultOverlayProps {
  outcome: RunOutcome;
  onRetry: () => void;
  onDismiss: () => void;
  /** Rendered only when the run is won (submission flow lives in parent). */
  submission?: React.ReactNode;
}

export function RunResultOverlay({
  outcome,
  onRetry,
  onDismiss,
  submission,
}: RunResultOverlayProps): JSX.Element {
  const won = outcome.status === "won";
  return (
    <div className="overlay" data-testid="run-result-overlay">
      <div className="overlay-card">
        <h2 className={won ? "overlay-title overlay-title--win" : "overlay-title overlay-title--dead"}>
          {won ? "Goal reached" : "You died"}
        </h2>
        <dl className="result-grid">
          <dt>time</dt>
          <dd className="mono" data-testid="result-time">
            {formatTimeMs(outcome.timeMs)}
          </dd>
          <dt>ticks</dt>
          <dd className="mono" data-testid="result-ticks">
            {outcome.ticks}
          </dd>
          {outcome.ghostLabel && outcome.ghostDeltaMs !== null && (
            <>
              <dt>vs ghost</dt>
              <dd
                className={`mono ${outcome.ghostDeltaMs < 0 ? "faster" : outcome.ghostDeltaMs > 0 ? "slower" : ""}`}
                data-testid="result-ghost-delta"
              >
                {formatDelta(outcome.ghostDeltaMs)} — {outcome.ghostLabel}
                {outcome.ghostVerified ? " (onchain-verified)" : " (local)"}
              </dd>
            </>
          )}
        </dl>
        {!won && (
          <p className="overlay-note">
            The contract only verifies runs that genuinely reach the goal. Try again.
          </p>
        )}
        {won && submission}
        <div className="overlay-actions">
          <button type="button" className="btn btn--primary" onClick={onRetry} data-testid="retry-button">
            Retry
          </button>
          <button type="button" className="btn btn--ghost" onClick={onDismiss} data-testid="dismiss-button">
            Back to idle
          </button>
        </div>
      </div>
    </div>
  );
}
