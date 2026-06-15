// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CivicTreasury} from "../src/CivicTreasury.sol";

/// @dev UNVERIFIED DRAFT — needs `forge test` (forge-std not yet vendored).
contract CivicTreasuryTest is Test {
    CivicTreasury treasury;
    uint256 authorizerPk = 0xA11CE;
    address authorizer;
    address payable recipient = payable(address(0xBEEF));

    function setUp() public {
        authorizer = vm.addr(authorizerPk);
        treasury = new CivicTreasury(authorizer);
        vm.deal(address(this), 10 ether);
    }

    function _sign(address to, uint256 amount, uint256 nonce, bytes32 ref)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = treasury.disbursementDigest(to, amount, nonce, ref);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(authorizerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_deposit_accumulates() public {
        treasury.depositFee{value: 1 ether}();
        assertEq(address(treasury).balance, 1 ether);
    }

    function test_disburse_with_valid_auth() public {
        treasury.depositFee{value: 5 ether}();
        bytes32 ref = keccak256("bill-42");
        bytes memory sig = _sign(recipient, 2 ether, 1, ref);

        treasury.disburse(recipient, 2 ether, 1, ref, sig);

        assertEq(recipient.balance, 2 ether);
        assertEq(address(treasury).balance, 3 ether);
        assertTrue(treasury.usedNonce(1));
    }

    function test_reject_replay() public {
        treasury.depositFee{value: 5 ether}();
        bytes32 ref = keccak256("bill-42");
        bytes memory sig = _sign(recipient, 2 ether, 1, ref);
        treasury.disburse(recipient, 2 ether, 1, ref, sig);

        vm.expectRevert(CivicTreasury.NonceUsed.selector);
        treasury.disburse(recipient, 2 ether, 1, ref, sig);
    }

    function test_reject_bad_signer() public {
        treasury.depositFee{value: 5 ether}();
        bytes32 ref = keccak256("bill-42");
        bytes32 digest = treasury.disbursementDigest(recipient, 2 ether, 1, ref);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, digest); // not the authorizer
        vm.expectRevert(CivicTreasury.BadSignature.selector);
        treasury.disburse(recipient, 2 ether, 1, ref, abi.encodePacked(r, s, v));
    }

    function test_reject_overdraw() public {
        treasury.depositFee{value: 1 ether}();
        bytes memory sig = _sign(recipient, 2 ether, 1, keccak256("bill"));
        vm.expectRevert(CivicTreasury.InsufficientBalance.selector);
        treasury.disburse(recipient, 2 ether, 1, keccak256("bill"), sig);
    }
}
