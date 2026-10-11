// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {LevelConfig} from "../src/generated/LevelConfig.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Acceptance test 5 (obstacles, 6 pts): solid collision works, hazards
///         kill, and invalid movement (tunneling / bypass) is impossible.
contract ObstacleTest is BaseTest {
    function test_walkingIntoSolidWallIsBlocked() public {
        Vectors.Case memory c = findCase("wall-block-right");
        RunnerSim.RunOutcome memory out = RunnerSim.run(c.inputs);
        assertTrue(out.status == RunnerSim.Status.Playing, "blocked player stays alive");
        // player left edge pinned exactly at wallW1's right edge is wrong way:
        // walking right, the player is pinned with its RIGHT edge on the wall's
        // LEFT edge: x + PLAYER_W == wallW1.x  =>  x == 264 - 12 == 252
        assertEq(out.finalX, 252, "player pinned against wallW1");
        assertEq(out.finalX + LevelConfig.PLAYER_W, 264);

        // submission of a run that never reaches the goal is rejected
        expectNotVerified(c, alice);
    }

    function test_hazardSpikesKillPlayer() public {
        Vectors.Case memory c = findCase("spikes-death");
        RunnerSim.RunOutcome memory out = RunnerSim.run(c.inputs);
        assertTrue(out.status == RunnerSim.Status.Dead);
        expectNotVerified(c, alice);
    }

    /// @dev No per-tick displacement can skip past a solid between two collision
    ///      checks: a skip would require moving at least the solid's full size,
    ///      and every possible displacement is strictly smaller than the
    ///      smallest solid dimension in the level.
    function test_perTickDisplacementCannotBypassSolids() public pure {
        LevelConfig.Rect[] memory solids = LevelConfig.solids();
        uint256 minW = type(uint256).max;
        uint256 minH = type(uint256).max;
        for (uint256 i = 0; i < solids.length; i++) {
            uint256 w = uint256(solids[i].w);
            uint256 h = uint256(solids[i].h);
            if (w < minW) minW = w;
            if (h < minH) minH = h;
        }

        uint256 dxMax = uint256(LevelConfig.MOVE_SPEED / int256(LevelConfig.POSITION_SCALE));
        uint256 dyDownMax =
            uint256(LevelConfig.TERMINAL_VELOCITY / int256(LevelConfig.POSITION_SCALE));
        uint256 dyUpMax = uint256(LevelConfig.JUMP_VELOCITY / int256(LevelConfig.POSITION_SCALE));

        assertGt(minW, 0);
        assertGt(minH, 0);
        assertLt(dxMax, minW, "horizontal step could skip a solid");
        assertLt(dyDownMax, minH, "downward step could skip a solid");
        assertLt(dyUpMax, minH, "upward step could skip a solid");
    }

    /// @dev Fuzz: for arbitrary valid input logs the simulation never places the
    ///      player inside a solid and never outside the world while alive.
    function test_fuzz_neverIntersectsSolidsOrLeavesBounds(uint256 seed) public pure {
        uint256 len = (seed % 150) + 1;
        bytes memory inputs = new bytes(len);
        uint8[6] memory valid = [uint8(0), uint8(1), uint8(2), uint8(4), uint8(5), uint8(6)];
        for (uint256 i = 0; i < len; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, "tick", i)));
            inputs[i] = bytes1(valid[r % 6]);
        }

        RunnerSim.State memory s = RunnerSim.initialState();
        LevelConfig.Rect[] memory solids = LevelConfig.solids();
        LevelConfig.Rect[] memory hazards = LevelConfig.hazards();
        uint256 maxX = LevelConfig.WORLD_W - uint256(LevelConfig.PLAYER_W);

        for (uint256 i = 0; i < len && s.status == RunnerSim.Status.Playing; i++) {
            RunnerSim.step(s, uint8(inputs[i]), solids, hazards);

            if (s.status == RunnerSim.Status.Playing || s.status == RunnerSim.Status.Won) {
                assertGe(s.x, 0, "x below world");
                assertLe(uint256(s.x), maxX, "x beyond world");
                assertGe(s.y, 0, "y above world");
                for (uint256 k = 0; k < solids.length; k++) {
                    assertFalse(
                        RunnerSim._overlaps(
                            s.x, s.y, LevelConfig.PLAYER_W, LevelConfig.PLAYER_H, solids[k]
                        ),
                        "player inside a solid"
                    );
                }
            }
        }
    }

    /// @dev A run crafted to walk straight through obstacles cannot be verified.
    function test_cannotBypassObstaclesWithStraightLineInput() public {
        // holding right from spawn dies on the first spike cluster
        bytes memory straight = new bytes(40);
        for (uint256 i = 0; i < straight.length; i++) {
            straight[i] = bytes1(uint8(2));
        }
        RunnerSim.RunOutcome memory out = RunnerSim.run(straight);
        assertTrue(out.status == RunnerSim.Status.Dead, "straight walk dies on spikes");
        assertLt(out.finalX, 144, "never even reached the first gap");
        vm.expectRevert(
            abi.encodeWithSelector(GhostSprint.RunNotVerified.selector, uint8(1), out.ticks)
        );
        target.submitRun(straight);

        // holding right + jump blindly dies too (falls into gap 1 or dies on spikes)
        bytes memory hop = new bytes(200);
        for (uint256 i = 0; i < hop.length; i++) {
            hop[i] = bytes1(uint8(2 | 4));
        }
        RunnerSim.RunOutcome memory out2 = RunnerSim.run(hop);
        assertTrue(out2.status != RunnerSim.Status.Won, "blind hopping must not win");
        if (out2.status != RunnerSim.Status.Won) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    GhostSprint.RunNotVerified.selector, uint8(out2.status), out2.ticks
                )
            );
            target.submitRun(hop);
        }
    }
}
