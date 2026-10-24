/**
 * S-09 Result: the outcome, what you got, and one obvious next step.
 * Reads the `BattleView` the API returned, so rewards, both tx hashes and the
 * "Result pending" state are exactly what the chain said.
 */
import { useState } from 'react';
import { useStore } from '../state/store.ts';
import { backToLab, fightLevel, finalizePending, openPhase, openReplay } from '../game/actions.ts';
import { useAction } from './useAction.ts';
import { usePrefersReducedMotion } from './motion.ts';
import TxChip from './TxChip.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

export default function ResultPanel() {
    const bv = useStore((s) => s.battleView);
    const battle = useStore((s) => s.battle);
    const wide = useLayout() === 'wide';
    const reduced = usePrefersReducedMotion();
    const againAction = useAction('again', 'Fight again');
    const retryFinalize = useAction('finalize', 'Finalize');
    const [retried, setRetried] = useState(false);

    if (!bv || !battle) return null;

    const won = bv.outcome.winner === 0;
    const pve = bv.mode === 'pve';
    const tier = bv.defender.tier ?? battle.tier;
    const pending = bv.status === 'finalize_pending';
    const cappedGloo = pve && won && bv.rewards.gloo === 0;
    const cappedEggs = bv.mode === 'pvp' && won && bv.rewards.eggs === 0;

    const retry = () =>
        void retryFinalize.run(async () => {
            const next = await finalizePending();
            setRetried(!!next && next.status === 'final');
            return next;
        });

    return (
        <div
            className={
                wide
                    ? 'pointer-events-auto absolute bottom-8 left-1/2 flex w-[460px] -translate-x-1/2 flex-col items-center gap-3'
                    : 'pb-safe-bottom pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-6'
            }
        >
            <h2
                className={`t-banner text-center ${won ? 'text-primary' : 'text-danger'} ${reduced ? '' : 'pop-in'}`}
                style={{ textShadow: '0 5px 0 #140b20', WebkitTextStroke: '2px #140b20' }}
            >
                {won ? 'VICTORY' : 'DEFEAT'}
            </h2>

            <div className={`panel flex w-full flex-col gap-2 px-4 py-3 ${reduced ? '' : 'pop-in'}`}>
                {bv.rewards.gloo > 0 && <Row icon={<Icon name="flask" className="text-goo" />} text={`+${bv.rewards.gloo} Gloo`} note="" />}
                {bv.rewards.eggs > 0 && <Row icon={<Icon name="egg" className="text-primary" />} text={`+${bv.rewards.eggs} Egg`} note="" />}
                {bv.rewards.brainDelta !== 0 && (
                    <Row
                        icon={<Icon name="skull" className={bv.rewards.brainDelta > 0 ? 'text-primary' : 'text-danger'} />}
                        text={`${bv.rewards.brainDelta > 0 ? '+' : ''}${bv.rewards.brainDelta} Brain`}
                        note=""
                    />
                )}
                {typeof bv.rewards.stars === 'number' && <Row icon={<Icon name="trophy" className="text-epic" />} text={`${bv.rewards.stars} stars`} note="" />}
                {cappedGloo && <p className="t-caption text-muted">Gloo cap reached for today</p>}
                {cappedEggs && <p className="t-caption text-muted">PvP egg limit reached for today</p>}
                {!won && <p className="t-body text-ink">Try another mix of parts and fight again.</p>}
            </div>

            <div className="flex w-full flex-col gap-2">
                <TxChip label="Battle start" status="confirmed" hash={bv.txStart} />
                {pending ? (
                    <div className="flex items-center justify-between gap-2">
                        <TxChip label="Result pending" status="failed" />
                        <button type="button" className="btn btn-secondary btn-md" disabled={retryFinalize.pending} onClick={retry}>
                            <span className="t-button">{retryFinalize.pending ? 'Retrying…' : 'Retry'}</span>
                        </button>
                    </div>
                ) : (
                    bv.txFinal && <TxChip label="Battle final" status="confirmed" hash={bv.txFinal} />
                )}
                {retryFinalize.error && (
                    <p className="t-caption flex items-center gap-2 text-danger" role="alert">
                        <Icon name="close" size={16} />
                        {retryFinalize.error}
                    </p>
                )}
                {retried && <p className="t-caption text-primary">Result confirmed on Monad.</p>}
                {againAction.error && (
                    <p className="t-caption flex items-center gap-2 text-danger" role="alert">
                        <Icon name="close" size={16} />
                        {againAction.error}
                    </p>
                )}
            </div>

            <div className="flex w-full flex-col gap-2">
                <button
                    type="button"
                    autoFocus
                    className="btn btn-primary btn-lg w-full"
                    disabled={retryFinalize.pending}
                    onClick={() => openReplay(bv.battleId)}
                >
                    <span className="t-button-lg">Replay</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        className="btn btn-secondary btn-md w-full"
                        disabled={againAction.pending}
                        onClick={() => (pve ? void againAction.run(() => fightLevel(tier)) : openPhase('pvp'))}
                    >
                        <span className="t-button">{pve ? (againAction.pending ? 'Starting…' : 'Again') : 'PvP'}</span>
                    </button>
                    <button type="button" className="btn btn-secondary btn-md w-full" onClick={backToLab}>
                        <span className="t-button">Back to Lab</span>
                    </button>
                </div>
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
