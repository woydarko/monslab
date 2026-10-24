/**
 * S-11 / S-12 Communities and weekly tasks (F-09, F-10).
 *
 * No community yet: create one (3–20 characters) or join by id. In a community:
 * the roster with each member's Brain and equipped monster, plus the two weekly
 * tasks (theme wins, mass hatch) with their bronze / silver / gold claims.
 *
 * The API only exposes writes for communities (create, join, leave, claim), so
 * the reads go straight to the community contract, like the replay screen.
 * Every write refreshes `me`, because eggs and the accessory land in the top bar.
 */
import { useCallback, useEffect, useState } from 'react';
import { zeroAddress } from 'viem';
import { api } from '../chain/api.ts';
import { ADDR } from '../chain/addresses.ts';
import { getCommunity, getCurrentWeek, getMembers, getThemeFamily, getWeekly, getWeekEndsAt, type MemberView } from '../chain/reads.ts';
import type { CommunityView, WeeklyView } from '../chain/types.ts';
import type { MeView } from '../../server/types.ts';
import { backToLab, refreshMe, toast } from '../game/actions.ts';
import { FAMILIES } from '../game/data/families.ts';
import { useStore } from '../state/store.ts';
import { errorCopy } from './copy.ts';
import { errorText, useAction } from './useAction.ts';
import { formatCountdown, TASK, themeFamily, TIER_LABEL, TIER_REWARD, tierState, TIERS, type TaskName, type TierState } from './weekly.ts';
import { FamilyDot, PartIcon, Sheet } from './bits.tsx';
import { shortAddress } from './replayView.ts';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

/** F-09: 30 members per community (proposal). */
const MEMBER_CAP = 30;
const NAME_RE = /^[A-Za-z0-9 _-]{3,20}$/;
const TASKS: TaskName[] = ['theme', 'hatch'];
/** Graphics only: the three tier markers (DESIGN_SYSTEM §Components). */
const TIER_COLOR = ['var(--color-bronze)', 'var(--color-silver)', 'var(--color-gold)'];
const STATE_LABEL: Record<TierState, string> = {
    claimed: 'Claimed',
    claimable: 'Claim',
    locked: 'Locked',
    needContribution: 'No contribution',
};

export default function CommunitySheet() {
    const me = useStore((s) => s.me);
    const wide = useLayout() === 'wide';

    if (!me) {
        return (
            <Sheet title="Community" onClose={backToLab} width={820}>
                <div className="flex items-center gap-2 py-4" role="status" aria-live="polite">
                    <span className="tx-spin" aria-hidden />
                    <span className="t-body text-muted">Loading your lab…</span>
                </div>
            </Sheet>
        );
    }

    const cid = me.communityId ?? 0;
    return cid > 0 ? <CommunityHome cid={cid} me={me} wide={wide} /> : <NoCommunity wide={wide} />;
}

/** S-11: create a community or join one by its number. */
function NoCommunity({ wide }: { wide: boolean }) {
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState<string | null>(null);
    const [joinId, setJoinId] = useState('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const create = useAction('create-community', 'Create community');
    const join = useAction('join-community', 'Join community');

    const submitCreate = () => {
        const value = name.trim();
        if (!NAME_RE.test(value)) {
            setNameError(errorCopy('invalid_community_name'));
            return;
        }
        setNameError(null);
        void create.run(async () => {
            const res = await api.createCommunity(value);
            await refreshMe();
            toast('Community created');
            return res;
        });
    };

    const submitJoin = () => {
        const id = Number(joinId.trim());
        if (!Number.isInteger(id) || id <= 0) {
            setJoinError(errorCopy('community_not_found'));
            return;
        }
        setJoinError(null);
        void join.run(async () => {
            const res = await api.joinCommunity(id);
            await refreshMe();
            toast('Community joined');
            return res;
        });
    };

    const shownNameError = nameError ?? create.error;
    const shownJoinError = joinError ?? join.error;

    return (
        <Sheet title="Community" onClose={backToLab} width={520}>
            <div className={`flex flex-col gap-4 ${wide ? '' : 'max-h-[70vh]'} overflow-y-auto overflow-x-hidden pr-1`}>
                <p className="t-body text-muted">Team up for weekly goals and Community Wars.</p>

                <form
                    className="panel flex flex-col gap-2 p-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submitCreate();
                    }}
                >
                    <label htmlFor="community-name" className="t-caption text-muted">
                        Community name
                    </label>
                    <input
                        id="community-name"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={20}
                        value={name}
                        aria-invalid={!!shownNameError}
                        aria-describedby="community-name-help"
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => name && !NAME_RE.test(name.trim()) && setNameError(errorCopy('invalid_community_name'))}
                        className={`t-num w-full rounded-[var(--radius-sm)] border-2 bg-panel px-3 py-2 text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-primary ${
                            shownNameError ? 'border-danger' : 'border-edge-strong'
                        }`}
                    />
                    {shownNameError ? (
                        <p id="community-name-help" className="t-caption flex items-center gap-2 text-danger" role="alert">
                            <Icon name="close" size={16} />
                            {shownNameError}
                        </p>
                    ) : (
                        <p id="community-name-help" className="t-caption text-muted">
                            3–20 chars: letters, numbers, space, - or _
                        </p>
                    )}
                    <p className="t-caption text-muted">You become the leader. Up to {MEMBER_CAP} members.</p>
                    <button type="submit" className="btn btn-primary btn-lg mt-1 w-full" disabled={create.pending} aria-busy={create.pending}>
                        <span className="t-button-lg">{create.pending ? 'Creating…' : 'Create'}</span>
                    </button>
                </form>

                <form
                    className="panel flex flex-col gap-2 p-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submitJoin();
                    }}
                >
                    <label htmlFor="community-id" className="t-caption text-muted">
                        Join with a community number
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            id="community-id"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={8}
                            value={joinId}
                            aria-invalid={!!shownJoinError}
                            aria-describedby="community-id-help"
                            onChange={(e) => setJoinId(e.target.value.replace(/[^0-9]/g, ''))}
                            className={`t-num min-w-0 flex-1 rounded-[var(--radius-sm)] border-2 bg-panel px-3 py-2 text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-primary ${
                                shownJoinError ? 'border-danger' : 'border-edge-strong'
                            }`}
                        />
                        <button type="submit" className="btn btn-secondary btn-md" disabled={join.pending || !joinId}>
                            <span className="t-button">{join.pending ? 'Joining…' : 'Join'}</span>
                        </button>
                    </div>
                    {shownJoinError ? (
                        <p id="community-id-help" className="t-caption flex items-center gap-2 text-danger" role="alert">
                            <Icon name="close" size={16} />
                            {shownJoinError}
                        </p>
                    ) : (
                        <p id="community-id-help" className="t-caption text-muted">
                            Ask the leader for their number. One community per player.
                        </p>
                    )}
                </form>
            </div>
        </Sheet>
    );
}

/** S-12: roster, weekly tasks and the claims. */
function CommunityHome({ cid, me, wide }: { cid: number; me: MeView; wide: boolean }) {
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [community, setCommunity] = useState<CommunityView | null>(null);
    const [members, setMembers] = useState<MemberView[]>([]);
    const [week, setWeek] = useState(0);
    const [endsAt, setEndsAt] = useState(0);
    const [theme, setTheme] = useState<number | null>(null);
    const [weekly, setWeekly] = useState<WeeklyView | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [confirmLeave, setConfirmLeave] = useState(false);
    const claim = useAction('claim', 'Claim');
    const leave = useAction('leave', 'Leave community');

    const load = useCallback(async () => {
        setState('loading');
        setError(null);
        // No contract address in this build: say so instead of showing an RPC error.
        if (ADDR.community === zeroAddress) {
            setError('Community is not set up in this build yet.');
            setState('error');
            return;
        }
        try {
            const wk = await getCurrentWeek();
            const [c, w, end, fam] = await Promise.all([getCommunity(cid), getWeekly(wk, cid, me.address), getWeekEndsAt(), getThemeFamily(wk)]);
            const rows = await getMembers(c.members);
            setWeek(wk);
            setCommunity(c);
            setWeekly(w);
            setEndsAt(end);
            setTheme(fam);
            setMembers(rows);
            setState('ready');
        } catch (e) {
            setError(errorText(e));
            setState('error');
        }
    }, [cid, me.address]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const doClaim = (task: TaskName, tier: number) => {
        void claim.run(async () => {
            const res = await api.claimWeekly(week, TASK[task], tier);
            await refreshMe();
            await load();
            toast('Reward claimed');
            return res;
        });
    };

    const doLeave = () => {
        void leave.run(async () => {
            const res = await api.leaveCommunity();
            await refreshMe();
            toast('You left the community');
            return res;
        });
    };

    const countdown = formatCountdown(endsAt - Math.floor(now / 1000));
    const themeId = theme === null ? null : themeFamily(theme);
    const states: Record<TaskName, TierState[]> | null = weekly
        ? {
              theme: tierState(weekly.progress[0], weekly.contribution[0], weekly.claimedMask[0], TIERS.theme),
              hatch: tierState(weekly.progress[1], weekly.contribution[1], weekly.claimedMask[1], TIERS.hatch),
          }
        : null;
    // One PrimaryButton per screen: the first tier that can be claimed right now.
    const primary = states
        ? TASKS.flatMap((t) => states[t].map((s, i) => ({ t, i, s }))).find((x) => x.s === 'claimable')
        : undefined;
    // F-10: the gold accessory (202) is one per player per week, across both tasks.
    const accessoryTaken = !!weekly && ((weekly.claimedMask[0] & 0b100) !== 0 || (weekly.claimedMask[1] & 0b100) !== 0);

    const shownError = claim.error ?? leave.error ?? error;

    if (state !== 'ready' || !community || !weekly || !states) {
        return (
            <Sheet title="Community" onClose={backToLab} width={820}>
                <div className="panel flex flex-col gap-3 p-3" role="status" aria-live="polite">
                    <div className="flex items-center gap-2">
                        {state === 'error' ? <Icon name="close" size={20} className="text-danger" /> : <span className="tx-spin" aria-hidden />}
                        <span className="t-body text-muted">{state === 'error' ? (shownError ?? errorCopy('network')) : 'Reading your community from Monad…'}</span>
                    </div>
                    {state === 'error' && (
                        <button type="button" className="btn btn-secondary btn-md w-fit" onClick={() => void load()}>
                            <span className="t-button">Retry</span>
                        </button>
                    )}
                </div>
            </Sheet>
        );
    }

    const roster = (
        <div className="panel flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
                <span className="t-label text-muted">MEMBERS</span>
                <span className="t-caption text-muted" aria-label={`${members.length} of ${MEMBER_CAP} members`}>
                    {members.length}/{MEMBER_CAP}
                </span>
            </div>
            <ul className={`flex min-h-0 flex-col gap-1 ${wide ? 'max-h-[46vh]' : 'max-h-[30vh]'} overflow-y-auto pr-1`}>
                {members.map((m) => {
                    const isLeader = m.address.toLowerCase() === community.leader.toLowerCase();
                    return (
                        <li key={m.address} className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-black/25 px-2 py-1">
                            <span className="w-5 shrink-0 text-primary">{isLeader && <Icon name="trophy" size={16} title="Leader" />}</span>
                            <span className="t-caption flex min-w-0 flex-1 items-center gap-1.5">
                                <span className="truncate">{m.username || shortAddress(m.address)}</span>
                                {m.address.toLowerCase() === me.address.toLowerCase() && <span className="t-label text-primary">YOU</span>}
                            </span>
                            <span className="flex shrink-0 gap-0.5" aria-hidden>
                                {m.parts.map((p, i) => (
                                    <PartIcon key={`${p}-${i}`} id={p} size={22} />
                                ))}
                            </span>
                            <span className="t-num flex shrink-0 items-center gap-1">
                                <Icon name="skull" size={14} className="text-primary" />
                                {m.brain}
                            </span>
                        </li>
                    );
                })}
            </ul>
            {members.length < 2 && <p className="t-caption text-muted">Invite friends with your community name.</p>}
        </div>
    );

    const tasks = (
        <div className="flex flex-col gap-2">
            {TASKS.map((task) => (
                <TaskPanel
                    key={task}
                    task={task}
                    progress={weekly.progress[TASK[task]]}
                    states={states[task]}
                    themeId={themeId}
                    accessoryTaken={accessoryTaken}
                    primaryTier={primary?.t === task ? primary.i : null}
                    pending={claim.pending}
                    onClaim={(tier) => doClaim(task, tier)}
                />
            ))}
        </div>
    );

    return (
        <Sheet title={community.name} onClose={backToLab} width={880}>
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="chip px-2.5">
                        <Icon name="home" size={16} className="text-primary" />
                        <span className="t-num">{members.length}</span>
                        <span className="t-caption text-muted">/{MEMBER_CAP} members</span>
                    </span>
                    <span className="chip px-2.5">
                        <Icon name="next" size={16} className="text-muted" />
                        <span className="t-caption text-muted">week ends in</span>
                        <span className="t-num">{countdown ?? 'ended'}</span>
                    </span>
                    <button type="button" className="btn btn-secondary btn-md ml-auto" onClick={() => void load()} disabled={claim.pending || leave.pending}>
                        <span className="t-button">Refresh</span>
                    </button>
                </div>

                {shownError && (
                    <p className="t-caption flex items-center gap-2 text-danger" role="alert">
                        <Icon name="close" size={16} />
                        {shownError}
                    </p>
                )}

                <div className={wide ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3' : 'flex flex-col gap-3'}>
                    {roster}
                    <div className="flex flex-col gap-2">
                        {tasks}
                        {confirmLeave ? (
                            <div className="panel flex flex-col gap-2 p-3">
                                <p className="t-body">Leave this community?</p>
                                <p className="t-caption text-muted">You can join a new one next week.</p>
                                <div className="flex gap-2">
                                    <button type="button" className="btn btn-secondary btn-md flex-1" disabled={leave.pending} onClick={doLeave}>
                                        <span className="t-button">{leave.pending ? 'Leaving…' : 'Leave'}</span>
                                    </button>
                                    <button type="button" className="btn btn-secondary btn-md flex-1" onClick={() => setConfirmLeave(false)}>
                                        <span className="t-button">Cancel</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-secondary btn-md w-fit" onClick={() => setConfirmLeave(true)}>
                                <span className="t-button">Leave</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Sheet>
    );
}

/** One weekly task: theme wins or mass hatch, with its three claims. */
function TaskPanel({
    task,
    progress,
    states,
    themeId,
    accessoryTaken,
    primaryTier,
    pending,
    onClaim,
}: {
    task: TaskName;
    progress: number;
    states: TierState[];
    themeId: keyof typeof FAMILIES | null;
    accessoryTaken: boolean;
    primaryTier: number | null;
    pending: boolean;
    onClaim: (tier: number) => void;
}) {
    const tiers = TIERS[task];
    const top = tiers[tiers.length - 1];
    const family = themeId ? FAMILIES[themeId] : null;
    return (
        <div className="panel flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                    <span className="t-label text-muted">{task === 'theme' ? 'THEME' : 'MASS HATCH'}</span>
                    {task === 'theme' && themeId && family ? (
                        <span className="t-caption flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-black/40 px-2 py-0.5">
                            <FamilyDot family={themeId} size={10} /> {family.name.toUpperCase()} week
                        </span>
                    ) : (
                        <span className="t-caption text-muted">Open eggs together</span>
                    )}
                </span>
                <span className="t-num" aria-label={`${progress} of ${top}`}>
                    {progress}/{top}
                </span>
            </div>

            {/* 12 px bar with the three tier markers (graphics only). */}
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-black/50" role="img" aria-label={`${progress} of ${top}`}>
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (progress / top) * 100)}%` }} />
                {tiers.map((goal, i) => (
                    <span key={goal} className="absolute top-0 h-full w-[2px]" style={{ left: `${(goal / top) * 100}%`, background: TIER_COLOR[i] }} aria-hidden />
                ))}
            </div>

            <p className="t-caption text-muted">
                {task === 'theme' ? `Win PvP with a ${family ? family.name : 'theme'} part equipped.` : 'Every egg your community opens counts.'}
            </p>

            <div className="grid grid-cols-3 gap-2">
                {tiers.map((goal, i) => {
                    const s = states[i];
                    const gold = i === 2;
                    const reward = gold && accessoryTaken ? '1 rare egg · Accessory already claimed this week' : TIER_REWARD[task][i];
                    const isPrimary = primaryTier === i;
                    return (
                        <button
                            key={goal}
                            type="button"
                            disabled={s !== 'claimable' || pending}
                            aria-label={`${TIER_LABEL[i]} ${goal} ${STATE_LABEL[s]}`}
                            onClick={() => onClaim(i)}
                            className={`btn ${isPrimary ? 'btn-primary' : 'btn-secondary'} flex-col gap-1 px-1.5 py-2 text-center`}
                        >
                            <span className="t-button flex items-center gap-1">
                                {s === 'claimed' && <Icon name="check" size={16} />}
                                {TIER_LABEL[i]}
                            </span>
                            <span className="t-label">{goal}</span>
                            <span className="t-caption leading-tight opacity-90">{s === 'claimable' || s === 'claimed' ? reward : STATE_LABEL[s]}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
