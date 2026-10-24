import type { ApiErrorBody, BattleRequest, BattleView, MeView } from '../../server/types.ts';

type Hex = `0x${string}`;
type Loadout = { head: number; body: number; legs: number; acc: number };

export class ApiError extends Error {
    constructor(public code: string, public status: number, message = code, public details?: Record<string, unknown>) {
        super(message);
        this.name = 'ApiError';
    }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`/api${path}`, {
            method,
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError('network', 0);
    }
    const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
    if (res.ok && data) return data;
    const e = data?.error;
    if (e?.code) throw new ApiError(e.code, res.status, e.message, e.details);
    throw new ApiError('network', res.status);
}

const get = <T>(path: string) => call<T>('GET', path);
const post = <T>(path: string, body: unknown = {}) => call<T>('POST', path, body);
const q = encodeURIComponent;

export const api = {
    nonce: (address: Hex) => get<{ nonce: string; message: string }>(`/auth/nonce?address=${q(address)}`),
    verify: (address: Hex, message: string, signature: Hex) => post<{ ok: true }>('/auth/verify', { address, message, signature }),
    logout: () => post<{ ok: true }>('/auth/logout'),
    me: () => get<MeView>('/me'),
    register: (username: string) => post<{ txHash: Hex; me: MeView }>('/register', { username }),
    setLoadout: (l: Loadout) => post<{ txHash: Hex; loadout: Loadout }>('/loadout', l),
    buyEgg: (count: number) => post<{ txHash: Hex; eggs: number; gloo: number }>('/egg/buy', { count }),
    openEgg: (eggType: 'normal' | 'rare') => post<{ txHash: Hex; sequence: string }>('/egg/open', { eggType }),
    eggStatus: (sequence: string) =>
        get<{ status: 'pending' | 'hatched'; tokenId?: number; rarity?: number; txHash?: Hex }>(`/egg/status?sequence=${q(sequence)}`),
    playerByCode: (code: string) => get<{ address: Hex; username: string; brain: number; loadout: Loadout }>(`/player/by-code/${q(code)}`),
    battle: (body: BattleRequest) => post<BattleView>('/battle', body),
    finalizeBattle: (battleId: string) => post<BattleView>('/battle/finalize', { battleId }),
    createCommunity: (name: string) => post<{ txHash: Hex; communityId: number }>('/community/create', { name }),
    joinCommunity: (communityId: number) => post<{ txHash: Hex }>('/community/join', { communityId }),
    leaveCommunity: () => post<{ txHash: Hex }>('/community/leave'),
    claimWeekly: (week: number, task: number, tier: number) =>
        post<{ txHash: Hex; rewards: Record<string, unknown> }>('/community/claim', { week, task, tier }),
    declareWar: (targetCommunityId: number) => post<{ txHash: Hex; warId: number }>('/war/declare', { targetCommunityId }),
    acceptWar: (warId: number) => post<{ txHash: Hex; endsAt: number }>('/war/accept', { warId }),
    lockTarget: (warId: number, targetIdx: number) => post<{ txHash: Hex; lockedUntil: number }>('/war/lock', { warId, targetIdx }),
    settleWar: (warId: number) => post<{ txHash: Hex; winnerCid: number }>('/war/settle', { warId }),
    claimWar: (warId: number) => post<{ txHash: Hex }>('/war/claim', { warId }),
    redeem: (code: string) => post<{ txHash: Hex; tokenId: number }>('/redeem', { code }),
    health: () => get<{ chainId: number; block: string; simVersion: number; relayers: { address: string; balanceMon: string }[]; randomSource: string }>('/health'),
};
