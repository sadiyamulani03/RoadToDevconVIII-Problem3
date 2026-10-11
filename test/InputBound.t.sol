// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {LevelConfig} from "../src/generated/LevelConfig.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Acceptance test 4 (input bound, 8 pts): MAX_INPUT_LENGTH is public,
///         over-long logs revert before any simulation work, logs at the bound
///         are handled strictly according to the game rules.
contract InputBoundTest is BaseTest {
    function test_maxInputLengthIsPublicConstant() public view {
        assertEq(target.MAX_INPUT_LENGTH(), LevelConfig.MAX_INPUT_LENGTH);
        assertEq(target.MAX_INPUT_LENGTH(), 1200);
    }

    function test_logExceedingMaxRevertsBeforeSimulation() public {
        uint256 max = target.MAX_INPUT_LENGTH();
        bytes memory tooLong = new bytes(max + 1); // all neutral

        // If the simulation ran first, an all-neutral log would revert with
        // RunNotVerified(Playing, max) — not with InputLogTooLong. Receiving
        // InputLogTooLong proves the bound is enforced ahead of simulation.
        vm.expectRevert(abi.encodeWithSelector(GhostSprint.InputLogTooLong.selector, max + 1, max));
        target.submitRun(tooLong);

        // Even if the over-long log contains garbage bytes, the length bound
        // fires first: no byte is ever decoded, no tick is ever simulated.
        tooLong[tooLong.length - 1] = 0xff;
        vm.expectRevert(abi.encodeWithSelector(GhostSprint.InputLogTooLong.selector, max + 1, max));
        target.submitRun(tooLong);

        assertEq(target.runCount(), 0, "over-long submissions must record nothing");
    }

    function test_logAtMaxIsAcceptedAndResolvedByGameRules() public {
        uint256 max = target.MAX_INPUT_LENGTH();

        // (a) exactly max neutral ticks: accepted, simulated for `max` ticks,
        //     still incomplete => rejected as unverified (not truncated, not accepted).
        Vectors.Case memory idle = findCase("max-length-neutral");
        assertEq(idle.inputs.length, max);
        expectNotVerified(idle, alice);

        // (b) a winning log of exactly max ticks is accepted and recorded.
        Vectors.Case memory lastTick = findCase("goal-last-tick");
        assertEq(lastTick.inputs.length, max);
        assertEq(lastTick.ticks, max);
        vm.prank(alice);
        uint256 runId = target.submitRun(lastTick.inputs);
        assertEq(runId, 1);
        assertEq(uint256(target.getRun(runId).tick), max);
        assertEq(uint256(target.getRun(runId).timeMs), target.computeTimeMs(max));

        // (c) max + 1 always reverts, regardless of content.
        bytes memory over = new bytes(max + 1);
        vm.expectRevert(abi.encodeWithSelector(GhostSprint.InputLogTooLong.selector, max + 1, max));
        target.submitRun(over);
    }

    function test_everyInputByteIsClassified() public {
        for (uint16 b = 0; b < 256; b++) {
            bool valid = b <= 6 && b != 3; // {0,1,2,4,5,6}
            assertEq(
                RunnerSim.isValidInputByte(uint8(b)),
                valid,
                string.concat("byte classification mismatch at ", vm.toString(uint256(b)))
            );

            bytes memory one = abi.encodePacked(uint8(b));
            if (!valid) {
                vm.expectRevert(
                    abi.encodeWithSelector(GhostSprint.InvalidInputByte.selector, 0, uint8(b))
                );
                target.submitRun(one);
            } else {
                // valid byte: simulated for one tick, still incomplete
                vm.expectRevert(
                    abi.encodeWithSelector(
                        GhostSprint.RunNotVerified.selector, uint8(0), uint256(1)
                    )
                );
                target.submitRun(one);
            }
        }
        assertEq(target.runCount(), 0);
    }
}
