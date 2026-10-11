import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { decodeEventLog, type Hex } from "viem";
import { ghostSprintAbi } from "../abi/ghostSprint";
import {
  CHAIN_ID,
  CHAIN_NAME,
  explorerTxUrl,
  resolveContractConfig,
} from "../config/chain";
import { formatTimeMs } from "../lib/format";

export interface RunSubmitProps {
  inputs: Uint8Array;
  localTimeMs: number;
  onVerified: () => void;
}

type SubmitPhase = "idle" | "signing" | "pending" | "verified" | "failed";

/**
 * Submits a won run's input log to GhostSprint.submitRun and tracks the full
 * lifecycle: wallet signature -> tx pending (with explorer link) -> receipt
 * -> contract-side verification read back from the chain. The displayed
 * "verified time" is the value the CONTRACT computed, not the client's.
 */
export function RunSubmit({ inputs, localTimeMs, onVerified }: RunSubmitProps): JSX.Element {
  const { isConnected, chainId } = useAccount();
  const config = useMemo(() => resolveContractConfig(), []);
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [contractTimeMs, setContractTimeMs] = useState<number | null>(null);
  const [verifiedRunId, setVerifiedRunId] = useState<string | null>(null);

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;

  useEffect(() => {
    if (isPending) setPhase("signing");
    else if (txHash && isConfirming) setPhase("pending");
    else if (txHash && isConfirmed) setPhase("verified");
    else if (writeError || receiptError) setPhase("failed");
  }, [isPending, txHash, isConfirming, isConfirmed, writeError, receiptError]);

  // once confirmed, decode the RunVerified event: contract-computed values
  useEffect(() => {
    if (!isConfirmed || !receipt || phase !== "verified" || contractTimeMs !== null) return;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ghostSprintAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "RunVerified") {
          const args = decoded.args as unknown as {
            runId: bigint;
            timeMs: bigint;
            tick: bigint;
          };
          setContractTimeMs(Number(args.timeMs));
          setVerifiedRunId(args.runId.toString());
          onVerified();
          return;
        }
      } catch {
        // not our event
      }
    }
  }, [isConfirmed, receipt, phase, contractTimeMs, onVerified]);

  const submit = (): void => {
    if (!config.address) return;
    let hex = "0x";
    for (const b of inputs) hex += b.toString(16).padStart(2, "0");
    writeContract({
      abi: ghostSprintAbi,
      address: config.address,
      functionName: "submitRun",
      args: [hex as Hex],
    });
  };

  if (!config.address) {
    return (
      <p className="overlay-note" data-testid="submit-no-contract">
        Onchain submission unavailable: the GhostSprint contract is not configured for{" "}
        {CHAIN_NAME} yet. Deploy it and run <code>npm run sync:deployment</code> —
        your run is saved locally meanwhile.
      </p>
    );
  }

  if (!isConnected) {
    return (
      <p className="overlay-note" data-testid="submit-need-wallet">
        Connect a {CHAIN_NAME} wallet to verify this run onchain (guest replay works without one).
      </p>
    );
  }

  if (wrongNetwork) {
    return (
      <p className="overlay-note" data-testid="submit-wrong-network">
        Switch your wallet to {CHAIN_NAME} (chain id {CHAIN_ID}) to submit.
      </p>
    );
  }

  if (phase === "verified" && contractTimeMs !== null) {
    return (
      <div className="verified-box" data-testid="verified-box">
        <span className="verified-badge">VERIFIED by contract</span>
        <span className="mono">
          {formatTimeMs(contractTimeMs)} — run #{verifiedRunId}
        </span>
        {txHash && (
          <a
            className="tx-link"
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            data-testid="tx-link"
          >
            view tx ↗
          </a>
        )}
        {contractTimeMs !== localTimeMs && (
          <span className="verified-note">
            (contract time {formatTimeMs(contractTimeMs)}, local preview {formatTimeMs(localTimeMs)})
          </span>
        )}
      </div>
    );
  }

  if (phase === "failed") {
    const msg = writeError?.message ?? receiptError?.message ?? "submission failed";
    return (
      <div className="submit-failed" data-testid="submit-failed">
        <p className="overlay-note">Transaction failed: {msg.split("\n")[0]}</p>
        <button type="button" className="btn btn--ghost" onClick={() => reset()}>
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="submit-row">
      <button
        type="button"
        className="btn btn--primary"
        onClick={submit}
        disabled={isPending || isConfirming}
        data-testid="submit-run"
      >
        {phase === "signing"
          ? "Confirm in wallet…"
          : phase === "pending"
            ? "Verifying onchain…"
            : "Verify run onchain"}
      </button>
      {txHash && (
        <a className="tx-link" href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer">
          {isConfirming ? "pending…" : "tx"} ↗
        </a>
      )}
    </div>
  );
}
