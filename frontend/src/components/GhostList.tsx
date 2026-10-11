import { useState } from "react";
import { DEMO_RUN } from "../game/demoRun";
import type { GhostRun } from "../game/useGame";
import type { VerifiedRun } from "../hooks/useVerifiedRuns";
import { formatTimeMs, shortAddress } from "../lib/format";
import { loadLocalRuns } from "../lib/localRuns";

export interface GhostListProps {
  status: string;
  error: string | null;
  runs: VerifiedRun[];
  loadingRunId: string | null;
  raceError: string | null;
  onRaceChainRun: (run: VerifiedRun) => void;
  onRaceGhost: (ghost: GhostRun) => void;
}

/**
 * Ghost picker. Chain-sourced ghosts are labeled onchain-verified (their
 * input log is re-simulated by the contract); the bundled demo run and
 * local practice runs are clearly labeled as NOT verified.
 */
export function GhostList({
  status,
  error,
  runs,
  loadingRunId,
  raceError,
  onRaceChainRun,
  onRaceGhost,
}: GhostListProps): JSX.Element {
  const [localRuns, setLocalRuns] = useState(() => loadLocalRuns());

  const demoGhost: GhostRun = {
    id: "demo",
    label: DEMO_RUN.label,
    verified: false,
    ticks: DEMO_RUN.ticks,
    timeMs: DEMO_RUN.timeMs,
    inputs: DEMO_RUN.inputs,
  };

  return (
    <div className="ghost-list" data-testid="ghost-list">
      <section>
        <h3 className="panel-heading">Onchain ghosts</h3>
        {status === "not-configured" && (
          <p className="panel-note">
            Contract not configured — race the bundled demo ghost or local practice ghosts below.
          </p>
        )}
        {status === "loading" && <p className="panel-note">Loading verified runs…</p>}
        {status === "error" && (
          <p className="panel-note panel-note--error" data-testid="ghosts-error">
            Failed to load: {error}
          </p>
        )}
        {status === "ready" && runs.length === 0 && (
          <p className="panel-note">No onchain runs yet.</p>
        )}
        {runs.length > 0 && (
          <ul className="ghost-rows">
            {runs.slice(0, 25).map((r) => (
              <li key={r.runId.toString()} className="ghost-row" data-testid="ghost-run-row">
                <span className="mono">#{r.runId.toString()}</span>
                <span className="mono" title={r.player}>
                  {shortAddress(r.player)}
                </span>
                <span className="mono">{formatTimeMs(r.timeMs)}</span>
                <span className="mono muted">{r.inputCount} ticks</span>
                <span className="verified-badge verified-badge--sm">onchain-verified</span>
                <button
                  type="button"
                  className="btn btn--mini"
                  disabled={loadingRunId === r.runId.toString()}
                  onClick={() => onRaceChainRun(r)}
                  data-testid={`race-run-${r.runId}`}
                >
                  {loadingRunId === r.runId.toString() ? "loading…" : "race"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {raceError && (
          <p className="panel-note panel-note--error" data-testid="race-error">
            {raceError}
          </p>
        )}
      </section>

      <section>
        <h3 className="panel-heading">Practice ghosts (not onchain-verified)</h3>
        <ul className="ghost-rows">
          <li className="ghost-row">
            <span className="mono">{formatTimeMs(demoGhost.timeMs)}</span>
            <span className="muted">{demoGhost.label}</span>
            <button
              type="button"
              className="btn btn--mini"
              onClick={() => onRaceGhost(demoGhost)}
              data-testid="race-demo"
            >
              race
            </button>
          </li>
          {localRuns.map((r) => (
            <li key={r.id} className="ghost-row">
              <span className="mono">{formatTimeMs(r.timeMs)}</span>
              <span className="muted">local practice run</span>
              <button
                type="button"
                className="btn btn--mini"
                onClick={() =>
                  onRaceGhost({
                    id: r.id,
                    label: r.label,
                    verified: false,
                    ticks: r.ticks,
                    timeMs: r.timeMs,
                    inputs: Uint8Array.from(r.inputs),
                  })
                }
                data-testid={`race-local-${r.id}`}
              >
                race
              </button>
            </li>
          ))}
        </ul>
        {localRuns.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--mini"
            onClick={() => {
              localStorage.removeItem("ghostsprint.localruns.v1");
              setLocalRuns(loadLocalRuns());
            }}
          >
            clear local ghosts
          </button>
        )}
      </section>
    </div>
  );
}
