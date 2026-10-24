// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

library MonsTypes {
    uint8 internal constant MODE_PVE = 0;
    uint8 internal constant MODE_PVP = 1;
    uint8 internal constant MODE_WAR = 2;

    uint8 internal constant TASK_THEME = 0;
    uint8 internal constant TASK_HATCH = 1;

    uint8 internal constant EGG_NORMAL = 0;
    uint8 internal constant EGG_RARE = 1;

    uint8 internal constant RANDOM_ENTROPY = 0;
    uint8 internal constant RANDOM_BACKEND = 1;

    uint256 internal constant PART_COUNT = 21;
    uint256 internal constant STARTER_HEAD = 101;
    uint256 internal constant STARTER_BODY = 102;
    uint256 internal constant STARTER_LEGS = 103;
    uint256 internal constant ACC_CROWN = 201;
    uint256 internal constant ACC_TRAIL = 202;
    uint256 internal constant ACC_ORB = 203;
}

/// winner: 0 = attacker, 1 = defender
struct Outcome {
    uint8 winner;
    uint16 actions;
    uint32 hpLeftA;
    uint32 hpLeftB;
    uint32 maxHpA;
    uint32 maxHpB;
    bytes32 resultHash;
}

struct PlayerView {
    bool registered;
    string username;
    bytes6 code;
    uint32 brain;
    uint64 gloo;
    uint32 eggs;
    uint32 rareEggs;
    uint32 pendingEggs;
    uint8 highestTier;
    uint32 glooToday;
    uint8 pvpEggsToday;
    uint64 loadout;
}

/// status: 0 none, 1 started, 2 finalized
struct BattleView {
    uint8 mode;
    uint8 status;
    uint16 simVersion;
    uint32 seed;
    uint64 startedAt;
    address attacker;
    address defender;
    uint256 ref;
    uint64 atkLoadout;
    uint64 defLoadout;
}

struct Params {
    uint64 eggPrice;
    uint32 glooBase;
    uint32 glooPerTier;
    uint32 glooDailyCap;
    uint32 brainStart;
    uint32 brainWin;
    uint32 brainLose;
    uint32 brainDefLose;
    uint32 brainDefWin;
    uint8 pvpEggCap;
    uint32 battleTtl;
    uint32 dayOffset;
}

struct Drop {
    bytes32 codeHash;
    uint256 tokenId;
    uint64 startsAt;
    uint64 endsAt;
    uint32 maxClaims;
    uint32 claimed;
}

struct CommunityView {
    string name;
    address leader;
    address[] members;
}

struct CommunityParams {
    uint32 maxMembers;
    uint64 weekGenesis;
    uint64 weekLength;
    uint32[3] themeTiers;
    uint32[3] hatchTiers;
    uint64 warAcceptWindow;
    uint64 warDuration;
    uint64 lockDuration;
    uint32 warEggReward;
}

/// status: 0 pending, 1 active, 2 settled, 3 expired. Index [side][idx]; side 0 = team A, side 1 = team B.
struct WarView {
    uint32 a;
    uint32 b;
    uint8 status;
    uint64 expiresAt;
    uint64 endsAt;
    address[5][2] team;
    uint64[5][2] loadouts;
    address[5][2] lockedBy;
    uint64[5][2] lockedUntil;
    bool[5][2] done;
    uint8[5][2] stars;
    bool[5][2] attacked;
    uint8[2] teamSize;
    uint16 starsA;
    uint16 starsB;
    uint32 winner;
}
