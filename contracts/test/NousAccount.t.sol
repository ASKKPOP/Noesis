// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NousAccount} from "../src/NousAccount.sol";

contract NousAccountTest is Test {
    NousAccount account;
    address owner;
    address sessionKey;
    address payable dest;

    function setUp() public {
        owner = makeAddr("owner");
        sessionKey = makeAddr("sessionKey");
        dest = payable(makeAddr("dest"));
        account = new NousAccount(owner, makeAddr("entryPoint"));
        vm.deal(address(account), 10 ether);
    }

    function test_owner_spends_freely() public {
        vm.prank(owner);
        account.execute(dest, 3 ether, "");
        assertEq(dest.balance, 3 ether);
    }

    function test_session_key_within_cap() public {
        vm.prank(owner);
        account.registerSessionKey(sessionKey, 1 ether, uint64(block.timestamp + 1 days));

        vm.prank(sessionKey);
        account.execute(dest, 0.6 ether, "");
        assertEq(dest.balance, 0.6 ether);
        assertEq(account.remaining(sessionKey), 0.4 ether);
    }

    function test_session_key_cap_exceeded() public {
        vm.prank(owner);
        account.registerSessionKey(sessionKey, 1 ether, uint64(block.timestamp + 1 days));

        vm.prank(sessionKey);
        vm.expectRevert(NousAccount.CapExceeded.selector);
        account.execute(dest, 1.5 ether, "");
    }

    function test_session_key_expired() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(owner);
        account.registerSessionKey(sessionKey, 1 ether, expiry);
        vm.warp(expiry + 1);

        vm.prank(sessionKey);
        vm.expectRevert(NousAccount.KeyExpired.selector);
        account.execute(dest, 0.1 ether, "");
    }

    function test_revoked_key_rejected() public {
        vm.prank(owner);
        account.registerSessionKey(sessionKey, 1 ether, uint64(block.timestamp + 1 days));
        vm.prank(owner);
        account.revokeSessionKey(sessionKey);

        vm.prank(sessionKey);
        vm.expectRevert(NousAccount.NotAuthorized.selector);
        account.execute(dest, 0.1 ether, "");
    }

    function test_stranger_rejected() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(NousAccount.NotAuthorized.selector);
        account.execute(dest, 0.1 ether, "");
    }

    function test_only_owner_registers() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(NousAccount.NotOwner.selector);
        account.registerSessionKey(sessionKey, 1 ether, uint64(block.timestamp + 1 days));
    }
}
