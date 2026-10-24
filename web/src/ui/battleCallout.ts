/**
 * Battle callouts (F-16): "Super effective!" when the element clash scores +2
 * or better, "Resisted" at -2 or worse (DESIGN_SYSTEM §Element system).
 * Pure, so the thresholds are pinned by a test; the tone picks the token.
 */
import type { BattleEvent } from '../game/sim/battle.ts';

export type CalloutTone = 'primary' | 'muted';

export interface Callout {
    text: string;
    tone: CalloutTone;
}

export const SUPER_EFFECTIVE = 'Super effective!';
export const RESISTED = 'Resisted';

export function clashCallout(score: number | null | undefined): Callout | null {
    if (typeof score !== 'number' || !Number.isFinite(score)) return null;
    if (score >= 2) return { text: SUPER_EFFECTIVE, tone: 'primary' };
    if (score <= -2) return { text: RESISTED, tone: 'muted' };
    return null;
}

/**
 * The battle scene reports one `hp` event per HP change, in the order it plays
 * the events. This builds the matching list of callouts so the UI can pop the
 * right one on the right hit (entries are `null` for beats with no callout).
 */
export function calloutPlan(events: readonly BattleEvent[]): Array<Callout | null> {
    const plan: Array<Callout | null> = [];
    for (const e of events) {
        if (e.type === 'attack') {
            const clash = (e as unknown as { clash?: number }).clash;
            plan.push(clashCallout(clash));
            // A draining hit reports the attacker's HP a second time.
            if (e.heal > 0) plan.push(null);
        } else if (e.type === 'regen' || e.type === 'poison' || e.type === 'revive') {
            plan.push(null);
        }
    }
    return plan;
}
