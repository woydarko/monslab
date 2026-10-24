/**
 * S-10 replay: pure helpers for the screen states, the badge and the deep link.
 * The badge is derived from K5's `VerifyResult` only — no optimistic "Verified".
 */
import type { BattleRecord, Outcome, VerifyResult } from '../chain/replay.ts';

export type ReplayPhase = 'loading' | 'not_found' | 'in_progress' | 'unsupported' | 'ready';

/** Which screen state to show: chain read first, then the verification verdict. */
export function replayPhaseOf(record: BattleRecord | null, verify: VerifyResult | null): ReplayPhase {
    if (!record) return verify ? 'not_found' : 'loading';
    if (!verify) return 'loading';
    if (verify.status === 'unavailable') return verify.reason === 'unsupported_sim' ? 'unsupported' : 'in_progress';
    return 'ready';
}

export interface ReplayBadge {
    text: string;
    tone: 'primary' | 'danger';
    detail: string;
}

/** Badge copy (DESIGN_SYSTEM §9 microcopy: "Re-simulated from Monad data"). */
export function replayBadge(verify: VerifyResult): ReplayBadge {
    if (verify.status === 'verified') return { text: 'Verified', tone: 'primary', detail: 'Re-simulated from Monad data' };
    if (verify.status === 'mismatch') return { text: 'Mismatch', tone: 'danger', detail: 'This replay does not match the Monad record' };
    return { text: 'Not verified', tone: 'danger', detail: 'The Monad record cannot be checked right now' };
}

/** The banner is always the attacker's point of view. */
export function winnerBanner(o: Outcome): 'VICTORY' | 'DEFEAT' {
    return o.winner === 0 ? 'VICTORY' : 'DEFEAT';
}

export function battleLink(battleId: string, origin: string): string {
    return `${origin.replace(/\/$/, '')}/?replay=${battleId}`;
}

export function shortAddress(address: string): string {
    return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
