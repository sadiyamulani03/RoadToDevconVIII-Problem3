// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {GhostSprint} from "../../src/GhostSprint.sol";
import {RunnerSim} from "../../src/RunnerSim.sol";
import {LevelConfig} from "../../src/generated/LevelConfig.sol";
import {Vectors} from "../generated/Vectors.sol";

/// @dev Shared fixture for Ghost Sprint acceptance tests.
abstract contract BaseTest is Test {
    GhostSprint internal target;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public virtual {
        target = new GhostSprint();
    }

    function findCase(string memory name) internal pure returns (Vectors.Case memory found) {
        Vectors.Case[] memory all = Vectors.cases();
        for (uint256 i = 0; i < all.length; i++) {
            if (keccak256(bytes(all[i].name)) == keccak256(bytes(name))) {
                return all[i];
            }
        }
        revert(string.concat("vector case not found: ", name));
    }

    function statusName(RunnerSim.Status s) internal pure returns (string memory) {
        if (s == RunnerSim.Status.Won) return "won";
        if (s == RunnerSim.Status.Dead) return "dead";
        return "playing";
    }

    function statusOrdinal(string memory name) internal pure returns (uint8) {
        if (keccak256(bytes(name)) == keccak256("won")) return 2;
        if (keccak256(bytes(name)) == keccak256("dead")) return 1;
        return 0;
    }

    function notVerifiedRevertData(string memory statusName_, uint256 ticks)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodeWithSelector(
            GhostSprint.RunNotVerified.selector, statusOrdinal(statusName_), ticks
        );
    }

    /// @dev Submit as `player` and expect a `RunNotVerified` revert for non-winning cases.
    function expectNotVerified(Vectors.Case memory c, address player) internal {
        vm.prank(player);
        vm.expectRevert(notVerifiedRevertData(c.status, c.ticks));
        target.submitRun(c.inputs);
    }
}
