import { community } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { parseJson, uint } from '../../server/validate.ts';

/** Claim the winner reward (War Orb + eggs) once per settled war. */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const warId = uint(body.warId);
    const { hash } = await sendAs(player, { ...community(), functionName: 'claimWarReward', args: [player, warId] });
    return ok({ txHash: hash });
});
