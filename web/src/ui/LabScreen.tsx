/**
 * S-04 Lab (F-03, F-16). The 3D monster sits in the middle; this overlay holds
 * the HUD. Parts come from the chain (`me.balances`): a part the player no
 * longer owns falls back to the starter and says so (Review Focus 2).
 *
 * Wide (desktop, primary): info column left, build panel right. Tall (phone):
 * name on top, one bottom panel. Both share the pieces below.
 */
import { useEffect, useState } from 'react';
import { store, useStore } from '../state/store.ts';
import {
    activeMonster, loadLab, loadoutParts, openPhase, previewLoadout, saveLoadout, toast, tokenToPartId,
} from '../game/actions.ts';
import { getPart, PARTS, TRAIT_INFO } from '../game/data/parts.ts';
import { FAMILIES } from '../game/data/families.ts';
import { buildMonster, maxStats } from '../game/sim/monster.ts';
import type { Slot } from './effectiveLoadout.ts';
import { effectiveLoadout } from './effectiveLoadout.ts';
import type { Loadout, MeView } from '../../server/types.ts';
import { FamilyDot, PartIcon, Stat, rarityColor } from './bits.tsx';
import ElementChip from './ElementChip.tsx';
import { partElements } from './elements.ts';
import { ACC_IDS, accessoryIcon, accessoryName } from './accessories.ts';
import TopBar from './TopBar.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';
import { useAction } from './useAction.ts';

const SLOTS: Slot[] = ['head', 'body', 'legs', 'acc'];
const SLOT_LABEL: Record<Slot, string> = { head: 'HEAD', body: 'BODY', legs: 'LEGS', acc: 'ACC' };
const PART_FALLBACK = 'Part moved — using starter';

export default function LabScreen() {
    const me = useStore((s) => s.me);
    const wide = useLayout() === 'wide';
    const [draft, setDraft] = useState<Loadout | null>(null);
    const [slot, setSlot] = useState<Slot>('head');
    const [focus, setFocus] = useState<string | null>(null);
    const { run: runLoad, pending: loading, error: loadError } = useAction('lab', 'Loadout');
    const { run: runSave, pending: saving, error: saveError } = useAction('save', 'Save loadout');

    // First paint: read the lab from the chain (deep links are handled by the router).
    useEffect(() => {
        if (!store.get().me) void runLoad(() => loadLab());
    }, [runLoad]);

    // Preview every local pick in the 3D scene; nothing is written until Save.
    const eff = me?.registered ? effectiveLoadout(me.loadout, me.balances) : null;
    const current: Loadout = draft ?? (eff ? { head: eff.head, body: eff.body, legs: eff.legs, acc: eff.acc } : { head: 101, body: 102, legs: 103, acc: 0 });
    const changed = !!eff && (current.head !== eff.head || current.body !== eff.body || current.legs !== eff.legs || current.acc !== eff.acc);
    const parts = loadoutParts(current);
    const key = `${current.head}|${current.body}|${current.legs}|${current.acc}`;

    useEffect(() => {
        if (me?.registered) previewLoadout(current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, !!me?.registered]);

    if (!me || !eff) {
        return <LabState wide={wide} loading={loading || !loadError} error={loadError} onRetry={() => void runLoad(() => loadLab())} />;
    }

    const pick = (next: Partial<Loadout>) => setDraft({ ...current, ...next });
    const save = () =>
        void runSave(async () => {
            const res = await saveLoadout(current);
            store.patch({ me: { ...me, loadout: res.loadout } });
            setDraft(null);
            toast('Loadout saved');
            return res;
        });

    const build = (
        <BuildPanel
            me={me}
            loadout={current}
            slot={slot}
            onSlot={setSlot}
            onPick={pick}
            focus={focus}
            onFocus={setFocus}
            saving={saving}
            error={saveError}
            changed={changed}
            onSave={save}
            compact={!wide}
        />
    );
    const info = <InfoPanel me={me} loadout={current} fallback={eff.fallback} compact={!wide} />;

    if (wide) {
        return (
            <div className="pointer-events-none absolute inset-0">
                <TopBar />
                <div className="absolute left-6 top-24 flex w-[340px] flex-col gap-3">{info}</div>
                <div className="pointer-events-auto absolute right-6 top-[84px] flex max-h-[calc(100%-120px)] w-[440px] flex-col gap-3 overflow-y-auto rounded-[var(--radius-lg)] border-2 border-edge bg-surface/95 p-4">
                    <h2 className="t-title">Build</h2>
                    {build}
                </div>
                <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
                    <NavButton label="EGG" onClick={() => openPhase('egg')} />
                    <NavButton label="LEVELS" onClick={() => openPhase('levels')} />
                    <NavButton label="PVP" onClick={() => openPhase('pvp')} />
                    <NavButton label="COMMUNITY" onClick={() => openPhase('community')} />
                </div>
            </div>
        );
    }

    return (
        <div className="pointer-events-none absolute inset-0 flex flex-col">
            <TopBar />
            <div className="mt-3 flex flex-col items-center gap-1 px-4">{info}</div>
            <div className="flex-1" />
            <div className="pb-safe-bottom pointer-events-auto mx-2 mb-2 flex max-h-[calc(100%-150px)] min-h-0 flex-col gap-2 rounded-[var(--radius-lg)] border-2 border-edge bg-surface/95 px-3 pt-3 sm:mx-auto sm:w-full sm:max-w-[520px]">
                <div className="flex min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1">{build}</div>
                <div className="grid grid-cols-4 gap-2">
                    <NavButton label="EGG" onClick={() => openPhase('egg')} small />
                    <NavButton label="LEVELS" onClick={() => openPhase('levels')} small />
                    <NavButton label="PVP" onClick={() => openPhase('pvp')} small />
                    <NavButton label="LABS" onClick={() => openPhase('community')} small />
                </div>
            </div>
        </div>
    );
}

/** Loading / error states for the whole screen (never an empty lab with no explanation). */
function LabState({ wide, loading, error, onRetry }: { wide: boolean; loading: boolean; error: string | null; onRetry: () => void }) {
    return (
        <div className={`pointer-events-none absolute inset-0 ${wide ? '' : 'flex flex-col'}`}>
            <TopBar />
            <div className={`pointer-events-auto panel mt-24 flex flex-col items-center gap-3 p-4 ${wide ? 'absolute left-1/2 w-[360px] -translate-x-1/2' : 'mx-4'}`} role="status" aria-live="polite">
                {error ? (
                    <>
                        <p className="t-body flex items-center gap-2 text-center text-danger">
                            <Icon name="close" size={18} />
                            {error}
                        </p>
                        <button type="button" className="btn btn-secondary btn-md" onClick={onRetry}>
                            <span className="t-button">RETRY</span>
                        </button>
                    </>
                ) : (
                    <>
                        {loading ? <span className="tx-spin" aria-hidden /> : <Icon name="help" size={20} className="text-muted" />}
                        <p className="t-body text-muted">{loading ? 'Loading your lab from Monad…' : 'Nothing to show yet.'}</p>
                    </>
                )}
            </div>
        </div>
    );
}

function NavButton({ label, onClick, small = false }: { label: string; onClick: () => void; small?: boolean }) {
    return (
        <button type="button" className={`btn btn-secondary pointer-events-auto ${small ? 'px-1' : 'px-3'}`} onClick={onClick}>
            <span className={small ? 't-label' : 't-button'}>{label}</span>
        </button>
    );
}

/** Name, stats, the three element pairs (F-16) and the family bonus. */
function InfoPanel({ me, loadout, fallback, compact }: { me: MeView; loadout: Loadout; fallback: Slot[]; compact: boolean }) {
    const parts = loadoutParts(loadout);
    const mon = buildMonster(parts);
    const pairs: Array<{ label: string; token: number }> = [
        { label: 'Attack', token: loadout.head },
        { label: 'Defense', token: loadout.body },
        { label: 'Special', token: loadout.legs },
    ];
    const name = activeMonster().name;
    return (
        <div className={`pointer-events-auto flex flex-col gap-2 ${compact ? 'items-center' : ''}`}>
            <h1 className={`t-title ${compact ? 'text-center' : ''}`}>{name}</h1>
            <span className="t-caption text-muted">@{me.username ?? 'lab'}</span>
            <div className="panel grid w-full grid-cols-3 gap-3 px-3 py-2">
                <Stat label="HP" value={mon.stats.hp} max={maxStats().hp} color="var(--color-goo)" />
                <Stat label="ATK" value={mon.stats.atk} max={maxStats().atk} color="var(--color-fang)" />
                <Stat label="SPD" value={mon.stats.spd} max={maxStats().spd} color="var(--color-rare)" />
            </div>
            <div className="panel flex w-full flex-col gap-2 p-3">
                <span className="t-label text-muted">ELEMENTS</span>
                {pairs.map(({ label, token }) => {
                    const partId = tokenToPartId(token);
                    const els = partId ? partElements(partId) : null;
                    return (
                        <div key={label} className="flex items-center justify-between gap-2">
                            <span className="t-caption text-muted">{label}</span>
                            <span className="flex items-center gap-2">
                                {els ? els.map((el) => <ElementChip key={el} el={el} size="md" />) : <span className="t-caption text-muted">None</span>}
                            </span>
                        </div>
                    );
                })}
                <span className="t-caption text-muted">Each element beats the next two around the circle.</span>
            </div>
            <div className="panel flex w-full flex-wrap items-center gap-2 p-3">
                <span className="t-label text-muted">BONUS</span>
                {mon.bonus?.kind === 'mix' && (
                    <span className="t-caption flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-primary px-2 py-0.5 text-surface">
                        <Icon name="mix" size={14} /> Mix Bonus
                    </span>
                )}
                {mon.bonus?.kind === 'set' && (
                    <span className="t-caption flex items-center gap-1.5 rounded-[var(--radius-sm)] border-2 border-edge px-2 py-0.5">
                        <FamilyDot family={mon.bonus.family} size={10} /> {FAMILIES[mon.bonus.family].name} Set Bonus
                    </span>
                )}
                {!mon.bonus && <span className="t-caption text-muted">Mix 3 families for +5%, or one family for +15%.</span>}
                {[...new Set(mon.traits)].map((t) => (
                    <span key={t} className="t-caption rounded-[var(--radius-sm)] bg-black/40 px-2 py-0.5 text-muted" title={TRAIT_INFO[t].text}>
                        {TRAIT_INFO[t].name}
                    </span>
                ))}
            </div>
            {fallback.length > 0 && (
                <p className="t-caption flex items-center gap-2 text-muted">
                    <Icon name="lock" size={16} />
                    {PART_FALLBACK}
                </p>
            )}
        </div>
    );
}

/** Slot tabs, the part tray for that slot, the detail strip and Save. */
function BuildPanel(props: {
    me: MeView;
    loadout: Loadout;
    slot: Slot;
    onSlot: (s: Slot) => void;
    onPick: (next: Partial<Loadout>) => void;
    focus: string | null;
    onFocus: (id: string | null) => void;
    saving: boolean;
    error: string | null;
    changed: boolean;
    onSave: () => void;
    compact: boolean;
}) {
    const { me, loadout, slot, onSlot, onPick, focus, onFocus, saving, error, changed, onSave, compact } = props;
    const owned = (token: number) => (me.balances[token] ?? 0) > 0;
    // Part token = index in PARTS + 1; accessories are 201–203.
    const tokensFor = (s: Slot): number[] =>
        s === 'acc' ? [...ACC_IDS] : PARTS.map((p, i) => ({ p, token: i + 1 })).filter((x) => x.p.slot === s).map((x) => x.token);

    const equippedToken = loadout[slot];
    const options = tokensFor(slot);
    const anyOwned = options.some(owned);
    const equippedPart = slot === 'acc' ? null : tokenToPartId(equippedToken);
    const focusedToken = focus ? Number(focus) : equippedToken;
    const focusedPart = slot === 'acc' ? null : tokenToPartId(focusedToken);

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Body slot">
                {SLOTS.map((s) => {
                    const t = loadout[s];
                    const p = s === 'acc' ? null : tokenToPartId(t);
                    const active = slot === s;
                    return (
                        <button
                            type="button"
                            role="tab"
                            aria-selected={active}
                            key={s}
                            onClick={() => onSlot(s)}
                            className={`flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-md)] border-2 px-1 py-1.5 ${
                                active ? 'border-primary bg-edge' : 'border-edge-strong bg-panel hover:border-muted'
                            }`}
                        >
                            {s === 'acc' ? (
                                t === 0 ? (
                                    <span className="flex h-10 w-10 items-center justify-center text-muted">
                                        <Icon name="gift" size={20} />
                                    </span>
                                ) : (
                                    <span className="flex h-10 w-10 items-center justify-center text-primary">
                                        <Icon name={accessoryIcon(t)} size={24} />
                                    </span>
                                )
                            ) : (
                                <PartIcon id={p!} size={40} />
                            )}
                            <span className="t-label text-muted">{SLOT_LABEL[s]}</span>
                        </button>
                    );
                })}
            </div>

            {!anyOwned && <p className="t-body text-muted">Open eggs to unlock parts.</p>}

            <div
                className={compact ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1' : 'grid grid-cols-4 gap-2'}
                role="tabpanel"
                onMouseLeave={() => onFocus(null)}
            >
                {slot === 'acc' && (
                    <button
                        type="button"
                        aria-pressed={loadout.acc === 0}
                        onClick={() => onPick({ acc: 0 })}
                        className={`flex flex-col items-center gap-1 rounded-[var(--radius-md)] border-2 px-1 pb-1.5 pt-1 ${compact ? 'w-[84px] shrink-0' : ''} ${
                            loadout.acc === 0 ? 'border-primary bg-edge' : 'border-edge-strong bg-panel hover:bg-edge'
                        }`}
                    >
                        <span className="flex h-14 w-14 items-center justify-center text-muted">
                            <Icon name="close" size={20} />
                        </span>
                        <span className="t-caption w-full text-center leading-tight">None</span>
                    </button>
                )}
                {options.map((token) => {
                    const has = owned(token);
                    const isOn = equippedToken === token;
                    const part = slot === 'acc' ? null : tokenToPartId(token);
                    const def = part ? getPart(part) : null;
                    const els = part ? partElements(part) : null;
                    const count = me.balances[token] ?? 0;
                    return (
                        <button
                            type="button"
                            key={token}
                            disabled={!has}
                            aria-pressed={isOn}
                            aria-label={has ? (part ? def!.name : accessoryName(token)) : 'Locked part'}
                            onMouseEnter={() => onFocus(String(token))}
                            onFocus={() => onFocus(String(token))}
                            onClick={() => onPick(slot === 'acc' ? { acc: token } : slot === 'head' ? { head: token } : slot === 'body' ? { body: token } : { legs: token })}
                            className={`relative flex flex-col items-center gap-1 rounded-[var(--radius-md)] border-2 px-1 pb-4 pt-1 ${compact ? 'w-[84px] shrink-0' : ''} ${
                                has ? 'cursor-pointer bg-panel hover:bg-edge' : 'border-dashed bg-black/20'
                            }`}
                            style={{ borderColor: !has ? 'var(--color-edge)' : isOn ? 'var(--color-primary)' : def ? rarityColor(def.rarity) : 'var(--color-edge-strong)' }}
                        >
                            {part ? (
                                <PartIcon id={part} size={56} locked={!has} />
                            ) : (
                                <span className={`flex h-14 w-14 items-center justify-center ${has ? 'text-primary' : 'text-muted'}`}>
                                    <Icon name={accessoryIcon(token)} size={28} />
                                </span>
                            )}
                            <span className={`t-caption w-full truncate text-center leading-tight ${has ? '' : 'text-muted'}`}>
                                {has ? (part ? def!.name : accessoryName(token)) : '???'}
                            </span>
                            {has && count > 1 && <span className="t-num absolute right-1 top-1">×{count}</span>}
                            {isOn && (
                                <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-surface" aria-hidden>
                                    <Icon name="check" size={14} />
                                </span>
                            )}
                            {!has && (
                                <span className="absolute left-1 top-1 text-muted" aria-hidden>
                                    <Icon name="lock" size={16} />
                                </span>
                            )}
                            {els && (
                                <span className="absolute bottom-1 left-1 flex gap-0.5" aria-hidden>
                                    {els.map((el) => (
                                        <ElementChip key={el} el={el} />
                                    ))}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <DetailStrip token={focusedToken} slot={slot} focusedPart={focusedPart} loadout={loadout} owned={owned(focusedToken)} equipped={equippedToken === focusedToken} />

            {error && (
                <p className="t-caption flex items-center gap-2 text-danger" role="alert">
                    <Icon name="close" size={16} />
                    {error}
                </p>
            )}
            <button type="button" className="btn btn-primary btn-lg w-full" disabled={!changed || saving} aria-busy={saving} onClick={onSave}>
                <span className="t-button-lg">{saving ? 'Saving…' : 'Save'}</span>
            </button>
            {!changed && <p className="t-caption text-center text-muted">Pick a part to save a new loadout.</p>}
        </div>
    );
}

/** Stats, traits and elements of whichever part is hovered or equipped. */
function DetailStrip({ token, slot, focusedPart, loadout, owned, equipped }: {
    token: number;
    slot: Slot;
    focusedPart: string | null;
    loadout: Loadout;
    owned: boolean;
    equipped: boolean;
}) {
    if (slot === 'acc') {
        return (
            <div className="panel flex items-center gap-3 p-3">
                <span className="flex h-12 w-12 items-center justify-center text-primary">
                    <Icon name={accessoryIcon(token)} size={28} />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="t-button">{token === 0 ? 'No accessory' : accessoryName(token)}</span>
                    <span className="t-caption text-muted">{token === 0 ? 'Cosmetic slot, empty. Nothing changes in a fight.' : 'Cosmetic only: no stats, no elements.'}</span>
                </div>
            </div>
        );
    }
    const part = focusedPart ?? tokenToPartId(loadout[slot] ?? 0) ?? 'goo_head';
    const p = getPart(part);
    const els = partElements(part);
    return (
        <div className="panel flex items-center gap-3 p-3">
            <PartIcon id={part} size={56} locked={!owned} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="t-button truncate">{owned ? p.name : `${p.name} (locked)`}</span>
                    <span className="t-label shrink-0" style={{ color: rarityColor(p.rarity) }}>
                        {p.rarity.toUpperCase()}
                    </span>
                </div>
                <span className="t-caption flex flex-wrap items-center gap-x-1.5 text-muted">
                    <FamilyDot family={p.family} size={8} /> {FAMILIES[p.family].name} family
                    <span>HP {p.stats.hp}</span>
                    <span>ATK {p.stats.atk}</span>
                    <span>SPD {p.stats.spd}</span>
                </span>
                {els && (
                    <span className="flex items-center gap-2">
                        {els.map((el) => (
                            <ElementChip key={el} el={el} size="md" />
                        ))}
                    </span>
                )}
                {p.traits.map((t) => (
                    <span key={t} className="t-caption text-muted">
                        <span className="text-ink">{TRAIT_INFO[t].name}:</span> {TRAIT_INFO[t].text}
                    </span>
                ))}
                <span className="t-caption flex flex-wrap gap-x-2">
                    {equipped ? (
                        <span className="flex items-center gap-1 text-primary">
                            <Icon name="check" size={14} /> Equipped
                        </span>
                    ) : owned ? (
                        <span className="text-muted">Select to preview it on your monster</span>
                    ) : (
                        <span className="text-muted">Open eggs to unlock parts</span>
                    )}
                </span>
            </div>
        </div>
    );
}
