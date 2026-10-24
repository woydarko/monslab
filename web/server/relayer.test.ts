import { afterEach, describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { parseAbi, parseEther, type Hex } from 'viem';
import { assertRelayerFunds, pickKeyIndex, sendAs, type RelayerDeps } from './relayer.ts';

const KEYS: Hex[] = [
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
];
const CALL = { address: '0x00000000000000000000000000000000000000aa' as Hex, abi: parseAbi(['function ping()']), functionName: 'ping', args: [] as const };

function deps(over: Partial<RelayerDeps> = {}): RelayerDeps {
    return {
        keys: KEYS,
        balanceOf: async () => parseEther('50'),
        nonceOf: async () => 7,
        simulate: async () => {},
        estimateGas: async () => 100_000n,
        send: async () => ({ hash: '0xabc' as Hex, receipt: { status: 'success' } as never }),
        ...over,
    };
}

function randomAddress(i: number): Hex {
    return privateKeyToAccount(`0x${(i + 1).toString(16).padStart(64, '0')}` as Hex).address;
}

describe('relayer', () => {
    afterEach(() => vi.restoreAllMocks());

    it('picks a stable key and spreads players', () => {
        const a = randomAddress(1);
        expect(pickKeyIndex(a, 4)).toBe(pickKeyIndex(a, 4));
        const buckets = [0, 0, 0, 0];
        for (let i = 0; i < 100; i++) buckets[pickKeyIndex(randomAddress(i), 4)]++;
        for (const b of buckets) expect(b).toBeGreaterThan(10);
    });

    it('serializes sends on the same key', async () => {
        const order: string[] = [];
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        let n = 0;
        const d = deps({
            keys: [KEYS[0]],
            send: async () => {
                const id = ++n;
                order.push(`start${id}`);
                if (id === 1) await gate;
                order.push(`end${id}`);
                return { hash: '0x1' as Hex, receipt: { status: 'success' } as never };
            },
        });
        const p1 = sendAs(randomAddress(1), CALL, d);
        const p2 = sendAs(randomAddress(2), CALL, d);
        await new Promise((r) => setTimeout(r, 20));
        expect(order).toEqual(['start1']);
        release();
        await Promise.all([p1, p2]);
        expect(order).toEqual(['start1', 'end1', 'start2', 'end2']);
    });

    it('refetches the nonce and retries on nonce errors', async () => {
        const nonces = [7, 8];
        const sent: number[] = [];
        const d = deps({
            nonceOf: async () => nonces.shift()!,
            send: async (_acc, tx) => {
                sent.push(tx.nonce);
                if (sent.length === 1) throw new Error('nonce too low');
                return { hash: '0x2' as Hex, receipt: { status: 'success' } as never };
            },
        });
        const r = await sendAs(randomAddress(3), CALL, d);
        expect(r.hash).toBe('0x2');
        expect(sent).toEqual([7, 8]);
    });

    it('pads gas by 10% and caps it', async () => {
        const gas: bigint[] = [];
        const capture = deps({ send: async (_a, tx) => (gas.push(tx.gas), { hash: '0x3' as Hex, receipt: { status: 'success' } as never }) });
        await sendAs(randomAddress(4), CALL, { ...capture, estimateGas: async () => 123_457n });
        await sendAs(randomAddress(4), CALL, { ...capture, estimateGas: async () => 2_900_000n });
        expect(gas).toEqual([135_802n, 3_000_000n]);
    });

    it('refuses to send when the relayer balance is low', async () => {
        const send = vi.fn();
        const d = deps({ balanceOf: async () => parseEther('11.9'), send });
        await expect(assertRelayerFunds(0, d)).rejects.toMatchObject({ code: 'relayer_unavailable', status: 503 });
        await expect(sendAs(randomAddress(5), CALL, d)).rejects.toMatchObject({ code: 'relayer_unavailable' });
        expect(send).not.toHaveBeenCalled();
    });

    it('throws on a reverted receipt and never logs a key', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const d = deps({ send: async () => ({ hash: '0x4' as Hex, receipt: { status: 'reverted' } as never }) });
        await expect(sendAs(randomAddress(6), CALL, d)).rejects.toMatchObject({ code: 'tx_reverted' });
        const d2 = deps({ send: async () => { throw new Error('nonce too low'); } });
        await expect(sendAs(randomAddress(6), CALL, d2)).rejects.toThrow();
        const logged = [...spy.mock.calls, ...errSpy.mock.calls].flat().map(String).join(' ').toLowerCase();
        for (const k of KEYS) expect(logged).not.toContain(k.slice(2));
    });
});
