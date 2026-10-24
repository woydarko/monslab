/**
 * S-10 Replay: anyone, logged in or not, can open `/?replay=<battleId>` and
 * watch the fight that Monad recorded. Both fighters come from the loadout
 * snapshots in `BattleStarted`; the outcome and rewards come from
 * `BattleFinalized`/`RewardGranted`; the badge is K5's verification verdict.
 *
 * States: loading, not found, still in progress, unsupported sim version,
 * playback, then the verdict + outcome. All motion is decorative.
 */
import { useEffect, useState } from 'react';
import { useStore } from '../state/store.ts';
import { fetchBattle, verifyBattle, type BattleRecord, type VerifyResult } from '../chain/replay.ts';
import { partsFromLoadout } from '../chain/loadout.ts';
import { getPlayer } from '../chain/reads.ts';
import { leaveReplay, playReplayBattle, skipBattle, toast } from '../game/actions.ts';
import { gameEvents } from '../game/events.ts';
import { ARENA } from '../game/data/arena.ts';
import { usePrefersReducedMotion } from './motion.ts';
import { battleLink, replayBadge, replayPhaseOf, shortAddress, winnerBanner } from './replayView.ts';
import { PartIcon, Sheet } from './bits.tsx';
import VerifiedBadge from './VerifiedBadge.tsx';
import TxChip, { shortHash } from './TxChip.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';
import { errorText } from './useAction.ts';

const ZERO = '0x0000000000000000000000000000000000000000';

export default function ReplayScreen() {
    const replayId = useStore((s) => s.replayId);
    const wide = useLayout() === 'wide';
    const reduced = usePrefersReducedMotion();

    const [record, setRecord] = useState<BattleRecord | null>(null);
    const [verify, setVerify] = useState<VerifyResult | null>(null);
    const [names, setNames] = useState<[string, string] | null>(null);
    const [missing, setMissing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [done, setDone] = useState(false);

    // Read the battle from Monad, verify it, then play it.
    useEffect(() => {
        if (!replayId) return;
        let live = true;
        setRecord(null);
        setVerify(null);
        setNames(null);
        setMissing(false);
        setError(null);
        setDone(false);
        (async () => {
            try {
                const rec = await fetchBattle(BigInt(replayId));
                if (!live) return;
                if (!rec) {
                    setMissing(true);
                    return;
                }
                const verdict = verifyBattle(rec);
                const resolved = await resolveNames(rec);
                if (!live) return;
                setRecord(rec);
                setVerify(verdict);
                setNames(resolved);
                if (verdict.sim) playReplayBattle(rec, verdict.sim, resolved);
            } catch (e) {
                if (live) setError(errorText(e));
            }
        })();
        return () => {
            live = false;
        };
    }, [replayId, attempt]);

    // The battle scene tells us when the fight is over.
    useEffect(() => gameEvents.on('battleDone', () => setDone(true)), []);

    const phase = error ? 'error' : missing ? 'not_found' : replayPhaseOf(record, verify);
    const replay = () => setAttempt((n) => n + 1);

    if (phase !== 'ready') {
        return (
            <Sheet title="REPLAY" onClose={leaveReplay}>
                <StatePanel phase={phase} error={error} record={record} onRetry={replay} />
            </Sheet>
        );
    }

    const rec = record!;
    const verdict = verify!;
    const badge = replayBadge(verdict);
    const claimed = verdict.claimed!;
    const atk = partsFromLoadout(rec.atkLoadout).parts;
    const def = partsFromLoadout(rec.defLoadout).parts;
    const link = battleLink(replayId!, window.location.origin);

    const copy = () => {
        void navigator.clipboard?.writeText(link).then(
            () => toast('Link copied'),
            () => toast('Copy failed'),
        );
    };

    const meta = (
        <span className="t-label text-muted">
            sim v{rec.simVersion} · seed {rec.seed} · #{String(rec.battleId)}
        </span>
    );

    return (
        <div className={wide ? 'pointer-events-none absolute inset-0' : 'pointer-events-none absolute inset-0 flex flex-col'}>
            {/* Top-left context: always visible, even while the fight plays. */}
            <div className={`absolute ${wide ? 'left-6 bottom-6' : 'inset-x-4 top-4'} flex items-center gap-2`}>
                <span className="chip pointer-events-auto inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1">
                    <Icon name="eye" size={18} className="text-primary" />
                    <span className="t-label">REPLAY</span>
                    <span className="t-num">#{String(rec.battleId)}</span>
                </span>
            </div>

            {!done && (
                <div className={`pointer-events-auto absolute ${wide ? 'bottom-6 right-6' : 'bottom-4 right-4'} flex gap-2`}>
                    <button type="button" className="btn btn-secondary btn-icon pointer-events-auto w-auto gap-1 px-3" onClick={skipBattle}>
                        <span className="t-button">SKIP</span>
                    </button>
                </div>
            )}

            {done && (
                <div
                    className={
                        wide
                            ? 'pointer-events-auto absolute bottom-6 left-1/2 flex w-[560px] -translate-x-1/2 flex-col gap-3'
                            : 'pb-safe-bottom pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-2 px-4 pb-4'
                    }
                >
                    <h2
                        className={`t-banner text-center ${claimed.winner === 0 ? 'text-primary' : 'text-danger'} ${reduced ? '' : 'pop-in'}`}
                        style={{ textShadow: '0 5px 0 #140b20', WebkitTextStroke: '2px #140b20' }}
                    >
                        {winnerBanner(claimed)}
                    </h2>

                    <div className={`panel flex flex-col gap-2 px-3 py-2 ${reduced ? '' : 'pop-in'}`}>
                        <Fighters names={names!} atk={atk} def={def} mode={rec.mode} />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="t-caption text-muted">
                                {claimed.actions} actions · attacker HP {claimed.hpLeftA}/{claimed.maxHpA} · defender HP {claimed.hpLeftB}/{claimed.maxHpB}
                            </span>
                        </div>
                        {rec.rewards ? (
                            <div className="flex flex-wrap items-center gap-3">
                                {rec.rewards.gloo > 0n && <Reward icon="flask" text={`+${rec.rewards.gloo} Gloo`} />}
                                {rec.rewards.eggs > 0 && <Reward icon="egg" text={`+${rec.rewards.eggs} Egg`} />}
                                {rec.rewards.brainDelta !== 0 && (
                                    <Reward icon="skull" text={`${rec.rewards.brainDelta > 0 ? '+' : ''}${rec.rewards.brainDelta} Brain`} />
                                )}
                                {rec.rewards.gloo === 0n && rec.rewards.eggs === 0 && rec.rewards.brainDelta === 0 && (
                                    <span className="t-caption text-muted">No rewards on this battle</span>
                                )}
                            </div>
                        ) : (
                            <span className="t-caption text-muted">Rewards not recorded</span>
                        )}
                    </div>

                    <VerifiedBadge badge={badge} meta={`sim v${rec.simVersion}`} />

                    <div className="flex flex-wrap items-center gap-2">
                        {meta}
                        <TxChip label="Battle start" status="confirmed" hash={rec.startTx} />
                        {rec.final && <TxChip label="Battle final" status="confirmed" hash={rec.final.txHash} />}
                    </div>

                    <div className="flex gap-2">
                        <button type="button" autoFocus className="btn btn-primary btn-md flex-1" onClick={replay}>
                            <span className="t-button">Replay Again</span>
                        </button>
                        <button type="button" className="btn btn-secondary btn-md gap-2" onClick={copy}>
                            <Icon name="link" size={20} />
                            <span className="t-button">Copy Link</span>
                        </button>
                        <button type="button" className="btn btn-secondary btn-md" onClick={leaveReplay}>
                            <span className="t-button">Back</span>
                        </button>
                    </div>
                    <p className="t-caption truncate text-center text-muted">{link}</p>
                </div>
            )}
        </div>
    );
}

/** Names come from the chain (`getPlayer`); logged-out readers get short addresses. */
async function resolveNames(r: BattleRecord): Promise<[string, string]> {
    const fallback: [string, string] = [
        shortAddress(r.attacker),
        r.mode === 0 ? (ARENA[Number(r.ref)]?.name ?? 'Wild monster') : shortAddress(r.defender),
    ];
    try {
        const attacker = await getPlayer(r.attacker);
        const a = attacker?.username || fallback[0];
        if (r.mode === 0 || !r.defender || r.defender.toLowerCase() === ZERO) return [a, fallback[1]];
        const defender = await getPlayer(r.defender);
        return [a, defender?.username || fallback[1]];
    } catch {
        return fallback;
    }
}

function Reward({ icon, text }: { icon: 'flask' | 'egg' | 'skull'; text: string }) {
    return (
        <span className="flex items-center gap-1">
            <Icon name={icon} size={18} className={icon === 'skull' ? 'text-primary' : icon === 'egg' ? 'text-primary' : 'text-goo'} />
            <span className="t-button">{text}</span>
        </span>
    );
}

function Fighters({ names, atk, def, mode }: { names: [string, string]; atk: readonly string[]; def: readonly string[]; mode: 0 | 1 | 2 }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <Side name={names[0]} parts={atk} />
            <span className="t-label shrink-0 text-muted">{mode === 0 ? 'LEVEL' : mode === 1 ? 'PVP' : 'WAR'}</span>
            <Side name={names[1]} parts={def} enemy />
        </div>
    );
}

function Side({ name, parts, enemy = false }: { name: string; parts: readonly string[]; enemy?: boolean }) {
    return (
        <div className={`flex min-w-0 flex-col gap-1 ${enemy ? 'items-end' : 'items-start'}`}>
            <span className="t-button flex min-w-0 items-center gap-1">
                <Icon name={enemy ? 'skull' : 'flask'} size={16} className={enemy ? 'text-danger' : 'text-primary'} />
                <span className="truncate">{name}</span>
            </span>
            <span className="flex gap-1">
                {parts.map((p) => (
                    <PartIcon key={p} id={p} size={22} />
                ))}
            </span>
        </div>
    );
}

function StatePanel({
    phase,
    error,
    record,
    onRetry,
}: {
    phase: string;
    error: string | null;
    record: BattleRecord | null;
    onRetry: () => void;
}) {
    const text: Record<string, { title: string; body: string }> = {
        loading: { title: 'Reading battle from Monad…', body: 'One moment.' },
        not_found: { title: 'Battle not found', body: 'Nothing on Monad has this battle number. Check the link.' },
        in_progress: { title: 'Battle still in progress', body: 'The result has not been finalized on Monad yet.' },
        unsupported: { title: 'Sim version not supported', body: 'This build cannot replay that version of the fight.' },
        error: { title: 'Could not read the battle', body: error ?? 'Monad is slow right now. Try again.' },
    };
    const copy = text[phase] ?? text.error;
    return (
        <div className="flex flex-col gap-3">
            <div className="panel flex items-start gap-3 px-3 py-3" role="status" aria-live="polite">
                {phase === 'loading' ? <span className="tx-spin mt-1" aria-hidden /> : <Icon name="close" size={24} className="mt-0.5 text-danger" />}
                <div className="min-w-0">
                    <p className="t-button">{copy.title}</p>
                    <p className="t-body mt-1 text-muted">{copy.body}</p>
                </div>
            </div>
            {record && (
                <div className="flex flex-wrap items-center gap-2">
                    <TxChip label="Battle start" status="confirmed" hash={record.startTx} />
                    <span className="t-label text-muted">#{String(record.battleId)} · seed {record.seed}</span>
                </div>
            )}
            <div className="flex gap-2">
                {(phase === 'error' || phase === 'not_found' || phase === 'in_progress') && (
                    <button type="button" autoFocus className="btn btn-primary btn-md flex-1" onClick={onRetry}>
                        <span className="t-button">Try Again</span>
                    </button>
                )}
                <button type="button" className="btn btn-secondary btn-md flex-1" onClick={leaveReplay}>
                    <span className="t-button">Back</span>
                </button>
            </div>
            {phase === 'in_progress' && (
                <p className="t-caption text-muted">
                    Start tx <span className="t-num">{record ? shortHash(record.startTx) : ''}</span>
                </p>
            )}
        </div>
    );
}
