import { parseEventLogs } from 'viem';
import { community, readGame } from '../../server/contracts.ts';
import { mapRevert, ok } from '../../server/errors.ts';
import { TARGET_LOCKED, argsOf } from '../../server/events.ts';
import { ApiError, withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import type { Hex } from '../../server/types.ts';
import { parseJson, uint } from '../../server/validate.ts';

/** Lock one of the enemy team's five targets for the lock window (ARCHITECTURE §Flow E). */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const warId = uint(body.warId);
    const targetIdx = uint(body.targetIdx, 4);

    try {
        const { hash, receipt } = await sendAs(player, { ...community(), functionName: 'lockTarget', args: [player, warId, targetIdx] });
        const [log] = parseEventLogs({ abi: [TARGET_LOCKED], eventName: 'TargetLocked', logs: receipt.logs, strict: false });
        if (!log) throw new ApiError(500, 'internal');
        return ok({ txHash: hash, lockedUntil: Number(argsOf<{ lockedUntil: bigint }>(log).lockedUntil) });
    } catch (err) {
        const mapped = mapRevert(err);
        // Two attackers raced for the same target: tell the loser who got it, by username.
        if (mapped.code === 'target_taken' && typeof mapped.details?.lockedBy === 'string') {
            const holder = mapped.details.lockedBy as Hex;
            const p = await readGame<{ username: string }>('getPlayer', [holder]).catch(() => null);
            throw new ApiError(409, 'target_taken', { lockedBy: holder, lockedByName: p?.username ?? undefined });
        }
        throw err;
    }
});
