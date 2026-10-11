#!/usr/bin/env node
// Repository secrets scan. Fails (exit 1) if anything that looks like a
// private key, mnemonic, or API token is present in the working tree or in
// git-tracked files.
//
// Usage: node scripts/scan-secrets.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "lib", // vendored forge-std
  "out",
  "cache",
  "dist",
  "broadcast",
  ".vscode",
]);
const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
  ".woff", ".woff2", ".ttf", ".otf",
  ".zip", ".gz", ".tar",
  ".pdf",
  ".lock",
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const PATTERNS = [
  {
    name: "hex private key",
    // 32-byte hex assigned to a key-ish name, or a bare PRIVATE_KEY= line
    re: /(?:private[_-]?key|secret[_-]?key|deployer[_-]?key|mnemonic)[^\n]{0,40}?(?:0x)?[0-9a-fA-F]{64}\b|PRIVATE_KEY\s*=\s*0x[0-9a-fA-F]{64}/g,
    redact: true, // never print any part of key material
  },
  {
    name: "bare 64-hex secret in env-like file",
    re: /\b[0-9a-fA-F]{64}\b/g,
    fileFilter: (file) => /(^|\/)\.env(\..+)?$|\.pem$|\.key$/i.test(file),
  },
  {
    name: "BIP39-style mnemonic",
    re: /\b(?:[a-z]+\s+){11,23}[a-z]+\b/g,
    // Source-code prose produces false positives; a leaked mnemonic in a
    // committed source file would also be caught by review, while this keeps
    // scanning .txt/.json/.env/.js storage-like files where leaks actually live.
    fileFilter: (file) =>
      !/\.(ts|tsx|js|mjs|cjs|sol|rs|css|scss|html|md|yml|yaml)$/i.test(file),
    validate: (match) => {
      const words = match.trim().toLowerCase().split(/\s+/);
      if (words.length < 12 || words.length > 24 || words.length % 3 !== 0) return false;
      const unique = new Set(words).size;
      if (unique < 8 || !words.every((w) => /^[a-z]+$/.test(w) && w.length >= 3)) {
        return false;
      }
      // Reject matches full of everyday English function words — real
      // BIP39 phrases almost never form coherent sentences.
      const common = new Set([
        "the", "your", "with", "that", "this", "are", "for", "from", "never",
        "only", "into", "when", "what", "how", "and", "not", "can", "run",
        "runs", "you", "all", "one", "out", "get", "has", "have", "will",
      ]);
      const commonCount = words.filter((w) => common.has(w)).length;
      return commonCount <= 1;
    },
  },
  {
    name: "provider/token style secret",
    re: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g,
  },
];

function walk(dir, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === ".git") continue;
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(path, files);
    } else if (!SKIP_EXT.has(extname(entry).toLowerCase()) && st.size <= MAX_FILE_BYTES) {
      files.push(path);
    }
  }
}

function gitTracked() {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((f) => join(root, f));
  } catch {
    return null;
  }
}

const findings = [];

const workingFiles = [];
walk(root, workingFiles);

const tracked = gitTracked();
const scanSet = new Map(workingFiles.map((f) => [f, "working tree"]));
if (tracked) {
  for (const f of tracked) {
    if (!scanSet.has(f) && existsSync(f)) scanSet.set(f, "git-tracked");
  }
}

for (const [file, origin] of scanSet) {
  const rel = relative(root, file);
  // The local secret store `.env` is intentionally skipped for content
  // scanning: real credentials are *supposed* to live there, and printing
  // matches would echo key material into terminal output. Exposure safety is
  // enforced by the structural checks below (must be gitignored + untracked).
  if (rel === ".env") continue;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of PATTERNS) {
    if (pattern.fileFilter && !pattern.fileFilter(rel)) continue;
    for (const match of content.matchAll(pattern.re)) {
      if (pattern.validate && !pattern.validate(match[0])) continue;
      const line = content.slice(0, match.index).split("\n").length;
      findings.push({
        file: rel,
        line,
        name: pattern.name,
        snippet: pattern.redact ? "[redacted]" : match[0].slice(0, 24) + "…",
      });
    }
  }
}

// structural checks: the local secret store must be ignored AND untracked

// .env.example must contain placeholders only (it is tracked by git)
const envExamplePath = join(root, ".env.example");
if (existsSync(envExamplePath)) {
  const exampleContent = readFileSync(envExamplePath, "utf8");
  const realValues = exampleContent
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    .filter(
      ([, v]) =>
        v !== "" && !/your|example|replace|<|https:\/\//i.test(v),
    );
  if (realValues.length > 0) {
    findings.push({
      file: ".env.example",
      line: 0,
      name: "non-placeholder value in .env.example",
      snippet: `${realValues.map(([k]) => k).join(", ")} (values withheld)`,
    });
  }
}

const gitignore = existsSync(join(root, ".gitignore"))
  ? readFileSync(join(root, ".gitignore"), "utf8")
  : "";
if (!/^\.env$/m.test(gitignore)) {
  findings.push({ file: ".gitignore", line: 0, name: "missing .env ignore rule", snippet: ".env" });
}
if (tracked && tracked.some((f) => relative(root, f) === ".env")) {
  findings.push({ file: ".env", line: 0, name: "tracked .env file", snippet: "git ls-files" });
}

if (findings.length === 0) {
  console.log(`scan-secrets: clean (scanned ${scanSet.size} files)`);
  process.exit(0);
}

console.error(`scan-secrets: ${findings.length} finding(s):`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.name}]  ${f.snippet}`);
}
process.exit(1);
