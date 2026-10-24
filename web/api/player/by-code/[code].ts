import { readGame } from '../../../server/contracts.ts';
import { ok } from '../../../server/errors.ts';
import { ApiError, withApi } from '../../../server/http.ts';
import type { Hex, PlayerLookup } from '../../../server/types.ts';
import { playerCode } from '../../../server/validate.ts';
import { unpackLoadout } from '../../../src/game/data/tokenIds.ts';

const ZERO = '0x0000000000000000000000000000000000000000';

interface PlayerStruct {
    username: string;
    brain: number;
    loadout: bigint;
}

/** Public lab lookup for PvP: code → address, username, brain, equipped parts. */
export const GET = withApi(async (request) => {
    const url = new URL(request.url);
    const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const raw = last && last.toLowerCase() !== 'by-code' ? last : (url.searchParams.get('code') ?? '');

    const { bytes6 } = playerCode(raw);
    const owner = (await readGame<Hex>('codeOwner', [bytes6])).toLowerCase() as Hex;
    if (owner === ZERO) throw new ApiError(404, 'player_not_found');

    const p = await readGame<PlayerStruct>('getPlayer', [owner as Hex]);
    return ok({ address: owner, username: p.username, brain: Number(p.brain), loadout: unpackLoadout(BigInt(p.loadout)) } satisfies PlayerLookup);
});
