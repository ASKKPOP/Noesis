// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaborEscrow} from "../src/LaborEscrow.sol";
import {CivicTreasury} from "../src/CivicTreasury.sol";

contract LaborEscrowTest is Test {
    CivicTreasury treasury;
    LaborEscrow escrow;
    uint256 oraclePk = 0x0AC1E;
    address oracle;
    address payable worker;
    address payer;

    function setUp() public {
        oracle = vm.addr(oraclePk);
        worker = payable(makeAddr("worker"));
        payer = makeAddr("payer");
        treasury = new CivicTreasury(address(0xA11CE));
        escrow = new LaborEscrow(oracle, payable(address(treasury)), 200); // 2%
        vm.deal(payer, 10 ether);
    }

    function _fund(uint256 amount, uint64 deadline) internal returns (uint256 id) {
        vm.prank(payer);
        id = escrow.fundJob{value: amount}(worker, deadline);
    }

    function _oracleSig(uint256 jobId) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, escrow.completionDigest(jobId));
        return abi.encodePacked(r, s, v);
    }

    function test_confirm_pays_worker_and_fee() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        escrow.confirmCompletion(id, _oracleSig(id));
        assertEq(worker.balance, 0.98 ether);
        assertEq(address(treasury).balance, 0.02 ether);
    }

    function test_refund_after_deadline() public {
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 id = _fund(1 ether, deadline);
        vm.warp(deadline + 1);
        vm.prank(payer);
        escrow.refund(id);
        assertEq(payer.balance, 10 ether);
    }

    function test_reject_bad_oracle() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, escrow.completionDigest(id));
        vm.expectRevert(LaborEscrow.BadSignature.selector);
        escrow.confirmCompletion(id, abi.encodePacked(r, s, v));
    }

    function test_reject_confirm_after_deadline() public {
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 id = _fund(1 ether, deadline);
        bytes memory sig = _oracleSig(id); // compute before arming expectRevert
        vm.warp(deadline + 1);
        vm.expectRevert(LaborEscrow.DeadlinePassed.selector);
        escrow.confirmCompletion(id, sig);
    }

    function test_reject_early_refund() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        vm.prank(payer);
        vm.expectRevert(LaborEscrow.DeadlineNotReached.selector);
        escrow.refund(id);
    }

    function test_reject_refund_by_non_payer() public {
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 id = _fund(1 ether, deadline);
        vm.warp(deadline + 1);
        vm.expectRevert(LaborEscrow.NotPayer.selector);
        escrow.refund(id); // called by test contract, not payer
    }
}
