import { parseEventLogs } from 'viem';
import { community } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { WAR_ACCEPTED } from '../../server/events.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { communityId, parseJson } from '../../server/validate.ts';

/** Accept a declared war: the contract locks both teams and their loadouts. */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const warId = communityId(body.warId);
    const { hash, receipt } = await sendAs(player, { ...community(), functionName: 'acceptWar', args: [player, warId] });
    const [log] = parseEventLogs({ abi: [WAR_ACCEPTED], eventName: 'WarAccepted', logs: receipt.logs, strict: false });
    if (!log) throw new ApiError(500, 'internal');
    return ok({ txHash: hash, endsAt: Number(log.args.endsAt) });
});
