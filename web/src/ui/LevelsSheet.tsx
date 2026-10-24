/**
 * S-06 Levels (F-06): the PvE ladder, 0 to 10. Tier n+1 unlocks after a win on
 * tier n (`me.highestTier`); the reward is `10 + 5 × tier` Gloo, capped per WIB
 * day. Each row is the Fight button, so a double click can't start two battles
 * (`useAction('fight')` is single-flight).
 */
import { ARENA } from '../game/data/arena.ts';
import { getPart } from '../game/data/parts.ts';
import { FAMILIES } from '../game/data/families.ts';
import { backToLab, fightLevel } from '../game/actions.ts';
import { useStore } from '../state/store.ts';
import { partElements } from './elements.ts';
import ElementChip from './ElementChip.tsx';
import { FamilyDot, PartIcon, Sheet } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';
import { useAction } from './useAction.ts';

const GLOO_PER_TIER = (tier: number) => 10 + 5 * tier;

export default function LevelsSheet() {
    const me = useStore((s) => s.me);
    const wide = useLayout() === 'wide';
    const { run, pending, error } = useAction('fight', 'Fight');

    if (!me) {
        return (
            <Sheet title="Levels" onClose={backToLab}>
                <div className="flex items-center gap-2 py-4" role="status" aria-live="polite">
                    <span className="tx-spin" aria-hidden />
                    <span className="t-body text-muted">Loading levels…</span>
                </div>
            </Sheet>
        );
    }

    const glooToday = me.limits?.glooToday ?? 0;
    const cap = me.limits?.glooCap ?? 300;

    return (
        <Sheet title="Levels" onClose={backToLab} width={920}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="t-caption text-muted">{ARENA.length} levels. Win one to unlock the next.</span>
                <span className="chip px-2.5" aria-label={`Gloo today ${glooToday} of ${cap}`}>
                    <span className="t-caption text-muted">Gloo today</span>
                    <span className="t-num">
                        {glooToday}/{cap}
                    </span>
                </span>
            </div>

            {error && (
                <p className="t-caption mb-2 flex items-center gap-2 text-danger" role="alert">
                    <Icon name="close" size={16} />
                    {error}
                </p>
            )}

            <div className={wide ? 'grid grid-flow-col grid-rows-6 gap-2' : 'flex max-h-[62vh] flex-col gap-2 overflow-y-auto overflow-x-hidden pb-1 pr-1'}>
                {ARENA.map((t) => {
                    const open = t.tier <= me.highestTier;
                    const beaten = t.tier < me.highestTier;
                    const isNext = t.tier === me.highestTier && !beaten;
                    const els = partElements(t.parts[0]);
                    return (
                        <button
                            type="button"
                            key={t.tier}
                            disabled={!open || pending}
                            aria-label={`Fight tier ${t.tier} ${t.name}, plus ${GLOO_PER_TIER(t.tier)} Gloo`}
                            onClick={() => void run(() => fightLevel(t.tier))}
                            className={`btn min-h-[64px] justify-start gap-3 px-3 text-left ${open ? (isNext ? 'btn-primary' : 'btn-secondary') : 'btn-secondary opacity-60'}`}
                        >
                            <span className="t-num-lg w-7 text-center">{open ? t.tier : <Icon name="lock" size={22} />}</span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="t-button">{t.name}</span>
                                <span className="t-caption flex flex-wrap items-center gap-x-2 gap-y-1 opacity-90">
                                    <span
                                        className="flex gap-0.5"
                                        role="img"
                                        aria-label={`Families: ${t.parts.map((p) => FAMILIES[getPart(p).family].name).join(', ')}`}
                                    >
                                        {t.parts.map((p) => (
                                            <FamilyDot key={p} family={getPart(p).family} size={8} />
                                        ))}
                                    </span>
                                    <span className="text-primary">+{GLOO_PER_TIER(t.tier)} Gloo</span>
                                    {els?.map((el) => <ElementChip key={el} el={el} />)}
                                </span>
                            </span>
                            <span className="flex shrink-0 -space-x-1" aria-hidden>
                                {t.parts.map((p) => (
                                    <PartIcon key={p} id={p} size={40} />
                                ))}
                            </span>
                            {beaten && <Icon name="check" className="text-primary" />}
                            {isNext && <Icon name="next" />}
                        </button>
                    );
                })}
            </div>
            <p className="t-caption pt-3 text-center text-muted">
                {pending ? 'Starting the battle…' : `Gloo is capped at ${cap} a day. Every fight is recorded on Monad.`}
            </p>
        </Sheet>
    );
}
