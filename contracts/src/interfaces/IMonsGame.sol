// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Outcome, PlayerView, BattleView, Params, Drop} from "./Types.sol";

interface IMonsGame {
    event Registered(address indexed player, string username, bytes6 code);
    event LoadoutSet(address indexed player, uint64 loadout);
    event EggsBought(address indexed player, uint32 count, uint64 glooSpent);
    event EggRequested(address indexed player, uint64 indexed sequence, uint8 eggType);
    event EggHatched(address indexed player, uint64 indexed sequence, uint256 tokenId, uint8 rarity);
    event BattleStarted(
        uint256 indexed battleId,
        address indexed attacker,
        address indexed defender,
        uint8 mode,
        uint256 ref,
        uint64 atkLoadout,
        uint64 defLoadout,
        uint32 seed,
        uint16 simVersion
    );
    event BattleFinalized(
        uint256 indexed battleId,
        uint8 winner,
        uint16 actions,
        uint32 hpLeftA,
        uint32 hpLeftB,
        uint32 maxHpA,
        uint32 maxHpB,
        bytes32 resultHash
    );
    event RewardGranted(address indexed player, uint256 indexed battleId, uint64 gloo, uint32 eggs, int32 brainDelta);
    event BrainChanged(address indexed player, uint32 brain);
    event Redeemed(address indexed player, uint256 indexed dropId, uint256 tokenId);
    event DropCreated(uint256 indexed dropId, uint256 tokenId, uint64 startsAt, uint64 endsAt, uint32 maxClaims);

    error NotRelayer();
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidUsername();
    error UsernameTaken();
    error CodeTaken();
    error NotOwner(uint256 tokenId);
    error WrongSlot(uint256 tokenId);
    error NoEgg();
    error InsufficientGloo();
    error InsufficientFee();
    error UnknownEgg();
    error TierLocked();
    error SelfBattle();
    error UnknownPlayer();
    error UnknownBattle();
    error AlreadyFinalized();
    error BattleExpired();
    error BadSimVersion();
    error BadResultHash();
    error DropNotStarted();
    error DropClosed();
    error AlreadyRedeemed();
    error DropSoldOut();
    error InvalidCode();
    error WindowLocked();
    error InvalidMode();
    error CommunityAlreadySet();

    // relayer writes
    function register(address player, string calldata username, bytes6 code) external;
    function setLoadout(address player, uint16 head, uint16 body, uint16 legs, uint16 acc) external;
    function buyEgg(address player, uint32 count) external;
    function openEgg(address player, uint8 eggType) external payable returns (uint64 sequence);
    function fulfillEggBackend(uint64 sequence, bytes32 random) external;
    function startBattle(address player, uint8 mode, uint256 ref) external returns (uint256 battleId, uint32 seed);
    function finalizeBattle(uint256 battleId, Outcome calldata o) external;
    function redeem(address player, uint256 dropId, string calldata code) external;

    // community writes
    function grantEggs(address player, uint32 normal, uint32 rare) external;

    // admin writes
    function setCommunity(address community_) external;
    function createDrop(
        uint256 dropId,
        bytes32 codeHash,
        uint256 tokenId,
        uint64 startsAt,
        uint64 endsAt,
        uint32 maxClaims
    ) external;
    function setDropWindow(uint256 dropId, uint64 startsAt, uint64 endsAt) external;
    function setRandomSource(uint8 source) external;
    function setSimVersion(uint16 version) external;
    function setParams(Params calldata p) external;
    function withdraw(address payable to) external;

    // reads
    function getPlayer(address player) external view returns (PlayerView memory);
    function loadoutOf(address player) external view returns (uint64);
    function snapshotLoadout(address player) external view returns (uint64);
    function familyMaskOf(uint64 loadout) external pure returns (uint8);
    function usernameOwner(bytes32 usernameHash) external view returns (address);
    function codeOwner(bytes6 code) external view returns (address);
    function brainOf(address player) external view returns (uint32);
    function battles(uint256 battleId) external view returns (BattleView memory);
    function battleCount() external view returns (uint256);
    function pendingEgg(uint64 sequence) external view returns (address player, uint8 eggType);
    function drops(uint256 dropId) external view returns (Drop memory);
    function redeemed(uint256 dropId, address player) external view returns (bool);
    function activeDropIds() external view returns (uint256[] memory);
    function params() external view returns (Params memory);
    function simVersion() external view returns (uint16);
    function randomSource() external view returns (uint8);
    function entropyFee() external view returns (uint128);
    function dayOf(uint64 ts) external view returns (uint32);
    function community() external view returns (address);
}
