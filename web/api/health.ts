import { game, publicClient } from '../server/contracts.ts';
import { ok } from '../server/errors.ts';
import { withApi } from '../server/http.ts';
import { relayerBalances } from '../server/relayer.ts';
import type { HealthView } from '../server/types.ts';

const SOURCES = ['entropy', 'backend'];

export const GET = withApi(async () => {
    const pc = publicClient();
    const [chainId, block, simVersion, source, relayers] = await Promise.all([
        pc.getChainId(),
        pc.getBlockNumber(),
        pc.readContract({ ...game(), functionName: 'simVersion' }) as Promise<number>,
        pc.readContract({ ...game(), functionName: 'randomSource' }) as Promise<number>,
        relayerBalances(),
    ]);
    const view: HealthView = { chainId, block: String(block), simVersion: Number(simVersion), relayers, randomSource: SOURCES[Number(source)] ?? 'unknown' };
    return ok(view);
});
