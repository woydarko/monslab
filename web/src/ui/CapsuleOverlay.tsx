/** Capsule reveal (GDD §4.2, §22.4): tap 3 times to crack, then the part card. */
import { useStore } from '../state/store.ts';
import { finishCapsule, tapCapsule } from '../game/actions.ts';
import { getPart, TRAIT_INFO } from '../game/data/parts.ts';
import { FAMILIES, RARITY_COLOR } from '../game/data/families.ts';
import { ATTACK_TEXT, FamilyDot, GooIcon, PartIcon, specialText, useSave } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

const RARITY_NAME = { common: 'Common', rare: 'Rare', epic: 'Epic' } as const;
const SLOT_NAME = { head: 'Head', body: 'Body', legs: 'Legs' } as const;

export default function CapsuleOverlay() {
    const c = useStore((s) => s.capsule);
    const s = useSave();
    const wide = useLayout() === 'wide';
    if (!c) return null;
    const part = getPart(c.partId);

    if (c.stage === 'egg') {
        return (
            <button
                type="button"
                autoFocus
                aria-label={`Crack the egg, ${3 - c.cracks} taps left`}
                className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-end gap-3 pb-24 focus-visible:outline-offset-[-12px]"
                onClick={tapCapsule}
            >
                <span key={c.cracks} className="t-banner attention text-primary" style={{ textShadow: '0 5px 0 #140b20', WebkitTextStroke: '2px #140b20', animationDelay: '0.6s' }}>
                    TAP!
                </span>
                <span className="flex gap-2" aria-hidden>
                    {[0, 1, 2].map((i) => (
                        <span key={i} className={`h-3 w-3 rounded-full border-2 border-[#140b20] ${i < c.cracks ? 'bg-primary' : 'bg-white/30'}`} />
                    ))}
                </span>
            </button>
        );
    }

    const color = RARITY_COLOR[c.rarity];
    const canEquip = c.isNew && s.ftue.done;
    return (
        <div
            className={
                wide
                    ? 'pointer-events-auto absolute right-16 top-1/2 flex w-[420px] -translate-y-1/2 flex-col gap-3'
                    : 'pb-safe-bottom pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pb-6'
            }
        >
            <div className="pop-in flex flex-col gap-2 rounded-[var(--radius-md)] border-2 bg-panel px-4 py-3" style={{ borderColor: color }}>
                <div className="flex items-center justify-between gap-2">
                    <span className="t-label" style={{ color }}>
                        {RARITY_NAME[c.rarity].toUpperCase()} {SLOT_NAME[part.slot].toUpperCase()}
                    </span>
                    {c.isNew ? (
                        <span className="t-label rounded-[4px] bg-primary px-1.5 text-surface">NEW</span>
                    ) : (
                        <span className="t-caption flex items-center gap-1.5 text-ink">
                            Duplicate, turned into <GooIcon size={16} /> <span className="t-num">+{c.goo}</span> Goo
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <PartIcon id={part.id} size={56} />
                    <h3 className="t-title">{part.name}</h3>
                </div>
                <p className="t-caption flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                    <span className="flex items-center gap-1.5 text-ink">
                        <FamilyDot family={part.family} size={10} /> {FAMILIES[part.family].name} family
                    </span>
                    <span>HP {part.stats.hp}</span>
                    <span>ATK {part.stats.atk}</span>
                    <span>SPD {part.stats.spd}</span>
                    {part.eyes > 0 && (
                        <span className="flex items-center gap-1">
                            <Icon name="eye" size={14} /> {part.eyes}
                        </span>
                    )}
                </p>
                {part.attack && (
                    <p className="t-body text-muted">
                        <span className="text-ink">{ATTACK_TEXT[part.attack.style]}. Special, {part.attack.special}:</span> {specialText(part.attack.style)}
                    </p>
                )}
                {part.traits.map((t) => (
                    <p key={t} className="t-body text-muted">
                        <span className="text-ink">{TRAIT_INFO[t].name}:</span> {TRAIT_INFO[t].text}
                    </p>
                ))}
            </div>
            {canEquip && (
                <button type="button" autoFocus className="btn btn-primary btn-lg w-full" onClick={() => finishCapsule(true)}>
                    <span className="t-button-lg">EQUIP NOW</span>
                </button>
            )}
            <button
                type="button"
                autoFocus={!canEquip}
                className={`btn w-full ${canEquip ? 'btn-secondary btn-md' : 'btn-primary btn-lg'}`}
                onClick={() => finishCapsule(false)}
            >
                <span className={canEquip ? 't-button' : 't-button-lg'}>BACK TO LAB</span>
            </button>
        </div>
    );
}
