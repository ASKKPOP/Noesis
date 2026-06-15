// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LandSale} from "../src/LandSale.sol";
import {CivicTreasury} from "../src/CivicTreasury.sol";

contract LandSaleTest is Test {
    CivicTreasury treasury;
    LandSale land;
    address authorizer;
    uint256 oraclePk = 0x0AC1E;
    address oracle;
    address buyer;

    function setUp() public {
        authorizer = makeAddr("polis");
        oracle = vm.addr(oraclePk);
        buyer = makeAddr("buyer");
        treasury = new CivicTreasury(address(0xA11CE));
        land = new LandSale(authorizer, oracle, payable(address(treasury)));
        vm.deal(buyer, 10 ether);
    }

    function test_buy_parcel_pays_treasury() public {
        vm.prank(authorizer);
        land.setPrice(7, 2 ether);

        vm.prank(buyer);
        land.buyParcel{value: 2 ether}(7);

        assertEq(land.ownerOf(7), buyer);
        assertEq(address(treasury).balance, 2 ether);
    }

    function test_reject_wrong_price() public {
        vm.prank(authorizer);
        land.setPrice(7, 2 ether);
        vm.prank(buyer);
        vm.expectRevert(LandSale.WrongPrice.selector);
        land.buyParcel{value: 1 ether}(7);
    }

    function test_reject_unlisted() public {
        vm.prank(buyer);
        vm.expectRevert(LandSale.NotForSale.selector);
        land.buyParcel{value: 1 ether}(99);
    }

    function test_reject_double_sale() public {
        vm.prank(authorizer);
        land.setPrice(7, 1 ether);
        vm.prank(buyer);
        land.buyParcel{value: 1 ether}(7);

        address buyer2 = makeAddr("buyer2");
        vm.deal(buyer2, 10 ether);
        vm.prank(buyer2);
        vm.expectRevert(LandSale.AlreadyOwned.selector);
        land.buyParcel{value: 1 ether}(7);
    }

    function test_only_authorizer_sets_price() public {
        vm.prank(buyer);
        vm.expectRevert(LandSale.NotAuthorizer.selector);
        land.setPrice(7, 1 ether);
    }

    function test_claim_with_credit() public {
        bytes32 digest = land.claimDigest(5, buyer);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(buyer);
        land.claimWithCredit(5, sig);
        assertEq(land.ownerOf(5), buyer);
    }

    function test_reject_credit_bad_oracle() public {
        bytes32 digest = land.claimDigest(5, buyer);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(buyer);
        vm.expectRevert(LandSale.BadSignature.selector);
        land.claimWithCredit(5, sig);
    }
}
