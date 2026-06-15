// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NousAccountFactory} from "../src/NousAccountFactory.sol";
import {NousAccount} from "../src/NousAccount.sol";

contract NousAccountFactoryTest is Test {
    NousAccountFactory factory;
    address owner;
    address ep;

    function setUp() public {
        factory = new NousAccountFactory();
        owner = makeAddr("owner");
        ep = makeAddr("entryPoint");
    }

    function test_counterfactual_matches_deploy() public {
        address predicted = factory.getAddress(owner, ep, 1);
        NousAccount a = factory.createAccount(owner, ep, 1);
        assertEq(address(a), predicted);
        assertEq(a.owner(), owner);
        assertEq(a.entryPoint(), ep);
    }

    function test_idempotent_returns_existing() public {
        NousAccount a1 = factory.createAccount(owner, ep, 1);
        NousAccount a2 = factory.createAccount(owner, ep, 1);
        assertEq(address(a1), address(a2));
    }

    function test_salt_varies_address() public {
        address a1 = address(factory.createAccount(owner, ep, 1));
        address a2 = address(factory.createAccount(owner, ep, 2));
        assertTrue(a1 != a2);
    }

    function test_prefunded_then_deployed_then_spends() public {
        // Fund the counterfactual address before the account exists, then deploy.
        address predicted = factory.getAddress(owner, ep, 7);
        vm.deal(predicted, 1 ether);
        NousAccount a = factory.createAccount(owner, ep, 7);
        assertEq(address(a).balance, 1 ether);

        address payable dest = payable(makeAddr("dest"));
        vm.prank(owner);
        a.execute(dest, 0.5 ether, "");
        assertEq(dest.balance, 0.5 ether);
    }
}
