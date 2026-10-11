// Fetches verified runs and leaderboards from the GhostSprint contract.
// Storage reads (getRuns / getRunInputs) are the source of truth; RunVerified
// events are emitted too (with the full input log) for log-based indexers.
// Every fetched input log is re-hashed and checked against the contract's
// stored inputsHash before being offered as a raceable ghost.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { keccak256, toHex, type Address, type Hex } from "viem";
import { ghostSprintAbi } from "../abi/ghostSprint";
import { CHAIN_ID, resolveContractConfig } from "../config/chain";

export interface VerifiedRun {
  runId: bigint;
  player: Address;
  ticks: number;
  timeMs: number;
  inputCount: number;
  inputsHash: Hex;
  verified: true;
}

export interface PlayerBest {
  player: Address;
  bestTimeMs: number;
  bestRunId: bigint;
  runCount: number;
}

export type RunsStatus = "idle" | "loading" | "ready" | "error" | "not-configured";

export interface VerifiedRunsState {
  status: RunsStatus;
  error: string | null;
  runs: VerifiedRun[];
  leaderboard: PlayerBest[];
  refetch: () => void;
}

const MAX_RUNS_FETCHED = 250n;

export function useVerifiedRuns(): VerifiedRunsState {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const config = useMemo(() => resolveContractConfig(), []);

  const [status, setStatus] = useState<RunsStatus>(
    config.address ? "loading" : "not-configured",
  );
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<VerifiedRun[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerBest[]>([]);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!config.address) {
      setStatus("not-configured");
      return;
    }
    if (!publicClient) {
      setStatus("loading");
      return;
    }
    let cancelled = false;

    const load = async (): Promise<void> => {
      setStatus("loading");
      setError(null);
      try {
        const address = config.address!;
        const count = await publicClient.readContract({
          abi: ghostSprintAbi,
          address,
          functionName: "runCount",
        });
        if (cancelled) return;
        const total = count as bigint;
        if (total === 0n) {
          setRuns([]);
          setLeaderboard([]);
          setStatus("ready");
          return;
        }
        const slice =
          total > MAX_RUNS_FETCHED ? total - MAX_RUNS_FETCHED : 0n;
        const batch = (await publicClient.readContract({
          abi: ghostSprintAbi,
          address,
          functionName: "getRuns",
          args: [slice, total - slice],
        })) as readonly {
          runId: bigint;
          player: Address;
          tick: bigint;
          timeMs: bigint;
          submittedAt: bigint;
          inputLength: number;
          inputsHash: Hex;
        }[];

        const fetched: VerifiedRun[] = batch.map((r) => ({
          runId: r.runId,
          player: r.player,
          ticks: Number(r.tick),
          timeMs: Number(r.timeMs),
          inputCount: Number(r.inputLength),
          inputsHash: r.inputsHash,
          verified: true,
        }));

        // per-player bests via multicall (batched RPC)
        const players = [...new Map(fetched.map((r) => [r.player, r.player])).values()];
        const contracts = players.flatMap((p) => [
          {
            abi: ghostSprintAbi,
            address,
            functionName: "bestTime" as const,
            args: [p] as const,
          },
          {
            abi: ghostSprintAbi,
            address,
            functionName: "bestRunId" as const,
            args: [p] as const,
          },
          {
            abi: ghostSprintAbi,
            address,
            functionName: "getRunCountForPlayer" as const,
            args: [p] as const,
          },
        ]);
        const results = await publicClient.multicall({ contracts });
        if (cancelled) return;
        const board: PlayerBest[] = [];
        players.forEach((p, i) => {
          const bestTime = results[i * 3];
          const bestRunId = results[i * 3 + 1];
          const runCount = results[i * 3 + 2];
          if (
            bestTime?.status === "success" &&
            bestRunId?.status === "success" &&
            runCount?.status === "success"
          ) {
            board.push({
              player: p,
              bestTimeMs: Number(bestTime.result),
              bestRunId: bestRunId.result as bigint,
              runCount: Number(runCount.result),
            });
          }
        });
        board.sort((a, b) =>
          a.bestTimeMs === b.bestTimeMs
            ? Number(a.bestRunId - b.bestRunId)
            : a.bestTimeMs - b.bestTimeMs,
        );
        fetched.sort((a, b) => Number(b.runId - a.runId));
        if (cancelled) return;
        setRuns(fetched);
        setLeaderboard(board);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [config.address, publicClient, nonce]);

  // live-update when a new RunVerified arrives from our own submission
  const { address } = useAccount();
  useEffect(() => {
    if (!config.address || !publicClient || !address) return;
    const unwatch = publicClient.watchContractEvent({
      abi: ghostSprintAbi,
      address: config.address,
      eventName: "RunVerified",
      onLogs: (logs) => {
        if (logs.some((l) => l.args.player === address)) refetch();
      },
      pollingInterval: 4000,
    });
    return () => unwatch?.();
  }, [config.address, publicClient, address, refetch]);

  return { status, error, runs, leaderboard, refetch };
}

/** Fetch + integrity-check a full input log for one run. */
export function useRunInputs(): {
  fetchInputs: (runId: bigint, expectedHash: Hex) => Promise<Uint8Array>;
} {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const config = useMemo(() => resolveContractConfig(), []);

  const fetchInputs = useCallback(
    async (runId: bigint, expectedHash: Hex): Promise<Uint8Array> => {
      if (!publicClient || !config.address) {
        throw new Error("contract not configured");
      }
      const inputs = (await publicClient.readContract({
        abi: ghostSprintAbi,
        address: config.address,
        functionName: "getRunInputs",
        args: [runId],
      })) as Hex;
      const bytes = Uint8Array.from(
        inputs
          .slice(2)
          .match(/.{2}/g)!
          .map((b) => parseInt(b, 16)),
      );
      const actual = keccak256(toHex(bytes));
      if (actual.toLowerCase() !== expectedHash.toLowerCase()) {
        throw new Error("input log failed integrity check (keccak mismatch)");
      }
      return bytes;
    },
    [config.address, publicClient],
  );

  return { fetchInputs };
}
