import { formatTimeMs, shortAddress } from "../lib/format";
import type { PlayerBest } from "../hooks/useVerifiedRuns";

export interface LeaderboardProps {
  status: string;
  error: string | null;
  leaderboard: PlayerBest[];
  onRace: (bestRunId: bigint, player: string, timeMs: number) => void;
}

export function Leaderboard({ status, error, leaderboard, onRace }: LeaderboardProps): JSX.Element {
  if (status === "not-configured") {
    return <p className="panel-note">Leaderboard appears after the contract is deployed to Base Sepolia.</p>;
  }
  if (status === "loading") {
    return <p className="panel-note">Loading leaderboard…</p>;
  }
  if (status === "error") {
    return (
      <p className="panel-note panel-note--error" data-testid="leaderboard-error">
        Failed to load: {error}
      </p>
    );
  }
  if (leaderboard.length === 0) {
    return (
      <p className="panel-note" data-testid="leaderboard-empty">
        No verified runs yet — be the first to reach the goal.
      </p>
    );
  }
  return (
    <table className="board" data-testid="leaderboard">
      <thead>
        <tr>
          <th>#</th>
          <th>player</th>
          <th>best</th>
          <th>runs</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((entry, i) => (
          <tr key={entry.player} data-testid="leaderboard-row">
            <td className="mono">{i + 1}</td>
            <td className="mono" title={entry.player}>
              {shortAddress(entry.player)}
            </td>
            <td className="mono">{formatTimeMs(entry.bestTimeMs)}</td>
            <td className="mono">{entry.runCount}</td>
            <td>
              <button
                type="button"
                className="btn btn--mini"
                onClick={() => onRace(entry.bestRunId, entry.player, entry.bestTimeMs)}
                data-testid={`race-best-${entry.player}`}
              >
                race
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
