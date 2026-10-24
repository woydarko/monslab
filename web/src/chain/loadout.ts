/**
 * Packed loadout helpers (`uint64 = head << 48 | body << 32 | legs << 16 | acc`,
 * ARCHITECTURE.md §Interfaces — Smart contracts).
 *
 * Shortcut: G2's `game/data/tokenIds.ts` (`unpackLoadout`, `partsFromLoadout`,
 * `tokenToPartId`) is not on this branch yet, so the chain module carries the
 * same rules for reads. Swap these imports when the branch is rebased onto
 * `feat/platform`.
 */
import { PARTS } from '../game/data/parts.ts';
import type { MonsterParts } from '../game/data/types.ts';
import type { Loadout } from '../../server/types.ts';

const MASK = 0xffffn;

/** Token id of the three starter parts (soulbound, one per slot). */
export const STARTER = { head: 101, body: 102, legs: 103 } as const;

/** Token id → part id: 1..21 are `PARTS[token - 1]`, 101–103 the starters. */
export function tokenToPartId(token: number): string | null {
    if (token >= 1 && token <= PARTS.length) return PARTS[token - 1].id;
    if (token === STARTER.head) return 'goo_head';
    if (token === STARTER.body) return 'goo_body';
    if (token === STARTER.legs) return 'goo_legs';
    return null;
}

export function partIdToToken(partId: string): number {
    if (partId === 'goo_head') return STARTER.head;
    if (partId === 'goo_body') return STARTER.body;
    if (partId === 'goo_legs') return STARTER.legs;
    return PARTS.findIndex((p) => p.id === partId) + 1;
}

export function unpackLoadout(x: bigint): Loadout {
    return {
        head: Number((x >> 48n) & MASK),
        body: Number((x >> 32n) & MASK),
        legs: Number((x >> 16n) & MASK),
        acc: Number(x & MASK),
    };
}

export function packLoadout(l: Loadout): bigint {
    return (BigInt(l.head) << 48n) | (BigInt(l.body) << 32n) | (BigInt(l.legs) << 16n) | BigInt(l.acc);
}

export interface PartsFromLoadout {
    parts: MonsterParts;
    acc: number;
    /** The raw token ids, in slot order. */
    tokens: Loadout;
}

/**
 * A packed loadout as the sim sees it. Tokens the contract could not resolve
 * are already starter parts on chain (`snapshotLoadout`), so unknown ids fall
 * back to the starter of that slot instead of throwing.
 */
export function partsFromLoadout(x: bigint): PartsFromLoadout {
    const tokens = unpackLoadout(x);
    const slot = (token: number, starter: number): string => tokenToPartId(token || starter) ?? tokenToPartId(starter)!;
    return {
        tokens,
        acc: tokens.acc,
        parts: [slot(tokens.head, STARTER.head), slot(tokens.body, STARTER.body), slot(tokens.legs, STARTER.legs)],
    };
}
