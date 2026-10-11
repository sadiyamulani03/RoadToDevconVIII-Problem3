# Ghost Sprint — Speedrun Ghosts (Base Sepolia)

An onchain speedrunning game for **Base Sepolia (chain id 84532)**. You
reach the flag as fast as you can; the game records one `uint8` per 60 Hz
tick; the **`GhostSprint` contract re-simulates your entire input log with
deterministic integer physics and derives the completion time itself**. A run
only counts if the simulation genuinely reaches the goal. There is no admin,
no trusted backend, and no way to override a recorded time. Race other
players' ghosts by replaying their verified input logs next to you.

---

## Quick start

```bash
# install (root tooling + frontend deps)
npm install
npm --prefix frontend install

# sanity: level freshness, cross-runtime vectors, contracts, frontend, secrets
npm run test:all

# play locally (guest mode — no wallet or deployment needed)
npm run build:frontend && npm --prefix frontend run preview
```

Controls: **←/→ or A/D** move, **Space/W/↑/Z** jump, **R** restart.

## How a run becomes a leaderboard entry

1. **Play** in the browser. The client records exactly one `uint8` per tick:
   bit 0 = left, bit 1 = right, bit 2 = jump. `3` (left+right) and any byte
   with bits 3–7 set are rejected by *both* runtimes.
2. **Submit** `submitRun(bytes inputs)` — the log never contains a time.
3. The contract re-simulates every tick (`RunnerSim.sol`), checks hazards and
   the goal rect, and computes `timeMs = ticks * 1000 / TICK_RATE` itself.
4. Only fully completed runs are stored; failed submissions revert and
   persist nothing. Personal bests improve strictly (`timeMs < previous`).
5. The full input log is stored **and** emitted in the `RunVerified` event, so
   any client can rebuild every ghost from chain data alone after a reload.

## Determinism model

The TypeScript engine (`frontend/src/game/engine.ts`) and the Solidity
simulator (`src/RunnerSim.sol`) implement the *same* integer pipeline:

- positions are whole world units; velocities are Q8 fixed point (x256);
- displacement is `trunc(velocity / 256)` — truncation toward zero, identical
  to Solidity integer division;
- no wall clocks, frame timestamps, or RNG ever touch simulation state;
- tick order is documented in both files' headers (validate → jump → vx →
  gravity → horizontal resolve → vertical resolve → ground probe → hazard →
  goal → out-of-world).

`scripts/gen-vectors.mjs` generates a shared vector suite
(`shared/vectors.json`) consumed by **both** `test/Vector.t.sol` (Foundry)
and `frontend/src/test/vectors.test.ts` (vitest) — the two runtimes must
agree tick-for-tick or the suite fails.

## Repository layout

| Path | Purpose |
| --- | --- |
| `shared/level.json` | **Single source of truth** for the level + physics constants |
| `shared/canonical-run.json` | Tick-optimal verified reference run (BFS solver) |
| `shared/vectors.json` | Cross-runtime test vectors (generated) |
| `scripts/generate-level.mjs` | Level codegen → `src/generated/LevelConfig.sol` + `frontend/src/generated/levelConfig.ts` |
| `scripts/solve-level.mjs` | BFS solver; proves the level is beatable |
| `scripts/gen-vectors.mjs` | Generates/validates the shared vector suite |
| `scripts/sync-abi.mjs` | Copies the built ABI into `frontend/src/abi/` |
| `scripts/sync-deployment.mjs` | Records a real deployment into the frontend |
| `scripts/scan-secrets.mjs` | Fails if secret-looking material is committed |
| `src/GhostSprint.sol` | Verification, leaderboard, ghost data, personal bests |
| `src/RunnerSim.sol` | Deterministic tick simulator (integer-only) |
| `script/Deploy.s.sol` | Base-Sepolia-guarded deployment script |
| `test/*.t.sol` | Foundry suite (all acceptance areas, incl. fuzz + invariants) |
| `frontend/` | Vite + React + TS game client (wagmi/viem) |
| `frontend/src/test/*.test.ts` | Vitest suite (vectors, determinism, config, security) |

## Deployment (Base Sepolia)

### Target network

| | |
| --- | --- |
| Network | **Base Sepolia** |
| Chain ID | **84532** |
| Block explorer | <https://sepolia.basescan.com> (contract links appear only after a real deployment) |
| Deploy script | `script/Deploy.s.sol` — refuses any chain other than 84532 unless `ALLOW_OTHER_CHAIN=true` is set explicitly for local anvil testing |

### Deployment status

| Field | Value |
| --- | --- |
| Deployment status | **Pending** — no deployment has been performed yet |
| Contract address | **Not deployed** |
| Deployment tx / block | Not available yet |
| Explorer link (contract) | Not available yet |

These fields are intentionally blank. They are updated **only** after a real,
verified Base Sepolia deployment is executed and its output recorded — no
address, transaction, block number, or explorer link in this repository is
fabricated. Until then `frontend/src/generated/deployment.ts` keeps
`address: null` and the frontend shows an explicit "not configured" state.

**Missing prerequisites (why deployment is pending):** no deployer
credentials are configured in this environment — `PRIVATE_KEY` and
`BASE_SEPOLIA_RPC_URL` are unset, and no funded Base Sepolia testnet account
is available. To resolve locally: fill in `.env` (created from
`.env.example`), fund the testnet-only deployer from a faucet, then run
`npm run deploy:sepolia` and the synchronization commands below. A verified
Base Sepolia RPC endpoint (chain id 84532) was confirmed reachable; only the
key and its funding are missing.

### Local guest mode (available without deployment)

The game is fully playable **without any deployment**: play, record, replay,
and race the bundled demo ghost or your own local practice ghosts. In this
mode onchain submission is disabled with a clear notice — **onchain
submissions, the public leaderboard, and onchain-verified ghosts require a
deployed contract** (see below).

### Deploying the contract

Prerequisites (credentials stay local — `.env` is gitignored and must never
be committed or printed):

1. Copy the template and fill in values locally:

   ```bash
   cp .env.example .env
   ```

2. Configure in `.env`:
   - `PRIVATE_KEY` — a **testnet-only** deployer key (never a mainnet key).
   - `BASE_SEPOLIA_RPC_URL` — Base Sepolia RPC endpoint.
   - `BASESCAN_API_KEY` — only needed by the verification workflow; the
     repository's deploy command runs `forge ... --verify`, so supply it for
     `npm run deploy:sepolia`, or invoke `forge script` without `--verify`
     if you skip contract-source verification.

3. Fund the deployer with Base Sepolia testnet ETH from a faucet (the
   account must cover deployment gas).

4. Run the repository's deployment command:

   ```bash
   source .env
   npm run deploy:sepolia
   ```

   On success the script prints the **real** deployed address
   (`GhostSprint deployed at: 0x…`), the deployer, chain id, `levelId`, and
   `version` — record the address and the deployment block from the forge
   broadcast output (`broadcast/Deploy.s.sol/…/run-latest.json`).

5. Synchronize the generated frontend configuration with the real
   deployment (never hand-edit generated files):

   ```bash
   npm run sync:abi                                # out/GhostSprint.sol → frontend/src/abi
   DEPLOYED_ADDRESS=0x… DEPLOYED_BLOCK=… node scripts/sync-deployment.mjs
   # equivalently: npm run sync:deployment with the same environment variables
   ```

6. Re-run the checks and verify the frontend picks up the real address:

   ```bash
   npm run test:all
   ```

   After synchronization the header must show the contract address (and a
   Base Sepolia explorer link) instead of the guest-mode banner; if
   `frontend/src/generated/deployment.ts` still reads `address: null`, the
   frontend is correctly refusing to pretend the contract exists.

### Fields to update after a real deployment

Clearly identifiable, currently-pending values to replace (all verifiable
against the broadcast output before editing):

- **This section's deployment status table** — status → Deployed, contract
  address, deployment tx, block number, and the contract explorer link
  (`<explorer>/address/<real address>`).
- `frontend/src/generated/deployment.ts` — via `npm run sync:deployment`
  (never by hand).
- Optionally `frontend/.env.local` → `VITE_CONTRACT_ADDRESS` for local
  overrides.

### Local anvil end-to-end (optional)

```bash
anvil --port 8545 &
export PRIVATE_KEY=<anvil key> ALLOW_OTHER_CHAIN=true
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

## Testing

| Command | What it proves |
| --- | --- |
| `npm run check:level` | Generated code matches `shared/level.json` |
| `npm run solve` | BFS finds a win; cross-checked against the TS engine |
| `npm run check:vectors` | Vectors replay identically in the TS engine |
| `npm run test:contracts` | Foundry: verification, bounds, obstacles, goal, parity, ghost data, PB, fuzz, invariants |
| `npm run test:frontend` | Vitest: engine semantics, shared vectors, determinism, Base-Sepolia config, ghost storage, secret hygiene |
| `npm run scan:secrets` | No keys/mnemonics/tokens anywhere in the tree |
| `npm run test:all` | Everything above, in order |
| `npm run lint` / `npm run typecheck` | forge fmt + forge lint + eslint + tsc |

## Security notes

- **No admin functions** — the contract has no owner, no pause, no
  set-time/override path. Verification logic is permissionless.
- **Bounds before work** — empty logs and logs over `MAX_INPUT_LENGTH`
  (1200) revert before any simulation; every byte is validated before tick 0.
- **Calldata is the input** — a run cannot lie about its time because the
  time is never an argument.
- **Secrets** — `.env` is gitignored; `.env.example` holds placeholders only;
  `npm run scan:secrets` enforces this mechanically.
- **Frontend integrity** — input logs fetched from the chain are re-hashed
  and checked against the contract's stored `inputsHash` before being used
  as raceable ghosts.
