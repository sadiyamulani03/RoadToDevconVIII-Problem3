// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {GhostSprint} from "../src/GhostSprint.sol";

/// @title Deployed-contract smoke test
/// @notice Submits real input logs to an already-deployed GhostSprint
///         contract (Base Sepolia) to exercise the deployed verification
///         flow: contract-side simulation, contract-derived time, storage,
///         and strict personal-best behaviour.
///
/// Inputs and target address come from the environment — nothing is
/// hard-coded, and no values are fabricated:
///   CONTRACT_ADDRESS    deployed GhostSprint address
///   RUN_INPUTS_FAST     0x… hex input log expected to WIN
///   RUN_INPUTS_PADDED   0x… hex input log (neutral prefix + same run)
///                       expected to win with a SLOWER time
///
/// Usage:
///   forge script script/SmokeTest.s.sol --rpc-url base_sepolia --broadcast
contract SmokeTest is Script {
    function run() external returns (uint256 fastId, uint256 paddedId) {
        GhostSprint target = GhostSprint(vm.envAddress("CONTRACT_ADDRESS"));
        bytes memory fast = vm.envBytes("RUN_INPUTS_FAST");
        bytes memory padded = vm.envBytes("RUN_INPUTS_PADDED");

        console.log("target:", address(target));
        console.log("fast inputs:", fast.length, "bytes");
        console.log("padded inputs:", padded.length, "bytes");

        // key comes from the environment (same pattern as Deploy.s.sol);
        // never hard-coded, never printed
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        fastId = target.submitRun(fast);
        paddedId = target.submitRun(padded);
        vm.stopBroadcast();

        console.log("fast runId:", fastId);
        console.log("padded runId:", paddedId);
    }
}
