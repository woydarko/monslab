/** On-chain token ids ↔ part ids, and the packed uint64 loadout. Pure. */
import { PARTS } from './parts.ts';
import type { MonsterParts } from './types.ts';

export const STARTER = { head: 101, body: 102, legs: 103 } as const;
export const ACCESSORIES = [201, 202, 203] as const;
export const ACC_NAMES: Record<number, string> = { 201: 'Monad Crown', 202: 'Goo Trail', 203: 'War Orb' };

const STARTER_PART: Record<number, string> = { 101: 'goo_head', 102: 'goo_body', 103: 'goo_legs' };

/** 1..21 → PARTS[token-1]; 101..103 → soulbound starter goo parts. */
export function tokenToPartId(token: number): string | null {
    if (token >= 1 && token <= PARTS.length) return PARTS[token - 1].id;
    return STARTER_PART[token] ?? null;
}

export function partIdToToken(partId: string): number {
    const i = PARTS.findIndex((p) => p.id === partId);
    if (i < 0) throw new Error(`unknown part ${partId}`);
    return i + 1;
}

export function slotOfToken(token: number): 'head' | 'body' | 'legs' | 'acc' | null {
    if ((ACCESSORIES as readonly number[]).includes(token)) return 'acc';
    const id = tokenToPartId(token);
    return id ? PARTS.find((p) => p.id === id)!.slot : null;
}

export interface PackedLoadout {
    head: number;
    body: number;
    legs: number;
    acc: number;
}

export function packLoadout(l: PackedLoadout): bigint {
    return (BigInt(l.head) << 48n) | (BigInt(l.body) << 32n) | (BigInt(l.legs) << 16n) | BigInt(l.acc);
}

export function unpackLoadout(x: bigint): PackedLoadout {
    return { head: Number((x >> 48n) & 0xffffn), body: Number((x >> 32n) & 0xffffn), legs: Number((x >> 16n) & 0xffffn), acc: Number(x & 0xffffn) };
}

/** Parts to simulate. A missing or unknown token falls back to that slot's starter (contract does the same). */
export function partsFromLoadout(x: bigint): { parts: MonsterParts; acc: number } {
    const l = unpackLoadout(x);
    const pick = (t: number, fallback: number) => tokenToPartId(t) ?? STARTER_PART[fallback];
    return { parts: [pick(l.head, STARTER.head), pick(l.body, STARTER.body), pick(l.legs, STARTER.legs)], acc: l.acc };
}
