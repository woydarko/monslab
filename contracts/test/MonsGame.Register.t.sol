// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";
import {PlayerView} from "../src/interfaces/Types.sol";

contract MonsGameRegisterTest is Fixture {
    bytes6 constant CODE = 0x4d4f4e533031;

    function test_register_mintsStarterAndEgg() public {
        vm.expectEmit(address(game));
        emit IMonsGame.Registered(alice, "nabil", CODE);
        vm.prank(relayer);
        game.register(alice, "nabil", CODE);
        assertEq(parts.balanceOf(alice, 101), 1);
        assertEq(parts.balanceOf(alice, 102), 1);
        assertEq(parts.balanceOf(alice, 103), 1);
        PlayerView memory v = game.getPlayer(alice);
        assertTrue(v.registered);
        assertEq(v.eggs, 1);
        assertEq(v.brain, 100);
        assertEq(v.loadout, STARTER_LOADOUT);
        assertEq(v.code, CODE);
        assertEq(game.usernameOwner(keccak256("nabil")), alice);
        assertEq(game.codeOwner(CODE), alice);
    }

    function test_register_rejectsNonRelayer() public {
        bytes32 role = game.RELAYER_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, role));
        vm.prank(bob);
        game.register(alice, "nabil", CODE);
    }

    function test_register_twiceReverts() public {
        vm.startPrank(relayer);
        game.register(alice, "nabil", CODE);
        vm.expectRevert(IMonsGame.AlreadyRegistered.selector);
        game.register(alice, "other", bytes6(0x4d4f4e533032));
    }

    function test_register_usernameTaken() public {
        vm.startPrank(relayer);
        game.register(alice, "nabil", CODE);
        vm.expectRevert(IMonsGame.UsernameTaken.selector);
        game.register(bob, "nabil", bytes6(0x4d4f4e533032));
    }

    function test_register_codeTaken() public {
        vm.startPrank(relayer);
        game.register(alice, "nabil", CODE);
        vm.expectRevert(IMonsGame.CodeTaken.selector);
        game.register(bob, "bobby", CODE);
        vm.expectRevert(IMonsGame.CodeTaken.selector);
        game.register(bob, "bobby", bytes6(0));
    }

    function test_register_invalidUsername() public {
        string[4] memory bad = ["ab", "Nabil", "a-b", "abcdefghijklmnopq"];
        vm.startPrank(relayer);
        for (uint256 i; i < bad.length; ++i) {
            vm.expectRevert(IMonsGame.InvalidUsername.selector);
            game.register(alice, bad[i], CODE);
        }
        game.register(alice, "a_9", CODE);
    }
}
