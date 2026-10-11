export function HowToPlay(): JSX.Element {
  return (
    <div className="howto" data-testid="how-to-play">
      <h3 className="panel-heading">How to play</h3>
      <ol className="howto-list">
        <li>
          Reach the green flag as fast as you can. <strong>←/→ or A/D</strong> move,{" "}
          <strong>Space/W/↑/Z</strong> jumps.
        </li>
        <li>
          Every run is recorded as one input byte per 60&nbsp;Hz tick. The recording is what you
          submit — never a time.
        </li>
        <li>
          Onchain, the <code>GhostSprint</code> contract re-simulates your entire input log with
          fixed integer physics and derives the completion time itself. A run only counts if the
          simulation genuinely reaches the goal. There is no admin and no way to override a time.
        </li>
        <li>
          Race other players' ghosts — their verified input logs are fetched from the chain and
          replayed next to you, deterministically.
        </li>
      </ol>
    </div>
  );
}
