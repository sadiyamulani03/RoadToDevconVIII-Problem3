// GENERATED-STYLE FILE — overwritten by scripts/sync-deployment.mjs.
// Until a real Base Sepolia deployment happens this stays null and the
// frontend clearly shows "contract not configured" instead of guessing.

export interface DeploymentInfo {
  chainId: number;
  /** Null until a real deployment is recorded by scripts/sync-deployment.mjs. */
  address: `0x${string}` | null;
  /** Block the contract was deployed at (for log backfill). */
  deploymentBlock: number | null;
  deployer: `0x${string}` | null;
  txHash: `0x${string}` | null;
  gitCommit: string | null;
  updatedAt: string | null;
}

export const DEPLOYMENT: DeploymentInfo = {
  chainId: 84532,
  address: null,
  deploymentBlock: null,
  deployer: null,
  txHash: null,
  gitCommit: null,
  updatedAt: null,
};
