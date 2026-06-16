// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CivicTreasury} from "../src/CivicTreasury.sol";
import {LaborEscrow} from "../src/LaborEscrow.sol";
import {LandSale} from "../src/LandSale.sol";
import {NousAccount} from "../src/NousAccount.sol";
import {PackedUserOperation} from "../src/erc4337/IAccount.sol";
import {MockEntryPoint} from "./mocks/MockEntryPoint.sol";

contract Reverter {
    fallback() external payable {
        revert("nope");
    }
}

/// @dev Branch-coverage pass: constructor guards, error paths, the ECDSA
///      early-returns (bad length / high-s), setOwner, CallFailed bubbling, and
///      a session key barred from calling anything but execute().
contract EdgeCasesTest is Test {
    uint256 constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    // ── CivicTreasury ─────────────────────────────────────────────────────────
    function test_treasury_zero_authorizer_reverts() public {
        vm.expectRevert(CivicTreasury.ZeroAuthorizer.selector);
        new CivicTreasury(address(0));
    }

    function test_treasury_receive_is_fee() public {
        CivicTreasury t = new CivicTreasury(address(0xA11CE));
        (bool ok, ) = address(t).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(t).balance, 1 ether);
    }

    function test_treasury_malformed_sig_rejected() public {
        CivicTreasury t = new CivicTreasury(address(0xA11CE));
        vm.deal(address(t), 1 ether);
        vm.expectRevert(CivicTreasury.BadSignature.selector);
        t.disburse(payable(address(0xBEEF)), 0.1 ether, 1, bytes32(0), hex"00112233");
    }

    function test_treasury_high_s_rejected() public {
        uint256 pk = 0xA11CE;
        CivicTreasury t = new CivicTreasury(vm.addr(pk));
        vm.deal(address(t), 1 ether);
        bytes32 digest = t.disbursementDigest(payable(address(0xBEEF)), 0.1 ether, 1, bytes32(0));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        bytes32 highS = bytes32(SECP256K1_N - uint256(s));
        uint8 vFlip = v == 27 ? 28 : 27;
        vm.expectRevert(CivicTreasury.BadSignature.selector);
        t.disburse(payable(address(0xBEEF)), 0.1 ether, 1, bytes32(0), abi.encodePacked(r, highS, vFlip));
    }

    // ── NousAccount ────────────────────────────────────────────────────────────
    function test_account_setOwner() public {
        address owner = makeAddr("o");
        NousAccount a = new NousAccount(owner, address(0));
        vm.prank(owner);
        a.setOwner(makeAddr("n"));
        assertEq(a.owner(), makeAddr("n"));
    }

    function test_account_setOwner_only_owner() public {
        NousAccount a = new NousAccount(makeAddr("o"), address(0));
        vm.expectRevert(NousAccount.NotOwner.selector);
        a.setOwner(makeAddr("x"));
    }

    function test_account_setOwner_zero_reverts() public {
        address owner = makeAddr("o");
        NousAccount a = new NousAccount(owner, address(0));
        vm.prank(owner);
        vm.expectRevert(NousAccount.BadParams.selector);
        a.setOwner(address(0));
    }

    function test_account_call_failed_bubbles() public {
        address owner = makeAddr("o");
        NousAccount a = new NousAccount(owner, address(0));
        vm.deal(address(a), 1 ether);
        Reverter rv = new Reverter();
        vm.prank(owner);
        vm.expectRevert(NousAccount.CallFailed.selector);
        a.execute(address(rv), 0.1 ether, "");
    }

    function test_4337_non_execute_callData_fails() public {
        uint256 ownerPk = 0xA11CE;
        uint256 sPk = 0x5E5;
        MockEntryPoint mep = new MockEntryPoint();
        NousAccount a = new NousAccount(vm.addr(ownerPk), address(mep));
        vm.deal(address(a), 1 ether);
        vm.prank(vm.addr(ownerPk));
        a.registerSessionKey(vm.addr(sPk), 1 ether, uint64(block.timestamp + 1 days));

        bytes memory callData = abi.encodeWithSignature("setOwner(address)", makeAddr("x"));
        PackedUserOperation memory op = PackedUserOperation({
            sender: address(a),
            nonce: 0,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
        bytes32 h = keccak256(abi.encode(op.sender, keccak256(callData), block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sPk, ethHash);
        op.signature = abi.encodePacked(r, s, v);

        vm.expectRevert(MockEntryPoint.SigFail.selector);
        mep.handleOp(address(a), op, h);
    }

    // ── LaborEscrow / LandSale ───────────────────────────────────────────────────
    function test_escrow_constructor_bad_params() public {
        vm.expectRevert(LaborEscrow.BadParams.selector);
        new LaborEscrow(address(0), makeAddr("arb"), payable(address(0xBEEF)), 200, 1 days);
    }

    function test_escrow_fund_bad_params() public {
        LaborEscrow e =
            new LaborEscrow(makeAddr("oracle"), makeAddr("arb"), payable(address(0xBEEF)), 200, 1 days);
        vm.expectRevert(LaborEscrow.BadParams.selector);
        e.fundJob{value: 0}(payable(makeAddr("w")), uint64(block.timestamp + 1 days));
    }

    function test_land_constructor_bad_params() public {
        vm.expectRevert(LandSale.BadParams.selector);
        new LandSale(address(0), makeAddr("oracle"), payable(address(0xBEEF)));
    }
}
