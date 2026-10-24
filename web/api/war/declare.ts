import { parseEventLogs } from 'viem';
import { community } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { WAR_DECLARED } from '../../server/events.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { communityId, parseJson } from '../../server/validate.ts';

/** Declare war on another community (leader only; the target has the accept window to answer). */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const target = communityId(body.targetCommunityId);
    const { hash, receipt } = await sendAs(player, { ...community(), functionName: 'declareWar', args: [player, target] });
    const [log] = parseEventLogs({ abi: [WAR_DECLARED], eventName: 'WarDeclared', logs: receipt.logs, strict: false });
    if (!log) throw new ApiError(500, 'internal');
    return ok({ txHash: hash, warId: Number(log.args.warId) });
});
