// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";
import {PlayerView} from "../src/interfaces/Types.sol";

contract MonsGameEggTest is Fixture {
    uint256[13] COMMONS = [uint256(1), 2, 4, 5, 6, 9, 10, 11, 13, 14, 17, 18, 21];
    uint256[5] RARES = [uint256(3), 7, 12, 16, 19];

    function setUp() public override {
        super.setUp();
        _register(alice, "alice");
        game.grantRole(game.COMMUNITY_ROLE(), address(this));
    }

    function test_buyEgg_spendsGloo() public {
        game.setGloo(alice, 250);
        vm.expectEmit(address(game));
        emit IMonsGame.EggsBought(alice, 2, 200);
        vm.prank(relayer);
        game.buyEgg(alice, 2);
        PlayerView memory v = game.getPlayer(alice);
        assertEq(v.gloo, 50);
        assertEq(v.eggs, 3);
    }

    function test_buyEgg_insufficient() public {
        game.setGloo(alice, 99);
        vm.expectRevert(IMonsGame.InsufficientGloo.selector);
        vm.prank(relayer);
        game.buyEgg(alice, 1);
        assertEq(game.getPlayer(alice).gloo, 99);
        assertEq(game.getPlayer(alice).eggs, 1);
    }

    function test_openEgg_requestsAndHatches() public {
        vm.expectEmit(address(game));
        emit IMonsGame.EggRequested(alice, 1, 0);
        vm.prank(relayer);
        uint64 seq = game.openEgg{value: 0.128 ether}(alice, 0);
        assertEq(seq, 1);
        assertEq(game.getPlayer(alice).eggs, 0);
        assertEq(game.getPlayer(alice).pendingEggs, 1);
        (address p, uint8 t) = game.pendingEgg(1);
        assertEq(p, alice);
        assertEq(t, 0);

        bytes32 r = bytes32(uint256(100));
        uint256 id = COMMONS[uint256(keccak256(abi.encode(r, uint256(1)))) % 13];
        vm.expectEmit(address(game));
        emit IMonsGame.EggHatched(alice, 1, id, 0);
        entropy.fire(1, r);
        assertEq(parts.balanceOf(alice, id), 1);
        assertEq(game.getPlayer(alice).pendingEggs, 0);
        (p,) = game.pendingEgg(1);
        assertEq(p, address(0));
    }

    function test_openEgg_noEgg() public {
        vm.startPrank(relayer);
        game.openEgg{value: 0.128 ether}(alice, 0);
        vm.expectRevert(IMonsGame.NoEgg.selector);
        game.openEgg{value: 0.128 ether}(alice, 0);
        vm.expectRevert(IMonsGame.NoEgg.selector);
        game.openEgg{value: 0.128 ether}(alice, 1);
    }

    function test_openEgg_feeTooLow() public {
        vm.expectRevert(IMonsGame.InsufficientFee.selector);
        vm.prank(relayer);
        game.openEgg{value: 0.1 ether}(alice, 0);
    }

    function test_openEgg_refundsExcess() public {
        uint256 before = relayer.balance;
        vm.prank(relayer);
        game.openEgg{value: 1 ether}(alice, 0);
        assertEq(before - relayer.balance, 0.128 ether);
        assertEq(address(game).balance, 0);
    }

    function test_callback_onlyEntropy() public {
        vm.prank(relayer);
        game.openEgg{value: 0.128 ether}(alice, 0);
        vm.expectRevert(bytes("Only Entropy can call this function"));
        vm.prank(bob);
        game._entropyCallback(1, address(entropy), bytes32(uint256(5)));
    }

    function test_callback_twiceMintsOnce() public {
        vm.prank(relayer);
        game.openEgg{value: 0.128 ether}(alice, 0);
        bytes32 r = bytes32(uint256(100));
        uint256 id = COMMONS[uint256(keccak256(abi.encode(r, uint256(1)))) % 13];
        entropy.fire(1, r);
        entropy.fire(1, r);
        assertEq(parts.balanceOf(alice, id), 1);
    }

    function test_rareEgg_neverCommon() public {
        game.grantEggs(alice, 0, 1);
        vm.prank(relayer);
        game.openEgg{value: 0.128 ether}(alice, 1);
        assertEq(game.getPlayer(alice).rareEggs, 0);
        bytes32 r = bytes32(uint256(100));
        uint256 id = RARES[uint256(keccak256(abi.encode(r, uint256(1)))) % 5];
        vm.expectEmit(address(game));
        emit IMonsGame.EggHatched(alice, 1, id, 1);
        entropy.fire(1, r);
    }

    function test_rarityDistribution_10000() public view {
        uint256[3] memory n;
        uint256[3] memory rare;
        for (uint256 i; i < 10_000; ++i) {
            uint256 roll = uint256(keccak256(abi.encode(i))) % 10_000;
            n[game.rarityFor(roll, 0)]++;
            rare[game.rarityFor(roll, 1)]++;
        }
        assertApproxEqAbs(n[0], 7000, 200);
        assertApproxEqAbs(n[1], 2500, 200);
        assertApproxEqAbs(n[2], 500, 200);
        assertEq(rare[0], 0);
        assertApproxEqAbs(rare[1], 8000, 200);
    }

    function test_backendMode_fulfill() public {
        game.setRandomSource(1);
        vm.prank(relayer);
        uint64 seq = game.openEgg(alice, 0);
        assertEq(game.getPlayer(alice).pendingEggs, 1);
        bytes32 r = bytes32(uint256(9999)); // epic roll
        vm.prank(relayer);
        game.fulfillEggBackend(seq, r);
        assertEq(game.getPlayer(alice).pendingEggs, 0);
        vm.expectRevert(IMonsGame.UnknownEgg.selector);
        vm.prank(relayer);
        game.fulfillEggBackend(seq, r);
    }

    function test_backend_rejectedInEntropyMode() public {
        vm.prank(relayer);
        uint64 seq = game.openEgg{value: 0.128 ether}(alice, 0);
        vm.expectRevert(IMonsGame.UnknownEgg.selector);
        vm.prank(relayer);
        game.fulfillEggBackend(seq, bytes32(uint256(1)));
    }

    function test_withdraw() public {
        vm.deal(address(game), 1 ether);
        game.withdraw(payable(bob));
        assertEq(bob.balance, 1 ether);
    }
}
