import { runBattle } from '../server/battle.ts';
import { ok } from '../server/errors.ts';
import { withApi } from '../server/http.ts';
import { requireSession } from '../server/session.ts';
import { battleRequest, parseJson } from '../server/validate.ts';

/** Start a battle: pre-checks → start tx → server sim → finalize tx (ARCHITECTURE §Flow D). */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    return ok(await runBattle(player, battleRequest(body)));
});
