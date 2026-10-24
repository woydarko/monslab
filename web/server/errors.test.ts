import { afterEach, describe, expect, it } from 'vitest';
import { fail, mapRevert, ok } from './errors.ts';
import { getEnv } from './env.ts';

describe('errors', () => {
    it('builds the error body with user copy', async () => {
        const r = fail(409, 'username_taken');
        expect(r.status).toBe(409);
        expect(await r.json()).toEqual({ error: { code: 'username_taken', message: 'That name is taken. Try another one.' } });
        expect(await fail(500, 'whatever').json()).toEqual({ error: { code: 'whatever', message: 'Something went wrong. Try again.' } });
        expect(await ok({ a: 1 }).json()).toEqual({ a: 1 });
    });

    it('maps contract reverts through the viem cause chain', () => {
        const err = { name: 'ContractFunctionExecutionError', cause: { name: 'ContractFunctionRevertedError', data: { errorName: 'TargetTaken', args: ['0xP1'] } } };
        expect(mapRevert(err)).toEqual({ status: 409, code: 'target_taken', details: { lockedBy: '0xP1' } });
        expect(mapRevert({ cause: { data: { errorName: 'UsernameTaken' } } })).toEqual({ status: 409, code: 'username_taken' });
        expect(mapRevert({ name: 'HttpRequestError' })).toEqual({ status: 503, code: 'network' });
        expect(mapRevert(new Error('boom'))).toEqual({ status: 500, code: 'internal' });
    });
});

describe('env', () => {
    const saved = { ...process.env };
    afterEach(() => { process.env = { ...saved }; });

    it('lists every missing name and never a value', () => {
        for (const k of Object.keys(process.env)) if (/RPC|RELAYER|SESSION|ADDRESS|SECRET/.test(k)) delete process.env[k];
        process.env.RPC_URL = 'https://secret-rpc.example/key123';
        let msg = '';
        try { getEnv(); } catch (e) { msg = (e as Error).message; }
        expect(msg).toContain('RELAYER_PRIVATE_KEYS');
        expect(msg).toContain('SESSION_SECRET');
        expect(msg).not.toContain('secret-rpc');
    });

    it('rejects malformed keys without echoing them', () => {
        Object.assign(process.env, {
            RPC_URL: 'http://rpc', RELAYER_PRIVATE_KEYS: '0xdeadbeef', SESSION_SECRET: 's'.repeat(32),
            GAME_ADDRESS: '0x' + '1'.repeat(40), PARTS_ADDRESS: '0x' + '2'.repeat(40), COMMUNITY_ADDRESS: '0x' + '3'.repeat(40), ENTROPY_ADDRESS: '0x' + '4'.repeat(40),
        });
        let msg = '';
        try { getEnv(); } catch (e) { msg = (e as Error).message; }
        expect(msg).toBe('invalid_env: RELAYER_PRIVATE_KEYS');
        process.env.RELAYER_PRIVATE_KEYS = `0x${'a'.repeat(64)}, 0x${'b'.repeat(64)}`;
        expect(getEnv().relayerKeys).toHaveLength(2);
    });
});
