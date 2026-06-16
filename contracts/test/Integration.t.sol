// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CivicTreasury} from "../src/CivicTreasury.sol";
import {LaborEscrow} from "../src/LaborEscrow.sol";
import {LandSale} from "../src/LandSale.sol";
import {NousAccount} from "../src/NousAccount.sol";

/// @dev End-to-end: the four money contracts composing as the economy intends.
///      A human funds a Nous account and authorizes a capped Brain session key;
///      the Brain pays for a job out of the account; the Grid attests completion;
///      the worker is paid and the fee lands in the treasury; the Polis then
///      disburses it. Plus a land purchase routing ETH to the same treasury.
contract IntegrationTest is Test {
    CivicTreasury treasury;
    LaborEscrow escrow;
    LandSale land;
    NousAccount payerAccount;

    uint256 oraclePk = 0x0AC1E; // Grid completion oracle
    uint256 polisPk = 0xB0B5; // Polis authorizer
    address oracle;
    address polis;
    address human; // owns the Nous account
    address brain; // the account's session key
    address payable worker;
    address payable grantee;
    address buyer;
    uint64 constant WINDOW = 1 days;

    function setUp() public {
        oracle = vm.addr(oraclePk);
        polis = vm.addr(polisPk);
        human = makeAddr("human");
        brain = makeAddr("brain");
        worker = payable(makeAddr("worker"));
        grantee = payable(makeAddr("grantee"));
        buyer = makeAddr("buyer");

        treasury = new CivicTreasury(polis);
        escrow = new LaborEscrow(oracle, polis, payable(address(treasury)), 200, WINDOW); // 2%, Polis arbiter
        land = new LandSale(polis, oracle, payable(address(treasury)));
        payerAccount = new NousAccount(human, address(0)); // direct session-key path
        vm.deal(address(payerAccount), 5 ether);
    }

    function test_e2e_labor_loop_then_disburse() public {
        // 1. Human authorizes the Brain to spend up to 2 ETH for 30 days.
        vm.prank(human);
        payerAccount.registerSessionKey(brain, 2 ether, uint64(block.timestamp + 30 days));

        // 2. Brain funds a 1 ETH job for the worker, paid from the account.
        bytes memory fundCall =
            abi.encodeCall(LaborEscrow.fundJob, (worker, uint64(block.timestamp + 1 days)));
        vm.prank(brain);
        bytes memory ret = payerAccount.execute(address(escrow), 1 ether, fundCall);
        uint256 jobId = abi.decode(ret, (uint256));
        assertEq(payerAccount.remaining(brain), 1 ether); // 2 cap − 1 spent

        // 3. Grid oracle attests completion → opens dispute window; unchallenged → finalize.
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, escrow.completionDigest(jobId));
        escrow.attestCompletion(jobId, abi.encodePacked(r, s, v));
        vm.warp(block.timestamp + WINDOW + 1);
        escrow.finalize(jobId);
        assertEq(worker.balance, 0.98 ether);
        assertEq(address(treasury).balance, 0.02 ether);

        // 4. Polis disburses the accumulated fee to a grantee.
        bytes32 ref = keccak256("bill-7");
        (uint8 v2, bytes32 r2, bytes32 s2) =
            vm.sign(polisPk, treasury.disbursementDigest(grantee, 0.02 ether, 1, ref));
        treasury.disburse(grantee, 0.02 ether, 1, ref, abi.encodePacked(r2, s2, v2));
        assertEq(grantee.balance, 0.02 ether);
        assertEq(address(treasury).balance, 0);
    }

    function test_e2e_land_purchase_funds_treasury() public {
        vm.prank(polis);
        land.setPrice(3, 1 ether);

        vm.deal(buyer, 2 ether);
        vm.prank(buyer);
        land.buyParcel{value: 1 ether}(3);

        assertEq(land.ownerOf(3), buyer);
        assertEq(address(treasury).balance, 1 ether);
    }
}
