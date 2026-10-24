import { game, readGame } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import { eggCount, parseJson } from '../../server/validate.ts';

interface PlayerBalances {
    eggs: number;
    gloo: bigint;
}

/** Buy 1–10 eggs with Gloo; returns the balances after the tx. */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const count = eggCount(body.count);
    const { hash } = await sendAs(player, { ...game(), functionName: 'buyEgg', args: [player, count] });
    const fresh = await readGame<PlayerBalances>('getPlayer', [player]);
    return ok({ txHash: hash, eggs: Number(fresh.eggs), gloo: Number(fresh.gloo) });
});
