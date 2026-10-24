import { community } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { communityId, parseJson } from '../../server/validate.ts';

/** Join a community (cooldown after leaving, capacity and one-community rules live in the contract). */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const cid = communityId(body.communityId);
    const { hash } = await sendAs(player, { ...community(), functionName: 'join', args: [player, cid] });
    return ok({ txHash: hash });
});
