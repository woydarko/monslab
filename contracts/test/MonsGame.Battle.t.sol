// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IMonsGame} from "../src/interfaces/IMonsGame.sol";
import {Outcome, PlayerView, BattleView} from "../src/interfaces/Types.sol";

contract MonsGameBattleTest is Fixture {
    function setUp() public override {
        super.setUp();
        _register(alice, "alice");
        _register(bob, "bob");
    }

    function _start(address p, uint8 mode, uint256 ref) internal returns (uint256 id, uint32 seed) {
        vm.prank(relayer);
        (id, seed) = game.startBattle(p, mode, ref);
    }

    function test_startPve_recordsSnapshotAndSeed() public {
        uint32 expectedSeed = uint32(
            uint256(keccak256(abi.encode(block.prevrandao, blockhash(block.number - 1), uint256(1), alice)))
        );
        vm.expectEmit(address(game));
        emit IMonsGame.BattleStarted(1, alice, address(0), 0, 0, STARTER_LOADOUT, 0, expectedSeed, 1);
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        assertEq(id, 1);
        assertEq(seed, expectedSeed);
        BattleView memory b = game.battles(1);
        assertEq(b.status, 1);
        assertEq(b.atkLoadout, STARTER_LOADOUT);
        vm.roll(block.number + 1);
        vm.prevrandao(bytes32(uint256(77)));
        (, uint32 seed2) = _start(alice, 0, 0);
        assertTrue(seed2 != seed);
    }

    function test_startPve_tierLocked() public {
        vm.expectRevert(IMonsGame.TierLocked.selector);
        _start(alice, 0, 1);
    }

    function test_start_invalidMode() public {
        vm.expectRevert(IMonsGame.InvalidMode.selector);
        _start(alice, 3, 0);
    }

    function test_start_unregistered() public {
        vm.expectRevert(IMonsGame.NotRegistered.selector);
        _start(carol, 0, 0);
    }

    function test_finalizePve_rewardsAndUnlocks() public {
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        Outcome memory o = _outcome(id, seed, 0);
        vm.expectEmit(address(game));
        emit IMonsGame.RewardGranted(alice, 1, 10, 0, 0);
        vm.prank(relayer);
        game.finalizeBattle(id, o);
        PlayerView memory v = game.getPlayer(alice);
        assertEq(v.gloo, 10);
        assertEq(v.highestTier, 1);
        assertEq(game.battles(id).status, 2);
        // tier 1 now open, pays 15
        _fight(alice, 0, 1, 0);
        assertEq(game.getPlayer(alice).gloo, 25);
        assertEq(game.getPlayer(alice).highestTier, 2);
    }

    function test_finalizePve_lossNoReward() public {
        _fight(alice, 0, 0, 1);
        assertEq(game.getPlayer(alice).gloo, 0);
        assertEq(game.getPlayer(alice).highestTier, 0);
    }

    function test_finalize_badHash() public {
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        Outcome memory o = _outcome(id, seed, 0);
        o.actions = 18;
        vm.expectRevert(IMonsGame.BadResultHash.selector);
        vm.prank(relayer);
        game.finalizeBattle(id, o);
    }

    function test_finalize_hpAboveMaxRejected() public {
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        Outcome memory o = _outcome(id, seed, 0);
        o.hpLeftA = o.maxHpA + 1;
        o.resultHash = _hash(id, seed, o); // hash matches: only the bound can stop it
        vm.expectRevert(IMonsGame.BadResultHash.selector);
        vm.prank(relayer);
        game.finalizeBattle(id, o);

        o = _outcome(id, seed, 1);
        o.hpLeftB = o.maxHpB + 1;
        o.resultHash = _hash(id, seed, o);
        vm.expectRevert(IMonsGame.BadResultHash.selector);
        vm.prank(relayer);
        game.finalizeBattle(id, o);
    }

    function test_finalize_twice() public {
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        Outcome memory o = _outcome(id, seed, 0);
        vm.startPrank(relayer);
        game.finalizeBattle(id, o);
        vm.expectRevert(IMonsGame.AlreadyFinalized.selector);
        game.finalizeBattle(id, o);
    }

    function test_finalize_expired() public {
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        Outcome memory o = _outcome(id, seed, 0);
        vm.warp(block.timestamp + 301);
        vm.expectRevert(IMonsGame.BattleExpired.selector);
        vm.prank(relayer);
        game.finalizeBattle(id, o);
    }

    function test_finalize_badSimVersion() public {
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        game.setSimVersion(2);
        Outcome memory o = _outcome(id, seed, 0);
        vm.expectRevert(IMonsGame.BadSimVersion.selector);
        vm.prank(relayer);
        game.finalizeBattle(id, o);
    }

    function test_finalize_nonRelayer() public {
        (uint256 id, uint32 seed) = _start(alice, 0, 0);
        Outcome memory o = _outcome(id, seed, 0);
        bytes32 role = game.RELAYER_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, role));
        vm.prank(bob);
        game.finalizeBattle(id, o);
    }

    function test_finalize_unknown() public {
        Outcome memory o = _outcome(9, 1, 0);
        vm.expectRevert(IMonsGame.UnknownBattle.selector);
        vm.prank(relayer);
        game.finalizeBattle(9, o);
    }

    function test_glooDailyCap() public {
        uint256 wins;
        while (game.getPlayer(alice).glooToday < 300) {
            _fight(alice, 0, 0, 0);
            wins++;
        }
        assertEq(wins, 30);
        _fight(alice, 0, 0, 0);
        assertEq(game.getPlayer(alice).gloo, 300);
        // next WIB day resets the cap
        vm.warp(block.timestamp + 1 days);
        _fight(alice, 0, 0, 0);
        assertEq(game.getPlayer(alice).gloo, 310);
    }

    function _pvp(address a, address d, uint8 winner) internal {
        _fight(a, 1, uint256(uint160(d)), winner);
    }

    function test_pvp_firstWinGivesEggAndBrain() public {
        _pvp(alice, bob, 0);
        assertEq(game.getPlayer(alice).eggs, 2);
        assertEq(game.brainOf(alice), 120);
        assertEq(game.brainOf(bob), 90);
    }

    function test_pvp_secondWinSameDayNoEgg() public {
        _pvp(alice, bob, 0);
        _pvp(alice, bob, 0);
        assertEq(game.getPlayer(alice).eggs, 2);
        assertEq(game.brainOf(alice), 140);
        assertEq(game.brainOf(bob), 80);
        vm.warp(block.timestamp + 1 days);
        _pvp(alice, bob, 0);
        assertEq(game.getPlayer(alice).eggs, 3);
    }

    function test_pvp_eggCap5() public {
        for (uint256 i; i < 6; ++i) {
            address d = address(uint160(0xD000 + i));
            _register(d, string(abi.encodePacked("def", bytes1(uint8(0x61 + i)))));
            _pvp(alice, d, 0);
        }
        assertEq(game.getPlayer(alice).eggs, 6); // 1 starter egg + 5
        assertEq(game.getPlayer(alice).pvpEggsToday, 5);
    }

    function test_pvp_lossBrain() public {
        _pvp(alice, bob, 1);
        assertEq(game.brainOf(alice), 85);
        assertEq(game.brainOf(bob), 105);
        game.setBrain(alice, 10);
        _pvp(alice, bob, 1);
        assertEq(game.brainOf(alice), 0);
        game.setBrain(bob, 3);
        _pvp(alice, bob, 0);
        assertEq(game.brainOf(bob), 0);
    }

    function test_pvp_self() public {
        vm.expectRevert(IMonsGame.SelfBattle.selector);
        _start(alice, 1, uint256(uint160(alice)));
    }

    function test_pvp_unknownDefender() public {
        vm.expectRevert(IMonsGame.UnknownPlayer.selector);
        _start(alice, 1, uint256(uint160(carol)));
        vm.expectRevert(IMonsGame.UnknownPlayer.selector);
        _start(alice, 1, uint256(type(uint160).max) + 1);
    }

    function test_pvp_snapshotsDefender() public {
        _give(bob, 8);
        vm.prank(relayer);
        game.setLoadout(bob, 101, 8, 103, 0);
        (uint256 id,) = _start(alice, 1, uint256(uint160(bob)));
        assertEq(game.battles(id).defLoadout, (uint64(101) << 48) | (uint64(8) << 32) | (uint64(103) << 16));
        assertEq(game.battles(id).defender, bob);
    }

    function test_snapshot_fallsBackToStarter() public {
        _give(alice, 7);
        _give(alice, 201);
        vm.prank(relayer);
        game.setLoadout(alice, 7, 102, 103, 201);
        vm.startPrank(alice);
        parts.safeTransferFrom(alice, bob, 7, 1, "");
        parts.safeTransferFrom(alice, bob, 201, 1, "");
        vm.stopPrank();
        assertEq(game.snapshotLoadout(alice), STARTER_LOADOUT);
        (uint256 id,) = _start(alice, 0, 0);
        assertEq(game.battles(id).atkLoadout, STARTER_LOADOUT);
    }

    function test_war_withoutCommunityReverts() public {
        vm.expectRevert(IMonsGame.InvalidMode.selector);
        _start(alice, 2, (uint256(1) << 8) | 2);
    }

    function test_resultHash_matchesVector() public pure {
        // cross-language vector posted by agent-platform (2026-10-24 11:22 +0700);
        // encoding order: (uint256 battleId, uint32 seed, uint8 winner, uint16 actions, uint32 hpLeftA,
        // uint32 hpLeftB, uint32 maxHpA, uint32 maxHpB)
        bytes32 expected = 0xc9bd0cccdaee2381dca37bcb952e8601000fbf6ade735ca2e88a74554c4e4535;
        Outcome memory o =
            Outcome({winner: 0, actions: 17, hpLeftA: 42, hpLeftB: 0, maxHpA: 108, maxHpB: 95, resultHash: 0});
        assertEq(_hash(1, 2841937721, o), expected);
    }
}
