/** Result (GDD §10.3, §22.4): the outcome, what you got, and one obvious next step. */
import { useStore } from '../state/store.ts';
import { DAILY_CAPSULE_WINS, EGG_PRICE, enterLab, openCapsule, openArena, startArenaBattle } from '../game/actions.ts';
import { getPart } from '../game/data/parts.ts';
import { MAX_SLICE_TIER } from '../game/data/arena.ts';
import { GooIcon, PartIcon, useSave } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

export default function ResultPanel() {
    const r = useStore((s) => s.result);
    const battle = useStore((s) => s.battle);
    const s = useSave();
    const wide = useLayout() === 'wide';
    if (!r || !battle) return null;
    const ftue = !s.ftue.done;
    const nextTier = Math.min(MAX_SLICE_TIER, s.arena.highestTier + 1);
    const hasRewards = r.capsule || r.goo > 0 || !!r.trophyPart || r.newTier !== null;

    return (
        <div
            className={
                wide
                    ? 'pointer-events-auto absolute bottom-8 left-1/2 flex w-[440px] -translate-x-1/2 flex-col items-center gap-3'
                    : 'pb-safe-bottom pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-6'
            }
        >
                <h2 className={`t-banner pop-in text-center ${r.won ? 'text-primary' : 'text-danger'}`} style={{ textShadow: '0 5px 0 #140b20', WebkitTextStroke: '2px #140b20' }}>
                    {r.won ? 'VICTORY!' : 'DEFEAT'}
                </h2>
            {(hasRewards || r.tip) && (
                <div className="panel pop-in flex w-full flex-col gap-2 px-4 py-3" style={{ animationDelay: '0.08s' }}>
                    {r.capsule && (
                        <Row
                            icon={<Icon name="egg" className="text-primary" />}
                            text="Spooky Egg"
                            note={ftue ? '' : `${s.capsules.winsToday}/${DAILY_CAPSULE_WINS} today`}
                        />
                    )}
                    {r.goo > 0 && <Row icon={<GooIcon />} text={`+${r.goo} Goo`} note={`Daily eggs used up. ${EGG_PRICE} Goo buys one.`} />}
                    {r.trophyPart && (
                        <Row icon={<PartIcon id={r.trophyPart} size={36} />} text={getPart(r.trophyPart).name} note="Stolen from their monster" />
                    )}
                    {r.newTier !== null && <Row icon={<Icon name="trophy" className="text-epic" />} text={`Arena tier ${r.newTier} cleared`} note={r.newTier === MAX_SLICE_TIER ? 'Bonus epic egg added' : ''} />}
                    {r.tip && (
                        <p className="t-body flex items-start gap-2 text-ink">
                            <Icon name="help" size={20} className="mt-0.5 text-epic" />
                            {r.tip}
                        </p>
                    )}
                </div>
            )}

            <div className="flex w-full flex-col gap-2">
                {r.capsule ? (
                    <button type="button" autoFocus className="btn btn-primary btn-lg attention w-full" onClick={openCapsule}>
                        <span className="t-button-lg">OPEN EGG</span>
                    </button>
                ) : r.mode === 'arena' ? (
                    <button
                        type="button"
                        autoFocus
                        className="btn btn-primary btn-lg w-full"
                        onClick={() => (r.won ? openArena() : startArenaBattle(battle.tier))}
                    >
                        <span className="t-button-lg">{r.won ? (s.arena.highestTier >= MAX_SLICE_TIER ? 'ARENA' : `TIER ${nextTier}`) : 'TRY AGAIN'}</span>
                    </button>
                ) : null}
                {!r.capsule && (
                    <button type="button" className="btn btn-secondary btn-md w-full" onClick={() => enterLab()}>
                        <span className="t-button">BACK TO LAB</span>
                    </button>
                )}
            </div>
        </div>
    );
}

function Row({ icon, text, note }: { icon: React.ReactNode; text: string; note: string }) {
    return (
        <div className="flex min-h-7 items-center gap-2">
            {icon}
            <span className="t-button">{text}</span>
            {note && <span className="t-caption ml-auto text-right text-muted">{note}</span>}
        </div>
    );
}
