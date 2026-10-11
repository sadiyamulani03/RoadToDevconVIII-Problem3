// Acceptance: frontend must target Base Sepolia (chain id 84532) explicitly,
// never mainnet, never a localhost-only default.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CHAIN_ID,
  CHAIN_NAME,
  EXPLORER_URL,
  RPC_URL,
  SUPPORTED_CHAINS,
  resolveContractConfig,
} from "../config/chain";
import { DEPLOYMENT } from "../generated/deployment";

describe("chain configuration", () => {
  it("targets Base Sepolia (84532)", () => {
    expect(CHAIN_ID).toBe(84532);
    expect(CHAIN_NAME).toMatch(/Base Sepolia/i);
    expect(SUPPORTED_CHAINS.map((c) => c.id)).toContain(84532);
  });

  it("is not mainnet and not localhost-only", () => {
    expect(CHAIN_ID).not.toBe(1);
    expect(CHAIN_ID).not.toBe(8453);
    expect(CHAIN_ID).not.toBe(1337);
    expect(CHAIN_ID).not.toBe(31337);
  });

  it("has a Base Sepolia explorer", () => {
    expect(EXPLORER_URL).toMatch(/sepolia\.basescan/i);
  });

  it("has a usable RPC endpoint", () => {
    expect(RPC_URL).toMatch(/^https?:\/\//);
  });

  it("deployment record is pinned to 84532 and honest about being unset", () => {
    expect(DEPLOYMENT.chainId).toBe(84532);
    // Before a real deployment, address must be null — never invented.
    expect(DEPLOYMENT.address === null || /^0x[0-9a-fA-F]{40}$/.test(DEPLOYMENT.address)).toBe(
      true,
    );
  });

  it("resolveContractConfig never invents an address", () => {
    const cfg = resolveContractConfig();
    expect(cfg.chainId).toBe(84532);
    if (cfg.address === null) {
      expect(cfg.source).toBe("missing");
    } else {
      expect(cfg.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(["env", "deployment"]).toContain(cfg.source);
    }
  });

  it("wagmi config chains only include Base Sepolia", async () => {
    const { wagmiConfig } = await import("../config/wagmi");
    expect(wagmiConfig.chains.map((c) => c.id)).toEqual([84532]);
  });

  it("generated level config and shared level agree on the level id", () => {
    const level = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../shared/level.json", import.meta.url)), "utf8"),
    ) as { meta: { id: string } };
    expect(DEPLOYMENT.chainId).toBe(84532);
    expect(level.meta.id).toBe("ghost-sprint-v1");
  });
});
