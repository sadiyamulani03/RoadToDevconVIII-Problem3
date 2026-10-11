import { formatTimeMs } from "../lib/format";

export interface HudProps {
  status: string;
  ticks: number;
  timeMs: number;
  ghostLabel: string | null;
  ghostVerified: boolean | null;
}

export function Hud({ status, ticks, timeMs, ghostLabel, ghostVerified }: HudProps): JSX.Element {
  return (
    <div className="hud" data-testid="hud">
      <div className="hud-cell">
        <span className="hud-label">time</span>
        <span className="hud-value mono" data-testid="hud-time">
          {formatTimeMs(timeMs)}
        </span>
      </div>
      <div className="hud-cell">
        <span className="hud-label">tick</span>
        <span className="hud-value mono" data-testid="hud-ticks">
          {ticks}
        </span>
      </div>
      <div className="hud-cell">
        <span className="hud-label">status</span>
        <span className="hud-value" data-testid="hud-status">
          {status}
        </span>
      </div>
      {ghostLabel && (
        <div className="hud-cell hud-cell--ghost">
          <span className="hud-label">ghost</span>
          <span className="hud-value hud-value--ghost" data-testid="hud-ghost">
            {ghostLabel}
            {ghostVerified ? " ✓" : " (local)"}
          </span>
        </div>
      )}
    </div>
  );
}
