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

Deployment needs a funded **testnet-only** key; nothing is committed:

```bash
cp .env.example .env        # then fill PRIVATE_KEY / BASE_SEPOLIA_RPC_URL
source .env
npm run deploy:sepolia      # forge script script/Deploy.s.sol --broadcast --verify
```

The deploy script refuses to run on any chain other than 84532 unless
`ALLOW_OTHER_CHAIN=true` is set explicitly (local anvil testing only).

After it succeeds, record the address for the frontend:

```bash
DEPLOYED_ADDRESS=0x… DEPLOYED_BLOCK=… node scripts/sync-deployment.mjs
# or: frontend/.env.local → VITE_CONTRACT_ADDRESS=0x…
```

Until then the frontend runs in **guest mode**: you can play, record, replay
and race the bundled demo ghost, and it will clearly say the contract is not
configured — it never invents an address.

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
