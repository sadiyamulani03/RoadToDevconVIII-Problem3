// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {Vm} from "forge-std/Vm.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Acceptance test 10 (personal best, 4 pts): strictly-faster-only rule
///         with independent per-player records.
contract PersonalBestTest is BaseTest {
    /// @dev neutral-padded variant of the canonical run: wins later => slower.
    function _slowerRun(uint256 pad) internal pure returns (bytes memory out) {
        Vectors.Case memory c = _canonical();
        bytes memory prefix = new bytes(pad);
        out = abi.encodePacked(prefix, c.inputs);
    }

    function _canonical() internal pure returns (Vectors.Case memory found) {
        Vectors.Case[] memory all = Vectors.cases();
        for (uint256 i = 0; i < all.length; i++) {
            if (keccak256(bytes(all[i].name)) == keccak256("canonical-win")) return all[i];
        }
        revert("canonical-win missing");
    }

    function test_firstValidRunEstablishesPersonalBest() public {
        bytes memory slow = _slowerRun(120);
        vm.prank(alice);
        uint256 runId = target.submitRun(slow);
        assertEq(target.bestTime(alice), uint256(target.getRun(runId).timeMs));
        assertEq(target.bestRunId(alice), runId);
        assertGt(target.bestTime(alice), 0);
    }

    function test_fasterRunReplacesPersonalBest() public {
        bytes memory slow = _slowerRun(120);
        vm.prank(alice);
        uint256 slowId = target.submitRun(slow);
        uint256 slowTime = target.bestTime(alice);

        Vectors.Case memory c = _canonical();
        vm.prank(alice);
        uint256 fastId = target.submitRun(c.inputs);
        uint256 fastTime = target.bestTime(alice);

        assertLt(fastTime, slowTime, "canonical run must be faster");
        assertEq(fastTime, c.timeMs);
        assertEq(target.bestRunId(alice), fastId);
        assertTrue(fastId != slowId);
        // both runs stay on the leaderboard; only the best pointer moved
        assertEq(target.runCount(), 2);
    }

    function test_slowerRunDoesNotReplacePersonalBest() public {
        Vectors.Case memory c = _canonical();
        vm.prank(alice);
        uint256 fastId = target.submitRun(c.inputs);
        uint256 fastTime = target.bestTime(alice);

        bytes memory slow = _slowerRun(120);
        vm.prank(alice);
        target.submitRun(slow);

        assertEq(target.bestTime(alice), fastTime, "slower run must not overwrite");
        assertEq(target.bestRunId(alice), fastId, "best run id must not move");
        assertEq(target.runCount(), 2, "slower run is still recorded as a run");
    }

    function test_equalTimeRunDoesNotReplacePersonalBest() public {
        Vectors.Case memory c = _canonical();
        vm.prank(alice);
        uint256 firstId = target.submitRun(c.inputs);
        uint256 firstTime = target.bestTime(alice);

        vm.prank(alice);
        uint256 secondId = target.submitRun(c.inputs);

        assertGt(secondId, firstId, "second run recorded");
        assertEq(target.bestTime(alice), firstTime, "equal time must not overwrite");
        assertEq(target.bestRunId(alice), firstId, "best run id must stay on first run");
    }

    function test_personalBestsAreIndependentPerPlayer() public {
        bytes memory slow = _slowerRun(120);
        Vectors.Case memory c = _canonical();

        vm.prank(alice);
        uint256 aliceFast = target.submitRun(c.inputs);
        vm.prank(bob);
        uint256 bobSlow = target.submitRun(slow);

        assertEq(target.bestRunId(alice), aliceFast);
        assertEq(target.bestRunId(bob), bobSlow);
        assertEq(target.bestTime(alice), c.timeMs);
        assertGt(target.bestTime(bob), target.bestTime(alice));

        // bob improves; alice untouched
        vm.prank(bob);
        uint256 bobFast = target.submitRun(c.inputs);
        assertEq(target.bestRunId(bob), bobFast);
        assertEq(target.bestTime(bob), c.timeMs);
        assertEq(target.bestRunId(alice), aliceFast);
        assertEq(target.bestTime(alice), c.timeMs);
    }

    function test_personalBestImprovedEventOnlyOnImprovement() public {
        Vectors.Case memory c = _canonical();

        // first run: improvement from zero
        vm.expectEmit(true, true, false, true, address(target));
        emit GhostSprint.PersonalBestImproved(alice, 1, 0, uint64(c.timeMs));
        vm.prank(alice);
        target.submitRun(c.inputs);

        // equal run: RunVerified yes, PersonalBestImproved no
        vm.expectEmit(true, true, false, true, address(target));
        emit GhostSprint.RunVerified(
            2, alice, uint64(c.ticks), uint64(c.timeMs), uint32(c.inputs.length), c.inputs
        );
        vm.recordLogs();
        vm.prank(alice);
        target.submitRun(c.inputs);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(
                logs[i].topics[0] != GhostSprint.PersonalBestImproved.selector,
                "equal time must not emit PersonalBestImproved"
            );
        }
    }
}
