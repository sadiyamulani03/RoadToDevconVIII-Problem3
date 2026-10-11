// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {GhostSprint} from "../src/GhostSprint.sol";

/// @title Deploy GhostSprint to Base Sepolia
/// @notice Guards against accidental deployment to any other chain. Local
///         anvil testing requires ALLOW_OTHER_CHAIN=true explicitly.
///
/// Usage:
///   source .env   # PRIVATE_KEY, BASE_SEPOLIA_RPC_URL
///   forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
///
/// After a successful deployment, record it for the frontend:
///   DEPLOYED_ADDRESS=0x... DEPLOYED_BLOCK=... node scripts/sync-deployment.mjs
contract Deploy is Script {
    /// @dev Base Sepolia. The game targets this chain only.
    uint256 internal constant EXPECTED_CHAIN_ID = 84_532;

    function run() external returns (GhostSprint game) {
        uint256 chainId = block.chainid;
        bool allowOther = vm.envOr("ALLOW_OTHER_CHAIN", false);
        require(
            chainId == EXPECTED_CHAIN_ID || allowOther,
            "refusing to deploy: chain is not Base Sepolia (84532). Set ALLOW_OTHER_CHAIN=true only for local testing."
        );

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        console.log("deployer:", vm.addr(deployerKey));
        console.log("chain id:", chainId);

        vm.startBroadcast(deployerKey);
        game = new GhostSprint();
        vm.stopBroadcast();

        console.log("GhostSprint deployed at:", address(game));
        console.log("levelId:", game.levelId());
        console.log("version:", game.version());
    }
}
