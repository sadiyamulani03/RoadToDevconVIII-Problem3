// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {LevelConfig} from "../src/generated/LevelConfig.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Acceptance test 7 (integer physics, 10 pts): cross-runtime reference
///         vectors must agree between the frontend engine (source of the
///         expectations) and this contract's simulation.
contract VectorTest is BaseTest {
    function test_vectors_count() public pure {
        assertEq(Vectors.cases().length, 10);
    }

    function test_vectors_matchContractSimulation() public pure {
        Vectors.Case[] memory cases = Vectors.cases();
        for (uint256 i = 0; i < cases.length; i++) {
            Vectors.Case memory c = cases[i];
            RunnerSim.RunOutcome memory out = RunnerSim.run(c.inputs);

            string memory ctx = string.concat("case ", c.name);
            assertEq(
                statusName(out.status),
                c.status,
                string.concat(ctx, ": status differs between runtimes")
            );
            assertEq(out.ticks, c.ticks, string.concat(ctx, ": tick count differs"));
            assertEq(
                RunnerSim.timeMsFromTicks(out.ticks), c.timeMs, string.concat(ctx, ": time differs")
            );
            assertEq(out.finalX, c.x, string.concat(ctx, ": final x differs"));
            assertEq(out.finalY, c.y, string.concat(ctx, ": final y differs"));
            assertEq(out.finalVx, c.vx, string.concat(ctx, ": final vx differs"));
            assertEq(out.finalVy, c.vy, string.concat(ctx, ": final vy differs"));
            assertEq(out.finalGrounded, c.grounded, string.concat(ctx, ": grounded differs"));
        }
    }

    function test_vectors_acceptedAndRecordedExactlyAsExpected() public {
        Vectors.Case[] memory cases = Vectors.cases();
        uint256 expectedRunId = 1;
        for (uint256 i = 0; i < cases.length; i++) {
            Vectors.Case memory c = cases[i];
            if (keccak256(bytes(c.status)) == keccak256("won")) {
                vm.prank(alice);
                uint256 runId = target.submitRun(c.inputs);
                assertEq(runId, expectedRunId);
                GhostSprint.Run memory rec = target.getRun(runId);
                assertEq(uint256(rec.tick), c.ticks, "recorded tick matches vector");
                assertEq(uint256(rec.timeMs), c.timeMs, "recorded time matches vector");
                assertEq(rec.player, alice);
                expectedRunId++;
            } else {
                expectNotVerified(c, alice);
            }
        }
        assertEq(target.runCount(), expectedRunId - 1);
    }

    /// @dev Time is computed with integer truncating division only.
    function test_timeFormulaTruncatesTowardZero() public view {
        assertEq(target.computeTimeMs(0), 0);
        assertEq(target.computeTimeMs(1), 16); // 1000/60 = 16.66.. -> 16
        assertEq(target.computeTimeMs(2), 33); // 2000/60 = 33.33.. -> 33
        assertEq(target.computeTimeMs(7), 116); // 7000/60 = 116.66.. -> 116
        assertEq(target.computeTimeMs(60), 1000);
        assertEq(target.computeTimeMs(1200), 20_000);
        // matches the library formula exactly for arbitrary ticks
        for (uint256 t = 0; t < 300; t += 7) {
            assertEq(target.computeTimeMs(t), (t * 1000) / LevelConfig.TICK_RATE);
        }
    }
}
