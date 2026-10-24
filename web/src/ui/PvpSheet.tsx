/**
 * S-07 PvP (F-07): fight another lab by code or invite link. The defender does
 * not have to be online — the API reads their current on-chain loadout, so the
 * preview and the matchup row describe the monster that will actually fight.
 *
 * States: empty (no code yet), looking up, error (bad format / not found /
 * your own code / Monad), populated preview, fight in flight.
 * The mini is the same 3D part renderer the Lab uses (`PartIcon`).
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../chain/api.ts';
import type { PlayerLookup } from '../../server/types.ts';
import { backToLab, fightPvp, loadoutParts, toast } from '../game/actions.ts';
import { store, useStore } from '../state/store.ts';
import { errorCopy } from './copy.ts';
import { errorText, useAction } from './useAction.ts';
import { matchupLabels, matchupLine, matchupOf, type MatchupLabel } from './matchup.ts';
import { inviteLink, normalizeCode } from './pvpCode.ts';
import { partElements } from './elements.ts';
import ElementChip from './ElementChip.tsx';
import { PartIcon, Sheet } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

export default function PvpSheet() {
    const me = useStore((s) => s.me);
    const pendingCode = useStore((s) => s.pendingCode);
    const wide = useLayout() === 'wide';

    const [input, setInput] = useState(pendingCode ?? '');
    const [looking, setLooking] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [opponent, setOpponent] = useState<PlayerLookup | null>(null);
    const [foundCode, setFoundCode] = useState<string | null>(null);
    const { run, pending, error: fightError } = useAction('fight', 'Fight');
    const autoRan = useRef(false);
    const busy = useRef(false);

    const lookup = async (raw: string) => {
        if (busy.current) return;
        const code = normalizeCode(raw);
        if (!code) {
            setOpponent(null);
            setFoundCode(null);
            setLookupError(errorCopy('bad_code_format'));
            return;
        }
        if (code === me?.code) {
            setOpponent(null);
            setFoundCode(null);
            setLookupError(errorCopy('self_battle'));
            return;
        }
        busy.current = true;
        setLooking(true);
        setLookupError(null);
        setOpponent(null);
        setFoundCode(null);
        try {
            const player = await api.playerByCode(code);
            setOpponent(player);
            setFoundCode(code);
        } catch (e) {
            setLookupError(errorText(e));
        } finally {
            busy.current = false;
            setLooking(false);
        }
    };

    // An invite link (`/?vs=CODE`) arrives here as `pendingCode`: show the code and look it up once.
    useEffect(() => {
        if (!pendingCode || autoRan.current || !me?.registered) return;
        autoRan.current = true;
        setInput(pendingCode);
        // Consumed: the prefill belongs to this visit only.
        store.patch({ pendingCode: null });
        void lookup(pendingCode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingCode, me?.registered]);

    if (!me) {
        return (
            <Sheet title="PvP" onClose={backToLab} width={560}>
                <div className="flex items-center gap-2 py-4" role="status" aria-live="polite">
                    <span className="tx-spin" aria-hidden />
                    <span className="t-body text-muted">Loading your lab…</span>
                </div>
            </Sheet>
        );
    }

    const pvpToday = me.limits?.pvpEggsToday ?? 0;
    const pvpCap = me.limits?.pvpEggCap ?? 5;
    const code = me.code ?? null;

    const copyLink = () => {
        if (!code) return;
        const link = inviteLink(code, window.location.origin);
        void navigator.clipboard?.writeText(link).then(
            () => toast('Link copied'),
            () => toast('Copy failed'),
        );
    };

    const fight = () => {
        if (!opponent || !foundCode) return;
        void run(() => fightPvp(foundCode, opponent.username));
    };

    const shownError = lookupError ?? fightError;
    const mineParts = loadoutParts(me.loadout);
    const theirParts = opponent ? loadoutParts(opponent.loadout) : [];
    const matchup = opponent ? matchupOf(mineParts, theirParts) : null;

    return (
        <Sheet title="PvP" onClose={backToLab} width={560}>
            <div className={`flex flex-col gap-3 ${wide ? 'max-h-[70vh]' : ''} overflow-y-auto overflow-x-hidden pr-1`}>
                {/* My code + invite link */}
                <div className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="flex min-w-0 flex-col gap-1">
                        <span className="t-label text-muted">YOUR CODE</span>
                        <span className="t-num-lg tracking-[0.12em]">{code ?? '—'}</span>
                    </span>
                    <button type="button" className="btn btn-secondary btn-md gap-2" disabled={!code} onClick={copyLink}>
                        <Icon name="link" size={20} />
                        <span className="t-button">Copy Link</span>
                    </button>
                </div>
                <p className="t-caption text-muted">Share your link and a friend opens this screen with your code ready.</p>

                {/* Opponent code */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void lookup(input);
                    }}
                >
                    <label htmlFor="opponent-code" className="t-caption text-muted">
                        Opponent code
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                        <input
                            id="opponent-code"
                            autoFocus={!pendingCode}
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={12}
                            value={input}
                            placeholder="MONS-______"
                            aria-invalid={!!lookupError}
                            aria-describedby="opponent-code-help"
                            onChange={(e) => setInput(e.target.value.toUpperCase())}
                            onBlur={() => input.trim() && !normalizeCode(input) && setLookupError(errorCopy('bad_code_format'))}
                            className={`t-num min-w-0 flex-1 rounded-[var(--radius-sm)] border-2 bg-panel px-3 py-2 tracking-[0.12em] text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-primary ${
                                lookupError ? 'border-danger' : 'border-edge-strong'
                            }`}
                        />
                        <button type="submit" className="btn btn-secondary btn-md" disabled={looking || !input.trim()}>
                            <span className="t-button">Find</span>
                        </button>
                    </div>
                    {shownError ? (
                        <p id="opponent-code-help" className="t-caption mt-2 flex items-center gap-2 text-danger" role="alert">
                            <Icon name="close" size={16} />
                            {shownError}
                        </p>
                    ) : (
                        <p id="opponent-code-help" className="t-caption mt-2 text-muted">
                            Codes look like MONS-AB12CD.
                        </p>
                    )}
                </form>

                {/* Result: empty, looking, populated */}
                {looking ? (
                    <div className="panel flex items-center gap-2 px-3 py-3" role="status" aria-live="polite">
                        <span className="tx-spin" aria-hidden />
                        <span className="t-body text-muted">Looking up that lab…</span>
                    </div>
                ) : opponent && matchup ? (
                    <div className="pop-in flex flex-col gap-2">
                        <div className="panel flex items-center gap-3 px-3 py-2">
                            <span className="flex shrink-0 items-end gap-0.5 rounded-[var(--radius-sm)] bg-black/30 px-1 pb-1 pt-2" role="img" aria-label={`${opponent.username} monster`}>
                                {theirParts.map((p, i) => (
                                    <PartIcon key={`${p}-${i}`} id={p} size={i === 1 ? 44 : 36} />
                                ))}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="t-button truncate">@{opponent.username}</span>
                                <span className="t-caption flex items-center gap-1.5 text-muted">
                                    <Icon name="skull" size={16} className="text-primary" />
                                    Brain <span className="t-num">{opponent.brain}</span>
                                </span>
                            </span>
                        </div>

                        <div className="panel flex flex-col gap-2 px-3 py-2">
                            <span className="t-label text-muted">THEIR ELEMENTS</span>
                            {(['Attack', 'Defense', 'Special'] as const).map((lane, i) => {
                                const els = partElements(theirParts[i]);
                                return (
                                    <span key={lane} className="flex items-center justify-between gap-2">
                                        <span className="t-caption text-muted">{lane}</span>
                                        <span className="flex items-center gap-2">
                                            {els ? els.map((el) => <ElementChip key={el} el={el} size="md" />) : <span className="t-caption text-muted">None</span>}
                                        </span>
                                    </span>
                                );
                            })}
                        </div>

                        {/* F-16: the two lanes that decide the fight, read from my side. */}
                        <div className="panel flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" aria-label={matchupLine(matchup)}>
                            <span className="t-label text-muted">MATCHUP</span>
                            <span className="t-caption flex items-center gap-1.5">
                                Your attack: <MatchupTag label={matchupLabels(matchup.attack)} />
                            </span>
                            <span className="t-caption text-muted" aria-hidden>
                                ·
                            </span>
                            <span className="t-caption flex items-center gap-1.5">
                                Their attack: <MatchupTag label={matchupLabels(matchup.defense)} />
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="panel flex items-center gap-2 px-3 py-3">
                        <Icon name="sword" size={20} className="text-muted" />
                        <span className="t-body text-muted">Ask a friend for their code, or share your link.</span>
                    </div>
                )}

                <span className="chip w-fit" aria-label={`Eggs from PvP today ${pvpToday} of ${pvpCap}`}>
                    <Icon name="egg" size={18} className="text-primary" />
                    <span className="t-caption text-muted">Eggs from PvP today</span>
                    <span className="t-num">
                        {pvpToday}/{pvpCap}
                    </span>
                </span>

                <button type="button" className="btn btn-primary btn-lg w-full" disabled={!opponent || pending || looking} aria-busy={pending} onClick={fight}>
                    <span className="t-button-lg">{pending ? 'Starting…' : 'Fight'}</span>
                </button>
                {!opponent && <p className="t-caption text-center text-muted">Find an opponent to start a fight.</p>}
            </div>
        </Sheet>
    );
}

/** Strong / Good / Even / Risky / Weak — text plus an icon, never colour alone. */
function MatchupTag({ label }: { label: MatchupLabel }) {
    const tone =
        label === 'Strong' ? 'text-primary' : label === 'Weak' ? 'text-danger' : label === 'Good' ? 'text-ink' : 'text-muted';
    return (
        <span className={`t-button flex items-center gap-1 ${tone}`}>
            {(label === 'Risky' || label === 'Weak') && <Icon name="help" size={16} />}
            {label}
        </span>
    );
}
