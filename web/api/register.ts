import { keccak256, toBytes } from 'viem';
import { codeToBytes6, playerCodeCandidates } from '../server/code.ts';
import { game, readGame, readMe } from '../server/contracts.ts';
import { ok } from '../server/errors.ts';
import { ApiError, withApi } from '../server/http.ts';
import { sendAs } from '../server/relayer.ts';
import { requireSession } from '../server/session.ts';
import type { Hex } from '../server/types.ts';
import { parseJson, username } from '../server/validate.ts';

const ZERO = '0x0000000000000000000000000000000000000000';

/** Mint a lab: unique username, first free player code, starter parts and one egg (contract side). */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const name = username(body.username);

    const owner = await readGame<Hex>('usernameOwner', [keccak256(toBytes(name))]);
    if (owner.toLowerCase() !== ZERO) throw new ApiError(409, 'username_taken');

    for (const code of playerCodeCandidates(player)) {
        const bytes6 = codeToBytes6(code);
        if ((await readGame<Hex>('codeOwner', [bytes6])).toLowerCase() !== ZERO) continue;
        const { hash } = await sendAs(player, { ...game(), functionName: 'register', args: [player, name, bytes6] });
        return ok({ txHash: hash, me: await readMe(player) });
    }
    // Every window collided: the player can retry, a later block almost certainly frees a code.
    throw new ApiError(409, 'code_taken');
});
