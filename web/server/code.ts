/**
 * Player codes: 6 Crockford base32 characters derived from `keccak256(address)`.
 * Eight windows into the same hash give the registration flow free fallbacks when a code is taken.
 */
import { keccak256 } from 'viem';
import type { Hex } from './types.ts';

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 6;
export const CANDIDATES = 8;

/** 256-bit hash as 52 Crockford base32 chars (5 bits each, last char zero-padded). */
function base32(hash: Hex): string {
    const bits = BigInt(hash);
    let out = '';
    for (let i = 0; i < 52; i++) {
        const shift = BigInt(256 - 5 * (i + 1));
        const idx = shift >= 0n ? Number((bits >> shift) & 31n) : Number((bits << -shift) & 31n);
        out += CROCKFORD[idx];
    }
    return out;
}

/** Deterministic candidates: window k = chars k..k+6 of the address hash. */
export function playerCodeCandidates(address: Hex): string[] {
    const stream = base32(keccak256(address.toLowerCase() as Hex));
    return Array.from({ length: CANDIDATES }, (_, k) => stream.slice(k, k + CODE_LENGTH));
}

/** ASCII bytes6 of the 6 characters (what the contract stores). */
export function codeToBytes6(code6: string): Hex {
    return `0x${[...code6].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}` as Hex;
}
