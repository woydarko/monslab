import { community, readCommunity } from '../../server/contracts.ts';
import { ok } from '../../server/errors.ts';
import { withApi } from '../../server/http.ts';
import { sendAs } from '../../server/relayer.ts';
import { requireSession } from '../../server/session.ts';
import type { Hex } from '../../server/types.ts';
import { parseJson, week as weekOf, weeklyTask, weeklyTier } from '../../server/validate.ts';

/** F-10 rewards: bronze/silver = 1 normal egg, gold = 1 rare egg (+ the community accessory once per week). */
export function rewardsFor(tier: 0 | 1 | 2) {
    return { eggs: tier === 2 ? 0 : 1, rareEggs: tier === 2 ? 1 : 0 };
}

/** Claim a weekly task tier; the contract checks progress, contribution and double claims. */
export const POST = withApi(async (request) => {
    const player = requireSession(request);
    const body = await parseJson(request);
    const week = weekOf(body.week);
    const task = weeklyTask(body.task);
    const tier = weeklyTier(body.tier);

    const { hash } = await sendAs(player, { ...community(), functionName: 'claimWeekly', args: [player, week, task, tier] });

    const { eggs, rareEggs } = rewardsFor(tier);
    // The accessory is capped at one per player per week across both tasks, so trust the chain, not the tier.
    const accessory = tier === 2 && (await readCommunity<boolean>('accessoryClaimed', [week, player]).catch(() => true)) ? 202 : null;
    return ok({ txHash: hash as Hex, rewards: { eggs, rareEggs, accessory } });
});
