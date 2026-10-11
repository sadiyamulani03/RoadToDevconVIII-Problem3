import { baseSepolia } from "wagmi/chains";
import { isAddress, type Address } from "viem";
import { DEPLOYMENT } from "../generated/deployment";

/**
 * The one chain this game deploys to. Hardcoded on purpose — acceptance
 * requires Base Sepolia (chain id 84532), never mainnet, never a
 * localhost-only default.
 */
export const CHAIN_ID = baseSepolia.id; // 84532
export const CHAIN_NAME = baseSepolia.name; // "Base Sepolia"
export const EXPLORER_URL = baseSepolia.blockExplorers.default.url;
export const SUPPORTED_CHAINS = [baseSepolia] as const;

/** Public RPC: env override for local dev, else the chain default. */
export const RPC_URL: string =
  import.meta.env.VITE_RPC_URL?.trim() || baseSepolia.rpcUrls.default.http[0];

export type ContractConfigSource = "env" | "deployment" | "missing";

export interface ContractConfig {
  address: Address | null;
  chainId: number;
  source: ContractConfigSource;
}

/**
 * Resolve the GhostSprint contract address. Priority:
 *   1. VITE_CONTRACT_ADDRESS env var (must be a valid address)
 *   2. frontend/src/generated/deployment.ts (written by scripts/sync-deployment.mjs)
 *   3. null — frontend runs in guest mode and says so explicitly.
 * Never invents or falls back to a placeholder address.
 */
export function resolveContractConfig(): ContractConfig {
  const env = import.meta.env.VITE_CONTRACT_ADDRESS?.trim();
  if (env && isAddress(env)) {
    return { address: env, chainId: CHAIN_ID, source: "env" };
  }
  if (
    DEPLOYMENT.address &&
    DEPLOYMENT.chainId === CHAIN_ID &&
    isAddress(DEPLOYMENT.address)
  ) {
    return {
      address: DEPLOYMENT.address,
      chainId: CHAIN_ID,
      source: "deployment",
    };
  }
  return { address: null, chainId: CHAIN_ID, source: "missing" };
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}
