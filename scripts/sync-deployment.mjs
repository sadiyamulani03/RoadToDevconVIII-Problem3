#!/usr/bin/env node
// Records a real deployment into frontend/src/generated/deployment.ts.
// Reads DEPLOYED_ADDRESS (and optional DEPLOYED_BLOCK / DEPLOYER / TX_HASH)
// from the environment — never from arguments in shell history.
//
// Usage (after `forge script ... --broadcast` succeeds):
//   DEPLOYED_ADDRESS=0x... DEPLOYED_BLOCK=123456 node scripts/sync-deployment.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "frontend", "src", "generated", "deployment.ts");

const address = (process.env.DEPLOYED_ADDRESS ?? "").trim();
if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("error: set DEPLOYED_ADDRESS=0x... to a deployed contract address");
  process.exit(1);
}

const block = process.env.DEPLOYED_BLOCK ?? "";
const deployer = (process.env.DEPLOYER ?? "").trim();
const txHash = (process.env.TX_HASH ?? "").trim();

const content = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/sync-deployment.mjs after a real Base Sepolia deployment.

export interface DeploymentInfo {
  chainId: number;
  address: \`0x\${string}\` | null;
  deploymentBlock: number | null;
  deployer: \`0x\${string}\` | null;
  txHash: \`0x\${string}\` | null;
  gitCommit: string | null;
  updatedAt: string | null;
}

export const DEPLOYMENT: DeploymentInfo = {
  chainId: 84532,
  address: "${address}",
  deploymentBlock: ${/^\d+$/.test(block) ? block : "null"},
  deployer: ${/^0x[0-9a-fA-F]{40}$/.test(deployer) ? `"${deployer}"` : "null"},
  txHash: ${/^0x[0-9a-fA-F]{64}$/.test(txHash) ? `"${txHash}"` : "null"},
  gitCommit: null,
  updatedAt: new Date().toISOString(),
};
`;

writeFileSync(outFile, content);
console.log(`wrote ${outFile} for ${address} (chain 84532)`);
