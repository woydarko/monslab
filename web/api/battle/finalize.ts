import { refinalize } from '../../server/battle.ts';
import { ok } from '../../server/errors.ts';
import { withApi } from '../../server/http.ts';
import { requireSession } from '../../server/session.ts';
import { parseJson, ValidationError } from '../../server/validate.ts';

const UINT = /^[0-9]{1,78}$/;

/** Retry a finalize that came back `finalize_pending`. The contract rejects duplicates (409 already_finalized). */
export const POST = withApi(async (request) => {
    requireSession(request);
    const body = await parseJson(request);
    const raw = typeof body.battleId === 'number' ? String(body.battleId) : body.battleId;
    if (typeof raw !== 'string' || !UINT.test(raw)) throw new ValidationError('invalid_request');
    return ok(await refinalize(BigInt(raw)));
});
