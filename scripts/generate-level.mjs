#!/usr/bin/env node
/**
 * Deterministic level generator.
 * Reads shared/level.json (single source of truth) and emits:
 *   - src/generated/LevelConfig.sol
 *   - frontend/src/generated/levelConfig.ts
 * Regenerate with: npm run generate:level
 * Verify freshness with: npm run check:level
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const levelPath = join(root, "shared", "level.json");
const level = JSON.parse(readFileSync(levelPath, "utf8"));

const SOL_HEADER = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ============================================================
// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: shared/level.json
// Regenerate:      npm run generate:level
// Verify:          npm run check:level
// ============================================================

library LevelConfig {
    string internal constant LEVEL_ID = "${level.meta.id}";
    string internal constant LEVEL_NAME = "${level.meta.name}";

    uint256 internal constant WORLD_W = ${level.world.width};
    uint256 internal constant WORLD_H = ${level.world.height};

    int256 internal constant SPAWN_X = ${level.player.spawnX};
    int256 internal constant SPAWN_Y = ${level.player.spawnY};
    int256 internal constant PLAYER_W = ${level.player.width};
    int256 internal constant PLAYER_H = ${level.player.height};

    uint256 internal constant TICK_RATE = ${level.physics.tickRate};
    uint256 internal constant MAX_INPUT_LENGTH = ${level.physics.maxInputLength};

    int256 internal constant MOVE_SPEED = ${level.physics.moveSpeed};
    int256 internal constant JUMP_VELOCITY = ${level.physics.jumpVelocity};
    int256 internal constant GRAVITY = ${level.physics.gravity};
    int256 internal constant TERMINAL_VELOCITY = ${level.physics.terminalVelocity};
    uint256 internal constant POSITION_SCALE = ${level.physics.positionScale};

    uint8 internal constant INPUT_BIT_LEFT = ${level.input.bitLeft};
    uint8 internal constant INPUT_BIT_RIGHT = ${level.input.bitRight};
    uint8 internal constant INPUT_BIT_JUMP = ${level.input.bitJump};
    uint8 internal constant INPUT_INVALID_MASK = ${level.input.invalidMask};

    struct Rect {
        int256 x;
        int256 y;
        int256 w;
        int256 h;
    }

    function goal() internal pure returns (Rect memory) {
        return Rect(${level.goal.x}, ${level.goal.y}, ${level.goal.w}, ${level.goal.h});
    }

    function solids() internal pure returns (Rect[] memory rs) {
        rs = new Rect[](${level.solids.length});
${level.solids
  .map((s, i) => `        rs[${i}] = Rect(${s.x}, ${s.y}, ${s.w}, ${s.h}); // ${s.name}`)
  .join("\n")}
    }

    function hazards() internal pure returns (Rect[] memory rs) {
        rs = new Rect[](${level.hazards.length});
${level.hazards
  .map((s, i) => `        rs[${i}] = Rect(${s.x}, ${s.y}, ${s.w}, ${s.h}); // ${s.name}`)
  .join("\n")}
    }
}
`;

const tsRect = (r) => `{ x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} }`;

const TS_HEADER = `// ============================================================
// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: shared/level.json
// Regenerate:      npm run generate:level
// Verify:          npm run check:level
// ============================================================

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LEVEL = {
  id: ${JSON.stringify(level.meta.id)},
  name: ${JSON.stringify(level.meta.name)},
  world: { width: ${level.world.width}, height: ${level.world.height} },
  player: {
    spawnX: ${level.player.spawnX},
    spawnY: ${level.player.spawnY},
    width: ${level.player.width},
    height: ${level.player.height},
  },
  solids: [
${level.solids.map((s) => `    ${tsRect(s)}, // ${s.name}`).join(",\n")}
  ] as readonly Rect[],
  hazards: [
${level.hazards.map((s) => `    ${tsRect(s)}, // ${s.name}`).join(",\n")}
  ] as readonly Rect[],
  goal: ${tsRect(level.goal)} as Rect,
  physics: {
    tickRate: ${level.physics.tickRate},
    maxInputLength: ${level.physics.maxInputLength},
    moveSpeed: ${level.physics.moveSpeed},
    jumpVelocity: ${level.physics.jumpVelocity},
    gravity: ${level.physics.gravity},
    terminalVelocity: ${level.physics.terminalVelocity},
    positionScale: ${level.physics.positionScale},
  },
  input: {
    bitLeft: ${level.input.bitLeft},
    bitRight: ${level.input.bitRight},
    bitJump: ${level.input.bitJump},
    invalidMask: ${level.input.invalidMask},
  },
} as const;

export default LEVEL;
`;

const solOut = join(root, "src", "generated", "LevelConfig.sol");
const tsOut = join(root, "frontend", "src", "generated", "levelConfig.ts");
mkdirSync(dirname(solOut), { recursive: true });
mkdirSync(dirname(tsOut), { recursive: true });
writeFileSync(solOut, SOL_HEADER);
writeFileSync(tsOut, TS_HEADER);
console.log("generated:", solOut);
console.log("generated:", tsOut);
