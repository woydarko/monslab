import { beforeEach, describe, expect, it, vi } from 'vitest';
import { codeToBytes6, playerCodeCandidates } from '../server/code.ts';
import { authed, errorCode, GAME, OTHER, PLAYER, ZERO } from './testing.ts';

const mocks = vi.hoisted(() => ({ sendAs: vi.fn(), readGame: vi.fn(), readMe: vi.fn() }));

vi.mock('../server/relayer.ts', () => ({ sendAs: mocks.sendAs }));
vi.mock('../server/contracts.ts', () => ({ game: () => ({ address: GAME, abi: [] }), readGame: mocks.readGame, readMe: mocks.readMe }));

const { POST: registerPOST } = await import('./register.ts');

function revertedTo(errorName: string) {
    return Promise.reject(Object.assign(new Error(`reverted: ${errorName}`), { data: { errorName } }));
}

describe('POST /api/register', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.readMe.mockResolvedValue({ address: PLAYER, registered: true, username: 'nabil_1' });
        mocks.sendAs.mockResolvedValue({ hash: `0x${'ab'.repeat(32)}`, receipt: { status: 'success', logs: [] } });
    });

    it('requires a session', async () => {
        const res = await registerPOST(new Request('http://x/api/register', { method: 'POST', body: '{"username":"nabil_1"}' }));
        expect(res.status).toBe(401);
        expect(await errorCode(res)).toBe('unauthenticated');
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('registers with the lowercase username and the first free code', async () => {
        const [first] = playerCodeCandidates(PLAYER);
        mocks.readGame.mockResolvedValue(ZERO);

        const res = await registerPOST(authed('/api/register', { username: 'Nabil_1' }));

        expect(res.status).toBe(200);
        const body = (await res.json()) as { txHash: string; me: unknown };
        expect(body.txHash).toBe(`0x${'ab'.repeat(32)}`);
        expect(body.me).toEqual({ address: PLAYER, registered: true, username: 'nabil_1' });
        expect(mocks.sendAs).toHaveBeenCalledTimes(1);
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'register', args: [PLAYER, 'nabil_1', codeToBytes6(first)] });
    });

    it('shifts the code window when the first candidate is taken', async () => {
        const [first, second] = playerCodeCandidates(PLAYER);
        mocks.readGame.mockImplementation(async (fn: string, args: readonly unknown[]) => {
            if (fn === 'usernameOwner') return ZERO;
            if (fn === 'codeOwner') return args[0] === codeToBytes6(first) ? OTHER : ZERO;
            throw new Error(`unexpected read ${fn}`);
        });

        const res = await registerPOST(authed('/api/register', { username: 'nabil_1' }));

        expect(res.status).toBe(200);
        expect(mocks.sendAs).toHaveBeenCalledTimes(1);
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ args: [PLAYER, 'nabil_1', codeToBytes6(second)] });
    });

    it('rejects a username the contract would reject', async () => {
        const res = await registerPOST(authed('/api/register', { username: 'Ab' }));
        expect(res.status).toBe(400);
        expect(await errorCode(res)).toBe('invalid_username');
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('pre-checks the username and reports it as taken', async () => {
        mocks.readGame.mockResolvedValue(OTHER);
        const res = await registerPOST(authed('/api/register', { username: 'nabil_1' }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('username_taken');
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('maps a UsernameTaken revert from the contract', async () => {
        mocks.readGame.mockResolvedValue(ZERO);
        mocks.sendAs.mockImplementation(() => revertedTo('UsernameTaken'));
        const res = await registerPOST(authed('/api/register', { username: 'nabil_1' }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('username_taken');
    });

    it('ignores an address in the body: the player comes from the session', async () => {
        mocks.readGame.mockResolvedValue(ZERO);
        const res = await registerPOST(authed('/api/register', { username: 'nabil_1', player: OTHER }));
        expect(res.status).toBe(200);
        expect(mocks.sendAs.mock.calls[0][0]).toBe(PLAYER);
        expect(mocks.sendAs.mock.calls[0][1].args[0]).toBe(PLAYER);
    });
});

describe('POST /api/loadout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendAs.mockResolvedValue({ hash: `0x${'cd'.repeat(32)}`, receipt: { status: 'success', logs: [] } });
    });

    it('saves the loadout for the session player', async () => {
        const loadout = { head: 1, body: 102, legs: 3, acc: 201 };
        const res = await loadoutPOST(authed('/api/loadout', loadout));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: `0x${'cd'.repeat(32)}`, loadout });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'setLoadout', args: [PLAYER, 1, 102, 3, 201] });
    });

    it('rejects negative or non-integer slots', async () => {
        for (const body of [{ head: -1, body: 1, legs: 2, acc: 0 }, { head: 1.5, body: 1, legs: 2, acc: 0 }, { head: 1, body: 1 }]) {
            const res = await loadoutPOST(authed('/api/loadout', body));
            expect(res.status).toBe(400);
            expect(mocks.sendAs).not.toHaveBeenCalled();
            vi.clearAllMocks();
        }
    });
});

describe('GET /api/player/by-code/:code', () => {
    it('looks up a player by their code', async () => {
        mocks.readGame.mockImplementation(async (fn: string) => {
            if (fn === 'codeOwner') return OTHER;
            if (fn === 'getPlayer') return { username: 'friend', brain: 120, loadout: (1n << 48n) | (2n << 32n) | (3n << 16n) | 201n };
            throw new Error(`unexpected read ${fn}`);
        });
        const res = await lookupGET(new Request('http://x/api/player/by-code/MONS-AB12CD'));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ address: OTHER, username: 'friend', brain: 120, loadout: { head: 1, body: 2, legs: 3, acc: 201 } });
    });

    it('404s an unknown code and 400s a malformed one', async () => {
        mocks.readGame.mockResolvedValue(ZERO);
        const missing = await lookupGET(new Request('http://x/api/player/by-code/MONS-AB12CD'));
        expect(missing.status).toBe(404);
        expect(await errorCode(missing)).toBe('player_not_found');

        const bad = await lookupGET(new Request('http://x/api/player/by-code/MONS-AB12C'));
        expect(bad.status).toBe(400);
        expect(await errorCode(bad)).toBe('bad_code_format');
    });
});

const loadoutPOST = (request: Request) => import('./loadout.ts').then((m) => m.POST(request));
const lookupGET = (request: Request) => import('./player/by-code/[code].ts').then((m) => m.GET(request));
