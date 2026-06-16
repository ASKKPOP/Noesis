// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaborEscrow} from "../src/LaborEscrow.sol";
import {CivicTreasury} from "../src/CivicTreasury.sol";

contract LaborEscrowTest is Test {
    CivicTreasury treasury;
    LaborEscrow escrow;
    uint256 oraclePk = 0x0AC1E;
    uint256 arbiterPk = 0xA4B1;
    address oracle;
    address arbiter;
    address payable worker;
    address payer;
    uint64 constant WINDOW = 1 days;

    function setUp() public {
        oracle = vm.addr(oraclePk);
        arbiter = vm.addr(arbiterPk);
        worker = payable(makeAddr("worker"));
        payer = makeAddr("payer");
        treasury = new CivicTreasury(address(0xA11CE));
        escrow = new LaborEscrow(oracle, arbiter, payable(address(treasury)), 200, WINDOW); // 2%
        vm.deal(payer, 10 ether);
    }

    function _fund(uint256 amount, uint64 deadline) internal returns (uint256 id) {
        vm.prank(payer);
        id = escrow.fundJob{value: amount}(worker, deadline);
    }

    function _attest(uint256 id) internal {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, escrow.completionDigest(id));
        escrow.attestCompletion(id, abi.encodePacked(r, s, v));
    }

    function _resolve(uint256 id, bool toWorker) internal {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbiterPk, escrow.resolutionDigest(id, toWorker));
        escrow.resolveDispute(id, toWorker, abi.encodePacked(r, s, v));
    }

    function test_attest_finalize_pays_worker_and_fee() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        _attest(id);
        vm.warp(block.timestamp + WINDOW + 1);
        escrow.finalize(id);
        assertEq(worker.balance, 0.98 ether);
        assertEq(address(treasury).balance, 0.02 ether);
    }

    function test_finalize_before_window_rejected() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        _attest(id);
        vm.expectRevert(LaborEscrow.WindowOpen.selector);
        escrow.finalize(id);
    }

    function test_dispute_resolve_to_worker() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        _attest(id);
        vm.prank(payer);
        escrow.disputeAttestation(id);
        _resolve(id, true);
        assertEq(worker.balance, 0.98 ether);
        assertEq(address(treasury).balance, 0.02 ether);
    }

    function test_dispute_resolve_to_payer() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        _attest(id);
        vm.prank(payer);
        escrow.disputeAttestation(id);
        _resolve(id, false);
        assertEq(payer.balance, 10 ether); // fully refunded
    }

    function test_only_payer_disputes() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        _attest(id);
        vm.expectRevert(LaborEscrow.NotPayer.selector);
        escrow.disputeAttestation(id); // called by the test contract, not the payer
    }

    function test_dispute_after_window_rejected() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        _attest(id);
        vm.warp(block.timestamp + WINDOW + 1);
        vm.prank(payer);
        vm.expectRevert(LaborEscrow.WindowClosed.selector);
        escrow.disputeAttestation(id);
    }

    function test_resolve_bad_arbiter() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        _attest(id);
        vm.prank(payer);
        escrow.disputeAttestation(id);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, escrow.resolutionDigest(id, true));
        vm.expectRevert(LaborEscrow.BadSignature.selector);
        escrow.resolveDispute(id, true, abi.encodePacked(r, s, v));
    }

    function test_refund_after_deadline() public {
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 id = _fund(1 ether, deadline);
        vm.warp(deadline + 1);
        vm.prank(payer);
        escrow.refund(id);
        assertEq(payer.balance, 10 ether);
    }

    function test_reject_bad_oracle_attest() public {
        uint256 id = _fund(1 ether, uint64(block.timestamp + 1 days));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, escrow.completionDigest(id));
        vm.expectRevert(LaborEscrow.BadSignature.selector);
        escrow.attestCompletion(id, abi.encodePacked(r, s, v));
    }

    function test_attest_after_deadline_rejected() public {
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 id = _fund(1 ether, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, escrow.completionDigest(id));
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.warp(deadline + 1);
        vm.expectRevert(LaborEscrow.DeadlinePassed.selector);
        escrow.attestCompletion(id, sig);
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
        escrow.refund(id);
    }
}
