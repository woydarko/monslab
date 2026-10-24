import { game } from '../server/contracts.ts';
import { ok } from '../server/errors.ts';
import { withApi } from '../server/http.ts';
import { sendAs } from '../server/relayer.ts';
import { requireSession } from '../server/session.ts';
import type { Loadout } from '../server/types.ts';
import { parseJson, uint } from '../server/validate.ts';

const SLOT = 65_535;

/** Equip four token ids; the contract checks ownership and slot match. */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const loadout: Loadout = { head: uint(body.head, SLOT), body: uint(body.body, SLOT), legs: uint(body.legs, SLOT), acc: uint(body.acc, SLOT) };
    const { hash } = await sendAs(player, { ...game(), functionName: 'setLoadout', args: [player, loadout.head, loadout.body, loadout.legs, loadout.acc] });
    return ok({ txHash: hash, loadout });
});
