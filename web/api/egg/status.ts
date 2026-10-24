import { findHatched, readGame } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { ApiError, withApi } from '../../server/http.ts';
import type { EggStatus, Hex } from '../../server/types.ts';
import { ValidationError } from '../../server/validate.ts';

const SEQUENCE = /^[0-9]{1,20}$/;

/** Poll one Entropy request: hatched (with the part) or still waiting for the callback. */
export const GET = withApi(async (request) => {
    const raw = new URL(request.url).searchParams.get('sequence') ?? '';
    if (!SEQUENCE.test(raw)) throw new ValidationError('invalid_request');
    const sequence = BigInt(raw);

    const hatched = await findHatched(sequence);
    if (hatched) return ok({ status: 'hatched', tokenId: hatched.tokenId, rarity: hatched.rarity, txHash: hatched.txHash } satisfies EggStatus);

    const pending = await readGame<{ player: Hex }>('pendingEgg', [sequence]);
    if (BigInt(pending.player) !== 0n) return ok({ status: 'pending' } satisfies EggStatus);
    throw new ApiError(404, 'egg_not_found');
});
