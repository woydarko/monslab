import { keccak256, parseEventLogs, toBytes } from 'viem';
import { game, readGame } from '../server/contracts.ts';
import { ok } from '../server/errors.ts';
import { REDEEMED } from '../server/events.ts';
import { ApiError, withApi } from '../server/http.ts';
import { sendAs } from '../server/relayer.ts';
import { requireSession } from '../server/session.ts';
import { parseJson, redeemCode } from '../server/validate.ts';

interface Drop {
    codeHash: string;
    tokenId: number;
    startsAt: bigint;
    endsAt: bigint;
    maxClaims: number;
    claimed: number;
}

const ZERO_HASH = /^0x0{64}$/;

/**
 * Redeem an event code (ARCHITECTURE §Flow G). The code itself never reaches a log line: only the
 * matched `dropId` and the outcome are logged.
 */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const code = redeemCode(body.code);
    const hash = keccak256(toBytes(code)).toLowerCase();

    const active = await readGame<bigint[]>('activeDropIds');
    if (!active.length) {
        const first = await readGame<Drop>('drops', [0n]).catch(() => null);
        const now = BigInt(Math.floor(Date.now() / 1000));
        throw new ApiError(409, first && BigInt(first.startsAt) > now ? 'drop_not_started' : 'drop_closed');
    }

    for (const dropId of active) {
        const drop = await readGame<Drop>('drops', [dropId]);
        if (String(drop.codeHash).toLowerCase() !== hash || ZERO_HASH.test(String(drop.codeHash))) continue;
        const { hash: txHash, receipt } = await sendAs(player, { ...game(), functionName: 'redeem', args: [player, dropId, code] });
        const [log] = parseEventLogs({ abi: [REDEEMED], eventName: 'Redeemed', logs: receipt.logs, strict: false });
        console.log(JSON.stringify({ level: 'info', route: 'redeem', dropId: String(dropId), ok: true }));
        return ok({ txHash, tokenId: Number(log?.args.tokenId ?? drop.tokenId) });
    }

    throw new ApiError(400, 'invalid_code');
});
