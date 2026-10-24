// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IMonsCommunity} from "./interfaces/IMonsCommunity.sol";
import {IMonsGame} from "./interfaces/IMonsGame.sol";
import {IMonsParts} from "./interfaces/IMonsParts.sol";
import {MonsTypes, CommunityView, CommunityParams, WarView} from "./interfaces/Types.sol";

/// Communities, weekly community tasks and 5v5 Community War with target locks.
contract MonsCommunity is AccessControl, IMonsCommunity {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    uint8 internal constant TEAM = 5;
    uint8 internal constant WAR_PENDING = 0;
    uint8 internal constant WAR_ACTIVE = 1;
    uint8 internal constant WAR_SETTLED = 2;
    uint8 internal constant WAR_EXPIRED = 3;

    struct Community {
        string name;
        address leader;
        uint64 createdAt;
        address[] members;
    }

    struct Target {
        address player;
        address lockedBy;
        uint64 lockedUntil;
        bool done;
        uint8 stars;
        uint32 hpPctBps;
    }

    struct War {
        uint32 a;
        uint32 b;
        uint8 status;
        uint64 expiresAt;
        uint64 endsAt;
        Target[TEAM][2] targets;
        uint64[TEAM][2] loadouts;
        bool[TEAM][2] attacked;
        uint8[2] teamSize;
        uint8[2] doneCount;
        uint8 started; // war battles started
        uint8 resulted; // war battles that reached onWarBattleResult
        uint64 lastStartAt;
        uint16 starsA;
        uint16 starsB;
        uint32 hpA;
        uint32 hpB;
        uint32 winner;
    }

    IMonsGame public immutable game;
    IMonsParts public immutable parts;
    CommunityParams internal _params;

    mapping(uint32 => Community) internal communities;
    uint32 public communityCount;
    mapping(address => uint32) public communityOf;
    mapping(address => uint32) internal memberIndex; // index + 1 in members
    mapping(bytes32 => uint32) public nameOwner;
    mapping(address => uint32) public cooldownUntilWeek;

    mapping(uint32 => mapping(uint32 => uint32[2])) internal progress;
    mapping(uint32 => mapping(uint32 => mapping(address => uint32[2]))) internal contribution;
    mapping(uint32 => mapping(address => uint32)) internal contribCid;
    mapping(uint32 => mapping(address => uint8[2])) internal claimedMask;
    mapping(uint32 => mapping(address => bool)) public accessoryClaimed;
    mapping(uint32 => uint8) internal themeOverride; // family + 1

    mapping(uint32 => War) internal wars;
    uint32 public warCount;
    mapping(uint32 => uint32) internal _activeWarOf;
    mapping(uint32 => mapping(address => bool)) public warRewardClaimed;
    /// enemy target idx + 1 that an attacker locked last in a war: one live lock per attacker
    mapping(uint32 => mapping(address => uint8)) internal heldLock;

    constructor(address admin, IMonsGame game_, IMonsParts parts_, CommunityParams memory p) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        game = game_;
        parts = parts_;
        if (p.weekGenesis == 0) p.weekGenesis = uint64(block.timestamp);
        _params = p;
    }

    // ---------------------------------------------------------------- communities

    function create(address player, string calldata name) external onlyRole(RELAYER_ROLE) returns (uint32 cid) {
        _requireRegistered(player);
        if (communityOf[player] != 0) revert AlreadyInCommunity();
        bytes32 key = _nameKey(bytes(name));
        if (nameOwner[key] != 0) revert NameTaken();
        cid = ++communityCount;
        nameOwner[key] = cid;
        Community storage c = communities[cid];
        c.name = name;
        c.leader = player;
        c.createdAt = uint64(block.timestamp);
        emit CommunityCreated(cid, player, name);
        _addMember(cid, player);
    }

    function join(address player, uint32 cid) external onlyRole(RELAYER_ROLE) {
        _requireRegistered(player);
        Community storage c = communities[cid];
        if (c.leader == address(0)) revert UnknownCommunity();
        if (communityOf[player] != 0) revert AlreadyInCommunity();
        if (cooldownUntilWeek[player] > currentWeek()) revert Cooldown();
        if (c.members.length >= _params.maxMembers) revert CommunityFull();
        _addMember(cid, player);
    }

    function leave(address player) external onlyRole(RELAYER_ROLE) {
        uint32 cid = communityOf[player];
        if (cid == 0) revert NotInCommunity();
        Community storage c = communities[cid];
        if (c.leader == player && c.members.length > 1) revert LeaderCannotLeave();

        uint256 i = memberIndex[player] - 1;
        address last = c.members[c.members.length - 1];
        c.members[i] = last;
        memberIndex[last] = uint32(i + 1);
        c.members.pop();
        delete memberIndex[player];
        delete communityOf[player];
        cooldownUntilWeek[player] = currentWeek() + 1;
        emit MemberLeft(cid, player);

        if (c.members.length == 0) {
            delete nameOwner[_nameKey(bytes(c.name))];
            delete communities[cid];
        }
    }

    // ---------------------------------------------------------------- weekly

    function onEggOpened(address player) external onlyRole(GAME_ROLE) {
        uint32 cid = communityOf[player];
        if (cid != 0) _progress(cid, player, MonsTypes.TASK_HATCH);
    }

    function onPvpWin(address player, uint8 familyMask) external onlyRole(GAME_ROLE) {
        uint32 cid = communityOf[player];
        if (cid != 0 && familyMask & (1 << themeOf(currentWeek())) != 0) {
            _progress(cid, player, MonsTypes.TASK_THEME);
        }
    }

    function claimWeekly(address player, uint32 week, uint8 task, uint8 tier) external onlyRole(RELAYER_ROLE) {
        if (task > MonsTypes.TASK_HATCH || tier > 2) revert TierNotReached();
        uint32 cw = currentWeek();
        if (week != cw && week + 1 != cw) revert WeekNotClaimable();
        uint32 cid = contribCid[week][player];
        if (cid == 0 || contribution[week][cid][player][task] == 0) revert NoContribution();
        uint32 need = task == MonsTypes.TASK_THEME ? _params.themeTiers[tier] : _params.hatchTiers[tier];
        if (progress[week][cid][task] < need) revert TierNotReached();
        uint8 bit = uint8(1 << tier);
        if (claimedMask[week][player][task] & bit != 0) revert AlreadyClaimed();
        claimedMask[week][player][task] |= bit;
        emit WeeklyClaimed(week, cid, player, task, tier);

        if (tier < 2) {
            game.grantEggs(player, 1, 0);
        } else {
            game.grantEggs(player, 0, 1);
            if (!accessoryClaimed[week][player]) {
                accessoryClaimed[week][player] = true;
                parts.mint(player, MonsTypes.ACC_TRAIL, 1);
            }
        }
    }

    // ---------------------------------------------------------------- war

    function declareWar(address leader, uint32 targetCid) external onlyRole(RELAYER_ROLE) returns (uint32 warId) {
        uint32 a = communityOf[leader];
        if (a == 0) revert NotInCommunity();
        if (communities[a].leader != leader) revert NotLeader();
        if (communities[targetCid].leader == address(0)) revert UnknownCommunity();
        if (a == targetCid) revert SameCommunity();
        if (_live(_activeWarOf[a]) || _live(_activeWarOf[targetCid])) revert WarActive();
        warId = ++warCount;
        War storage w = wars[warId];
        w.a = a;
        w.b = targetCid;
        w.expiresAt = uint64(block.timestamp) + _params.warAcceptWindow;
        _activeWarOf[a] = warId;
        _activeWarOf[targetCid] = warId;
        emit WarDeclared(warId, a, targetCid, w.expiresAt);
    }

    function acceptWar(address leader, uint32 warId) external onlyRole(RELAYER_ROLE) {
        War storage w = _war(warId);
        if (w.status != WAR_PENDING) revert WarNotPending();
        if (block.timestamp > w.expiresAt) revert WarExpired();
        if (communityOf[leader] != w.b || communities[w.b].leader != leader) revert NotLeader();
        w.status = WAR_ACTIVE;
        w.endsAt = uint64(block.timestamp) + _params.warDuration;
        address[TEAM] memory teamA = _pickTeam(w, 0, w.a);
        address[TEAM] memory teamB = _pickTeam(w, 1, w.b);
        emit WarAccepted(warId, w.endsAt, teamA, teamB);
    }

    function lockTarget(address attacker, uint32 warId, uint8 targetIdx) external onlyRole(RELAYER_ROLE) {
        War storage w = _activeWar(warId);
        (uint8 side, uint8 idx) = _member(w, attacker);
        if (w.attacked[side][idx]) revert NoAttackLeft();
        Target storage t = _target(w, 1 - side, targetIdx);
        if (t.lockedBy != address(0) && t.lockedBy != attacker && t.lockedUntil >= block.timestamp) {
            revert TargetTaken(t.lockedBy);
        }
        uint8 prev = heldLock[warId][attacker];
        if (prev != 0 && prev - 1 != targetIdx) {
            Target storage old = w.targets[1 - side][prev - 1];
            if (old.lockedBy == attacker) {
                old.lockedBy = address(0);
                old.lockedUntil = 0;
            }
        }
        heldLock[warId][attacker] = targetIdx + 1;
        t.lockedBy = attacker;
        t.lockedUntil = uint64(block.timestamp) + _params.lockDuration;
        emit TargetLocked(warId, 1 - side, targetIdx, attacker, t.lockedUntil);
    }

    /// Marks the attack as used and holds the lock for the battle TTL so nobody else can hit the same target.
    function onWarBattleStart(address attacker, uint32 warId, uint8 targetIdx)
        external
        onlyRole(GAME_ROLE)
        returns (address target, uint64 atkLoadout, uint64 defLoadout)
    {
        War storage w = _activeWar(warId);
        (uint8 side, uint8 idx) = _member(w, attacker);
        if (w.attacked[side][idx]) revert NoAttackLeft();
        Target storage t = _target(w, 1 - side, targetIdx);
        if (t.lockedBy != attacker || t.lockedUntil < block.timestamp) revert NotLockedByYou();
        w.attacked[side][idx] = true;
        w.started += 1;
        w.lastStartAt = uint64(block.timestamp);
        t.lockedUntil = uint64(block.timestamp) + game.params().battleTtl;
        return (t.player, w.loadouts[side][idx], w.loadouts[1 - side][targetIdx]);
    }

    function onWarBattleResult(
        uint32 warId,
        address attacker,
        uint8 targetIdx,
        uint8 stars,
        uint32 hpPctBps,
        uint256 battleId
    ) external onlyRole(GAME_ROLE) {
        War storage w = _war(warId);
        if (w.status != WAR_ACTIVE) return; // settled while the battle was running: result ignored
        w.resulted += 1;
        (uint8 side,) = _member(w, attacker);
        uint8 ts = 1 - side;
        Target storage t = w.targets[ts][targetIdx];
        if (t.done) return;
        t.done = true;
        t.stars = stars;
        t.hpPctBps = hpPctBps;
        w.doneCount[ts] += 1;
        if (side == 0) {
            w.starsA += stars;
            w.hpA += hpPctBps;
        } else {
            w.starsB += stars;
            w.hpB += hpPctBps;
        }
        emit WarAttackResult(warId, ts, targetIdx, attacker, stars, hpPctBps, battleId);
    }

    /// Anyone, after endsAt or once every possible attack has a result.
    function settleWar(uint32 warId) external {
        War storage w = _war(warId);
        if (w.status != WAR_ACTIVE) revert WarNotActive();
        if (!_allAttacksDone(w) && !_timeUp(w)) revert WarNotOver();
        w.status = WAR_SETTLED;
        if (w.starsA != w.starsB) w.winner = w.starsA > w.starsB ? w.a : w.b;
        else if (w.hpA != w.hpB) w.winner = w.hpA > w.hpB ? w.a : w.b;
        if (_activeWarOf[w.a] == warId) delete _activeWarOf[w.a];
        if (_activeWarOf[w.b] == warId) delete _activeWarOf[w.b];
        emit WarSettled(warId, w.winner, w.starsA, w.starsB);
    }

    function claimWarReward(address player, uint32 warId) external onlyRole(RELAYER_ROLE) {
        War storage w = _war(warId);
        if (w.status != WAR_SETTLED) revert WarNotOver();
        if (w.winner == 0) revert NotWinner();
        uint8 side = w.winner == w.a ? 0 : 1;
        bool onTeam;
        for (uint256 i; i < w.teamSize[side]; ++i) {
            if (w.targets[side][i].player == player) onTeam = true;
        }
        if (!onTeam) revert NotWinner();
        if (warRewardClaimed[warId][player]) revert AlreadyClaimed();
        warRewardClaimed[warId][player] = true;
        emit WarRewardClaimed(warId, player);
        game.grantEggs(player, _params.warEggReward, 0);
        parts.mint(player, MonsTypes.ACC_ORB, 1);
    }

    // ---------------------------------------------------------------- admin

    function setWeeklyTheme(uint32 week, uint8 family) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(family < 7, "family");
        themeOverride[week] = family + 1;
        emit ThemeSet(week, family);
    }

    function setParams(CommunityParams calldata p) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _params = p;
    }

    // ---------------------------------------------------------------- reads

    function getCommunity(uint32 cid) external view returns (CommunityView memory) {
        Community storage c = communities[cid];
        return CommunityView(c.name, c.leader, c.members);
    }

    function currentWeek() public view returns (uint32) {
        if (block.timestamp < _params.weekGenesis) return 0;
        return uint32((block.timestamp - _params.weekGenesis) / _params.weekLength);
    }

    function weekEndsAt() external view returns (uint64) {
        return _params.weekGenesis + (uint64(currentWeek()) + 1) * _params.weekLength;
    }

    function themeOf(uint32 week) public view returns (uint8) {
        uint8 o = themeOverride[week];
        return o != 0 ? o - 1 : uint8(week % 7);
    }

    function weeklyView(uint32 week, uint32 cid, address player)
        external
        view
        returns (uint32[2] memory, uint32[2] memory, uint8[2] memory)
    {
        return (progress[week][cid], contribution[week][cid][player], claimedMask[week][player]);
    }

    function getWar(uint32 warId) external view returns (WarView memory v) {
        War storage w = wars[warId];
        v.a = w.a;
        v.b = w.b;
        v.status = w.status == WAR_PENDING && w.a != 0 && block.timestamp > w.expiresAt ? WAR_EXPIRED : w.status;
        v.expiresAt = w.expiresAt;
        v.endsAt = w.endsAt;
        v.loadouts = w.loadouts;
        v.attacked = w.attacked;
        v.teamSize = w.teamSize;
        v.starsA = w.starsA;
        v.starsB = w.starsB;
        v.winner = w.winner;
        for (uint256 s; s < 2; ++s) {
            for (uint256 i; i < TEAM; ++i) {
                Target storage t = w.targets[s][i];
                v.team[s][i] = t.player;
                v.lockedBy[s][i] = t.lockedBy;
                v.lockedUntil[s][i] = t.lockedUntil;
                v.done[s][i] = t.done;
                v.stars[s][i] = t.stars;
            }
        }
    }

    function activeWarOf(uint32 cid) external view returns (uint32) {
        uint32 id = _activeWarOf[cid];
        return _live(id) ? id : 0;
    }

    function params() external view returns (CommunityParams memory) {
        return _params;
    }

    // ---------------------------------------------------------------- internal

    function _requireRegistered(address player) internal view {
        if (!game.getPlayer(player).registered) revert NotRegistered();
    }

    function _addMember(uint32 cid, address player) internal {
        Community storage c = communities[cid];
        c.members.push(player);
        memberIndex[player] = uint32(c.members.length);
        communityOf[player] = cid;
        emit MemberJoined(cid, player);
    }

    function _progress(uint32 cid, address player, uint8 task) internal {
        uint32 week = currentWeek();
        uint32 total = ++progress[week][cid][task];
        contribution[week][cid][player][task] += 1;
        contribCid[week][player] = cid;
        emit WeeklyProgress(week, cid, task, total);
    }

    /// 3..20 chars of [A-Za-z0-9 _]; returns keccak of the lowercased name.
    function _nameKey(bytes memory s) internal pure returns (bytes32) {
        if (s.length < 3 || s.length > 20) revert InvalidName();
        bytes memory lower = new bytes(s.length);
        for (uint256 i; i < s.length; ++i) {
            bytes1 c = s[i];
            if (c >= 0x41 && c <= 0x5a) c = bytes1(uint8(c) + 32);
            else if (!((c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x20 || c == 0x5f)) {
                revert InvalidName();
            }
            lower[i] = c;
        }
        return keccak256(lower);
    }

    function _live(uint32 warId) internal view returns (bool) {
        if (warId == 0) return false;
        War storage w = wars[warId];
        return w.status == WAR_ACTIVE || (w.status == WAR_PENDING && block.timestamp <= w.expiresAt);
    }

    function _war(uint32 warId) internal view returns (War storage w) {
        w = wars[warId];
        if (w.a == 0) revert UnknownWar();
    }

    function _activeWar(uint32 warId) internal view returns (War storage w) {
        w = _war(warId);
        if (w.status != WAR_ACTIVE || block.timestamp >= w.endsAt) revert WarNotActive();
    }

    function _member(War storage w, address player) internal view returns (uint8 side, uint8 idx) {
        for (uint8 s; s < 2; ++s) {
            for (uint8 i; i < w.teamSize[s]; ++i) {
                if (w.targets[s][i].player == player) return (s, i);
            }
        }
        revert NotTeamMember();
    }

    function _target(War storage w, uint8 side, uint8 idx) internal view returns (Target storage t) {
        if (idx >= w.teamSize[side]) revert NotTeamMember();
        t = w.targets[side][idx];
        if (t.done) revert TargetDone();
    }

    /// endsAt passed and no battle can still land a result: all results are in, or the last battle's TTL ended.
    function _timeUp(War storage w) internal view returns (bool) {
        if (block.timestamp < w.endsAt) return false;
        return w.started == w.resulted || block.timestamp > w.lastStartAt + game.params().battleTtl;
    }

    function _allAttacksDone(War storage w) internal view returns (bool) {
        uint8 n = w.teamSize[0] < w.teamSize[1] ? w.teamSize[0] : w.teamSize[1];
        return w.doneCount[0] == n && w.doneCount[1] == n;
    }

    /// Top members by Brain (desc), ties by lower address; snapshot loadouts now.
    function _pickTeam(War storage w, uint8 side, uint32 cid) internal returns (address[TEAM] memory team) {
        address[] memory ms = communities[cid].members;
        uint256 n = ms.length < TEAM ? ms.length : TEAM;
        uint32[] memory brain = new uint32[](ms.length);
        for (uint256 i; i < ms.length; ++i) {
            brain[i] = game.brainOf(ms[i]);
        }
        for (uint256 k; k < n; ++k) {
            uint256 best = k;
            for (uint256 j = k + 1; j < ms.length; ++j) {
                if (brain[j] > brain[best] || (brain[j] == brain[best] && ms[j] < ms[best])) best = j;
            }
            (ms[k], ms[best]) = (ms[best], ms[k]);
            (brain[k], brain[best]) = (brain[best], brain[k]);
            team[k] = ms[k];
            w.targets[side][k].player = ms[k];
            w.loadouts[side][k] = game.snapshotLoadout(ms[k]);
        }
        w.teamSize[side] = uint8(n);
    }
}
