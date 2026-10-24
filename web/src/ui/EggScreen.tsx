/**
 * S-05 Egg (F-04, F-05). Tap once to open the egg on chain; taps 2–3 crack it.
 * The part arrives with `EggHatched`; until then the egg keeps shaking and the
 * screen says "Hatching…". An egg still pending from a previous visit is
 * resumed on mount (Review Focus 3), never silently lost.
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { useStore } from '../state/store.ts';
import {
    backToLab, buyEgg, EGG_PRICE_GLOO, openEgg, resumePendingEggs, saveLoadout, toast, tokenToPartId, refreshMe, type HatchResult,
} from '../game/actions.ts';
import { getPart } from '../game/data/parts.ts';
import { FAMILIES, RARITY_COLOR } from '../game/data/families.ts';
import type { Rarity } from '../game/data/types.ts';
import { EGG_START, eggReducer } from './eggFlow.ts';
import { errorText, useAction } from './useAction.ts';
import { usePrefersReducedMotion } from './motion.ts';
import { FamilyDot, PartIcon, rarityColor } from './bits.tsx';
import ElementChip from './ElementChip.tsx';
import { partElements } from './elements.ts';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

const RARITY_NAME: Rarity[] = ['common', 'rare', 'epic'];
const SLOT_NAME = { head: 'HEAD', body: 'BODY', legs: 'LEGS' } as const;

export default function EggScreen() {
    const me = useStore((s) => s.me);
    const wide = useLayout() === 'wide';
    const reduced = usePrefersReducedMotion();
    const [flow, dispatch] = useReducer(eggReducer, EGG_START);
    const [reveal, setReveal] = useState<HatchResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const opening = useAction('egg', 'Open egg');
    const buying = useAction('buy', 'Buy egg');
    const equipped = useAction('equip', 'Equip');
    const once = useRef(false);

    // Review Focus 3: pick up eggs that were hatching when the tab closed.
    useEffect(() => {
        if (once.current || !me) return;
        once.current = true;
        void (async () => {
            const seqs = me.pendingEggs ?? [];
            if (!seqs.length) return;
            setPendingCount(seqs.length);
            try {
                const results = await resumePendingEggs({
                    onPending: () => dispatch('requested'),
                    onWaiting: () => dispatch('timeout2s'),
                });
                const hatched = results.find((r) => r.tokenId !== undefined);
                if (hatched) {
                    dispatch('hatched');
                    setReveal(hatched);
                } else {
                    dispatch('timeout60s');
                }
            } catch (e) {
                setError(errorText(e));
                dispatch('error');
            } finally {
                setPendingCount(0);
            }
        })();
    }, [me]);

    if (!me) {
        return (
            <Shell wide={wide}>
                <div className="panel flex items-center gap-2 p-4" role="status">
                    <span className="tx-spin" aria-hidden />
                    <span className="t-body text-muted">Loading your eggs…</span>
                </div>
            </Shell>
        );
    }

    const eggs = me.eggs;
    const rareEggs = me.rareEggs;
    const cracking = flow.state === 'requesting' || flow.state === 'cracking' || flow.state === 'waiting' || flow.state === 'still';
    const canBuy = me.gloo >= EGG_PRICE_GLOO;

    const tap = () => {
        if (reveal || opening.pending) return;
        if (flow.state === 'idle') {
            dispatch('tap');
            setError(null);
            void opening
                .run(() =>
                    openEgg('normal', {
                        onRequested: () => dispatch('requested'),
                        onWaiting: () => dispatch('timeout2s'),
                    }),
                )
                .then((res) => {
                    if (!res) {
                        dispatch('error');
                        return;
                    }
                    if (res.tokenId !== undefined) {
                        dispatch('hatched');
                        setReveal(res);
                    } else {
                        dispatch('timeout60s');
                    }
                });
            return;
        }
        dispatch('tap');
    };

    const buy = () =>
        void buying.run(async () => {
            const res = await buyEgg(1);
            toast('Egg bought');
            return res;
        });

    const equip = () => {
        if (!reveal?.tokenId) return;
        const partId = tokenToPartId(reveal.tokenId);
        if (!partId) return;
        const slot = getPart(partId).slot;
        const id = reveal.tokenId;
        void equipped.run(async () => {
            const next =
                slot === 'head' ? { ...me.loadout, head: id } : slot === 'body' ? { ...me.loadout, body: id } : { ...me.loadout, legs: id };
            const res = await saveLoadout(next);
            toast('Equipped');
            return res;
        });
    };

    const retry = () => {
        dispatch('reset');
        setReveal(null);
        setError(null);
        void refreshMe().catch(() => undefined);
    };

    const buyHint = canBuy ? `${EGG_PRICE_GLOO} Gloo` : 'Not enough Gloo. Win levels to earn more.';
    const status = error ?? opening.error ?? equipped.error;

    return (
        <Shell wide={wide} onClose={backToLab}>
            <div className={`flex w-full flex-col gap-3 ${wide ? '' : 'items-center'}`}>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="chip px-2.5" aria-label={`${eggs} normal eggs`}>
                        <Icon name="egg" size={18} className="text-primary" />
                        <span className="t-num">{eggs}</span>
                        <span className="t-caption text-muted">Eggs</span>
                    </span>
                    <span className="chip px-2.5" aria-label={`${rareEggs} rare eggs`}>
                        <Icon name="egg" size={18} className="text-rare" />
                        <span className="t-num">{rareEggs}</span>
                        <span className="t-caption text-muted">Rare eggs</span>
                    </span>
                    {pendingCount > 0 && (
                        <span className="chip px-2.5" role="status">
                            <span className="tx-spin" aria-hidden />
                            <span className="t-caption">Resuming {pendingCount} egg</span>
                        </span>
                    )}
                </div>

                {reveal?.tokenId !== undefined ? (
                    <RevealCard result={reveal} busy={equipped.pending} onEquip={equip} onKeep={backToLab} />
                ) : (
                    <>
                        <button
                            type="button"
                            autoFocus
                            onClick={tap}
                            disabled={eggs <= 0 || opening.pending}
                            aria-label={cracking ? 'Cracking the egg' : 'Tap to hatch'}
                            aria-busy={opening.pending}
                            className={`mx-auto flex h-44 w-36 flex-col items-center justify-center rounded-[50%_50%_46%_46%/60%_60%_40%_40%] border-4 bg-panel ${reduced ? '' : 'egg-wobble'} ${
                                cracking ? 'border-primary' : 'border-edge-strong'
                            } ${eggs <= 0 ? 'opacity-50' : ''}`}
                        >
                            <EggArt cracks={flow.cracks} />
                        </button>
                        <p className="t-button text-center" aria-live="polite">
                            {flow.state === 'still'
                                ? "Still hatching — we'll keep it safe"
                                : flow.state === 'waiting'
                                  ? 'Hatching…'
                                  : flow.state === 'failed'
                                    ? 'The egg did not open.'
                                    : eggs > 0
                                      ? cracking
                                          ? 'Cracking…'
                                          : 'Tap to hatch'
                                      : 'No eggs left. Win PvP or buy one with Gloo.'}
                        </p>
                        {cracking && !reduced && <p className="t-caption text-center text-muted">{3 - flow.cracks} taps left</p>}
                    </>
                )}

                {status && (
                    <p className="t-caption flex items-center justify-center gap-2 text-danger" role="alert">
                        <Icon name="close" size={16} />
                        {status}
                    </p>
                )}

                <div className="flex w-full flex-col gap-2">
                    {flow.state === 'still' && (
                        <button type="button" className="btn btn-secondary btn-md w-full" onClick={retry}>
                            <span className="t-button">Retry</span>
                        </button>
                    )}
                    <button type="button" className="btn btn-secondary btn-md w-full" disabled={!canBuy || buying.pending} onClick={buy} aria-busy={buying.pending}>
                        <span className="t-button">{`Buy egg · ${EGG_PRICE_GLOO} Gloo`}</span>
                    </button>
                    <p className="t-caption text-center text-muted">{buyHint}</p>
                    {buying.error && (
                        <p className="t-caption text-center text-danger" role="alert">
                            {buying.error}
                        </p>
                    )}
                </div>
            </div>
        </Shell>
    );
}

/** Frame for the screen: a sheet on phones, a centred panel on desktop. */
function Shell({ wide, children, onClose }: { wide: boolean; children: React.ReactNode; onClose?: () => void }) {
    return (
        <div className={`pointer-events-auto absolute inset-0 flex bg-black/45 ${wide ? 'items-center justify-center p-6' : 'flex-col justify-end'}`}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Egg"
                className={
                    wide
                        ? 'pop-in flex w-full max-w-[460px] flex-col gap-3 rounded-[var(--radius-lg)] border-2 border-edge bg-surface p-5'
                        : 'slide-up pb-safe-bottom flex w-full flex-col gap-3 rounded-t-[var(--radius-lg)] border-t-2 border-edge bg-surface px-4 pt-4 sm:mx-auto sm:max-w-[520px]'
                }
            >
                <div className="flex items-center justify-between">
                    <h2 className="t-title text-ink">Egg</h2>
                    {onClose && (
                        <button type="button" aria-label="Close" className="btn btn-secondary btn-icon" onClick={onClose}>
                            <Icon name="close" />
                        </button>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}

/** A plain egg with up to three crack lines (no emoji, no images). */
function EggArt({ cracks }: { cracks: number }) {
    return (
        <svg width="72" height="88" viewBox="0 0 72 88" aria-hidden>
            <path d="M36 4c14 0 26 20 26 40S50 84 36 84 10 64 10 44 22 4 36 4z" fill="var(--color-ink)" stroke="#140b20" strokeWidth="4" />
            {cracks >= 1 && <path d="M30 24l8 8-6 8" fill="none" stroke="#140b20" strokeWidth="3" />}
            {cracks >= 2 && <path d="M46 40l-8 8 8 8" fill="none" stroke="#140b20" strokeWidth="3" />}
            {cracks >= 3 && <path d="M22 56l10 6-4 10" fill="none" stroke="#140b20" strokeWidth="3" />}
        </svg>
    );
}

/** The hatched part: rarity border, family, slot, elements, Equip / Keep. */
function RevealCard({ result, busy, onEquip, onKeep }: { result: HatchResult; busy: boolean; onEquip: () => void; onKeep: () => void }) {
    const partId = tokenToPartId(result.tokenId!);
    if (!partId) {
        return (
            <p className="t-body text-danger" role="alert">
                Unknown part #{result.tokenId}. Try again from the lab.
            </p>
        );
    }
    const part = getPart(partId);
    const rarity = RARITY_NAME[result.rarity ?? 0] ?? 'common';
    const els = partElements(partId);
    return (
        <div className="pop-in flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border-2 bg-panel px-4 py-3" style={{ borderColor: RARITY_COLOR[rarity] }}>
                <div className="flex items-center justify-between gap-2">
                    <span className="t-label" style={{ color: rarityColor(rarity) }}>
                        {rarity.toUpperCase()} · {FAMILIES[part.family].name.toUpperCase()} · {SLOT_NAME[part.slot]}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <PartIcon id={partId} size={64} />
                    <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="t-title truncate">{part.name}</h3>
                        <span className="t-caption flex items-center gap-1.5 text-muted">
                            <FamilyDot family={part.family} size={8} /> HP {part.stats.hp} · ATK {part.stats.atk} · SPD {part.stats.spd}
                        </span>
                        {els && (
                            <span className="flex items-center gap-2">
                                {els.map((el) => (
                                    <ElementChip key={el} el={el} size="md" />
                                ))}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <button type="button" autoFocus className="btn btn-primary btn-lg w-full" disabled={busy} aria-busy={busy} onClick={onEquip}>
                <span className="t-button-lg">{busy ? 'Equipping…' : 'Equip'}</span>
            </button>
            <button type="button" className="btn btn-secondary btn-md w-full" onClick={onKeep}>
                <span className="t-button">Keep</span>
            </button>
        </div>
    );
}
