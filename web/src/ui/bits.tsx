/** Shared UI pieces built on the DESIGN.md tokens. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { store, useStore } from '../state/store.ts';
import { saveSystem, type MonsSave } from '../game/localSave.ts';
import { FAMILIES, RARITY_COLOR } from '../game/data/families.ts';
import { skinTint } from '../game/data/skins.ts';
import type { AttackStyle, PartDef } from '../game/data/types.ts';
import { toggleMute } from '../game/audio.ts';
import { gameEvents } from '../game/events.ts';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';
import { onPartIcons, partIcon, partIconsVersion } from '../game/render/partIcons.ts';

/** Re-render on every save commit and return the live save. */
export function useSave(): MonsSave {
    useStore((s) => s.rev);
    return saveSystem.data!;
}

/**
 * Family marker. Each family has its own shape as well as its color, so seven
 * families stay distinct for color-blind players (goo/ghost and fang/shroom
 * are close in hue). Shapes echo the parts: fang tooth, goo blob, eye with a
 * pupil, claw diamond, bone square, mushroom cap, ghost sheet.
 */
const FAMILY_SHAPE: Record<PartDef['family'], string> = {
    fang: 'M1 1.5h10L6 11z',
    goo: 'M6 1a5 5 0 1 1 0 10a5 5 0 1 1 0-10z',
    eye: 'M6 1a5 5 0 1 1 0 10a5 5 0 1 1 0-10zM6 4.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6z',
    claw: 'M6 0.8L11.2 6L6 11.2L0.8 6z',
    bone: 'M1.5 1.5h9v9h-9z',
    shroom: 'M0.8 8a5.2 6 0 0 1 10.4 0z',
    ghost: 'M1.5 11V5.5a4.5 4.5 0 0 1 9 0V11l-1.5-1.5L7.5 11L6 9.5L4.5 11L3 9.5z',
};

export function FamilyDot({ family, size = 10 }: { family: PartDef['family']; size?: number }) {
    const s = Math.max(size, 10) + 2;
    return (
        <svg width={s} height={s} viewBox="0 0 12 12" className="inline-block shrink-0" aria-hidden>
            <path d={FAMILY_SHAPE[family]} fill={FAMILIES[family].color} fillRule="evenodd" stroke="#140b20" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
    );
}

/** How each head attacks, in the player's words (sim/battle.ts AttackStyle). */
export const ATTACK_TEXT: Record<AttackStyle, string> = {
    bite: 'Bites',
    claw: 'Slashes with claws',
    headbutt: 'Headbutts',
    spit: 'Spits goo',
    laser: 'Fires an eye laser',
    spore: 'Puffs poison spores',
    wail: 'Wails',
};

/** What a special adds on top of 1.6× damage (sim/battle.ts: head traits are boosted on a special). */
export const SPECIAL_EXTRA: Record<AttackStyle, string> = {
    bite: 'heals twice as much',
    claw: '',
    headbutt: '40% stun chance',
    spit: '',
    laser: '',
    spore: 'poison lasts 2 actions longer',
    wail: 'lowers ATK twice',
};

/** One line explaining a head's attack and special move. */
export function specialText(style: AttackStyle): string {
    const extra = SPECIAL_EXTRA[style];
    return `Every 4th attack: 1.6× damage${extra ? `, ${extra}` : ''}.`;
}

/** A part's 3D thumbnail. Locked parts show as a dark silhouette (a teaser of what to win). */
export function PartIcon({ id, size, locked = false }: { id: string; size: number; locked?: boolean }) {
    useSyncExternalStore(onPartIcons, partIconsVersion);
    const url = partIcon(id);
    return url ? (
        <img
            src={url}
            alt=""
            width={size}
            height={size}
            draggable={false}
            className="shrink-0 select-none"
            style={{ imageRendering: 'pixelated', filter: locked ? 'brightness(0) opacity(0.45)' : undefined }}
        />
    ) : (
        <span className="shrink-0 rounded-[var(--radius-sm)] bg-black/30" style={{ width: size, height: size }} />
    );
}

/** A skin's color as a round swatch (data/skins.ts). */
export function SkinSwatch({ id, size = 24 }: { id: number; size?: number }) {
    return (
        <span
            className="inline-block shrink-0 rounded-full border-2 border-[#140b20]"
            style={{ width: size, height: size, background: `#${skinTint(id).toString(16).padStart(6, '0')}` }}
            aria-hidden
        />
    );
}

export function rarityColor(r: PartDef['rarity']): string {
    return RARITY_COLOR[r];
}

/** One stat in the compact 3-column stat row: label, number, bar. */
export function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-1">
                <span className="t-label text-muted">{label}</span>
                <span className="t-num">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                <div className="h-full transition-[width] duration-300" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
            </div>
        </div>
    );
}

export function GooIcon({ size = 20 }: { size?: number }) {
    return (
        <span
            className="inline-block shrink-0 rounded-full border-2 border-[#140b20]"
            style={{ width: size, height: size, background: 'radial-gradient(circle at 35% 30%, #d8ffb0, #7bd389 45%, #3c8a4a)' }}
            aria-hidden
        />
    );
}

/** Sound toggle used by the title and the lab (44 × 44). */
export function SoundButton() {
    const s = useSave();
    const on = s.settings.sfx > 0 || s.settings.music > 0;
    return (
        <button
            type="button"
            aria-label={on ? 'Mute sound' : 'Turn sound on'}
            aria-pressed={!on}
            className="btn btn-secondary btn-icon pointer-events-auto"
            onClick={() => {
                toggleMute();
                store.patch({ rev: store.get().rev + 1 });
            }}
        >
            <Icon name={on ? 'sound' : 'mute'} />
        </button>
    );
}

/** Close on Escape (R-32). */
export function useEscape(onEscape: () => void): void {
    const ref = useRef(onEscape);
    ref.current = onEscape;
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape') ref.current();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);
}

/**
 * Arena / Challenge container. Wide (desktop): a centered dialog. Tall (phone):
 * a bottom sheet. Click outside, ✕ or Escape closes it.
 */
export function Sheet({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
    useEscape(onClose);
    const wide = useLayout() === 'wide';
    return (
        <div
            className={`pointer-events-auto absolute inset-0 flex bg-black/55 ${wide ? 'items-center justify-center p-6' : 'flex-col justify-end'}`}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={
                    wide
                        ? 'pop-in w-full rounded-[var(--radius-lg)] border-2 border-edge bg-surface p-5'
                        : 'slide-up pb-safe-bottom w-full rounded-t-[var(--radius-lg)] border-t-2 border-edge bg-surface px-4 pt-4 sm:mx-auto sm:max-w-[560px] sm:border-x-2'
                }
                style={wide ? { maxWidth: width } : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="t-title text-ink">{title}</h2>
                    <button type="button" aria-label="Close" autoFocus className="btn btn-secondary btn-icon" onClick={onClose}>
                        <Icon name="close" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

/** Fades from black whenever the 3D scene is swapped, hiding the cut. */
export function SceneFade() {
    const [n, setN] = useState(0);
    useEffect(() => gameEvents.on('sceneChange', () => setN((v) => v + 1)), []);
    return n > 0 ? <div key={n} className="scene-fade" /> : null;
}

/** Phone design width; narrower tall frames scale the UI down. */
export const UI_DESIGN_WIDTH = 390;
/** Desktop design canvas (DESIGN.md › Layout): the wide UI is laid out for 1280 × 720. */
export const UI_WIDE_DESIGN = { w: 1280, h: 720 };
/** Never shrink below this: controls must stay comfortable to click and tap. */
const UI_MIN_SCALE = 0.7;
/** Large monitors scale up so the UI doesn't look tiny on a 1440p/4K screen. */
const UI_MAX_WIDE_SCALE = 1.5;

/**
 * Proportional UI layer. Wide: scales to fit the 1280 × 720 design canvas
 * (up on big monitors, down on small laptops). Tall: scales down on frames
 * narrower than 390 px. Layout never wraps or overflows; it only resizes.
 */
export function UiScale({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const layout = useLayout();
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const frame = ref.current?.parentElement;
        if (!frame) return;
        const update = () => {
            const { width: w, height: h } = frame.getBoundingClientRect();
            const raw = layout === 'wide' ? Math.min(w / UI_WIDE_DESIGN.w, h / UI_WIDE_DESIGN.h) : Math.min(1, w / UI_DESIGN_WIDTH);
            setScale(Math.max(UI_MIN_SCALE, Math.min(layout === 'wide' ? UI_MAX_WIDE_SCALE : 1, raw)));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(frame);
        return () => ro.disconnect();
    }, [layout]);
    return (
        <div
            ref={ref}
            className="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: scale === 1 ? undefined : `scale(${scale})` }}
        >
            {children}
        </div>
    );
}
