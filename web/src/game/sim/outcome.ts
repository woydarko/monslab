/** Battle outcome summary + resultHash, identical to the contract's abi.encode. Pure. */
import { encodeAbiParameters, keccak256 } from 'viem';
import type { BattleResult } from './battle.ts';

export interface Outcome {
    winner: 0 | 1;
    actions: number;
    hpLeftA: number;
    hpLeftB: number;
    maxHpA: number;
    maxHpB: number;
}

const int = (x: number): number => Math.max(0, Math.round(x));

export function outcomeOf(result: BattleResult): Outcome {
    const hp: [number, number] = [result.maxHp[0], result.maxHp[1]];
    for (const e of result.events) {
        if (e.type === 'attack') {
            hp[e.target] = e.targetHp;
            hp[e.actor] = e.actorHp;
        } else if (e.type === 'regen') hp[e.actor] = e.actorHp;
        else if (e.type === 'poison') hp[e.target] = e.targetHp;
        else if (e.type === 'revive') hp[e.actor] = e.hp;
    }
    return {
        winner: result.winner,
        actions: int(result.actions),
        hpLeftA: int(hp[0]),
        hpLeftB: int(hp[1]),
        maxHpA: int(result.maxHp[0]),
        maxHpB: int(result.maxHp[1]),
    };
}

export function resultHash(battleId: bigint, seed: number, o: Outcome): `0x${string}` {
    return keccak256(
        encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint32' }, { type: 'uint8' }, { type: 'uint16' }, { type: 'uint32' }, { type: 'uint32' }, { type: 'uint32' }, { type: 'uint32' }],
            [battleId, seed, o.winner, o.actions, o.hpLeftA, o.hpLeftB, o.maxHpA, o.maxHpB],
        ),
    );
}
