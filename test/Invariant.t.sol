// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @dev Invariant handler: submits a rotating set of always-winning logs.
contract SubmitHandler is Test {
    GhostSprint public immutable target;
    uint256 public submissions;
    bytes[] private variants;

    constructor(GhostSprint t) {
        target = t;
        Vectors.Case[] memory all = Vectors.cases();
        bytes memory canonical;
        for (uint256 i = 0; i < all.length; i++) {
            if (keccak256(bytes(all[i].name)) == keccak256("canonical-win")) {
                canonical = all[i].inputs;
            }
        }
        // pads are multiples of the 3-tick resting phase so every variant
        // resumes from the exact spawn state before the canonical inputs
        uint256[4] memory pads = [uint256(0), 60, 201, 501];
        for (uint256 i = 0; i < pads.length; i++) {
            variants.push(abi.encodePacked(new bytes(pads[i]), canonical));
        }
    }

    function submitVariant(uint256 idx) external {
        target.submitRun(variants[idx % variants.length]);
        submissions++;
    }

    function variantCount() external view returns (uint256) {
        return variants.length;
    }
}

/// @notice Invariant tests: personal bests always agree with recorded runs and
///         can only improve; run records always re-simulate to the same result.
contract InvariantTest is BaseTest {
    SubmitHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new SubmitHandler(target);
        targetContract(address(handler));
    }

    function invariant_personalBestEqualsFastestRecordedRun() public view {
        uint256 count = target.runCount();
        if (count == 0) return;

        address player = address(handler);
        uint256 best = target.bestTime(player);
        uint256 bestRun = target.bestRunId(player);
        assertTrue(best > 0, "a recorded winning run must establish a best");
        assertTrue(bestRun > 0, "best run id must be set");

        // the stored best must equal the minimum over every run of this player
        uint256 minTime = type(uint256).max;
        for (uint256 i = 1; i <= count; i++) {
            GhostSprint.Run memory rec = target.getRun(i);
            if (rec.player == player && uint256(rec.timeMs) < minTime) {
                minTime = uint256(rec.timeMs);
            }
        }
        assertEq(best, minTime, "bestTime must be the minimum of the player's runs");

        // and it must point at a real run belonging to that player
        GhostSprint.Run memory bestRec = target.getRun(bestRun);
        assertEq(bestRec.player, player);
        assertEq(uint256(bestRec.timeMs), best);
        assertEq(keccak256(target.getRunInputs(bestRun)), bestRec.inputsHash);
    }

    function invariant_runCountMatchesSuccessfulSubmissions() public view {
        assertEq(target.runCount(), handler.submissions(), "one record per submission");
    }

    function invariant_latestRunAlwaysReverifies() public view {
        uint256 count = target.runCount();
        if (count == 0) return;
        GhostSprint.Run memory rec = target.getRun(count);
        RunnerSim.RunOutcome memory out = RunnerSim.run(target.getRunInputs(count));
        assertTrue(out.status == RunnerSim.Status.Won, "recorded runs must re-verify");
        assertEq(out.ticks, uint256(rec.tick), "completion tick is reproducible");
        assertEq(RunnerSim.timeMsFromTicks(out.ticks), uint256(rec.timeMs), "time reproducible");
    }
}
