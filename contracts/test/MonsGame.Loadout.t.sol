// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";

contract MonsGameLoadoutTest is Fixture {
    function setUp() public override {
        super.setUp();
        _register(alice, "alice");
    }

    function test_setLoadout_ownedParts() public {
        _give(alice, 7);
        uint64 expected = (uint64(7) << 48) | (uint64(102) << 32) | (uint64(103) << 16);
        vm.expectEmit(address(game));
        emit IMonsGame.LoadoutSet(alice, expected);
        vm.prank(relayer);
        game.setLoadout(alice, 7, 102, 103, 0);
        assertEq(game.loadoutOf(alice), expected);
    }

    function test_setLoadout_notOwner() public {
        vm.expectRevert(abi.encodeWithSelector(IMonsGame.NotOwner.selector, 10));
        vm.prank(relayer);
        game.setLoadout(alice, 10, 102, 103, 0);
    }

    function test_setLoadout_wrongSlot() public {
        _give(alice, 7);
        _give(alice, 201);
        vm.startPrank(relayer);
        vm.expectRevert(abi.encodeWithSelector(IMonsGame.WrongSlot.selector, 7));
        game.setLoadout(alice, 101, 7, 103, 0);
        vm.expectRevert(abi.encodeWithSelector(IMonsGame.WrongSlot.selector, 201));
        game.setLoadout(alice, 201, 102, 103, 0);
        vm.expectRevert(abi.encodeWithSelector(IMonsGame.WrongSlot.selector, 7));
        game.setLoadout(alice, 101, 102, 103, 7);
        vm.expectRevert(abi.encodeWithSelector(IMonsGame.WrongSlot.selector, 999));
        game.setLoadout(alice, 999, 102, 103, 0);
    }

    function test_setLoadout_accessoryOptional() public {
        vm.prank(relayer);
        game.setLoadout(alice, 101, 102, 103, 0);
        _give(alice, 201);
        vm.prank(relayer);
        game.setLoadout(alice, 101, 102, 103, 201);
        assertEq(game.loadoutOf(alice), STARTER_LOADOUT | 201);
    }

    function test_setLoadout_unregistered() public {
        vm.expectRevert(IMonsGame.NotRegistered.selector);
        vm.prank(relayer);
        game.setLoadout(bob, 101, 102, 103, 0);
    }

    function test_dayRollsAtWibMidnight() public {
        vm.warp(1761325199); // 2025-10-24 16:59:59 UTC = 23:59:59 WIB
        uint32 x = game.dayOf(uint64(block.timestamp));
        vm.warp(1761325200);
        assertEq(game.dayOf(uint64(block.timestamp)), x + 1);
        assertEq(game.dayOf(1761325200 - 86400), x);
    }

    function test_familyMask() public view {
        assertEq(game.familyMaskOf(STARTER_LOADOUT), 2); // goo
        uint64 l = (uint64(1) << 48) | (uint64(8) << 32) | (uint64(21) << 16) | 201; // fang, eye, ghost
        assertEq(game.familyMaskOf(l), 1 | 4 | 64);
    }
}
