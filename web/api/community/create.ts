import { parseEventLogs } from 'viem';
import { community } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { COMMUNITY_CREATED } from '../../server/events.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { communityName, parseJson } from '../../server/validate.ts';

/** Found a community: the creator becomes the leader (max 30 members, one community per player). */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const name = communityName(body.name);
    const { hash, receipt } = await sendAs(player, { ...community(), functionName: 'create', args: [player, name] });
    const [log] = parseEventLogs({ abi: [COMMUNITY_CREATED], eventName: 'CommunityCreated', logs: receipt.logs, strict: false });
    if (!log) throw new ApiError(500, 'internal');
    return ok({ txHash: hash, communityId: Number(log.args.cid) });
});
