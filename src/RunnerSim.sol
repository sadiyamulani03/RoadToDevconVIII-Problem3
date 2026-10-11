// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LevelConfig} from "./generated/LevelConfig.sol";

/// @title RunnerSim — deterministic integer physics for Ghost Sprint
/// @notice Mirrors frontend/src/game/engine.ts tick-for-tick.
///         Integer-only Q8 fixed-point math. No floating point, no timestamps.
///
/// Tick order (must match the TypeScript engine exactly):
///   1. validate + decode input byte (bit0 left, bit1 right, bit2 jump)
///   2. jump (only when grounded)
///   3. horizontal velocity from input
///   4. gravity + terminal clamp
///   5. horizontal move + solid resolution + world-edge clamp
///   6. vertical move (grounded cleared first) + solid resolution
///   6b. ground probe: grounded iff a 1-unit probe below the player touches a
///       solid (keeps jump input responsive on every resting tick)
///   7. hazard check  -> dead
///   8. goal check    -> won
///   9. fall out of world -> dead
library RunnerSim {
    enum Status {
        Playing,
        Dead,
        Won
    }

    struct State {
        int256 x;
        int256 y;
        int256 vx;
        int256 vy;
        bool grounded;
        Status status;
        uint256 tick;
    }

    struct RunOutcome {
        Status status;
        uint256 ticks;
        int256 finalX;
        int256 finalY;
        int256 finalVx;
        int256 finalVy;
        bool finalGrounded;
    }

    error EmptyInputLog();
    error InputLogTooLong(uint256 length, uint256 maxLength);
    error InvalidInputByte(uint256 tick, uint8 inputByte);

    function initialState() internal pure returns (State memory s) {
        s.x = LevelConfig.SPAWN_X;
        s.y = LevelConfig.SPAWN_Y;
        s.vx = 0;
        s.vy = 0;
        s.grounded = true;
        s.status = Status.Playing;
        s.tick = 0;
    }

    function _overlaps(int256 ax, int256 ay, int256 aw, int256 ah, LevelConfig.Rect memory b)
        internal
        pure
        returns (bool)
    {
        return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
    }

    /// @dev Truncating division toward zero is Solidity's native integer division.
    function _disp(int256 v) private pure returns (int256) {
        return v / int256(LevelConfig.POSITION_SCALE);
    }

    /// @dev Bits 3..7 must be clear; the two direction bits may not both be set.
    function isValidInputByte(uint8 b) internal pure returns (bool) {
        if ((b & LevelConfig.INPUT_INVALID_MASK) != 0) return false;
        uint8 directions = LevelConfig.INPUT_BIT_LEFT | LevelConfig.INPUT_BIT_RIGHT;
        if ((b & directions) == directions) return false;
        return true;
    }

    function validateInputLog(bytes memory inputs) internal pure {
        uint256 len = inputs.length;
        if (len == 0) revert EmptyInputLog();
        if (len > LevelConfig.MAX_INPUT_LENGTH) {
            revert InputLogTooLong(len, LevelConfig.MAX_INPUT_LENGTH);
        }
        for (uint256 i = 0; i < len; i++) {
            if (!isValidInputByte(uint8(inputs[i]))) revert InvalidInputByte(i, uint8(inputs[i]));
        }
    }

    /// @notice Advance the simulation by exactly one tick.
    function step(
        State memory s,
        uint8 input,
        LevelConfig.Rect[] memory solids,
        LevelConfig.Rect[] memory hazards
    ) internal pure {
        if (s.status != Status.Playing) return;

        // 1. validate + decode
        if (!isValidInputByte(input)) revert InvalidInputByte(s.tick, input);
        bool left = (input & LevelConfig.INPUT_BIT_LEFT) != 0;
        bool right = (input & LevelConfig.INPUT_BIT_RIGHT) != 0;
        bool jump = (input & LevelConfig.INPUT_BIT_JUMP) != 0;

        // 2. jump (only when grounded)
        if (jump && s.grounded) {
            s.vy = -LevelConfig.JUMP_VELOCITY;
            s.grounded = false;
        }

        // 3. horizontal velocity
        if (right) s.vx = LevelConfig.MOVE_SPEED;
        else if (left) s.vx = -LevelConfig.MOVE_SPEED;
        else s.vx = 0;

        // 4. gravity + terminal clamp
        s.vy += LevelConfig.GRAVITY;
        if (s.vy > LevelConfig.TERMINAL_VELOCITY) s.vy = LevelConfig.TERMINAL_VELOCITY;

        // 5. horizontal move + solid resolution + world-edge clamp
        s.x += _disp(s.vx);
        uint256 n = solids.length;
        for (uint256 i = 0; i < n; i++) {
            LevelConfig.Rect memory r = solids[i];
            if (_overlaps(s.x, s.y, LevelConfig.PLAYER_W, LevelConfig.PLAYER_H, r)) {
                if (s.vx > 0) s.x = r.x - LevelConfig.PLAYER_W;
                else if (s.vx < 0) s.x = r.x + r.w;
                s.vx = 0;
            }
        }
        int256 maxX = int256(LevelConfig.WORLD_W - uint256(LevelConfig.PLAYER_W));
        if (s.x < 0) {
            s.x = 0;
            s.vx = 0;
        } else if (s.x > maxX) {
            s.x = maxX;
            s.vx = 0;
        }

        // 6. vertical move + solid resolution
        s.grounded = false;
        s.y += _disp(s.vy);
        for (uint256 i = 0; i < n; i++) {
            LevelConfig.Rect memory r = solids[i];
            if (_overlaps(s.x, s.y, LevelConfig.PLAYER_W, LevelConfig.PLAYER_H, r)) {
                if (s.vy > 0) {
                    s.y = r.y - LevelConfig.PLAYER_H;
                } else if (s.vy < 0) {
                    s.y = r.y + r.h;
                }
                s.vy = 0;
            }
        }
        if (s.y < 0) {
            s.y = 0;
            if (s.vy < 0) s.vy = 0;
        }

        // 6b. ground probe: a 1-unit rect below the player must intersect a
        //     solid. Probing (instead of requiring an overlap this tick) keeps
        //     `grounded` stable while resting, so a jump input is honoured on
        //     every tick the player stands on a surface.
        for (uint256 i = 0; i < n; i++) {
            if (_overlaps(s.x, s.y + 1, LevelConfig.PLAYER_W, LevelConfig.PLAYER_H, solids[i])) {
                s.grounded = true;
                break;
            }
        }

        s.tick += 1;

        // 7. hazards
        uint256 hn = hazards.length;
        for (uint256 i = 0; i < hn; i++) {
            if (_overlaps(s.x, s.y, LevelConfig.PLAYER_W, LevelConfig.PLAYER_H, hazards[i])) {
                s.status = Status.Dead;
                return;
            }
        }

        // 8. goal
        if (_overlaps(s.x, s.y, LevelConfig.PLAYER_W, LevelConfig.PLAYER_H, LevelConfig.goal())) {
            s.status = Status.Won;
            return;
        }

        // 9. fell out of the world
        if (s.y + LevelConfig.PLAYER_H > int256(LevelConfig.WORLD_H)) {
            s.status = Status.Dead;
        }
    }

    /// @notice Simulate a full input log from a fresh spawn.
    ///         Reverts on malformed logs; for valid logs returns the outcome
    ///         (status != Won if the player died or ran out of inputs).
    function run(bytes memory inputs) internal pure returns (RunOutcome memory out) {
        validateInputLog(inputs);
        State memory s = initialState();
        LevelConfig.Rect[] memory solids = LevelConfig.solids();
        LevelConfig.Rect[] memory hazards = LevelConfig.hazards();
        uint256 len = inputs.length;
        for (uint256 i = 0; i < len; i++) {
            if (s.status != Status.Playing) break;
            step(s, uint8(inputs[i]), solids, hazards);
        }
        out.status = s.status;
        out.ticks = s.tick;
        out.finalX = s.x;
        out.finalY = s.y;
        out.finalVx = s.vx;
        out.finalVy = s.vy;
        out.finalGrounded = s.grounded;
    }

    /// @notice Authoritative completion time in milliseconds:
    ///         trunc(ticks * 1000 / TICK_RATE).
    function timeMsFromTicks(uint256 ticks) internal pure returns (uint256) {
        return (ticks * 1000) / LevelConfig.TICK_RATE;
    }
}
