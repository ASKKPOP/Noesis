// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CivicTreasury} from "../src/CivicTreasury.sol";
import {LaborEscrow} from "../src/LaborEscrow.sol";
import {LandSale} from "../src/LandSale.sol";

/// @notice Deploy the civic money singletons to a testnet (Sepolia first).
/// @dev    NousAccount is deployed per holder (Nous / Group treasury / Holding),
///         not here. Config + the deployer key come from env — NEVER commit keys.
///         `forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast`
contract Deploy is Script {
    function run() external {
        address authorizer = vm.envAddress("POLIS_AUTHORIZER");
        address oracle = vm.envAddress("GRID_ORACLE");
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(200)); // 2% default
        uint256 disputeWindow = vm.envOr("DISPUTE_WINDOW", uint256(1 days));
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");

        // The Polis authorizer doubles as the dispute arbiter (the court).
        vm.startBroadcast(deployerPk);
        CivicTreasury treasury = new CivicTreasury(authorizer);
        LaborEscrow escrow =
            new LaborEscrow(oracle, authorizer, payable(address(treasury)), uint16(feeBps), uint64(disputeWindow));
        LandSale land = new LandSale(authorizer, oracle, payable(address(treasury)));
        vm.stopBroadcast();

        console2.log("CivicTreasury:", address(treasury));
        console2.log("LaborEscrow:  ", address(escrow));
        console2.log("LandSale:     ", address(land));
    }
}
