// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {LevelConfig} from "../src/generated/LevelConfig.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Acceptance test 6 (goal, 6 pts): only runs that genuinely reach the
///         goal are recorded; incomplete, dead and out-of-bounds runs are
///         rejected and leave no state behind.
contract GoalTest is BaseTest {
    function test_completedRunIsRecorded() public {
        Vectors.Case memory c = findCase("canonical-win");
        vm.prank(alice);
        uint256 runId = target.submitRun(c.inputs);
        assertEq(runId, 1);
        assertEq(target.runCount(), 1);
        assertEq(uint256(target.getRun(runId).tick), c.ticks);

        RunnerSim.RunOutcome memory out = RunnerSim.run(c.inputs);
        assertTrue(out.status == RunnerSim.Status.Won);
    }

    function test_incompleteRunRejected() public {
        Vectors.Case memory c = findCase("stop-before-goal"); // one input short
        assertEq(uint8(0), uint8(RunnerSim.Status.Playing));
        expectNotVerified(c, alice);

        Vectors.Case memory early = findCase("short-incomplete");
        expectNotVerified(early, alice);

        assertEq(target.runCount(), 0);
        assertEq(target.bestTime(alice), 0);
        assertEq(target.bestRunId(alice), 0);
    }

    function test_deadRunRejected() public {
        Vectors.Case memory spikes = findCase("spikes-death");
        RunnerSim.RunOutcome memory out = RunnerSim.run(spikes.inputs);
        assertTrue(out.status == RunnerSim.Status.Dead);
        expectNotVerified(spikes, alice);

        assertEq(target.runCount(), 0);
        assertEq(target.bestTime(alice), 0);
    }

    function test_outOfBoundsRunRejected() public {
        Vectors.Case memory gap = findCase("gap-death");
        RunnerSim.RunOutcome memory out = RunnerSim.run(gap.inputs);
        assertTrue(out.status == RunnerSim.Status.Dead);
        // the player fell below the world floor
        assertGt(out.finalY + LevelConfig.PLAYER_H, int256(LevelConfig.WORLD_H));
        expectNotVerified(gap, alice);

        assertEq(target.runCount(), 0);
    }

    function test_rejectedSubmissionsWriteNothing() public {
        // several distinct failure modes, then verify zero state was written
        expectNotVerified(findCase("stop-before-goal"), alice);
        expectNotVerified(findCase("spikes-death"), bob);
        expectNotVerified(findCase("gap-death"), alice);
        expectNotVerified(findCase("max-length-neutral"), bob);

        vm.expectRevert(GhostSprint.EmptyInputLog.selector);
        target.submitRun("");

        assertEq(target.runCount(), 0, "no run records");
        assertEq(target.bestTime(alice), 0, "no personal best for alice");
        assertEq(target.bestTime(bob), 0, "no personal best for bob");
        assertEq(target.bestRunId(alice), 0);
        assertEq(target.bestRunId(bob), 0);
    }

    function test_runThatStopsJustBeforeGoalCannotBeAcceptedByPaddingWithNothing() public {
        Vectors.Case memory c = findCase("stop-before-goal");
        // replaying the exact same inputs still ends without reaching the goal
        RunnerSim.RunOutcome memory out = RunnerSim.run(c.inputs);
        assertTrue(out.status == RunnerSim.Status.Playing);
        expectNotVerified(c, alice);
    }
}
