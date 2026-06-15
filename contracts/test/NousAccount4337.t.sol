// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NousAccount} from "../src/NousAccount.sol";
import {PackedUserOperation} from "../src/erc4337/IAccount.sol";
import {MockEntryPoint} from "./mocks/MockEntryPoint.sol";

contract NousAccount4337Test is Test {
    MockEntryPoint mep;
    NousAccount account;
    uint256 ownerPk = 0xA11CE;
    address owner;
    uint256 sessionPk = 0x5E5;
    address sessionKey;
    address payable dest;

    function setUp() public {
        owner = vm.addr(ownerPk);
        sessionKey = vm.addr(sessionPk);
        dest = payable(makeAddr("dest"));
        mep = new MockEntryPoint();
        account = new NousAccount(owner, address(mep));
        vm.deal(address(account), 10 ether);
    }

    /// @dev Build an execute() userOp signed by `signerPk`, plus the userOpHash.
    function _op(uint256 signerPk, uint256 value)
        internal
        returns (PackedUserOperation memory op, bytes32 hash)
    {
        bytes memory callData = abi.encodeCall(NousAccount.execute, (dest, value, ""));
        op = PackedUserOperation({
            sender: address(account),
            nonce: 0,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
        hash = keccak256(abi.encode(op.sender, keccak256(callData), block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethHash);
        op.signature = abi.encodePacked(r, s, v);
    }

    function test_owner_userop_executes() public {
        (PackedUserOperation memory op, bytes32 h) = _op(ownerPk, 2 ether);
        mep.handleOp(address(account), op, h);
        assertEq(dest.balance, 2 ether);
    }

    function test_session_key_userop_within_cap() public {
        vm.prank(owner);
        account.registerSessionKey(sessionKey, 1 ether, uint64(block.timestamp + 1 days));
        (PackedUserOperation memory op, bytes32 h) = _op(sessionPk, 0.7 ether);
        mep.handleOp(address(account), op, h);
        assertEq(dest.balance, 0.7 ether);
        assertEq(account.remaining(sessionKey), 0.3 ether);
    }

    function test_session_key_userop_over_cap_fails() public {
        vm.prank(owner);
        account.registerSessionKey(sessionKey, 1 ether, uint64(block.timestamp + 1 days));
        (PackedUserOperation memory op, bytes32 h) = _op(sessionPk, 1.5 ether);
        vm.expectRevert(MockEntryPoint.SigFail.selector);
        mep.handleOp(address(account), op, h);
    }

    function test_unknown_signer_fails() public {
        (PackedUserOperation memory op, bytes32 h) = _op(0xBAD, 0.1 ether);
        vm.expectRevert(MockEntryPoint.SigFail.selector);
        mep.handleOp(address(account), op, h);
    }

    function test_validateUserOp_only_entrypoint() public {
        (PackedUserOperation memory op, bytes32 h) = _op(ownerPk, 1 ether);
        vm.expectRevert(NousAccount.NotEntryPoint.selector);
        account.validateUserOp(op, h, 0);
    }
}
