import { createPublicClient, fallback, http, webSocket, type PublicClient } from 'viem';
import { monadTestnet } from 'viem/chains';

export const chain = monadTestnet;
if (chain.id !== 10143) throw new Error('wrong chain');

const env = import.meta.env;
const rpc = [env.VITE_RPC_URL, env.VITE_RPC_URL_FALLBACK].filter(Boolean).map((u) => http(u, { batch: true }));

export const publicClient: PublicClient = createPublicClient({
    chain,
    transport: rpc.length ? fallback(rpc) : http(undefined, { batch: true }),
    batch: { multicall: true },
});

export const wsClient: PublicClient | null = env.VITE_WS_URL
    ? createPublicClient({ chain, transport: webSocket(env.VITE_WS_URL) })
    : null;

export const EXPLORER: string = (env.VITE_EXPLORER_URL || chain.blockExplorers.default.url).replace(/\/$/, '');

export function txUrl(hash: string): string {
    return /^0x[0-9a-fA-F]{64}$/.test(hash) ? `${EXPLORER}/tx/${hash}` : '';
}
