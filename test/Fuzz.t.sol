// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Adversarial fuzzing: arbitrary submissions either revert without
///         side effects or produce a run that the contract's own simulation
///         confirms as a genuine win. Personal bests may only improve.
contract FuzzTest is BaseTest {
    function test_fuzz_arbitraryLogsEitherRevertCleanlyOrVerify(uint256 seed) public {
        bytes memory inputs = _mixedLog(seed);
        uint256 runsBefore = target.runCount();
        uint256 bestBefore = target.bestTime(alice);
        uint256 bestRunBefore = target.bestRunId(alice);

        vm.prank(alice);
        (bool ok,) =
            address(target).call(abi.encodeWithSelector(GhostSprint.submitRun.selector, inputs));

        if (ok) {
            assertEq(target.runCount(), runsBefore + 1, "successful submission is recorded");
            uint256 id = target.runCount();
            GhostSprint.Run memory rec = target.getRun(id);

            // the contract's own simulation must reproduce the recorded result
            bytes memory stored = target.getRunInputs(id);
            RunnerSim.RunOutcome memory out = RunnerSim.run(stored);
            assertTrue(out.status == RunnerSim.Status.Won, "recorded runs are genuine wins");
            assertEq(out.ticks, uint256(rec.tick));
            assertEq(RunnerSim.timeMsFromTicks(out.ticks), uint256(rec.timeMs));
            assertEq(keccak256(stored), rec.inputsHash);
            assertEq(rec.player, alice);

            // personal best may only improve (or be established)
            uint256 bestAfter = target.bestTime(alice);
            if (bestBefore == 0) {
                assertEq(bestAfter, uint256(rec.timeMs), "first best established");
            } else if (bestAfter != bestBefore) {
                assertLt(bestAfter, bestBefore, "best may only become strictly faster");
                assertEq(target.bestRunId(alice), id);
            }
        } else {
            assertEq(target.runCount(), runsBefore, "failed submission records nothing");
            assertEq(target.bestTime(alice), bestBefore, "failed submission touches no best");
            assertEq(target.bestRunId(alice), bestRunBefore);
        }
    }

    function test_fuzz_neverAcceptsOversizedLogs(uint16 rawLen) public {
        uint256 len = bound(uint256(rawLen), uint256(target.MAX_INPUT_LENGTH()) + 1, 4000);
        bytes memory inputs = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            inputs[i] = bytes1(uint8(2));
        }
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                GhostSprint.InputLogTooLong.selector, len, target.MAX_INPUT_LENGTH()
            )
        );
        target.submitRun(inputs);
        assertEq(target.runCount(), 0);
    }

    /// @dev Mix of structured (sometimes winning) and random (mostly invalid) logs.
    function _mixedLog(uint256 seed) internal view returns (bytes memory out) {
        if (seed % 3 == 0) {
            // structured: canonical run with neutral padding (always wins).
            // pad is a multiple of 3 so the 3-tick resting phase realigns with
            // the spawn state before the canonical inputs begin.
            Vectors.Case memory c = findCase("canonical-win");
            uint256 window = (uint256(target.MAX_INPUT_LENGTH()) - c.inputs.length) / 3;
            uint256 pad = 3 * ((seed / 3) % (window + 1));
            out = abi.encodePacked(new bytes(pad), c.inputs);
            return out;
        }
        uint256 len = (seed % 200) + 1;
        out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            uint8 b = uint8(uint256(keccak256(abi.encode(seed, "b", i))));
            if (i % 4 == 0) {
                b = b | 0x08; // force reserved bit => invalid
            } else {
                // map into the valid alphabet, occasionally into 3 (both directions)
                uint8[7] memory alphabet = [uint8(0), 1, 2, 3, 4, 5, 6];
                b = alphabet[b % 7];
            }
            out[i] = bytes1(b);
        }
    }
}
