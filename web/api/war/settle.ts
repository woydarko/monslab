import { parseEventLogs } from 'viem';
import { community } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { WAR_SETTLED } from '../../server/events.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { parseJson, uint } from '../../server/validate.ts';

/**
 * Settle a finished war. `settleWar` is public in the contract (any wallet may call it), so we only need a
 * signed-in player to pick a relayer key and to keep the write surface authenticated.
 */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const warId = uint(body.warId);
    const { hash, receipt } = await sendAs(player, { ...community(), functionName: 'settleWar', args: [warId] });
    const [log] = parseEventLogs({ abi: [WAR_SETTLED], eventName: 'WarSettled', logs: receipt.logs, strict: false });
    if (!log) throw new ApiError(500, 'internal');
    return ok({ txHash: hash, winnerCid: Number(log.args.winnerCid) });
});
