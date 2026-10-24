// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CommunityView, CommunityParams, WarView} from "./Types.sol";

interface IMonsCommunity {
    event CommunityCreated(uint32 indexed cid, address indexed leader, string name);
    event MemberJoined(uint32 indexed cid, address indexed player);
    event MemberLeft(uint32 indexed cid, address indexed player);
    event WeeklyProgress(uint32 indexed week, uint32 indexed cid, uint8 task, uint32 total);
    event WeeklyClaimed(uint32 indexed week, uint32 indexed cid, address indexed player, uint8 task, uint8 tier);
    event ThemeSet(uint32 indexed week, uint8 family);
    event WarDeclared(uint32 indexed warId, uint32 indexed a, uint32 indexed b, uint64 expiresAt);
    event WarAccepted(uint32 indexed warId, uint64 endsAt, address[5] teamA, address[5] teamB);
    event TargetLocked(uint32 indexed warId, uint8 side, uint8 targetIdx, address indexed attacker, uint64 lockedUntil);
    event WarAttackResult(
        uint32 indexed warId,
        uint8 side,
        uint8 targetIdx,
        address indexed attacker,
        uint8 stars,
        uint32 hpPctBps,
        uint256 battleId
    );
    event WarSettled(uint32 indexed warId, uint32 winnerCid, uint16 starsA, uint16 starsB);
    event WarRewardClaimed(uint32 indexed warId, address indexed player);

    error NotRelayer();
    error NotRegistered();
    error AlreadyInCommunity();
    error NotInCommunity();
    error NameTaken();
    error InvalidName();
    error CommunityFull();
    error Cooldown();
    error LeaderCannotLeave();
    error NotLeader();
    error UnknownCommunity();
    error NoContribution();
    error TierNotReached();
    error AlreadyClaimed();
    error WeekNotClaimable();
    error WarActive();
    error UnknownWar();
    error WarNotPending();
    error WarExpired();
    error WarNotActive();
    error NotTeamMember();
    error TargetTaken(address lockedBy);
    error TargetDone();
    error NoAttackLeft();
    error NotLockedByYou();
    error WarNotOver();
    error NotWinner();
    error SameCommunity();

    // relayer writes
    function create(address player, string calldata name) external returns (uint32 cid);
    function join(address player, uint32 cid) external;
    function leave(address player) external;
    function claimWeekly(address player, uint32 week, uint8 task, uint8 tier) external;
    function declareWar(address leader, uint32 targetCid) external returns (uint32 warId);
    function acceptWar(address leader, uint32 warId) external;
    function lockTarget(address attacker, uint32 warId, uint8 targetIdx) external;
    function claimWarReward(address player, uint32 warId) external;

    // public
    function settleWar(uint32 warId) external;

    // game hooks
    function onEggOpened(address player) external;
    function onPvpWin(address player, uint8 familyMask) external;
    function onWarBattleStart(address attacker, uint32 warId, uint8 targetIdx)
        external
        returns (address target, uint64 atkLoadout, uint64 defLoadout);
    function onWarBattleResult(
        uint32 warId,
        address attacker,
        uint8 targetIdx,
        uint8 stars,
        uint32 hpPctBps,
        uint256 battleId
    ) external;

    // admin
    function setWeeklyTheme(uint32 week, uint8 family) external;
    function setParams(CommunityParams calldata p) external;

    // reads
    function getCommunity(uint32 cid) external view returns (CommunityView memory);
    function communityCount() external view returns (uint32);
    function communityOf(address player) external view returns (uint32);
    function currentWeek() external view returns (uint32);
    function weekEndsAt() external view returns (uint64);
    function themeOf(uint32 week) external view returns (uint8);
    function weeklyView(uint32 week, uint32 cid, address player)
        external
        view
        returns (uint32[2] memory progress, uint32[2] memory contribution, uint8[2] memory claimedMask);
    function getWar(uint32 warId) external view returns (WarView memory);
    function activeWarOf(uint32 cid) external view returns (uint32);
    function warCount() external view returns (uint32);
    function params() external view returns (CommunityParams memory);
}
