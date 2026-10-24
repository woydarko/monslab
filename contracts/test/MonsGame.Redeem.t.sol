// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";

contract MonsGameRedeemTest is Fixture {
    uint64 startsAt;
    uint64 endsAt;

    function setUp() public override {
        super.setUp();
        _register(alice, "alice");
        _register(bob, "bob");
        startsAt = uint64(block.timestamp + 100);
        endsAt = startsAt + 1 days;
        vm.expectEmit(address(game));
        emit IMonsGame.DropCreated(1, 201, startsAt, endsAt, 500);
        game.createDrop(1, keccak256(bytes("BLITZJOGJA")), 201, startsAt, endsAt, 500);
    }

    function _redeem(address p, string memory code) internal {
        vm.prank(relayer);
        game.redeem(p, 1, code);
    }

    function test_redeem_inWindow() public {
        vm.warp(startsAt);
        vm.expectEmit(address(game));
        emit IMonsGame.Redeemed(alice, 1, 201);
        _redeem(alice, "BLITZJOGJA");
        assertEq(parts.balanceOf(alice, 201), 1);
        assertTrue(game.redeemed(1, alice));
        assertEq(game.drops(1).claimed, 1);
        assertEq(game.activeDropIds().length, 1);
    }

    function test_redeem_beforeStart() public {
        vm.expectRevert(IMonsGame.DropNotStarted.selector);
        _redeem(alice, "BLITZJOGJA");
        assertEq(game.activeDropIds().length, 0);
    }

    function test_redeem_afterEnd() public {
        vm.warp(endsAt);
        vm.expectRevert(IMonsGame.DropClosed.selector);
        _redeem(alice, "BLITZJOGJA");
        assertEq(game.activeDropIds().length, 0);
    }

    function test_redeem_twice() public {
        vm.warp(startsAt);
        _redeem(alice, "BLITZJOGJA");
        vm.expectRevert(IMonsGame.AlreadyRedeemed.selector);
        _redeem(alice, "BLITZJOGJA");
    }

    function test_redeem_soldOut() public {
        game.createDrop(2, keccak256(bytes("ONE")), 201, startsAt, endsAt, 1);
        vm.warp(startsAt);
        vm.startPrank(relayer);
        game.redeem(alice, 2, "ONE");
        vm.expectRevert(IMonsGame.DropSoldOut.selector);
        game.redeem(bob, 2, "ONE");
    }

    function test_redeem_wrongCode() public {
        vm.warp(startsAt);
        vm.expectRevert(IMonsGame.InvalidCode.selector);
        _redeem(alice, "blitzjogja");
        vm.expectRevert(IMonsGame.InvalidCode.selector);
        vm.prank(relayer);
        game.redeem(alice, 99, "BLITZJOGJA");
    }

    function test_redeem_unregistered() public {
        vm.warp(startsAt);
        vm.expectRevert(IMonsGame.NotRegistered.selector);
        _redeem(carol, "BLITZJOGJA");
    }

    function test_setDropWindow_beforeStart() public {
        game.setDropWindow(1, startsAt + 10, endsAt + 10);
        assertEq(game.drops(1).startsAt, startsAt + 10);
    }

    function test_setDropWindow_lockedAfterStart() public {
        vm.warp(startsAt);
        vm.expectRevert(IMonsGame.WindowLocked.selector);
        game.setDropWindow(1, startsAt + 10, endsAt + 10);
    }

    function test_createDrop_existingReverts() public {
        vm.expectRevert(IMonsGame.WindowLocked.selector);
        game.createDrop(1, keccak256(bytes("X")), 201, startsAt, endsAt, 5);
    }

    function test_noMintPathAfterEnd() public {
        parts.revokeRole(parts.MINTER_ROLE(), admin);
        assertFalse(parts.hasRole(parts.MINTER_ROLE(), admin));
        vm.warp(endsAt + 1);
        vm.expectRevert(IMonsGame.DropClosed.selector);
        _redeem(alice, "BLITZJOGJA");
    }
}
