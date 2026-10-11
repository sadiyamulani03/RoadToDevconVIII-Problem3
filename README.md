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
| Block explorer | <https://sepolia.basescan.org> |
| Deploy script | `script/Deploy.s.sol` — refuses any chain other than 84532 unless `ALLOW_OTHER_CHAIN=true` is set explicitly for local anvil testing |

### Deployment status

| Field | Value |
| --- | --- |
| Deployment status | **Deployed** — 2026-10-11, via `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast` |
| Contract address | [`0x2c81dBA21188704201C899C7810a67fA903B5171`](https://sepolia.basescan.org/address/0x2c81dBA21188704201C899C7810a67fA903B5171) |
| Deployment tx | [`0x726a1e9eff62cfaffee20d669beda59368488a61c037e5c63ff5142ef04c61fd`](https://sepolia.basescan.org/tx/0x726a1e9eff62cfaffee20d669beda59368488a61c037e5c63ff5142ef04c61fd) |
| Deployment block | `47964631` (receipt status `1` success, gas used `1,583,557`) |
| Deployer | `0x81A4d25Ae3f981A67ab6098AA8Ea2b7B821d734E` |
| Onchain sanity reads | `levelId() = "ghost-sprint-v1"`, `version() = "1.0.0"`, `MAX_INPUT_LENGTH() = 1200`, `TICK_RATE() = 60` |
| Source verification | **Verified** — 2026-10-11: explorer reports `GhostSprint` (solc `v0.8.28+commit.7893614a`, optimizer runs `200`, EVM `cancun`, no constructor args); [view verified source](https://sepolia.basescan.org/address/0x2c81dBA21188704201C899C7810a67fA903B5171#code). Sourcify reports `exact_match` for chain 84532. |

Every value above was taken from `broadcast/Deploy.s.sol/84532/run-latest.json`
and confirmed with `cast receipt` / `cast call` against Base Sepolia — nothing
is fabricated. `frontend/src/generated/deployment.ts` was produced from these
exact values by `npm run sync:deployment`.

### Source verification (confirmed 2026-10-11)

Verification ran against **Base Sepolia only** (chain 84532) and was
confirmed through the explorer's `getsourcecode` API — not merely by
submitting the request. The explorer returns the published source
(21,715 bytes) and ABI (5,915 bytes) for `GhostSprint` in
`src/GhostSprint.sol`, compiled with `v0.8.28+commit.7893614a`, optimizer
runs `200`, EVM `cancun`, and **no constructor arguments** — matching
`foundry.toml` and `script/Deploy.s.sol` (`new GhostSprint()`) exactly.
Sourcify independently reports `exact_match` for this address on chain
84532.

The command used (the key is read from the local gitignored `.env` and is
never committed or printed):

```bash
forge verify-contract 0x2c81dBA21188704201C899C7810a67fA903B5171 \
  src/GhostSprint.sol:GhostSprint --chain 84532 --watch \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

### Local guest mode (play without a wallet)

The game is playable **without connecting a wallet**: play, record, replay,
and race the bundled demo ghost or your own local practice ghosts. Connecting
a Base Sepolia wallet enables **onchain submission** to the deployed contract
above, the public leaderboard, and racing onchain-verified ghosts fetched
from contract storage.

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

### Onchain smoke test (deployed flow — executed 2026-10-11)

`script/SmokeTest.s.sol` submitted two real runs from the deployer wallet to
the deployed contract (both confirmed in block `47964922`):

| Run | Inputs | Contract-computed result | Tx |
| --- | --- | --- | --- |
| run #1 | canonical 141-tick log | **won — 141 ticks, 2350 ms** | [`0x5cf690c2…269669e`](https://sepolia.basescan.org/tx/0x5cf690c2c877c3d52ef2fbc3eedfc3ccb0d6e0d5e8554a42a200e5c31269669e) |
| run #2 | same run behind 60 neutral ticks | won — 201 ticks, 3350 ms (**slower, PB untouched**) | [`0xd9353cf2…f707de9`](https://sepolia.basescan.org/tx/0xd9353cf2c83245e574a5e9a12c2a031cdb15ca8ffdcd5f7562379224cf707de9) |

Checks performed **against the deployed bytecode** (not local simulations):

- `runCount() = 2`; `getRun(1)` and `getRun(2)` carry the contract's own
  tick/time values (`ticks * 1000 / 60` — no caller-supplied time exists);
- **strict personal best**: `bestTime(deployer) = 2350`, `bestRunId = 1`
  after the slower run; exactly one `PersonalBestImproved` event
  (`previous = 0 → 2350`);
- **input integrity**: `keccak256(getRunInputs(1))` equals the stored
  `inputsHash` and the originally submitted bytes;
- **client parity**: replaying the *chain-retrieved* input log in the TS
  engine yields `won / 141 ticks / 2350 ms` — identical to the contract;
- **rejections** (via `eth_call`, no state change): incomplete run →
  `RunNotVerified(0, 50)` (not recorded), empty → `EmptyInputLog`,
  1201-byte log → `InputLogTooLong(1201, 1200)`, byte `0x03` →
  `InvalidInputByte(0, 3)`, unknown id → `UnknownRun(99)`; `runCount`
  stayed `2`;
- both `RunVerified` events contain the complete input log in their data
  (replayable from chain logs alone).

Reproduce (uses local `.env` credentials, spends a tiny amount of testnet
gas):

```bash
CONTRACT_ADDRESS=0x2c81dBA21188704201C899C7810a67fA903B5171 \
RUN_INPUTS_FAST=0x… RUN_INPUTS_PADDED=0x… \
forge script script/SmokeTest.s.sol --rpc-url base_sepolia --broadcast
```

**Not tested:** browser-wallet submission through the frontend UI (this
environment has no GUI wallet). The contract-side path that UI calls is what
the checks above exercised directly; `npm run test:all` covers the client
logic locally.

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
