import { describe, expect, it } from 'vitest';
import type { BattleRecord, Outcome, VerifyResult } from '../chain/replay.ts';
import { battleLink, replayPhaseOf, replayBadge, shortAddress, winnerBanner } from './replayView.ts';

const outcome: Outcome = { winner: 0, actions: 17, hpLeftA: 42, hpLeftB: 0, maxHpA: 108, maxHpB: 95 };

const record: BattleRecord = {
    battleId: 7n,
    mode: 0,
    attacker: '0x00000000000000000000000000000000000000aa',
    defender: '0x0000000000000000000000000000000000000000',
    ref: 0n,
    atkLoadout: 0n,
    defLoadout: 0n,
    seed: 42,
    simVersion: 1,
    startTx: `0x${'11'.repeat(32)}`,
    final: { ...outcome, resultHash: `0x${'ab'.repeat(32)}`, txHash: `0x${'22'.repeat(32)}`, blockNumber: 5n },
    rewards: { gloo: 0n, eggs: 1, brainDelta: 10 },
};

const verified: VerifyResult = { status: 'verified', claimed: outcome, recomputed: outcome, hashOk: true };

describe('replayPhaseOf', () => {
    it('is loading until the chain read settles', () => {
        expect(replayPhaseOf(null, null)).toBe('loading');
    });

    it('is not_found when no BattleStarted log exists', () => {
        expect(replayPhaseOf(null, verified)).toBe('not_found');
    });

    it('maps the two honest unverified reasons', () => {
        expect(replayPhaseOf(record, { status: 'unavailable', reason: 'in_progress' })).toBe('in_progress');
        expect(replayPhaseOf(record, { status: 'unavailable', reason: 'unsupported_sim' })).toBe('unsupported');
    });

    it('is ready once a verdict exists', () => {
        expect(replayPhaseOf(record, verified)).toBe('ready');
        expect(replayPhaseOf(record, { status: 'mismatch', claimed: outcome, recomputed: { ...outcome, hpLeftA: 1 }, hashOk: false })).toBe('ready');
    });
});

describe('replayBadge', () => {
    it('is only primary for a verified battle', () => {
        expect(replayBadge(verified)).toEqual({ text: 'Verified', tone: 'primary', detail: 'Re-simulated from Monad data' });
    });

    it('says mismatch in danger tone', () => {
        const b = replayBadge({ status: 'mismatch', claimed: outcome, recomputed: outcome, hashOk: false });
        expect(b.text).toBe('Mismatch');
        expect(b.tone).toBe('danger');
    });

    it('never claims verification for an unavailable result', () => {
        const b = replayBadge({ status: 'unavailable', reason: 'in_progress' });
        expect(b.text).not.toBe('Verified');
        expect(b.tone).toBe('danger');
    });
});

describe('winnerBanner', () => {
    it('reads from the attacker point of view', () => {
        expect(winnerBanner(outcome)).toBe('VICTORY');
        expect(winnerBanner({ ...outcome, winner: 1 })).toBe('DEFEAT');
    });
});

describe('battleLink', () => {
    it('builds the deep link', () => {
        expect(battleLink('7', 'https://monslab.vercel.app')).toBe('https://monslab.vercel.app/?replay=7');
    });
});

describe('shortAddress', () => {
    it('shortens an address and passes short strings through', () => {
        expect(shortAddress('0x00000000000000000000000000000000000000aa')).toBe('0x0000…00aa');
        expect(shortAddress('andi')).toBe('andi');
    });
});
