// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {IMonsGame} from "./interfaces/IMonsGame.sol";
import {IMonsParts} from "./interfaces/IMonsParts.sol";
import {IMonsCommunity} from "./interfaces/IMonsCommunity.sol";
import {MonsTypes, Outcome, PlayerView, BattleView, Params, Drop} from "./interfaces/Types.sol";

/// Player accounts, eggs (Pyth Entropy v2), two-step battles and event drops.
/// Every player action arrives through the relayer (API), which authenticates the player off-chain.
contract MonsGame is AccessControl, ReentrancyGuard, IEntropyConsumer, IMonsGame {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant COMMUNITY_ROLE = keccak256("COMMUNITY_ROLE");

    uint8 internal constant MAX_TIER = 10;
    uint64 internal constant BACKEND_SEQ_BASE = 1 << 63;

    struct Player {
        bool registered;
        uint8 highestTier;
        uint8 pvpEggsToday;
        uint32 brain;
        uint32 eggs;
        uint32 rareEggs;
        uint32 pendingEggs;
        uint32 day;
        uint32 glooToday;
        uint64 gloo;
        uint64 loadout;
        bytes6 code;
        string username;
    }

    struct EggRequest {
        address player;
        uint8 eggType;
    }

    IMonsParts public immutable parts;
    address public immutable entropy;
    address public community;

    mapping(address => Player) internal players;
    mapping(bytes32 => address) public usernameOwner;
    mapping(bytes6 => address) public codeOwner;
    mapping(address => mapping(address => uint32)) public pvpRewardDay;
    mapping(uint64 => EggRequest) internal _pendingEgg;
    mapping(uint256 => BattleView) internal _battles;
    uint256 public battleCount;
    mapping(uint256 => Drop) internal _drops;
    mapping(uint256 => mapping(address => bool)) public redeemed;
    uint256[] internal dropIds;
    Params internal _params;
    uint16 public simVersion = 1;
    uint8 public randomSource;
    uint64 internal backendSeq;
    /// slot + 1 (0 = unknown token): 1 head, 2 body, 3 legs, 4 accessory
    mapping(uint256 => uint8) internal slotPlusOne;
    mapping(uint256 => uint8) public rarityOf;
    uint256[][3] internal tokensByRarity;

    constructor(address admin, IMonsParts parts_, address entropy_, uint8[] memory slots, uint8[] memory rarities) {
        require(slots.length == MonsTypes.PART_COUNT && rarities.length == MonsTypes.PART_COUNT, "parts table");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        parts = parts_;
        entropy = entropy_;
        for (uint256 i; i < MonsTypes.PART_COUNT; ++i) {
            require(slots[i] < 3 && rarities[i] < 3, "parts table");
            slotPlusOne[i + 1] = slots[i] + 1;
            rarityOf[i + 1] = rarities[i];
            tokensByRarity[rarities[i]].push(i + 1);
        }
        slotPlusOne[MonsTypes.STARTER_HEAD] = 1;
        slotPlusOne[MonsTypes.STARTER_BODY] = 2;
        slotPlusOne[MonsTypes.STARTER_LEGS] = 3;
        slotPlusOne[MonsTypes.ACC_CROWN] = 4;
        slotPlusOne[MonsTypes.ACC_TRAIL] = 4;
        slotPlusOne[MonsTypes.ACC_ORB] = 4;
        _params = Params({
            eggPrice: 100,
            glooBase: 10,
            glooPerTier: 5,
            glooDailyCap: 300,
            brainStart: 100,
            brainWin: 20,
            brainLose: 15,
            brainDefLose: 10,
            brainDefWin: 5,
            pvpEggCap: 5,
            battleTtl: 300,
            dayOffset: 25200
        });
    }

    // ---------------------------------------------------------------- players

    function register(address player, string calldata username, bytes6 code) external onlyRole(RELAYER_ROLE) {
        Player storage p = players[player];
        if (p.registered) revert AlreadyRegistered();
        if (!_validUsername(bytes(username))) revert InvalidUsername();
        bytes32 nameHash = keccak256(bytes(username));
        if (usernameOwner[nameHash] != address(0)) revert UsernameTaken();
        if (code == bytes6(0) || codeOwner[code] != address(0)) revert CodeTaken();

        usernameOwner[nameHash] = player;
        codeOwner[code] = player;
        p.registered = true;
        p.username = username;
        p.code = code;
        p.brain = _params.brainStart;
        p.eggs = 1;
        p.day = dayOf(uint64(block.timestamp));
        p.loadout = _pack(MonsTypes.STARTER_HEAD, MonsTypes.STARTER_BODY, MonsTypes.STARTER_LEGS, 0);
        emit Registered(player, username, code);

        parts.mint(player, MonsTypes.STARTER_HEAD, 1);
        parts.mint(player, MonsTypes.STARTER_BODY, 1);
        parts.mint(player, MonsTypes.STARTER_LEGS, 1);
    }

    function setLoadout(address player, uint16 head, uint16 body, uint16 legs, uint16 acc)
        external
        onlyRole(RELAYER_ROLE)
    {
        Player storage p = _registered(player);
        _checkPart(player, head, 1);
        _checkPart(player, body, 2);
        _checkPart(player, legs, 3);
        if (acc != 0) _checkPart(player, acc, 4);
        uint64 l = _pack(head, body, legs, acc);
        p.loadout = l;
        emit LoadoutSet(player, l);
    }

    // ---------------------------------------------------------------- eggs

    function buyEgg(address player, uint32 count) external onlyRole(RELAYER_ROLE) {
        Player storage p = _registered(player);
        uint64 cost = uint64(count) * _params.eggPrice;
        if (count == 0 || p.gloo < cost) revert InsufficientGloo();
        p.gloo -= cost;
        p.eggs += count;
        emit EggsBought(player, count, cost);
    }

    function openEgg(address player, uint8 eggType)
        external
        payable
        onlyRole(RELAYER_ROLE)
        nonReentrant
        returns (uint64 sequence)
    {
        Player storage p = _registered(player);
        if (eggType == MonsTypes.EGG_NORMAL) {
            if (p.eggs == 0) revert NoEgg();
            p.eggs -= 1;
        } else if (eggType == MonsTypes.EGG_RARE) {
            if (p.rareEggs == 0) revert NoEgg();
            p.rareEggs -= 1;
        } else {
            revert NoEgg();
        }
        p.pendingEggs += 1;

        uint256 fee;
        if (randomSource == MonsTypes.RANDOM_ENTROPY) {
            fee = IEntropyV2(entropy).getFeeV2();
            if (msg.value < fee) revert InsufficientFee();
            sequence = IEntropyV2(entropy).requestV2{value: fee}();
        } else {
            sequence = BACKEND_SEQ_BASE + ++backendSeq;
        }
        _pendingEgg[sequence] = EggRequest(player, eggType);
        emit EggRequested(player, sequence, eggType);

        if (community != address(0)) IMonsCommunity(community).onEggOpened(player);
        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "refund");
        }
    }

    function fulfillEggBackend(uint64 sequence, bytes32 random) external onlyRole(RELAYER_ROLE) {
        if (randomSource != MonsTypes.RANDOM_BACKEND || _pendingEgg[sequence].player == address(0)) {
            revert UnknownEgg();
        }
        _hatch(sequence, random);
    }

    function grantEggs(address player, uint32 normal, uint32 rare) external onlyRole(COMMUNITY_ROLE) {
        Player storage p = players[player];
        p.eggs += normal;
        p.rareEggs += rare;
    }

    function rarityFor(uint256 roll, uint8 eggType) public pure returns (uint8) {
        if (eggType == MonsTypes.EGG_RARE) return roll < 8000 ? 1 : 2;
        if (roll < 7000) return 0;
        return roll < 9500 ? 1 : 2;
    }

    function getEntropy() internal view override returns (address) {
        return entropy;
    }

    function entropyCallback(uint64 sequence, address, bytes32 random) internal override {
        _hatch(sequence, random);
    }

    /// Second delivery of the same sequence is a no-op (pending already deleted).
    function _hatch(uint64 sequence, bytes32 random) internal {
        EggRequest memory req = _pendingEgg[sequence];
        if (req.player == address(0)) return;
        delete _pendingEgg[sequence];
        players[req.player].pendingEggs -= 1;
        uint8 rarity = rarityFor(uint256(random) % 10_000, req.eggType);
        uint256[] storage list = tokensByRarity[rarity];
        uint256 tokenId = list[uint256(keccak256(abi.encode(random, uint256(1)))) % list.length];
        emit EggHatched(req.player, sequence, tokenId, rarity);
        parts.mint(req.player, tokenId, 1);
    }

    // ---------------------------------------------------------------- battles

    function startBattle(address player, uint8 mode, uint256 ref)
        external
        onlyRole(RELAYER_ROLE)
        returns (uint256 battleId, uint32 seed)
    {
        Player storage p = _registered(player);
        address defender;
        uint64 atkLoadout;
        uint64 defLoadout;
        if (mode == MonsTypes.MODE_PVE) {
            if (ref > p.highestTier) revert TierLocked();
            atkLoadout = snapshotLoadout(player);
        } else if (mode == MonsTypes.MODE_PVP) {
            if (ref > type(uint160).max) revert UnknownPlayer();
            defender = address(uint160(ref));
            if (defender == player) revert SelfBattle();
            if (!players[defender].registered) revert UnknownPlayer();
            atkLoadout = snapshotLoadout(player);
            defLoadout = snapshotLoadout(defender);
        } else if (mode == MonsTypes.MODE_WAR && community != address(0)) {
            (defender, atkLoadout, defLoadout) =
                IMonsCommunity(community).onWarBattleStart(player, uint32(ref >> 8), uint8(ref));
        } else {
            revert InvalidMode();
        }

        battleId = ++battleCount;
        seed = uint32(uint256(keccak256(abi.encode(block.prevrandao, blockhash(block.number - 1), battleId, player))));
        _battles[battleId] = BattleView({
            mode: mode,
            status: 1,
            simVersion: simVersion,
            seed: seed,
            startedAt: uint64(block.timestamp),
            attacker: player,
            defender: defender,
            ref: ref,
            atkLoadout: atkLoadout,
            defLoadout: defLoadout
        });
        emit BattleStarted(battleId, player, defender, mode, ref, atkLoadout, defLoadout, seed, simVersion);
    }

    function finalizeBattle(uint256 battleId, Outcome calldata o) external onlyRole(RELAYER_ROLE) {
        BattleView storage b = _battles[battleId];
        if (b.status == 0) revert UnknownBattle();
        if (b.status == 2) revert AlreadyFinalized();
        if (block.timestamp > b.startedAt + _params.battleTtl) revert BattleExpired();
        if (b.simVersion != simVersion) revert BadSimVersion();
        bytes32 h = keccak256(
            abi.encode(battleId, b.seed, o.winner, o.actions, o.hpLeftA, o.hpLeftB, o.maxHpA, o.maxHpB)
        );
        if (o.winner > 1 || h != o.resultHash) revert BadResultHash();

        b.status = 2;
        emit BattleFinalized(battleId, o.winner, o.actions, o.hpLeftA, o.hpLeftB, o.maxHpA, o.maxHpB, h);

        bool won = o.winner == 0;
        if (b.mode == MonsTypes.MODE_PVE) {
            _rewardPve(b.attacker, battleId, uint8(b.ref), won);
        } else if (b.mode == MonsTypes.MODE_PVP) {
            _rewardPvp(b.attacker, b.defender, battleId, won, b.atkLoadout);
        } else {
            uint32 hpPct = o.maxHpA == 0 ? 0 : uint32((uint256(o.hpLeftA) * 10_000) / o.maxHpA);
            uint8 stars = !won ? 0 : hpPct > 8000 ? 3 : hpPct > 5000 ? 2 : 1;
            IMonsCommunity(community).onWarBattleResult(
                uint32(b.ref >> 8), b.attacker, uint8(b.ref), stars, hpPct, battleId
            );
        }
    }

    function _rewardPve(address player, uint256 battleId, uint8 tier, bool won) internal {
        Player storage p = players[player];
        _touchDay(p);
        uint64 g;
        if (won) {
            uint32 amount = _params.glooBase + _params.glooPerTier * tier;
            uint32 room = _params.glooDailyCap > p.glooToday ? _params.glooDailyCap - p.glooToday : 0;
            if (amount > room) amount = room;
            g = amount;
            p.gloo += g;
            p.glooToday += amount;
            uint8 next = tier + 1 > MAX_TIER ? MAX_TIER : tier + 1;
            if (next > p.highestTier) p.highestTier = next;
        }
        emit RewardGranted(player, battleId, g, 0, 0);
    }

    function _rewardPvp(address a, address d, uint256 battleId, bool won, uint64 atkLoadout) internal {
        Player storage pa = players[a];
        Player storage pd = players[d];
        _touchDay(pa);
        uint32 eggs;
        int32 delta;
        if (won) {
            pa.brain += _params.brainWin;
            pd.brain -= _min(pd.brain, _params.brainDefLose);
            delta = int32(_params.brainWin);
            uint32 today = pa.day;
            if (pa.pvpEggsToday < _params.pvpEggCap && pvpRewardDay[a][d] != today) {
                pvpRewardDay[a][d] = today;
                pa.pvpEggsToday += 1;
                pa.eggs += 1;
                eggs = 1;
            }
        } else {
            uint32 loss = _min(pa.brain, _params.brainLose);
            pa.brain -= loss;
            pd.brain += _params.brainDefWin;
            delta = -int32(loss);
        }
        emit BrainChanged(a, pa.brain);
        emit BrainChanged(d, pd.brain);
        emit RewardGranted(a, battleId, 0, eggs, delta);
        if (won && community != address(0)) IMonsCommunity(community).onPvpWin(a, familyMaskOf(atkLoadout));
    }

    // ---------------------------------------------------------------- drops

    function createDrop(
        uint256 dropId,
        bytes32 codeHash,
        uint256 tokenId,
        uint64 startsAt,
        uint64 endsAt,
        uint32 maxClaims
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_drops[dropId].tokenId != 0 || tokenId == 0 || endsAt <= startsAt) revert WindowLocked();
        _drops[dropId] = Drop(codeHash, tokenId, startsAt, endsAt, maxClaims, 0);
        dropIds.push(dropId);
        emit DropCreated(dropId, tokenId, startsAt, endsAt, maxClaims);
    }

    function setDropWindow(uint256 dropId, uint64 startsAt, uint64 endsAt) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Drop storage d = _drops[dropId];
        if (d.tokenId == 0 || block.timestamp >= d.startsAt || endsAt <= startsAt) revert WindowLocked();
        d.startsAt = startsAt;
        d.endsAt = endsAt;
        emit DropCreated(dropId, d.tokenId, startsAt, endsAt, d.maxClaims);
    }

    function redeem(address player, uint256 dropId, string calldata code) external onlyRole(RELAYER_ROLE) {
        _registered(player);
        Drop storage d = _drops[dropId];
        if (d.tokenId == 0 || keccak256(bytes(code)) != d.codeHash) revert InvalidCode();
        if (block.timestamp < d.startsAt) revert DropNotStarted();
        if (block.timestamp >= d.endsAt) revert DropClosed();
        if (redeemed[dropId][player]) revert AlreadyRedeemed();
        if (d.claimed >= d.maxClaims) revert DropSoldOut();
        redeemed[dropId][player] = true;
        d.claimed += 1;
        emit Redeemed(player, dropId, d.tokenId);
        parts.mint(player, d.tokenId, 1);
    }

    // ---------------------------------------------------------------- admin

    function setCommunity(address community_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (community != address(0)) revert CommunityAlreadySet();
        community = community_;
    }

    function setRandomSource(uint8 source) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(source <= MonsTypes.RANDOM_BACKEND, "source");
        randomSource = source;
    }

    function setSimVersion(uint16 version) external onlyRole(DEFAULT_ADMIN_ROLE) {
        simVersion = version;
    }

    function setParams(Params calldata p) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _params = p;
    }

    function withdraw(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool ok,) = to.call{value: address(this).balance}("");
        require(ok, "withdraw");
    }

    // ---------------------------------------------------------------- reads

    function getPlayer(address player) external view returns (PlayerView memory v) {
        Player storage p = players[player];
        bool sameDay = p.day == dayOf(uint64(block.timestamp));
        v = PlayerView({
            registered: p.registered,
            username: p.username,
            code: p.code,
            brain: p.brain,
            gloo: p.gloo,
            eggs: p.eggs,
            rareEggs: p.rareEggs,
            pendingEggs: p.pendingEggs,
            highestTier: p.highestTier,
            glooToday: sameDay ? p.glooToday : 0,
            pvpEggsToday: sameDay ? p.pvpEggsToday : 0,
            loadout: p.loadout
        });
    }

    function loadoutOf(address player) external view returns (uint64) {
        return players[player].loadout;
    }

    /// Loadout with parts no longer owned replaced by the slot starter (accessory -> 0).
    function snapshotLoadout(address player) public view returns (uint64) {
        uint64 l = players[player].loadout;
        uint256 head = uint16(l >> 48);
        uint256 body = uint16(l >> 32);
        uint256 legs = uint16(l >> 16);
        uint256 acc = uint16(l);
        if (head == 0 || parts.balanceOf(player, head) == 0) head = MonsTypes.STARTER_HEAD;
        if (body == 0 || parts.balanceOf(player, body) == 0) body = MonsTypes.STARTER_BODY;
        if (legs == 0 || parts.balanceOf(player, legs) == 0) legs = MonsTypes.STARTER_LEGS;
        if (acc != 0 && parts.balanceOf(player, acc) == 0) acc = 0;
        return _pack(head, body, legs, acc);
    }

    /// Bit per family (0 fang .. 6 ghost) of head/body/legs. Token 1..21 family = (id-1)/3; starters are goo.
    function familyMaskOf(uint64 loadout) public pure returns (uint8 mask) {
        for (uint256 shift = 16; shift <= 48; shift += 16) {
            uint256 id = uint16(loadout >> shift);
            if (id >= 1 && id <= MonsTypes.PART_COUNT) mask |= uint8(1 << ((id - 1) / 3));
            else if (id >= MonsTypes.STARTER_HEAD && id <= MonsTypes.STARTER_LEGS) mask |= 2;
        }
    }

    function brainOf(address player) external view returns (uint32) {
        return players[player].brain;
    }

    function battles(uint256 battleId) external view returns (BattleView memory) {
        return _battles[battleId];
    }

    function pendingEgg(uint64 sequence) external view returns (address player, uint8 eggType) {
        EggRequest memory r = _pendingEgg[sequence];
        return (r.player, r.eggType);
    }

    function drops(uint256 dropId) external view returns (Drop memory) {
        return _drops[dropId];
    }

    function activeDropIds() external view returns (uint256[] memory ids) {
        uint256 n;
        ids = new uint256[](dropIds.length);
        for (uint256 i; i < dropIds.length; ++i) {
            Drop storage d = _drops[dropIds[i]];
            if (d.startsAt <= block.timestamp && block.timestamp < d.endsAt) ids[n++] = dropIds[i];
        }
        assembly {
            mstore(ids, n)
        }
    }

    function params() external view returns (Params memory) {
        return _params;
    }

    function entropyFee() external view returns (uint128) {
        return IEntropyV2(entropy).getFeeV2();
    }

    function dayOf(uint64 ts) public view returns (uint32) {
        return uint32((uint256(ts) + _params.dayOffset) / 86_400);
    }

    function slotOf(uint256 tokenId) external view returns (uint8) {
        return slotPlusOne[tokenId] == 0 ? type(uint8).max : slotPlusOne[tokenId] - 1;
    }

    // ---------------------------------------------------------------- internal

    function _registered(address player) internal view returns (Player storage p) {
        p = players[player];
        if (!p.registered) revert NotRegistered();
    }

    function _checkPart(address player, uint256 id, uint8 slot) internal view {
        if (slotPlusOne[id] != slot) revert WrongSlot(id);
        if (parts.balanceOf(player, id) == 0) revert NotOwner(id);
    }

    function _touchDay(Player storage p) internal {
        uint32 today = dayOf(uint64(block.timestamp));
        if (p.day != today) {
            p.day = today;
            p.glooToday = 0;
            p.pvpEggsToday = 0;
        }
    }

    function _pack(uint256 head, uint256 body, uint256 legs, uint256 acc) internal pure returns (uint64) {
        return uint64((head << 48) | (body << 32) | (legs << 16) | acc);
    }

    function _min(uint32 a, uint32 b) internal pure returns (uint32) {
        return a < b ? a : b;
    }

    /// `^[a-z0-9_]{3,16}$`
    function _validUsername(bytes memory s) internal pure returns (bool) {
        if (s.length < 3 || s.length > 16) return false;
        for (uint256 i; i < s.length; ++i) {
            bytes1 c = s[i];
            if (!((c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x5f)) return false;
        }
        return true;
    }
}
