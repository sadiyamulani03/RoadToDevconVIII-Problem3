import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN_ID, CHAIN_NAME } from "../config/chain";
import { shortAddress } from "../lib/format";

/**
 * Wallet + network status bar. Purely presentational about connection state —
 * never blocks guest play.
 */
export function WalletBar(): JSX.Element {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;
  const connector = connectors[0];

  return (
    <div className="wallet-bar" data-testid="wallet-bar">
      <span className={`net-badge${wrongNetwork ? " net-badge--warn" : ""}`}>
        {wrongNetwork ? "wrong network" : CHAIN_NAME}
      </span>
      {!isConnected ? (
        <button
          type="button"
          className="btn btn--primary"
          disabled={!connector || isPending}
          onClick={() => connector && connect({ connector })}
          data-testid="connect-wallet"
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
      ) : wrongNetwork ? (
        <button
          type="button"
          className="btn btn--warn"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: CHAIN_ID })}
          data-testid="switch-network"
        >
          {isSwitching ? "Switching…" : `Switch to ${CHAIN_NAME}`}
        </button>
      ) : (
        <div className="wallet-connected">
          <span className="mono" data-testid="wallet-address">
            {address ? shortAddress(address) : ""}
          </span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => disconnect()}
            data-testid="disconnect-wallet"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
