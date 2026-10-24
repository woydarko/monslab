import { parseEventLogs } from 'viem';
import { game, readGame } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { EGG_REQUESTED, argsOf } from '../../server/events.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { eggType, parseJson } from '../../server/validate.ts';

/** Burn one egg: pay the Entropy fee and return the request sequence the client watches. */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const type = eggType(body.eggType);
    const fee = await readGame<bigint>('entropyFee');
    const { hash, receipt } = await sendAs(player, { ...game(), functionName: 'openEgg', args: [player, type], value: fee });
    const [log] = parseEventLogs({ abi: [EGG_REQUESTED], eventName: 'EggRequested', logs: receipt.logs, strict: false });
    if (!log) throw new ApiError(500, 'internal');
    return ok({ txHash: hash, sequence: String(argsOf<{ sequence: bigint }>(log).sequence) });
});
