import { useCallback, useEffect, useState } from "react";
import { GamePanel } from "./components/GamePanel";
import { GhostList } from "./components/GhostList";
import { HowToPlay } from "./components/HowToPlay";
import { Leaderboard } from "./components/Leaderboard";
import { WalletBar } from "./components/WalletBar";
import { useGame, type GhostRun } from "./game/useGame";
import { useRunInputs, useVerifiedRuns, type VerifiedRun } from "./hooks/useVerifiedRuns";
import { CHAIN_NAME, resolveContractConfig } from "./config/chain";
import { explorerAddressUrl } from "./config/chain";

type Tab = "leaderboard" | "ghosts" | "howto";

export function App(): JSX.Element {
  const game = useGame();
  const [tab, setTab] = useState<Tab>("ghosts");
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [raceError, setRaceError] = useState<string | null>(null);
  const config = resolveContractConfig();
  const runs = useVerifiedRuns();
  const { fetchInputs } = useRunInputs();

  // "R" restarts while playing
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === "KeyR" && game.status !== "idle") {
        game.start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  const raceChainRun = useCallback(
    async (run: VerifiedRun) => {
      setRaceError(null);
      setLoadingRunId(run.runId.toString());
      try {
        const inputs = await fetchInputs(run.runId, run.inputsHash);
        const ghost: GhostRun = {
          id: `run-${run.runId}`,
          label: `run #${run.runId} · ${run.player.slice(0, 8)}…`,
          verified: true,
          ticks: run.ticks,
          timeMs: run.timeMs,
          inputs,
        };
        game.setGhost(ghost);
      } catch (err) {
        setRaceError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingRunId(null);
      }
    },
    [fetchInputs, game],
  );

  const raceGhost = useCallback(
    (ghost: GhostRun) => {
      setRaceError(null);
      game.setGhost(ghost);
    },
    [game],
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1 className="brand-title">Ghost Sprint</h1>
          <span className="brand-sub">onchain speedrun · {CHAIN_NAME}</span>
        </div>
        <WalletBar />
      </header>

      {config.address ? (
        <p className="status-line">
          contract <a href={explorerAddressUrl(config.address)} target="_blank" rel="noreferrer" className="mono">{config.address}</a>
        </p>
      ) : (
        <p className="status-line status-line--warn" data-testid="no-contract">
          contract not configured for {CHAIN_NAME} — playing in guest mode (runs stay local until deployed)
        </p>
      )}

      <main className="app-main">
        <GamePanel game={game} onRunVerified={runs.refetch} />

        <aside className="sidebar">
          <nav className="tabs">
            {(["ghosts", "leaderboard", "howto"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`tab${tab === t ? " tab--active" : ""}`}
                onClick={() => setTab(t)}
                data-testid={`tab-${t}`}
              >
                {t === "howto" ? "how to play" : t}
              </button>
            ))}
          </nav>
          {tab === "leaderboard" && (
            <Leaderboard
              status={runs.status}
              error={runs.error}
              leaderboard={runs.leaderboard}
              onRace={(bestRunId) => {
                const run = runs.runs.find((r) => r.runId === bestRunId);
                if (run) void raceChainRun(run);
              }}
            />
          )}
          {tab === "ghosts" && (
            <GhostList
              status={runs.status}
              error={runs.error}
              runs={runs.runs}
              loadingRunId={loadingRunId}
              raceError={raceError}
              onRaceChainRun={(r) => void raceChainRun(r)}
              onRaceGhost={raceGhost}
            />
          )}
          {tab === "howto" && <HowToPlay />}
        </aside>
      </main>

      <footer className="app-footer">
        Deterministic integer physics · run verified by the contract, not the client ·
        inputs never contain a time
      </footer>
    </div>
  );
}

export default App;
