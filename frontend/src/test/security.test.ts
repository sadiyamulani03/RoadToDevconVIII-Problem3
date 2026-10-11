// Security hygiene (supports the secrets-scan acceptance test):
//  - .env.example must contain placeholders only
//  - .env must be gitignored
//  - no committed file may contain private keys or mnemonics

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function trackedFiles(): string[] {
  try {
    const out = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

describe("secret hygiene", () => {
  it(".env is gitignored", () => {
    const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env$/m);
  });

  it(".env.example contains only placeholders", () => {
    const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8");
    const lines = envExample.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const eq = line.indexOf("=");
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      // every value must be empty or an obvious placeholder
      const placeholder =
        value === "" ||
        /^<.*>$/.test(value) ||
        /your[_-]/i.test(value) ||
        /example/i.test(value) ||
        /replace/i.test(value) ||
        /^https:\/\/(sepolia\.)?(base|basecamp)\b/i.test(value); // public RPC endpoints are not secrets
      expect(placeholder, `.env.example ${key} looks like a real secret`).toBe(true);
    }
  });

  it("no tracked file contains a private key or mnemonic", () => {
    const suspicious =
      /\b[0-9a-fA-F]{64}\b(?![0-9a-fA-F])|((\w+\s+){11,23}(witness|abandon|zoo|ability|absent))/;
    const keyish = /PRIVATE_KEY\s*=\s*0x[0-9a-fA-F]{64}|MNEMONIC\s*=\s*\w+/;
    for (const file of trackedFiles()) {
      if (file.startsWith("lib/")) continue; // vendored forge-std
      if (/\.(png|jpg|gif|ico|woff2?|lock)$/i.test(file)) continue;
      const path = join(repoRoot, file);
      if (!existsSync(path)) continue;
      let content: string;
      try {
        content = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      if (keyish.test(content) || (suspicious.test(content) && !file.endsWith(".sol"))) {
        // .sol files contain bytes32 constants legitimately (keccak hashes);
        // focus the scan on config/script/env-looking files.
        expect(file, `possible secret material in tracked file ${file}`).toBe("");
      }
    }
  });

  it("no .env file is committed", () => {
    const files = trackedFiles();
    expect(files.filter((f) => f === ".env" || f.endsWith("/.env"))).toEqual([]);
  });
});
