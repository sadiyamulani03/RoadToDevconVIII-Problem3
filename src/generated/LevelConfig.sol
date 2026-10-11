// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// ============================================================
// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: shared/level.json
// Regenerate:      npm run generate:level
// Verify:          npm run check:level
// ============================================================

library LevelConfig {
    string internal constant LEVEL_ID = "ghost-sprint-v1";
    string internal constant LEVEL_NAME = "Ghost Sprint";

    uint256 internal constant WORLD_W = 480;
    uint256 internal constant WORLD_H = 272;

    int256 internal constant SPAWN_X = 16;
    int256 internal constant SPAWN_Y = 232;
    int256 internal constant PLAYER_W = 12;
    int256 internal constant PLAYER_H = 16;

    uint256 internal constant TICK_RATE = 60;
    uint256 internal constant MAX_INPUT_LENGTH = 1200;

    int256 internal constant MOVE_SPEED = 768;
    int256 internal constant JUMP_VELOCITY = 1536;
    int256 internal constant GRAVITY = 102;
    int256 internal constant TERMINAL_VELOCITY = 1792;
    uint256 internal constant POSITION_SCALE = 256;

    uint8 internal constant INPUT_BIT_LEFT = 1;
    uint8 internal constant INPUT_BIT_RIGHT = 2;
    uint8 internal constant INPUT_BIT_JUMP = 4;
    uint8 internal constant INPUT_INVALID_MASK = 248;

    struct Rect {
        int256 x;
        int256 y;
        int256 w;
        int256 h;
    }

    function goal() internal pure returns (Rect memory) {
        return Rect(448, 200, 16, 48);
    }

    function solids() internal pure returns (Rect[] memory rs) {
        rs = new Rect[](6);
        rs[0] = Rect(0, 248, 144, 24); // groundA
        rs[1] = Rect(192, 248, 112, 24); // groundB
        rs[2] = Rect(344, 248, 136, 24); // groundC
        rs[3] = Rect(96, 216, 48, 10); // ledgeP1
        rs[4] = Rect(264, 216, 12, 32); // wallW1
        rs[5] = Rect(312, 216, 24, 10); // stepP2
    }

    function hazards() internal pure returns (Rect[] memory rs) {
        rs = new Rect[](3);
        rs[0] = Rect(56, 238, 24, 10); // spikesA
        rs[1] = Rect(232, 238, 16, 10); // spikesB
        rs[2] = Rect(392, 238, 24, 10); // spikesC
    }
}
