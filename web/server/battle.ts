/**
 * Battle orchestrator (ARCHITECTURE.md Flow D): start the battle on chain, replay the sim version the
 * contract recorded, then finalize with a `resultHash` the contract verifies. Finalize is retried three
 * times; if it still fails the battle is reported as `finalize_pending` and can be re-finalized later.
 */
import { parseEventLogs } from 'viem';
import { buildFighters, computeBattle } from '../src/game/battlePlayer.ts';
import { unpackLoadout } from '../src/game/data/tokenIds.ts';
import { resultHash } from '../src/game/sim/outcome.ts';
import { findBattleStarted, game, readCommunity, readGame, type BattleStartedLog } from './contracts.ts';
import { BATTLE_STARTED, REWARD_GRANTED } from './events.ts';
import { mapRevert } from './errors.ts';
import { ApiError } from './http.ts';
import { sendAs } from './relayer.ts';
import type { BattleMode, BattleOutcome, BattleRequest, BattleView, Hex } from './types.ts';
import { playerCode } from './validate.ts';

/** Backoff before each finalize retry; three attempts in total. */
export const FINALIZE_DELAYS = [300, 600, 1200];
const MODE_CODE = { pve: 0, pvp: 1, war: 2 } as const;
const MODE_NAME: BattleMode[] = ['pve', 'pvp', 'war'];
const ZERO = '0x0000000000000000000000000000000000000000';

export interface BattleDeps {
    /** Injected by tests so they do not wait out the backoff. */
    sleep?(ms: number): Promise<void>;
}

interface WarView {
    lockedBy?: [string[], string[]];
    lockedUntil?: [bigint[], bigint[]];
}

interface FinalizeResult {
    txFinal: Hex;
    rewards: BattleView['rewards'];
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Friendly pre-checks, then the on-chain `mode` + `ref` for `startBattle`. */
async function startArgs(player: Hex, req: BattleRequest): Promise<{ mode: number; ref: bigint }> {
    if (req.mode === 'pve') {
        const p = await readGame<{ highestTier: number }>('getPlayer', [player]);
        if (req.tier > Number(p.highestTier)) throw new ApiError(400, 'tier_locked');
        return { mode: MODE_CODE.pve, ref: BigInt(req.tier) };
    }
    if (req.mode === 'pvp') {
        const { bytes6 } = playerCode(req.code);
        const defender = (await readGame<Hex>('codeOwner', [bytes6])).toLowerCase();
        if (defender === ZERO) throw new ApiError(404, 'player_not_found');
        if (defender === player.toLowerCase()) throw new ApiError(400, 'self_battle');
        return { mode: MODE_CODE.pvp, ref: BigInt(defender) };
    }
    const war = await readCommunity<WarView>('getWar', [req.warId]);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const held = [0, 1].some((side) => {
        const by = (war.lockedBy?.[side]?.[req.targetIdx] ?? ZERO).toLowerCase();
        const until = BigInt(war.lockedUntil?.[side]?.[req.targetIdx] ?? 0n);
        return by === player.toLowerCase() && until > now;
    });
    if (!held) throw new ApiError(409, 'not_locked_by_you');
    return { mode: MODE_CODE.war, ref: (BigInt(req.warId) << 8n) | BigInt(req.targetIdx) };
}

/** Same sim version the contract recorded, so the hash matches. */
function simulate(started: BattleStartedLog): BattleOutcome {
    const mode = MODE_NAME[started.mode];
    if (!mode) throw new ApiError(500, 'internal');
    const [a, b] = buildFighters({
        mode,
        atk: started.atkLoadout,
        def: started.defLoadout,
        tier: mode === 'pve' ? Number(started.ref) : null,
        atkName: 'You',
        defName: 'Rival',
    });
    return computeBattle(a, b, started.seed, started.simVersion).outcome;
}

async function finalizeOnce(player: Hex, started: BattleStartedLog, outcome: BattleOutcome): Promise<FinalizeResult> {
    const o = { ...outcome, resultHash: resultHash(started.battleId, started.seed, outcome) };
    const { hash, receipt } = await sendAs(player, { ...game(), functionName: 'finalizeBattle', args: [started.battleId, o] });
    const [reward] = parseEventLogs({ abi: [REWARD_GRANTED], eventName: 'RewardGranted', logs: receipt.logs, strict: false });
    const rewards = reward
        ? { gloo: Number(reward.args.gloo), eggs: Number(reward.args.eggs), brainDelta: Number(reward.args.brainDelta) }
        : { gloo: 0, eggs: 0, brainDelta: 0 };
    return { txFinal: hash, rewards };
}

/** Three attempts; null when every one failed (the client shows "Result pending"). */
async function finalizeWithRetry(player: Hex, started: BattleStartedLog, outcome: BattleOutcome, deps: BattleDeps): Promise<FinalizeResult | null> {
    const sleep = deps.sleep ?? defaultSleep;
    for (let attempt = 0; attempt < FINALIZE_DELAYS.length; attempt++) {
        try {
            return await finalizeOnce(player, started, outcome);
        } catch {
            if (attempt === FINALIZE_DELAYS.length - 1) return null;
            await sleep(FINALIZE_DELAYS[attempt]);
        }
    }
    return null;
}

function viewOf(started: BattleStartedLog, outcome: BattleOutcome, final: FinalizeResult | null, txStart: Hex): BattleView {
    const mode = MODE_NAME[started.mode];
    const defenderAddress = started.defender.toLowerCase() === ZERO ? undefined : started.defender;
    return {
        battleId: String(started.battleId),
        seed: started.seed,
        simVersion: started.simVersion,
        mode,
        attacker: { address: started.attacker, loadout: unpackLoadout(BigInt(started.atkLoadout)) },
        defender: mode === 'pve' ? { tier: Number(started.ref) } : { address: defenderAddress, loadout: unpackLoadout(BigInt(started.defLoadout)) },
        outcome,
        rewards: final?.rewards ?? { gloo: 0, eggs: 0, brainDelta: 0 },
        txStart,
        txFinal: final?.txFinal ?? null,
        status: final ? 'final' : 'finalize_pending',
    };
}

function fromArgs(args: Record<string, unknown>, txHash: Hex): BattleStartedLog {
    return {
        battleId: args.battleId as bigint,
        attacker: args.attacker as Hex,
        defender: args.defender as Hex,
        mode: Number(args.mode),
        ref: args.ref as bigint,
        atkLoadout: args.atkLoadout as bigint,
        defLoadout: args.defLoadout as bigint,
        seed: Number(args.seed),
        simVersion: Number(args.simVersion),
        txHash,
    };
}

export async function runBattle(player: Hex, req: BattleRequest, deps: BattleDeps = {}): Promise<BattleView> {
    const { mode, ref } = await startArgs(player, req);
    const start = await sendAs(player, { ...game(), functionName: 'startBattle', args: [player, mode, ref] });
    const [log] = parseEventLogs({ abi: [BATTLE_STARTED], eventName: 'BattleStarted', logs: start.receipt.logs, strict: false });
    if (!log) throw new ApiError(500, 'internal');

    const started = fromArgs(log.args as Record<string, unknown>, start.hash);
    const outcome = simulate(started);
    const final = await finalizeWithRetry(player, started, outcome, deps);
    return viewOf(started, outcome, final, start.hash);
}

/** Re-simulate a battle from its start log and try to finalize it once (idempotent: the contract rejects duplicates). */
export async function refinalize(battleId: bigint, _deps: BattleDeps = {}): Promise<BattleView> {
    const started = await findBattleStarted(battleId);
    if (!started) throw new ApiError(404, 'battle_not_found');
    const outcome = simulate(started);
    try {
        const final = await finalizeOnce(started.attacker, started, outcome);
        return viewOf(started, outcome, final, started.txHash);
    } catch (err) {
        const mapped = mapRevert(err);
        throw new ApiError(mapped.status, mapped.code, mapped.details);
    }
}
