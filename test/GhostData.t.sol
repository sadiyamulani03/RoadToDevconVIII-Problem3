// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./utils/Base.t.sol";
import {GhostSprint} from "../src/GhostSprint.sol";
import {RunnerSim} from "../src/RunnerSim.sol";
import {LevelConfig} from "../src/generated/LevelConfig.sol";
import {Vm} from "forge-std/Vm.sol";
import {Vectors} from "./generated/Vectors.sol";

/// @notice Acceptance test 9 (ghost data, 6 pts): verified inputs are fully
///         retrievable from contract storage AND from emitted logs, run
///         metadata matches a re-simulation, and a run can be reconstructed
///         after a reload without any browser or server state.
contract GhostDataTest is BaseTest {
    uint256 internal constant CHUNK = 31; // deliberately not a power of two

    function _submitCanonical() internal returns (uint256 runId) {
        Vectors.Case memory c = findCase("canonical-win");
        vm.prank(alice);
        runId = target.submitRun(c.inputs);
    }

    function test_completeInputsAreRetrievableFromStorage() public {
        Vectors.Case memory c = findCase("canonical-win");
        uint256 runId = _submitCanonical();

        assertEq(target.getRunInputsLength(runId), c.inputs.length);
        assertEq(target.getRunInputs(runId), c.inputs);
        assertEq(target.getRun(runId).inputLength, uint32(c.inputs.length));
        assertEq(target.getRun(runId).inputsHash, keccak256(c.inputs));
    }

    function test_inputsReconstructibleViaBoundedChunkReads() public {
        Vectors.Case memory c = findCase("canonical-win");
        uint256 runId = _submitCanonical();

        bytes memory rebuilt;
        uint256 offset = 0;
        while (offset < c.inputs.length) {
            uint256 len = CHUNK;
            if (offset + len > c.inputs.length) len = c.inputs.length - offset;
            rebuilt = abi.encodePacked(rebuilt, target.getRunInputsChunk(runId, offset, len));
            offset += len;
        }
        assertEq(rebuilt, c.inputs, "chunked reconstruction must equal the original log");

        // bounds are enforced
        vm.expectRevert(
            abi.encodeWithSelector(
                GhostSprint.ChunkOutOfBounds.selector, c.inputs.length + 1, c.inputs.length
            )
        );
        target.getRunInputsChunk(runId, c.inputs.length, 1);

        vm.expectRevert(abi.encodeWithSelector(GhostSprint.UnknownRun.selector, uint256(0)));
        target.getRunInputsChunk(0, 0, 1);
    }

    function test_fullInputLogIsEmittedInEvent() public {
        Vectors.Case memory c = findCase("canonical-win");

        vm.recordLogs();
        vm.prank(alice);
        uint256 runId = target.submitRun(c.inputs);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != address(target)) continue;
            if (logs[i].topics[0] != GhostSprint.RunVerified.selector) continue;
            assertEq(uint256(logs[i].topics[1]), runId, "event runId");
            assertEq(address(uint160(uint256(logs[i].topics[2]))), alice, "event player");
            (uint64 tick, uint64 timeMs, uint32 inputLength, bytes memory inputs) =
                abi.decode(logs[i].data, (uint64, uint64, uint32, bytes));
            assertEq(uint256(tick), c.ticks, "event tick");
            assertEq(uint256(timeMs), c.timeMs, "event time");
            assertEq(uint256(inputLength), uint256(uint32(c.inputs.length)));
            assertEq(inputs, c.inputs, "event carries the complete input log");
            found = true;
        }
        assertTrue(found, "RunVerified event with full inputs must be emitted");
    }

    function test_runMetadataMatchesReSimulation() public {
        Vectors.Case memory c = findCase("canonical-win");
        uint256 runId = _submitCanonical();
        GhostSprint.Run memory rec = target.getRun(runId);

        // re-simulate exactly what a ghost loader would replay
        bytes memory inputs = target.getRunInputs(runId);
        RunnerSim.RunOutcome memory out = RunnerSim.run(inputs);
        assertTrue(out.status == RunnerSim.Status.Won, "stored run must still win");
        assertEq(out.ticks, uint256(rec.tick));
        assertEq(RunnerSim.timeMsFromTicks(out.ticks), uint256(rec.timeMs));
        assertEq(out.finalX, c.x);
        assertEq(out.finalY, c.y);
        assertEq(keccak256(inputs), rec.inputsHash, "integrity check");
    }

    function test_replayIsReproducibleAfterReload() public {
        uint256 runId = _submitCanonical();

        // "reload": everything is re-read from the chain — storage only
        bytes memory first = target.getRunInputs(runId);
        bytes memory second = target.getRunInputs(runId);
        assertEq(first, second);

        // two independent replays produce identical trajectories tick-for-tick
        RunnerSim.State memory a = RunnerSim.initialState();
        RunnerSim.State memory b = RunnerSim.initialState();
        LevelConfig.Rect[] memory solids = LevelConfig.solids();
        LevelConfig.Rect[] memory hazards = LevelConfig.hazards();
        for (uint256 i = 0; i < first.length; i++) {
            if (a.status != RunnerSim.Status.Playing) break;
            RunnerSim.step(a, uint8(first[i]), solids, hazards);
            RunnerSim.step(b, uint8(second[i]), solids, hazards);
            assertEq(a.x, b.x);
            assertEq(a.y, b.y);
            assertEq(a.vx, b.vx);
            assertEq(a.vy, b.vy);
            assertEq(a.grounded, b.grounded);
            assertTrue(a.status == b.status);
            assertEq(a.tick, b.tick);
        }
    }

    function test_runsCanBeEnumerated() public {
        Vectors.Case memory c = findCase("canonical-win");
        vm.prank(alice);
        uint256 id1 = target.submitRun(c.inputs);
        vm.prank(bob);
        uint256 id2 = target.submitRun(c.inputs);

        assertEq(target.runCount(), 2);
        assertEq(id1, 1);
        assertEq(id2, 2);

        GhostSprint.RunView[] memory page = target.getRuns(0, 10);
        assertEq(page.length, 2);
        assertEq(page[0].runId, 1);
        assertEq(page[0].player, alice);
        assertEq(page[1].runId, 2);
        assertEq(page[1].player, bob);

        GhostSprint.RunView[] memory single = target.getRuns(1, 1);
        assertEq(single.length, 1);
        assertEq(single[0].runId, 2);

        GhostSprint.RunView[] memory empty = target.getRuns(2, 5);
        assertEq(empty.length, 0);

        // personal best run id points at a retrievable run
        uint256 bestRun = target.bestRunId(alice);
        assertEq(bestRun, 1);
        assertEq(target.getRunInputs(bestRun), c.inputs);
    }

    function test_unknownRunReverts() public {
        vm.expectRevert(abi.encodeWithSelector(GhostSprint.UnknownRun.selector, 1));
        target.getRun(1);
        vm.expectRevert(abi.encodeWithSelector(GhostSprint.UnknownRun.selector, 0));
        target.getRunInputs(0);
        vm.expectRevert(abi.encodeWithSelector(GhostSprint.UnknownRun.selector, 99));
        target.getRunInputsLength(99);
    }
}
