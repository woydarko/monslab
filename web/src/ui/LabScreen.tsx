/**
 * LAB hub (GDD §10.1, §22.2). The 3D monster sits in the middle; this overlay
 * holds the HUD. FTUE (GDD §9) gates which controls exist.
 *
 * Wide (desktop, primary): info column on the left, build panel on the right,
 * monster centred between them. Tall (phone): name on top, one bottom panel.
 * Both layouts share the same pieces below; only the arrangement differs.
 */
import { useEffect, useState } from 'react';
import { store, useStore } from '../state/store.ts';
import {
    activeMonster, buyEgg, DAILY_CAPSULE_WINS, eggWinsToday, EGG_PRICE, enterTitle, equipPart, mix, openArena, openCapsule, openCollection,
    renameMonster, selectTraySlot, showHowTo, startArenaBattle, toast,
} from '../game/actions.ts';
import { getPart, PARTS, TRAIT_INFO } from '../game/data/parts.ts';
import { FAMILIES } from '../game/data/families.ts';
import { MAX_SLICE_TIER } from '../game/data/arena.ts';
import { buildMonster, maxStats } from '../game/sim/monster.ts';
import type { MonsterParts, SlotId } from '../game/data/types.ts';
import { NAME_MAX } from '../game/names.ts';
import { ATTACK_TEXT, FamilyDot, GooIcon, PartIcon, rarityColor, SkinSwatch, SoundButton, specialText, Stat, useSave } from './bits.tsx';
import PhoneTopBar from './PhoneTopBar.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

const SLOTS: SlotId[] = ['head', 'body', 'legs'];
const SLOT_LABEL: Record<SlotId, string> = { head: 'HEAD', body: 'BODY', legs: 'LEGS' };

export default function LabScreen() {
    const s = useSave();
    const phase = useStore((st) => st.phase);
    const wide = useLayout() === 'wide';
    const m = activeMonster();
    const step = s.ftue.done ? 99 : s.ftue.step;
    const sheetOpen = phase !== 'lab';

    if (wide) {
        return (
            <div className="pointer-events-none absolute inset-0">
                <TopBar step={step} />
                {step >= 1 && (
                    <div className="absolute left-6 top-24 flex w-[340px] flex-col gap-3">
                        <Identity align="left" />
                        <StatsCard parts={m.parts} />
                        <AttackCard parts={m.parts} />
                        <TraitsCard parts={m.parts} />
                    </div>
                )}
                {step >= 4 && !sheetOpen && (
                    <div className="pointer-events-auto absolute right-6 top-[84px] flex w-[440px] flex-col gap-2.5 rounded-[var(--radius-lg)] border-2 border-edge bg-surface/95 p-4">
                        <h2 className="t-title">Build</h2>
                        <BuildPanel parts={m.parts} pointer={step === 4} />
                        {step >= 99 && <div className="mt-1"><Actions /></div>}
                    </div>
                )}
                {step <= 3 && (
                    <div className="pointer-events-auto absolute bottom-10 left-1/2 flex w-[380px] -translate-x-1/2 flex-col items-center gap-3">
                        <FtueAction step={step} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="pointer-events-none absolute inset-0 flex flex-col">
            <TopBar step={step} />
            {step >= 1 && (
                <div className="mt-3 flex flex-col items-center gap-1 px-4">
                    <Identity align="center" />
                </div>
            )}
            <div className="flex-1" />
            {step <= 3 && (
                <div className="pb-safe-bottom pointer-events-auto flex flex-col items-center gap-3 px-4 pb-6">
                    {step >= 1 && <StatsRow parts={m.parts} />}
                    <FtueAction step={step} />
                </div>
            )}
            {step >= 4 && !sheetOpen && (
                // Capped below the name so the monster stays visible; the middle scrolls, actions stay put.
                <div className="pb-safe-bottom pointer-events-auto mx-2 mb-2 flex max-h-[calc(100%-150px)] min-h-0 flex-col gap-2 sm:mx-auto sm:w-full sm:max-w-[520px] rounded-[var(--radius-lg)] border-2 border-edge bg-surface/95 px-3 pt-3">
                    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1">
                        <StatsRow parts={m.parts} />
                        <BuildPanel parts={m.parts} pointer={step === 4} compact />
                    </div>
                    {step >= 99 && <Actions />}
                </div>
            )}
        </div>
    );
}

/** Resources left, system buttons right. */
function TopBar({ step }: { step: number }) {
    const s = useSave();
    const wide = useLayout() === 'wide';
    const veteran = step >= 99;
    const ownedCount = PARTS.filter((p) => (s.ownedParts[p.id] ?? 0) > 0).length;
    if (!wide) return <PhoneTopBar veteran={veteran} />;
    return (
        <div className={`pt-safe-top flex items-center justify-between gap-2 ${wide ? 'px-6 pt-4' : 'px-4'}`}>
            {/* Resources only matter once the tutorial hands over the controls. */}
            {veteran ? (
                <div className="flex items-center gap-2">
                    <div className="chip" aria-label={`${s.goo} Goo`}>
                        <GooIcon />
                        <span className="t-num">{s.goo}</span>
                        {wide && <span className="t-caption text-muted">Goo</span>}
                    </div>
                    <button
                        type="button"
                        className="btn btn-secondary pointer-events-auto px-3"
                        disabled={s.goo < EGG_PRICE}
                        title={s.goo < EGG_PRICE ? `Collect ${EGG_PRICE} Goo from duplicate parts and extra wins` : undefined}
                        onClick={buyEgg}
                    >
                        <span className="t-button">{wide ? `BUY EGG · ${EGG_PRICE} GOO` : `BUY EGG ${EGG_PRICE}`}</span>
                    </button>
                    {s.capsules.stored > 0 ? (
                        <button type="button" className="btn btn-primary pointer-events-auto px-3" onClick={openCapsule}>
                            <span className="t-button">{`OPEN EGG (${s.capsules.stored})`}</span>
                        </button>
                    ) : (
                        wide && (
                            <span className="t-caption on-scene text-ink">
                                {eggWinsToday() < DAILY_CAPSULE_WINS
                                    ? `Win a battle for an egg (${eggWinsToday()}/${DAILY_CAPSULE_WINS} today)`
                                    : 'Daily egg wins used up. Wins now give Goo.'}
                            </span>
                        )
                    )}
                </div>
            ) : (
                <div />
            )}
            <div className="flex items-center gap-2">
                {veteran &&
                    (wide ? (
                        <button type="button" className="btn btn-secondary pointer-events-auto px-3" onClick={openCollection}>
                            <span className="t-button">{`COLLECTION ${ownedCount}/${PARTS.length}`}</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            aria-label={`Collection, ${ownedCount} of ${PARTS.length} parts`}
                            title="Collection"
                            className="btn btn-secondary btn-icon pointer-events-auto"
                            onClick={openCollection}
                        >
                            <Icon name="book" />
                        </button>
                    ))}
                <button type="button" aria-label="How to play" title="How to play" className="btn btn-secondary btn-icon pointer-events-auto" onClick={() => showHowTo(true)}>
                    <Icon name="help" />
                </button>
                <SoundButton />
                {veteran && (
                    <button type="button" aria-label="Back to title" title="Back to title" className="btn btn-secondary btn-icon pointer-events-auto" onClick={enterTitle}>
                        <Icon name="home" />
                    </button>
                )}
            </div>
        </div>
    );
}

/** Name (renamable), bonus, eyes/crit, trait chips (tall only; wide lists traits in their own card). */
function Identity({ align }: { align: 'left' | 'center' }) {
    const s = useSave();
    const [renaming, setRenaming] = useState(false);
    const m = activeMonster();
    const mon = buildMonster(m.parts);
    const veteran = s.ftue.done;
    const justify = align === 'left' ? 'justify-start' : 'justify-center';
    return (
        <div className={`flex flex-col gap-2 ${align === 'left' ? 'items-start' : 'items-center'}`}>
            {renaming ? (
                <RenameInput
                    initial={m.name}
                    onDone={(v) => {
                        if (v !== null && v !== m.name && !renameMonster(v)) toast('That name won’t work. Try letters and numbers.');
                        setRenaming(false);
                    }}
                />
            ) : (
                <div className="flex items-center gap-1">
                    <h1 className={`t-title on-scene ${align === 'left' ? 'text-left' : 'text-center'}`}>{m.name}</h1>
                    {veteran && (
                        <button
                            type="button"
                            aria-label="Rename monster"
                            title="Rename"
                            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-ink"
                            onClick={() => setRenaming(true)}
                        >
                            <Icon name="pencil" size={20} />
                        </button>
                    )}
                </div>
            )}
            <div className={`flex flex-wrap items-center gap-2 ${justify}`}>
                {mon.bonus?.kind === 'mix' && <span className="t-caption rounded-[var(--radius-sm)] bg-primary px-2 py-0.5 text-surface">Mix Bonus</span>}
                {mon.bonus?.kind === 'set' && (
                    <span className="t-caption flex items-center gap-1.5 rounded-[var(--radius-sm)] border-2 border-edge bg-panel px-2 py-0.5">
                        <FamilyDot family={mon.bonus.family} size={8} /> {FAMILIES[mon.bonus.family].name} Set
                    </span>
                )}
                <span className="t-caption flex items-center gap-1 rounded-[var(--radius-sm)] bg-black/55 px-2 py-0.5 text-ink">
                    <Icon name="eye" size={16} /> {mon.eyes} {mon.eyes === 1 ? 'eye' : 'eyes'} · {Math.round(mon.critChance * 100)}% crit
                </span>
                {align === 'center' && (
                    <span className="t-caption rounded-[var(--radius-sm)] bg-black/55 px-2 py-0.5 text-ink" title={`${ATTACK_TEXT[mon.style]}. ${specialText(mon.style)}`}>
                        Special: {mon.special}
                    </span>
                )}
            </div>
            {align === 'center' && (
                <div className="flex flex-wrap justify-center gap-1">
                    {[...new Set(mon.traits)].map((t) => (
                        <span key={t} className="t-caption rounded-[var(--radius-sm)] bg-black/55 px-2 py-0.5 text-muted" title={TRAIT_INFO[t].text}>
                            {TRAIT_INFO[t].name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Desktop: stats as full-width rows with room for the bars to read. */
function StatsCard({ parts }: { parts: MonsterParts }) {
    const mon = buildMonster(parts);
    return (
        <div className="panel pointer-events-auto flex flex-col gap-3 p-4">
            <Stat label="HP" value={mon.stats.hp} max={maxStats().hp} color="var(--color-goo)" />
            <Stat label="ATK" value={mon.stats.atk} max={maxStats().atk} color="var(--color-fang)" />
            <Stat label="SPD" value={mon.stats.spd} max={maxStats().spd} color="var(--color-rare)" />
        </div>
    );
}

/** Desktop: how this monster attacks, so the special's name in battle has a source. */
function AttackCard({ parts }: { parts: MonsterParts }) {
    const mon = buildMonster(parts);
    return (
        <div className="panel pointer-events-auto flex items-center gap-3 p-3">
            <PartIcon id={parts[0]} size={48} />
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="t-label text-muted">ATTACK</span>
                <span className="t-button">{mon.special}</span>
                <span className="t-caption text-muted">
                    {ATTACK_TEXT[mon.style]}. {specialText(mon.style)}
                </span>
            </div>
        </div>
    );
}

/** Desktop: every trait with its effect spelled out (no hover needed). */
function TraitsCard({ parts }: { parts: MonsterParts }) {
    const mon = buildMonster(parts);
    return (
        <div className="panel pointer-events-auto flex flex-col gap-2 p-4">
            <span className="t-label text-muted">TRAITS</span>
            {[...new Set(mon.traits)].map((t) => (
                <p key={t} className="t-body text-muted">
                    <span className="text-ink">{TRAIT_INFO[t].name}:</span> {TRAIT_INFO[t].text}
                </p>
            ))}
        </div>
    );
}

/** Phone: compact 3-column stats. */
function StatsRow({ parts }: { parts: MonsterParts }) {
    const mon = buildMonster(parts);
    return (
        <div className="panel pointer-events-auto grid w-full grid-cols-3 gap-3 px-3 py-2">
            <Stat label="HP" value={mon.stats.hp} max={maxStats().hp} color="var(--color-goo)" />
            <Stat label="ATK" value={mon.stats.atk} max={maxStats().atk} color="var(--color-fang)" />
            <Stat label="SPD" value={mon.stats.spd} max={maxStats().spd} color="var(--color-rare)" />
        </div>
    );
}

/** FTUE steps 0–3: exactly one action at a time. */
function FtueAction({ step }: { step: number }) {
    const s = useSave();
    if (step === 0) {
        return (
            <>
                <p className="t-body on-scene text-center">Your first monster is ready to be mixed.</p>
                <button type="button" className="btn btn-primary btn-lg attention pointer-events-auto w-full max-w-xs" onClick={mix}>
                    <span className="t-button-lg">MIX!</span>
                </button>
            </>
        );
    }
    if (step === 3 && s.capsules.stored > 0) {
        return (
            <button type="button" className="btn btn-primary btn-lg attention pointer-events-auto w-full max-w-xs" onClick={openCapsule}>
                <span className="t-button-lg">OPEN EGG</span>
            </button>
        );
    }
    return (
        <button type="button" className="btn btn-primary btn-lg attention pointer-events-auto w-full max-w-xs" onClick={() => startArenaBattle(0)}>
            <span className="t-button-lg">BATTLE</span>
        </button>
    );
}

/**
 * Build panel: slot tabs (with the equipped part's picture), a grid of part
 * cards, and a detail strip explaining whichever part is hovered/focused
 * (or the equipped one). Cards stay clean; the numbers live in the strip.
 */
function BuildPanel({ parts, pointer, compact = false }: { parts: MonsterParts; pointer: boolean; compact?: boolean }) {
    const s = useSave();
    const slot = useStore((st) => st.traySlot);
    const highlight = useStore((st) => st.highlightPart);
    const [hover, setHover] = useState<string | null>(null);
    const idx = slot === 'head' ? 0 : slot === 'body' ? 1 : 2;
    const options = slot === 'skin' ? [] : PARTS.filter((p) => p.slot === slot);
    // In the tutorial the strip shows the new part first, so its trade is visible before the tap.
    const teach = pointer && !!highlight && options.some((p) => p.id === highlight);
    const focus = hover && options.some((p) => p.id === hover) ? hover : teach ? highlight! : parts[idx];
    const iconSize = compact ? 40 : 56;

    return (
        <div className="flex flex-col gap-3">
            {teach && (
                <p className="t-body text-ink">
                    Every part is a trade. {getPart(highlight!).name} gives up some HP for speed and extra eyes, and more eyes means more critical hits.
                    Select it to equip.
                </p>
            )}
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2" role="tablist" aria-label="Body slot">
                {SLOTS.map((sl, i) => {
                    const p = getPart(parts[i]);
                    const active = slot === sl;
                    return (
                        <button
                            type="button"
                            role="tab"
                            aria-selected={active}
                            key={sl}
                            onClick={() => selectTraySlot(sl)}
                            className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border-2 px-2 py-1.5 text-left ${
                                active ? 'border-primary bg-edge' : 'border-edge-strong bg-panel hover:border-muted'
                            }`}
                        >
                            <PartIcon id={p.id} size={compact ? 32 : 40} />
                            <span className="flex min-w-0 flex-col">
                                <span className="t-label text-muted">{SLOT_LABEL[sl]}</span>
                                <span className="t-caption leading-tight">{p.name}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {slot === 'skin' ? null : (
            <>
            {/* Phone: one row that scrolls sideways, so the panel never covers the monster. */}
            <div
                className={compact ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1' : 'grid grid-cols-4 gap-2'}
                role="tabpanel"
                onMouseLeave={() => setHover(null)}
            >
                {options.map((p) => {
                    const has = (s.ownedParts[p.id] ?? 0) > 0;
                    const equipped = parts[idx] === p.id;
                    const isNew = highlight === p.id;
                    return (
                        <button
                            type="button"
                            key={p.id}
                            disabled={!has}
                            aria-pressed={equipped}
                            aria-label={has ? p.name : `${p.name}, locked`}
                            onMouseEnter={() => setHover(p.id)}
                            onFocus={() => setHover(p.id)}
                            onClick={() => {
                                equipPart(p.id);
                                store.patch({ highlightPart: null });
                            }}
                            className={`relative flex flex-col items-center gap-1 rounded-[var(--radius-md)] border-2 px-1 pb-1.5 pt-1 ${compact ? 'w-[84px] shrink-0' : ''} ${
                                has ? 'cursor-pointer bg-panel hover:bg-edge' : 'border-dashed bg-black/20'
                            } ${focus === p.id && has ? 'ring-2 ring-white/40' : ''}`}
                            style={{ borderColor: !has ? 'var(--color-edge)' : equipped ? 'var(--color-primary)' : rarityColor(p.rarity) }}
                        >
                            <PartIcon id={p.id} size={iconSize} locked={!has} />
                            <span className={`t-caption w-full text-center leading-tight ${has ? '' : 'text-muted'}`}>{has ? p.name : '???'}</span>
                            {equipped && (
                                <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-surface" aria-hidden>
                                    <Icon name="check" size={14} />
                                </span>
                            )}
                            {!has && (
                                <span className="absolute left-1 top-1 text-muted" aria-hidden>
                                    <Icon name="lock" size={16} />
                                </span>
                            )}
                            {isNew && <span className="t-label absolute right-1 top-1 rounded-[4px] bg-primary px-1 text-surface">NEW</span>}
                            {isNew && pointer && (
                                <span className="hand absolute -bottom-4 -right-1" aria-hidden>
                                    <svg width="34" height="34" viewBox="0 0 24 24" fill="#b6ff3b" stroke="#140b20" strokeWidth="1.5">
                                        <path d="M9 2h2v9h1V5h2v6h1V7h2v6h1V9h2v7l-2 6H9l-5-6 2-2 3 2z" />
                                    </svg>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <PartDetail id={focus} parts={parts} owned={(s.ownedParts[focus] ?? 0) > 0} compact={compact} />
            </>
            )}
        </div>
    );
}

/** What the focused part is and what swapping to it would change. */
function PartDetail({ id, parts, owned, compact }: { id: string; parts: MonsterParts; owned: boolean; compact: boolean }) {
    const p = getPart(id);
    const idx = p.slot === 'head' ? 0 : p.slot === 'body' ? 1 : 2;
    const equipped = parts[idx] === id;
    const current = buildMonster(parts);
    const trial = [...parts] as MonsterParts;
    trial[idx] = id;
    const t = buildMonster(trial);
    const sameStats = t.stats.hp === current.stats.hp && t.stats.atk === current.stats.atk && t.stats.spd === current.stats.spd;
    return (
        <div className={`panel flex items-start gap-3 p-3 ${compact ? '' : 'min-h-[100px]'}`}>
            {!compact && <PartIcon id={id} size={64} locked={!owned} />}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="t-button truncate">{owned ? p.name : `${p.name} (locked)`}</span>
                    <span className="t-label shrink-0" style={{ color: rarityColor(p.rarity) }}>
                        {p.rarity.toUpperCase()}
                    </span>
                </div>
                <span className="t-caption flex flex-wrap items-center gap-x-1.5 text-muted">
                    <FamilyDot family={p.family} size={8} /> {FAMILIES[p.family].name} family
                </span>
                {p.attack && (
                    <span className="t-caption text-muted">
                        <span className="text-ink">{ATTACK_TEXT[p.attack.style]}. Special, {p.attack.special}:</span> {specialText(p.attack.style)}
                    </span>
                )}
                {p.traits.map((tr) => (
                    <span key={tr} className="t-caption text-muted">
                        <span className="text-ink">{TRAIT_INFO[tr].name}:</span> {TRAIT_INFO[tr].text}
                    </span>
                ))}
                <span className="t-caption flex flex-wrap gap-x-2">
                    {equipped ? (
                        <span className="flex items-center gap-1 text-primary">
                            <Icon name="check" size={14} /> Equipped
                        </span>
                    ) : !owned ? (
                        <span className="text-muted">Win eggs in the Arena to unlock</span>
                    ) : (
                        <>
                            <Delta v={t.stats.hp - current.stats.hp} l="HP" />
                            <Delta v={t.stats.atk - current.stats.atk} l="ATK" />
                            <Delta v={t.stats.spd - current.stats.spd} l="SPD" />
                            <Delta v={Math.round((t.critChance - current.critChance) * 100)} l="% crit" />
                            {t.bonus?.kind === 'mix' && current.bonus?.kind !== 'mix' && <span className="text-primary">Mix Bonus!</span>}
                            {t.bonus?.kind === 'set' && current.bonus?.kind !== 'set' && <span className="text-primary">Set Bonus!</span>}
                            {current.bonus && t.bonus?.kind !== current.bonus.kind && <span className="text-danger">{current.bonus.kind === 'set' ? 'Set Bonus' : 'Mix Bonus'} lost</span>}
                            {sameStats && t.critChance === current.critChance && <span className="text-muted">Same stats, different trait</span>}
                        </>
                    )}
                </span>
            </div>
        </div>
    );
}

function Actions() {
    const s = useSave();
    return (
        <div className="grid grid-cols-1 gap-2">
            <button type="button" className="btn btn-primary btn-lg flex-col gap-0.5 px-2" onClick={openArena}>
                <span className="t-button-lg">BATTLE</span>
                <span className="t-caption opacity-80">
                    {s.arena.highestTier >= MAX_SLICE_TIER ? 'All cleared' : `Tier ${s.arena.highestTier + 1} next`}
                </span>
            </button>
        </div>
    );
}

function Delta({ v, l }: { v: number; l: string }) {
    if (v === 0) return null;
    return <span className={v > 0 ? 'text-primary' : 'text-danger'}>{`${v > 0 ? '+' : ''}${v}${l.startsWith('%') ? '' : ' '}${l}`}</span>;
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
    const [v, setV] = useState(initial);
    return (
        <form
            className="pointer-events-auto flex gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                onDone(v);
            }}
        >
            <input
                autoFocus
                aria-label="Monster name"
                maxLength={NAME_MAX}
                value={v}
                onChange={(e) => setV(e.target.value)}
                onBlur={() => onDone(v)}
                onKeyDown={(e) => e.key === 'Escape' && onDone(null)}
                className="t-title h-12 w-64 rounded-[var(--radius-sm)] border-2 border-primary bg-surface px-3 text-ink outline-none"
            />
        </form>
    );
}
