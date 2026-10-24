import { community } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';

/** Leave the current community (the leader can only leave alone — the contract disbands it then). */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const { hash } = await sendAs(player, { ...community(), functionName: 'leave', args: [player] });
    return ok({ txHash: hash });
});
