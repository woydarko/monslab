/**
 * S-08 Battle HUD: enemy bar on top, player bar at the bottom, speed and skip,
 * floating numbers from game events, and the element callout (F-16).
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.ts';
import { gameEvents, type FloatKind } from '../game/events.ts';
import { setBattleSpeed, skipBattle } from '../game/actions.ts';
import { getPart } from '../game/data/parts.ts';
import { useCallout } from './callouts.ts';
import { usePrefersReducedMotion } from './motion.ts';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

export default function BattleHud() {
    const battle = useStore((s) => s.battle);
    const phase = useStore((s) => s.phase);
    const [hp, setHp] = useState<[number, number]>(battle ? [...battle.maxHp] : [1, 1]);
    const [fast, setFast] = useState(false);
    const key = battle?.names.join('|');

    useEffect(() => {
        if (battle) setHp([...battle.maxHp]);
        setFast(false);
        return gameEvents.on('hp', ({ side, hp: v }) =>
            setHp((cur) => {
                const next: [number, number] = [...cur];
                next[side] = v;
                return next;
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const wide = useLayout() === 'wide';
    const controls = phase === 'battle';
    const toggleFast = () => {
        setBattleSpeed(fast ? 1 : 2);
        setFast(!fast);
    };

    // Desktop keyboard: F = double speed, S = skip.
    useEffect(() => {
        if (!controls) return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'f' || e.key === 'F') toggleFast();
            if (e.key === 's' || e.key === 'S') skipBattle();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    });

    // Starting state: the start tx / finalize tx are still in flight (never a blank screen).
    if (!battle) {
        if (phase !== 'battle') return null;
        return (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="panel pointer-events-auto flex items-center gap-3 px-4 py-3" role="status" aria-live="polite">
                    <span className="tx-spin" aria-hidden />
                    <span className="t-body text-muted">Starting battle…</span>
                </div>
            </div>
        );
    }

    const speedButtons = controls && (
        <div className="flex justify-end gap-2">
            <button
                type="button"
                aria-pressed={fast}
                aria-label="Double speed"
                title="Double speed (F)"
                className={`btn btn-icon pointer-events-auto w-auto px-3 ${fast ? 'btn-primary' : 'btn-secondary'}`}
                onClick={toggleFast}
            >
                <span className="t-num">×2</span>
            </button>
            <button type="button" aria-label="Skip to the result" title="Skip (S)" className="btn btn-secondary btn-icon pointer-events-auto w-auto gap-1 px-3" onClick={skipBattle}>
                <span className="t-button">SKIP</span>
            </button>
        </div>
    );

    // Desktop: player bar top-left (player stands left), enemy bar top-right, controls under the enemy.
    if (wide) {
        return (
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-6 right-6 top-4 flex items-start justify-between gap-6">
                    <div className="w-[420px]">
                        <HpBar name={battle.names[0]} head={battle.parts[0][0]} hp={hp[0]} max={battle.maxHp[0]} />
                    </div>
                    <span className="t-banner on-scene mt-1 text-ink" aria-hidden>
                        VS
                    </span>
                    <div className="flex w-[420px] flex-col gap-2">
                        <HpBar name={battle.names[1]} head={battle.parts[1][0]} hp={hp[1]} max={battle.maxHp[1]} enemy />
                        {speedButtons}
                    </div>
                </div>
                <CalloutLayer />
            </div>
        );
    }

    return (
        <div className="pointer-events-none absolute inset-0 flex flex-col">
            <div className="pt-safe-top flex flex-col gap-2 px-4">
                <HpBar name={battle.names[1]} head={battle.parts[1][0]} hp={hp[1]} max={battle.maxHp[1]} enemy />
                {speedButtons}
            </div>
            <CalloutLayer />
            <div className="flex-1" />
            {phase === 'battle' && (
                <div className="pb-safe-bottom px-4 pb-2">
                    <HpBar name={battle.names[0]} head={battle.parts[0][0]} hp={hp[0]} max={battle.maxHp[0]} />
                </div>
            )}
        </div>
    );
}

/** "Super effective!" / "Resisted" (element clash, F-16). Fade only when motion is reduced. */
export function CalloutLayer() {
    const callout = useCallout();
    const reduced = usePrefersReducedMotion();
    if (!callout) return null;
    return (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-4" role="status" aria-live="polite">
            <span className={`t-num-lg text-center ${reduced ? '' : 'pop-in'} ${callout.tone === 'primary' ? 'text-primary' : 'text-muted'}`} style={{ textShadow: '0 4px 0 #140b20' }}>
                {callout.text}
            </span>
        </div>
    );
}

function HpBar({ name, head, hp, max, enemy = false }: { name: string; head: string; hp: number; max: number; enemy?: boolean }) {
    const attack = getPart(head).attack;
    const pct = Math.max(0, (hp / max) * 100);
    const low = pct < 30;
    return (
        <div className="panel px-3 py-2">
            <div className="flex items-center justify-between gap-2">
                <span className="t-button flex min-w-0 items-center gap-2">
                    <Icon name={enemy ? 'skull' : 'flask'} size={20} className={enemy ? 'text-danger' : 'text-primary'} />
                    <span className="truncate">{name}</span>
                </span>
                <span className="t-num shrink-0">
                    {hp}/{max}
                </span>
            </div>
            {attack && (
                <span className="t-caption mt-0.5 block truncate text-muted">
                    Special every 4th attack: <span className="text-ink">{attack.special}</span>
                </span>
            )}
            <div className="mt-1.5 h-3 overflow-hidden rounded-[4px] border-2 border-[#140b20] bg-black/60" role="progressbar" aria-valuenow={hp} aria-valuemax={max} aria-label={`${name} HP`}>
                <div
                    className="h-full transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%`, background: low ? 'var(--color-danger)' : enemy ? 'var(--color-fang)' : 'var(--color-goo)' }}
                />
            </div>
        </div>
    );
}

interface Floater {
    id: number;
    x: number;
    y: number;
    text: string;
    kind: FloatKind;
}

const FLOAT_STYLE: Record<FloatKind, string> = {
    damage: 'text-[36px] text-ink',
    crit: 'text-[52px] text-primary',
    miss: 'text-[30px] text-muted',
    heal: 'text-[30px] text-goo',
    info: 'text-[30px] text-epic',
    poison: 'text-[30px] text-[#f15bb5]',
    special: 'text-[44px] text-primary',
};

export function FloatLayer() {
    const [items, setItems] = useState<Floater[]>([]);
    const nextIdRef = useRef(0);
    useEffect(
        () =>
            gameEvents.on('float', (e) => {
                const id = nextIdRef.current++;
                setItems((cur) => [...cur.slice(-12), { id, ...e }]);
                setTimeout(() => setItems((cur) => cur.filter((f) => f.id !== id)), 1000);
            }),
        [nextIdRef],
    );
    return (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
            {items.map((f) => (
                <span key={f.id} className={`float-num leading-none ${FLOAT_STYLE[f.kind]}`} style={{ left: f.x, top: f.y }}>
                    {f.text}
                </span>
            ))}
        </div>
    );
}
