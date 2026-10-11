// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {LevelConfig} from "../src/generated/LevelConfig.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Acceptance test 3 (onchain simulation, 22 pts) — core behaviours:
///         the contract is the sole judge of a run.
contract GhostSprintTest is BaseTest {
    function test_validInputLogIsRecorded() public {
        Vectors.Case memory c = findCase("canonical-win");

        vm.expectEmit(true, true, false, true, address(target));
        emit GhostSprint.RunVerified(
            1, alice, uint64(c.ticks), uint64(c.timeMs), uint32(c.inputs.length), c.inputs
        );
        vm.expectEmit(true, true, false, true, address(target));
        emit GhostSprint.PersonalBestImproved(alice, 1, 0, uint64(c.timeMs));

        vm.prank(alice);
        uint256 runId = target.submitRun(c.inputs);
        assertEq(runId, 1);
        assertEq(target.runCount(), 1);

        GhostSprint.Run memory rec = target.getRun(runId);
        assertEq(rec.player, alice);
        assertEq(uint256(rec.tick), c.ticks);
        assertEq(uint256(rec.timeMs), c.timeMs);
        assertEq(uint256(rec.inputLength), c.inputs.length);
        assertEq(rec.inputsHash, keccak256(c.inputs));
        assertEq(target.getRunInputs(runId), c.inputs);
        assertEq(target.bestTime(alice), c.timeMs);
        assertEq(target.bestRunId(alice), 1);
    }

    /// @dev The stored time is derived exclusively from the contract's own
    ///      simulation. There is no function anywhere that accepts a finish time.
    function test_callerCannotSupplyCompletionTime() public {
        Vectors.Case memory c = findCase("canonical-win");

        // 1. submitRun(bytes) has no time parameter: a two-argument variant
        //    does not exist on the contract (raw call reverts).
        (bool ok,) =
            address(target).call(abi.encodeWithSignature("submitRun(bytes,uint256)", c.inputs, 1));
        assertFalse(ok, "submitRun(bytes,uint256) must not exist");

        (ok,) = address(target)
            .call(abi.encodeWithSignature("submitRunWithTime(bytes,uint256)", c.inputs, 1));
        assertFalse(ok, "submitRunWithTime must not exist");

        // 2. No admin/owner path can assign or edit times.
        bytes32[7] memory adminSelectors = [
            bytes32(keccak256("setTime(uint256)")),
            bytes32(keccak256("setBestTime(address,uint256)")),
            bytes32(keccak256("setRunTime(uint256,uint256)")),
            bytes32(keccak256("owner()")),
            bytes32(keccak256("transferOwnership(address)")),
            bytes32(keccak256("overrideTime(address,uint256)")),
            bytes32(keccak256("grantRole(bytes32,address)"))
        ];
        for (uint256 i = 0; i < adminSelectors.length; i++) {
            (ok,) = address(target).call(abi.encodePacked(adminSelectors[i], new bytes(64)));
            assertFalse(ok, "privileged function must not exist");
        }

        // 3. The recorded time equals the contract's own formula.
        vm.prank(alice);
        uint256 runId = target.submitRun(c.inputs);
        GhostSprint.Run memory rec = target.getRun(runId);
        assertEq(uint256(rec.timeMs), target.computeTimeMs(rec.tick));
        assertEq(uint256(rec.timeMs), (c.ticks * 1000) / LevelConfig.TICK_RATE);
        assertEq(uint256(rec.timeMs), c.timeMs);
    }

    /// @dev Determinism: identical input logs always verify to identical results.
    function test_simulationIsDeterministic() public {
        Vectors.Case memory c = findCase("canonical-win");
        RunnerSim.RunOutcome memory a = RunnerSim.run(c.inputs);
        RunnerSim.RunOutcome memory b = RunnerSim.run(c.inputs);
        assertEq(a.ticks, b.ticks);
        assertEq(a.finalX, b.finalX);
        assertEq(a.finalY, b.finalY);
        assertEq(a.finalVx, b.finalVx);
        assertEq(a.finalVy, b.finalVy);
        assertTrue(a.status == b.status);

        vm.prank(alice);
        uint256 id1 = target.submitRun(c.inputs);
        vm.prank(bob);
        uint256 id2 = target.submitRun(c.inputs);
        assertEq(uint256(target.getRun(id1).timeMs), uint256(target.getRun(id2).timeMs));
        assertEq(uint256(target.getRun(id1).tick), uint256(target.getRun(id2).tick));
    }

    function test_malformedInputLogsAreRejected() public {
        // empty
        vm.expectRevert(GhostSprint.EmptyInputLog.selector);
        target.submitRun("");

        // reserved high bits
        bytes memory hiBit = hex"08";
        vm.expectRevert(
            abi.encodeWithSelector(GhostSprint.InvalidInputByte.selector, 0, uint8(0x08))
        );
        target.submitRun(hiBit);

        // invalid byte at a non-zero index keeps the correct index
        bytes memory mid = hex"01020304";
        vm.expectRevert(
            abi.encodeWithSelector(GhostSprint.InvalidInputByte.selector, 2, uint8(0x03))
        );
        target.submitRun(mid);

        // a rejected submission records nothing
        assertEq(target.runCount(), 0);
        assertEq(target.bestTime(alice), 0);
    }

    function test_levelConfigurationIsExposed() public view {
        assertEq(target.levelId(), LevelConfig.LEVEL_ID);
        assertEq(target.TICK_RATE(), LevelConfig.TICK_RATE);
        assertEq(target.version(), "1.0.0");
    }
}
