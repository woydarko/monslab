/** Arena ladder (GDD §4.4): tiers 1 to 10, each unlocks the next. The next fight is the focal point. */
import { ARENA, MAX_SLICE_TIER } from '../game/data/arena.ts';
import { backToLab, canFightTier, startArenaBattle } from '../game/actions.ts';
import { buildMonster, scaleMonster } from '../game/sim/monster.ts';
import { getPart } from '../game/data/parts.ts';
import { FAMILIES } from '../game/data/families.ts';
import { FamilyDot, PartIcon, Sheet, useSave } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

export default function ArenaSheet() {
    const s = useSave();
    const next = Math.min(MAX_SLICE_TIER, s.arena.highestTier + 1);
    const wide = useLayout() === 'wide';
    return (
        <Sheet title="Arena" onClose={backToLab} width={920}>
            {/* Desktop: two columns read top to bottom (1 to 5, then 6 to 10). Phone: one scrolling list. */}
            <div className={wide ? 'grid grid-flow-col grid-rows-5 gap-2' : 'flex max-h-[62vh] flex-col gap-2 overflow-y-auto overflow-x-hidden pb-1 pr-1'}>
                {ARENA.filter((t) => t.tier >= 1 && t.tier <= MAX_SLICE_TIER).map((t) => {
                    const open = canFightTier(t.tier);
                    const beaten = s.arena.highestTier >= t.tier;
                    const isNext = t.tier === next && !beaten;
                    const m = scaleMonster(buildMonster(t.parts), t.statMult);
                    return (
                        <button
                            type="button"
                            key={t.tier}
                            disabled={!open}
                            onClick={() => startArenaBattle(t.tier)}
                            className={`btn min-h-[64px] justify-start gap-3 px-3 text-left ${isNext ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            <span className="t-num-lg w-7 text-center">{open ? t.tier : <Icon name="lock" size={22} />}</span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="t-button">{t.name}</span>
                                <span className="t-caption flex items-center gap-1.5 opacity-90">
                                    <span
                                        className="flex gap-0.5"
                                        role="img"
                                        aria-label={`Families: ${t.parts.map((p) => FAMILIES[getPart(p).family].name).join(', ')}`}
                                        title={t.parts.map((p) => FAMILIES[getPart(p).family].name).join(' / ')}
                                    >
                                        {t.parts.map((p) => (
                                            <FamilyDot key={p} family={getPart(p).family} size={8} />
                                        ))}
                                    </span>
                                    HP {m.stats.hp} · ATK {m.stats.atk} · SPD {m.stats.spd}
                                </span>
                            </span>
                            {/* What you'll fight: the opponent's actual parts. */}
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
            <p className="t-caption pt-3 text-center text-muted">Clear tier {MAX_SLICE_TIER} for a bonus egg that always hatches epic.</p>
        </Sheet>
    );
}
