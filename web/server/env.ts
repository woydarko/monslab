/** Server env. Errors name the variables, never their values. */
import type { Hex } from './types.ts';

export interface ServerEnv {
    rpcUrl: string;
    rpcUrlFallback?: string;
    relayerKeys: Hex[];
    sessionSecret: string;
    game: Hex;
    parts: Hex;
    community: Hex;
    entropy: Hex;
    backendRandomSecret?: string;
    deployBlock: bigint;
}

const REQUIRED = ['RPC_URL', 'RELAYER_PRIVATE_KEYS', 'SESSION_SECRET', 'GAME_ADDRESS', 'PARTS_ADDRESS', 'COMMUNITY_ADDRESS', 'ENTROPY_ADDRESS'] as const;
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const KEY = /^0x[0-9a-fA-F]{64}$/;

export function getEnv(): ServerEnv {
    const e = process.env;
    const missing = REQUIRED.filter((k) => !e[k]?.trim());
    if (missing.length) throw new Error(`missing_env: ${missing.join(', ')}`);
    const keys = e.RELAYER_PRIVATE_KEYS!.split(',').map((k) => k.trim()).filter(Boolean);
    const invalid: string[] = [];
    if (!keys.length || !keys.every((k) => KEY.test(k))) invalid.push('RELAYER_PRIVATE_KEYS');
    if (e.SESSION_SECRET!.length < 32) invalid.push('SESSION_SECRET');
    for (const k of ['GAME_ADDRESS', 'PARTS_ADDRESS', 'COMMUNITY_ADDRESS', 'ENTROPY_ADDRESS'] as const) if (!ADDR.test(e[k]!.trim())) invalid.push(k);
    if (invalid.length) throw new Error(`invalid_env: ${invalid.join(', ')}`);
    return {
        rpcUrl: e.RPC_URL!.trim(),
        rpcUrlFallback: e.RPC_URL_FALLBACK?.trim() || undefined,
        relayerKeys: keys as Hex[],
        sessionSecret: e.SESSION_SECRET!,
        game: e.GAME_ADDRESS!.trim() as Hex,
        parts: e.PARTS_ADDRESS!.trim() as Hex,
        community: e.COMMUNITY_ADDRESS!.trim() as Hex,
        entropy: e.ENTROPY_ADDRESS!.trim() as Hex,
        backendRandomSecret: e.BACKEND_RANDOM_SECRET || undefined,
        deployBlock: BigInt(e.DEPLOY_BLOCK || e.VITE_DEPLOY_BLOCK || 0),
    };
}
