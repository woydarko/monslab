/** Event signatures the API decodes (from receipts and logs). Pure. */
import { parseAbiItem } from 'viem';

/** Decoded args of a log, typed by the caller: viem widens `args` when `strict: false`, and some build setups lose the ABI types. */
export function argsOf<T>(log: { args: unknown }): T {
    return log.args as T;
}

export const EGG_REQUESTED = parseAbiItem('event EggRequested(address indexed player, uint64 indexed sequence, uint8 eggType)');
export const EGG_HATCHED = parseAbiItem('event EggHatched(address indexed player, uint64 indexed sequence, uint256 tokenId, uint8 rarity)');
export const BATTLE_STARTED = parseAbiItem(
    'event BattleStarted(uint256 indexed battleId, address indexed attacker, address indexed defender, uint8 mode, uint256 ref, uint64 atkLoadout, uint64 defLoadout, uint32 seed, uint16 simVersion)',
);
export const REWARD_GRANTED = parseAbiItem('event RewardGranted(address indexed player, uint256 indexed battleId, uint64 gloo, uint32 eggs, int32 brainDelta)');
export const COMMUNITY_CREATED = parseAbiItem('event CommunityCreated(uint32 indexed cid, address indexed leader, string name)');
export const WAR_DECLARED = parseAbiItem('event WarDeclared(uint32 indexed warId, uint32 indexed a, uint32 indexed b, uint64 expiresAt)');
export const WAR_ACCEPTED = parseAbiItem('event WarAccepted(uint32 indexed warId, uint64 endsAt, address[5] teamA, address[5] teamB)');
export const TARGET_LOCKED = parseAbiItem('event TargetLocked(uint32 indexed warId, uint8 side, uint8 targetIdx, address indexed attacker, uint64 lockedUntil)');
export const WAR_SETTLED = parseAbiItem('event WarSettled(uint32 indexed warId, uint32 winnerCid, uint16 starsA, uint16 starsB)');
export const REDEEMED = parseAbiItem('event Redeemed(address indexed player, uint256 indexed dropId, uint256 tokenId)');
export const WAR_ATTACK_RESULT = parseAbiItem(
    'event WarAttackResult(uint32 indexed warId, uint8 side, uint8 targetIdx, address indexed attacker, uint8 stars, uint32 hpPctBps, uint256 battleId)',
);
