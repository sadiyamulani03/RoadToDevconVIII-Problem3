// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {LevelConfig} from "../src/generated/LevelConfig.sol";

/// @notice Acceptance test 8 (shared level, 10 pts): the Solidity constants and
///         the frontend module are both derived from shared/level.json — this
///         test proves the Solidity side matches the JSON source byte-for-byte
///         and that both generated files carry the generated-file notice.
contract LevelParityTest is Test {
    struct RectJson {
        uint256 h;
        string name;
        uint256 w;
        uint256 x;
        uint256 y;
    }

    string internal constant GENERATED_NOTICE = "AUTO-GENERATED";
    string internal constant SOURCE_OF_TRUTH = "shared/level.json";
    string internal constant REGENERATE_CMD = "npm run generate:level";

    function _readLevel() internal view returns (string memory) {
        return vm.readFile("shared/level.json");
    }

    function test_worldAndPlayerMatchJson() public view {
        string memory json = _readLevel();
        assertEq(vm.parseJsonUint(json, ".world.width"), LevelConfig.WORLD_W);
        assertEq(vm.parseJsonUint(json, ".world.height"), LevelConfig.WORLD_H);
        assertEq(vm.parseJsonUint(json, ".player.spawnX"), uint256(LevelConfig.SPAWN_X));
        assertEq(vm.parseJsonUint(json, ".player.spawnY"), uint256(LevelConfig.SPAWN_Y));
        assertEq(vm.parseJsonUint(json, ".player.width"), uint256(LevelConfig.PLAYER_W));
        assertEq(vm.parseJsonUint(json, ".player.height"), uint256(LevelConfig.PLAYER_H));
        assertEq(vm.parseJsonString(json, ".meta.id"), LevelConfig.LEVEL_ID);
        assertEq(vm.parseJsonString(json, ".meta.name"), LevelConfig.LEVEL_NAME);
    }

    function test_physicsAndInputMatchJson() public view {
        string memory json = _readLevel();
        assertEq(vm.parseJsonUint(json, ".physics.tickRate"), LevelConfig.TICK_RATE);
        assertEq(vm.parseJsonUint(json, ".physics.maxInputLength"), LevelConfig.MAX_INPUT_LENGTH);
        assertEq(vm.parseJsonUint(json, ".physics.moveSpeed"), uint256(LevelConfig.MOVE_SPEED));
        assertEq(
            vm.parseJsonUint(json, ".physics.jumpVelocity"), uint256(LevelConfig.JUMP_VELOCITY)
        );
        assertEq(vm.parseJsonUint(json, ".physics.gravity"), uint256(LevelConfig.GRAVITY));
        assertEq(
            vm.parseJsonUint(json, ".physics.terminalVelocity"),
            uint256(LevelConfig.TERMINAL_VELOCITY)
        );
        assertEq(vm.parseJsonUint(json, ".physics.positionScale"), LevelConfig.POSITION_SCALE);
        assertEq(vm.parseJsonUint(json, ".input.bitLeft"), LevelConfig.INPUT_BIT_LEFT);
        assertEq(vm.parseJsonUint(json, ".input.bitRight"), LevelConfig.INPUT_BIT_RIGHT);
        assertEq(vm.parseJsonUint(json, ".input.bitJump"), LevelConfig.INPUT_BIT_JUMP);
        assertEq(vm.parseJsonUint(json, ".input.invalidMask"), LevelConfig.INPUT_INVALID_MASK);
    }

    function test_goalSolidsAndHazardsMatchJson() public view {
        string memory json = _readLevel();

        LevelConfig.Rect memory g = LevelConfig.goal();
        assertEq(vm.parseJsonUint(json, ".goal.x"), uint256(g.x));
        assertEq(vm.parseJsonUint(json, ".goal.y"), uint256(g.y));
        assertEq(vm.parseJsonUint(json, ".goal.w"), uint256(g.w));
        assertEq(vm.parseJsonUint(json, ".goal.h"), uint256(g.h));

        RectJson[] memory solids = abi.decode(vm.parseJson(json, ".solids"), (RectJson[]));
        LevelConfig.Rect[] memory cs = LevelConfig.solids();
        assertEq(solids.length, cs.length, "solid count differs");
        for (uint256 i = 0; i < solids.length; i++) {
            assertEq(solids[i].x, uint256(cs[i].x), "solid x differs");
            assertEq(solids[i].y, uint256(cs[i].y), "solid y differs");
            assertEq(solids[i].w, uint256(cs[i].w), "solid w differs");
            assertEq(solids[i].h, uint256(cs[i].h), "solid h differs");
        }

        RectJson[] memory hazards = abi.decode(vm.parseJson(json, ".hazards"), (RectJson[]));
        LevelConfig.Rect[] memory ch = LevelConfig.hazards();
        assertEq(hazards.length, ch.length, "hazard count differs");
        for (uint256 i = 0; i < hazards.length; i++) {
            assertEq(hazards[i].x, uint256(ch[i].x), "hazard x differs");
            assertEq(hazards[i].y, uint256(ch[i].y), "hazard y differs");
            assertEq(hazards[i].w, uint256(ch[i].w), "hazard w differs");
            assertEq(hazards[i].h, uint256(ch[i].h), "hazard h differs");
        }
    }

    /// @dev Both generated files must be clearly marked as generated and name
    ///      their source of truth and regeneration command.
    function test_generatedFilesCarryNotice() public view {
        string memory sol = vm.readFile("src/generated/LevelConfig.sol");
        assertTrue(_contains(sol, GENERATED_NOTICE), "LevelConfig.sol lacks notice");
        assertTrue(_contains(sol, SOURCE_OF_TRUTH), "LevelConfig.sol lacks source path");
        assertTrue(_contains(sol, REGENERATE_CMD), "LevelConfig.sol lacks regen command");

        string memory ts = vm.readFile("frontend/src/generated/levelConfig.ts");
        assertTrue(_contains(ts, GENERATED_NOTICE), "levelConfig.ts lacks notice");
        assertTrue(_contains(ts, SOURCE_OF_TRUTH), "levelConfig.ts lacks source path");
        assertTrue(_contains(ts, REGENERATE_CMD), "levelConfig.ts lacks regen command");
    }

    /// @dev The frontend module embeds the same geometry literals as the JSON.
    function test_frontendModuleEmbedsSameGeometry() public view {
        string memory json = _readLevel();
        string memory ts = vm.readFile("frontend/src/generated/levelConfig.ts");

        RectJson[] memory solids = abi.decode(vm.parseJson(json, ".solids"), (RectJson[]));
        for (uint256 i = 0; i < solids.length; i++) {
            assertTrue(
                _contains(ts, _rectLiteral(solids[i].x, solids[i].y, solids[i].w, solids[i].h)),
                "frontend module missing a solid"
            );
        }
        RectJson[] memory hazards = abi.decode(vm.parseJson(json, ".hazards"), (RectJson[]));
        for (uint256 i = 0; i < hazards.length; i++) {
            assertTrue(
                _contains(ts, _rectLiteral(hazards[i].x, hazards[i].y, hazards[i].w, hazards[i].h)),
                "frontend module missing a hazard"
            );
        }

        // scalar literals from the JSON appear in the frontend module too
        assertUintField(ts, "spawnX", vm.parseJsonUint(json, ".player.spawnX"));
        assertUintField(ts, "spawnY", vm.parseJsonUint(json, ".player.spawnY"));
        assertUintField(ts, "tickRate", vm.parseJsonUint(json, ".physics.tickRate"));
        assertUintField(ts, "maxInputLength", vm.parseJsonUint(json, ".physics.maxInputLength"));
        assertUintField(ts, "positionScale", vm.parseJsonUint(json, ".physics.positionScale"));
        assertUintField(ts, "invalidMask", vm.parseJsonUint(json, ".input.invalidMask"));
        assertUintField(ts, "bitLeft", vm.parseJsonUint(json, ".input.bitLeft"));
        assertUintField(ts, "bitRight", vm.parseJsonUint(json, ".input.bitRight"));
        assertUintField(ts, "bitJump", vm.parseJsonUint(json, ".input.bitJump"));
    }

    function assertUintField(string memory ts, string memory key, uint256 value) internal view {
        assertTrue(
            _contains(ts, string.concat(key, ": ", vm.toString(value))),
            string.concat("frontend module missing field ", key)
        );
    }

    function _rectLiteral(uint256 x, uint256 y, uint256 w, uint256 h)
        internal
        pure
        returns (string memory)
    {
        return string.concat(
            "{ x: ",
            vm.toString(x),
            ", y: ",
            vm.toString(y),
            ", w: ",
            vm.toString(w),
            ", h: ",
            vm.toString(h),
            " }"
        );
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i = 0; i + n.length <= h.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
