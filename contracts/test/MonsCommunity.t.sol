// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CommunityFixture} from "./utils/CommunityFixture.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IMonsCommunity} from "../src/interfaces/IMonsCommunity.sol";
import {CommunityView, WarView} from "../src/interfaces/Types.sol";

contract MonsCommunityTest is CommunityFixture {
    function test_create_setsLeader() public {
        address p = _reg(1);
        vm.expectEmit(address(community));
        emit IMonsCommunity.CommunityCreated(1, p, "Indonads");
        uint32 cid = _create(p, "Indonads");
        CommunityView memory v = community.getCommunity(cid);
        assertEq(v.leader, p);
        assertEq(v.members.length, 1);
        assertEq(v.name, "Indonads");
        assertEq(community.communityOf(p), cid);
        assertEq(community.communityCount(), 1);
    }

    function test_create_nameTakenCaseInsensitive() public {
        _create(_reg(1), "Indonads");
        address p2 = _reg(2);
        vm.expectRevert(IMonsCommunity.NameTaken.selector);
        vm.prank(relayer);
        community.create(p2, "indonads");
    }

    function test_create_invalidName() public {
        address p = _reg(1);
        string[3] memory bad = ["ab", "abcdefghijklmnopqrstu", "a!b"];
        vm.startPrank(relayer);
        for (uint256 i; i < 3; ++i) {
            vm.expectRevert(IMonsCommunity.InvalidName.selector);
            community.create(p, bad[i]);
        }
        community.create(p, "UGM Devs_2");
    }

    function test_create_alreadyInCommunity() public {
        address p = _reg(1);
        _create(p, "Indonads");
        vm.expectRevert(IMonsCommunity.AlreadyInCommunity.selector);
        vm.prank(relayer);
        community.create(p, "Other");
    }

    function test_join_full() public {
        (uint32 cid,) = _crew("Big", 0, 30);
        address p = _reg(40);
        vm.expectRevert(IMonsCommunity.CommunityFull.selector);
        vm.prank(relayer);
        community.join(p, cid);
    }

    function test_join_unknown() public {
        address p = _reg(1);
        vm.expectRevert(IMonsCommunity.UnknownCommunity.selector);
        vm.prank(relayer);
        community.join(p, 7);
    }

    function test_leave_cooldown() public {
        (uint32 cid, address[] memory ms) = _crew("Indonads", 0, 2);
        vm.prank(relayer);
        community.leave(ms[1]);
        assertEq(community.communityOf(ms[1]), 0);
        assertEq(community.getCommunity(cid).members.length, 1);
        vm.expectRevert(IMonsCommunity.Cooldown.selector);
        vm.prank(relayer);
        community.join(ms[1], cid);
        vm.warp(block.timestamp + WEEK);
        _join(ms[1], cid);
        assertEq(community.communityOf(ms[1]), cid);
    }

    function test_leader_cannotLeaveWithMembers() public {
        (, address[] memory ms) = _crew("Indonads", 0, 2);
        vm.expectRevert(IMonsCommunity.LeaderCannotLeave.selector);
        vm.prank(relayer);
        community.leave(ms[0]);
    }

    function test_leader_lastLeaves_dissolves() public {
        address p = _reg(1);
        uint32 cid = _create(p, "Indonads");
        vm.prank(relayer);
        community.leave(p);
        assertEq(community.getCommunity(cid).leader, address(0));
        _create(_reg(2), "INDONADS");
    }

    function test_leave_notInCommunity() public {
        address p = _reg(1);
        vm.expectRevert(IMonsCommunity.NotInCommunity.selector);
        vm.prank(relayer);
        community.leave(p);
    }

    function test_unregistered_cannotCreate() public {
        vm.expectRevert(IMonsCommunity.NotRegistered.selector);
        vm.prank(relayer);
        community.create(carol, "Indonads");
    }
}

contract MonsCommunityWeeklyTest is CommunityFixture {
    uint32 cid;
    address[] ms;

    function setUp() public override {
        super.setUp();
        (cid, ms) = _crew("Indonads", 0, 3);
    }

    function _eggs(address p, uint256 n) internal {
        for (uint256 i; i < n; ++i) {
            vm.prank(address(game));
            community.onEggOpened(p);
        }
    }

    function test_hatch_progressAndClaimBronze() public {
        _eggs(ms[0], 4);
        _eggs(ms[1], 6);
        (uint32[2] memory prog, uint32[2] memory contrib,) = community.weeklyView(0, cid, ms[0]);
        assertEq(prog[1], 10);
        assertEq(contrib[1], 4);
        uint32 before = game.getPlayer(ms[0]).eggs;
        vm.expectEmit(address(community));
        emit IMonsCommunity.WeeklyClaimed(0, cid, ms[0], 1, 0);
        vm.prank(relayer);
        community.claimWeekly(ms[0], 0, 1, 0);
        assertEq(game.getPlayer(ms[0]).eggs, before + 1);
        (,, uint8[2] memory mask) = community.weeklyView(0, cid, ms[0]);
        assertEq(mask[1], 1);
    }

    function test_hatch_viaRealEggOpen() public {
        vm.prank(relayer);
        game.openEgg{value: 0.128 ether}(ms[0], 0);
        (uint32[2] memory prog,,) = community.weeklyView(0, cid, ms[0]);
        assertEq(prog[1], 1);
    }

    function test_claim_noContribution() public {
        _eggs(ms[0], 10);
        vm.expectRevert(IMonsCommunity.NoContribution.selector);
        vm.prank(relayer);
        community.claimWeekly(ms[1], 0, 1, 0);
    }

    function test_claim_tierNotReached() public {
        _eggs(ms[0], 9);
        vm.startPrank(relayer);
        vm.expectRevert(IMonsCommunity.TierNotReached.selector);
        community.claimWeekly(ms[0], 0, 1, 0);
        vm.expectRevert(IMonsCommunity.TierNotReached.selector);
        community.claimWeekly(ms[0], 0, 2, 0);
    }

    function test_claim_twice() public {
        _eggs(ms[0], 10);
        vm.startPrank(relayer);
        community.claimWeekly(ms[0], 0, 1, 0);
        vm.expectRevert(IMonsCommunity.AlreadyClaimed.selector);
        community.claimWeekly(ms[0], 0, 1, 0);
    }

    function test_gold_bothTasks_oneAccessory() public {
        _eggs(ms[0], 50);
        for (uint256 i; i < 20; ++i) {
            vm.prank(address(game));
            community.onPvpWin(ms[0], 1); // week 0 theme = fang (bit 0)
        }
        vm.startPrank(relayer);
        community.claimWeekly(ms[0], 0, 1, 2);
        community.claimWeekly(ms[0], 0, 0, 2);
        vm.stopPrank();
        assertEq(parts.balanceOf(ms[0], 202), 1);
        assertEq(game.getPlayer(ms[0]).rareEggs, 2);
    }

    function test_theme_requiresFamily() public {
        assertEq(community.themeOf(0), 0);
        vm.prank(address(game));
        community.onPvpWin(ms[0], 2); // goo only
        (uint32[2] memory prog,,) = community.weeklyView(0, cid, ms[0]);
        assertEq(prog[0], 0);
        vm.prank(address(game));
        community.onPvpWin(ms[0], 3); // fang + goo
        (prog,,) = community.weeklyView(0, cid, ms[0]);
        assertEq(prog[0], 1);
    }

    function test_setWeeklyTheme() public {
        vm.expectEmit(address(community));
        emit IMonsCommunity.ThemeSet(0, 1);
        community.setWeeklyTheme(0, 1);
        assertEq(community.themeOf(0), 1);
        assertEq(community.themeOf(8), 1); // rotation 8 % 7
    }

    function test_claimPreviousWeekAfterRollover() public {
        _eggs(ms[0], 10);
        vm.warp(block.timestamp + WEEK);
        assertEq(community.currentWeek(), 1);
        vm.prank(relayer);
        community.claimWeekly(ms[0], 0, 1, 0);
        _eggs(ms[1], 10);
        vm.warp(block.timestamp + 2 * WEEK);
        vm.expectRevert(IMonsCommunity.WeekNotClaimable.selector);
        vm.prank(relayer);
        community.claimWeekly(ms[1], 0, 1, 0);
    }

    function test_hooks_onlyGame() public {
        bytes32 role = community.GAME_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, relayer, role));
        vm.prank(relayer);
        community.onEggOpened(ms[0]);
    }
}

contract MonsCommunityWarTest is CommunityFixture {
    uint32 a;
    uint32 b;
    address[] ta;
    address[] tb;

    function setUp() public override {
        super.setUp();
        (a, ta) = _crew("Indonads", 0, 7);
        (b, tb) = _crew("UGM Devs", 10, 3);
        for (uint256 i; i < 7; ++i) {
            game.setBrain(ta[i], uint32(100 + 10 * i));
        }
    }

    function _declare(address leader, uint32 target) internal returns (uint32 warId) {
        vm.prank(relayer);
        warId = community.declareWar(leader, target);
    }

    function _accept(address leader, uint32 warId) internal {
        vm.prank(relayer);
        community.acceptWar(leader, warId);
    }

    function _lock(address p, uint32 warId, uint8 idx) internal {
        vm.prank(relayer);
        community.lockTarget(p, warId, idx);
    }

    function _war() internal returns (uint32 warId) {
        warId = _declare(ta[0], b);
        _accept(tb[0], warId);
    }

    function test_declare_accept_snapshotsTop5() public {
        uint32 warId = _declare(ta[0], b);
        assertEq(community.activeWarOf(a), warId);
        uint64 snap = game.snapshotLoadout(ta[6]);
        _accept(tb[0], warId);
        WarView memory w = community.getWar(warId);
        assertEq(w.status, 1);
        assertEq(w.teamSize[0], 5);
        assertEq(w.teamSize[1], 3);
        for (uint256 i; i < 5; ++i) {
            assertEq(w.team[0][i], ta[6 - i]);
        }
        assertEq(w.team[1][0], tb[0]);
        assertEq(w.loadouts[0][0], snap);
        _give(ta[6], 7);
        vm.prank(relayer);
        game.setLoadout(ta[6], 7, 102, 103, 0);
        assertEq(community.getWar(warId).loadouts[0][0], snap);
    }

    function test_declare_notLeader() public {
        vm.expectRevert(IMonsCommunity.NotLeader.selector);
        vm.prank(relayer);
        community.declareWar(ta[1], b);
    }

    function test_declare_sameCommunity() public {
        vm.expectRevert(IMonsCommunity.SameCommunity.selector);
        vm.prank(relayer);
        community.declareWar(ta[0], a);
    }

    function test_declare_whileActive() public {
        _declare(ta[0], b);
        vm.expectRevert(IMonsCommunity.WarActive.selector);
        vm.prank(relayer);
        community.declareWar(ta[0], b);
    }

    function test_accept_expired() public {
        uint32 warId = _declare(ta[0], b);
        vm.warp(block.timestamp + 601);
        vm.expectRevert(IMonsCommunity.WarExpired.selector);
        vm.prank(relayer);
        community.acceptWar(tb[0], warId);
        assertEq(community.getWar(warId).status, 3);
        _declare(ta[0], b); // expired war no longer blocks
    }

    function test_accept_notTargetLeader() public {
        uint32 warId = _declare(ta[0], b);
        vm.expectRevert(IMonsCommunity.NotLeader.selector);
        vm.prank(relayer);
        community.acceptWar(ta[0], warId);
    }

    function test_lock_thenSecondAttackerReverts() public {
        uint32 warId = _war();
        vm.expectEmit(address(community));
        emit IMonsCommunity.TargetLocked(warId, 1, 2, ta[6], uint64(block.timestamp + 120));
        _lock(ta[6], warId, 2);
        vm.expectRevert(abi.encodeWithSelector(IMonsCommunity.TargetTaken.selector, ta[6]));
        vm.prank(relayer);
        community.lockTarget(ta[5], warId, 2);
    }

    function test_lock_expiresAfter120s() public {
        uint32 warId = _war();
        _lock(ta[6], warId, 2);
        vm.warp(block.timestamp + 121);
        _lock(ta[5], warId, 2);
        assertEq(community.getWar(warId).lockedBy[1][2], ta[5]);
    }

    function test_lock_nonTeamMember() public {
        uint32 warId = _war();
        vm.expectRevert(IMonsCommunity.NotTeamMember.selector);
        vm.prank(relayer);
        community.lockTarget(ta[0], warId, 0); // leader has lowest brain, not in top 5
    }

    function test_lock_doneTarget() public {
        uint32 warId = _war();
        _lock(ta[6], warId, 2);
        _warFight(ta[6], warId, 2, 0, 90, 100);
        vm.expectRevert(IMonsCommunity.TargetDone.selector);
        vm.prank(relayer);
        community.lockTarget(ta[5], warId, 2);
    }

    function test_lock_noAttackLeft() public {
        uint32 warId = _war();
        _lock(ta[6], warId, 2);
        _warFight(ta[6], warId, 2, 0, 90, 100);
        vm.expectRevert(IMonsCommunity.NoAttackLeft.selector);
        vm.prank(relayer);
        community.lockTarget(ta[6], warId, 1);
    }

    function test_lock_warNotActive() public {
        uint32 warId = _war();
        vm.warp(block.timestamp + 300);
        vm.expectRevert(IMonsCommunity.WarNotActive.selector);
        vm.prank(relayer);
        community.lockTarget(ta[6], warId, 1);
    }

    function test_warBattle_requiresLock() public {
        uint32 warId = _war();
        vm.expectRevert(IMonsCommunity.NotLockedByYou.selector);
        vm.prank(relayer);
        game.startBattle(ta[6], 2, (uint256(warId) << 8) | 2);
    }

    function test_warBattle_flow() public {
        uint32 warId = _war();
        _lock(ta[6], warId, 2);
        uint256 bid = _warFight(ta[6], warId, 2, 0, 90, 100);
        WarView memory w = community.getWar(warId);
        assertEq(w.stars[1][2], 3);
        assertTrue(w.done[1][2]);
        assertTrue(w.attacked[0][0]);
        assertEq(w.starsA, 3);
        assertEq(game.battles(bid).defender, tb[2]);
        assertEq(game.battles(bid).defLoadout, w.loadouts[1][2]);
    }

    function test_stars_thresholds() public {
        _crew("Five", 20, 5);
        (uint32 d, address[] memory td) = _crew("Other", 30, 5);
        uint32 warId = _declare(_player(20), d);
        _accept(td[0], warId);
        uint32[5] memory hp = [uint32(8001), 8000, 5001, 5000, 9000];
        uint8[5] memory want = [uint8(3), 2, 2, 1, 0];
        WarView memory w = community.getWar(warId);
        for (uint8 i; i < 5; ++i) {
            address p = w.team[0][i];
            _lock(p, warId, i);
            _warFight(p, warId, i, i == 4 ? 1 : 0, hp[i], 10_000);
        }
        w = community.getWar(warId);
        for (uint256 i; i < 5; ++i) {
            assertEq(w.stars[1][i], want[i]);
        }
        assertEq(w.starsA, 8);
    }

    function _duel(uint256 from) internal returns (uint32 warId, address pa, address pb) {
        (, address[] memory x) = _crew("Solo A", from, 1);
        (uint32 cb, address[] memory y) = _crew("Solo B", from + 1, 1);
        pa = x[0];
        pb = y[0];
        warId = _declare(pa, cb);
        _accept(pb, warId);
    }

    function test_settle_beforeOver() public {
        uint32 warId = _war();
        vm.expectRevert(IMonsCommunity.WarNotOver.selector);
        community.settleWar(warId);
    }

    function test_settle_afterAllAttacks() public {
        (uint32 c, address[] memory x) = _crew("Four A", 20, 4);
        (uint32 d, address[] memory y) = _crew("Four B", 30, 4);
        uint32 warId = _declare(x[0], d);
        _accept(y[0], warId);
        WarView memory w = community.getWar(warId);
        for (uint8 i; i < 4; ++i) {
            _lock(w.team[0][i], warId, i);
            _warFight(w.team[0][i], warId, i, 0, 60, 100);
            _lock(w.team[1][i], warId, i);
            _warFight(w.team[1][i], warId, i, 1, 0, 100);
        }
        vm.expectEmit(address(community));
        emit IMonsCommunity.WarSettled(warId, c, 8, 0);
        community.settleWar(warId);
        assertEq(community.getWar(warId).winner, c);
        assertEq(community.activeWarOf(c), 0);
    }

    function test_settle_tieBreakHp() public {
        (uint32 warId, address pa, address pb) = _duel(50);
        _lock(pa, warId, 0);
        _warFight(pa, warId, 0, 0, 90, 100);
        _lock(pb, warId, 0);
        _warFight(pb, warId, 0, 0, 95, 100);
        community.settleWar(warId);
        WarView memory w = community.getWar(warId);
        assertEq(w.starsA, w.starsB);
        assertEq(w.winner, w.b);
    }

    function test_settle_draw() public {
        (uint32 warId,,) = _duel(50);
        vm.warp(block.timestamp + 300);
        community.settleWar(warId);
        assertEq(community.getWar(warId).winner, 0);
        assertEq(community.getWar(warId).status, 2);
    }

    function test_claimReward_winnerOnce() public {
        (uint32 warId, address pa, address pb) = _duel(50);
        _lock(pa, warId, 0);
        _warFight(pa, warId, 0, 0, 90, 100);
        vm.prank(relayer);
        vm.expectRevert(IMonsCommunity.WarNotOver.selector);
        community.claimWarReward(pa, warId);
        vm.warp(block.timestamp + 300);
        community.settleWar(warId);
        uint32 eggs = game.getPlayer(pa).eggs;
        vm.startPrank(relayer);
        community.claimWarReward(pa, warId);
        assertEq(parts.balanceOf(pa, 203), 1);
        assertEq(game.getPlayer(pa).eggs, eggs + 2);
        vm.expectRevert(IMonsCommunity.AlreadyClaimed.selector);
        community.claimWarReward(pa, warId);
        vm.expectRevert(IMonsCommunity.NotWinner.selector);
        community.claimWarReward(pb, warId);
    }
}
