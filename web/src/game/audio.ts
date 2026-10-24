/**
 * Web Audio for music + SFX (GDD §12). Files live in public/audio and load in
 * the background after boot. A missing or slow file just means silence.
 * The context unlocks on the first tap (browser autoplay rules).
 */
import { saveSystem } from './localSave.ts';

export type Sfx =
    | 'mix' | 'pop' | 'hit' | 'crit' | 'miss' | 'heal' | 'ko'
    | 'egg_crack' | 'egg_open' | 'win' | 'lose' | 'button';
export type Music = 'lab' | 'battle';

const SFX_FILES: Sfx[] = ['mix', 'pop', 'hit', 'crit', 'miss', 'heal', 'ko', 'egg_crack', 'egg_open', 'win', 'lose', 'button'];
const SFX_GAIN: Partial<Record<Sfx, number>> = { button: 0.35, heal: 0.6, miss: 0.7, win: 0.8, lose: 0.8 };
/**
 * The generated SFX files run 2 to 25 s with long tails (the KO sound kept
 * wailing for 11 s, into the next screen). Each sound plays only its useful
 * part: `at` skips leading silence, `len` is how long it sounds before a short
 * fade. Measured from each file's loudness envelope (18 Okt).
 */
const SFX_CLIP: Record<Sfx, { at: number; len: number }> = {
    button: { at: 0.08, len: 0.3 },
    pop: { at: 0, len: 0.8 },
    hit: { at: 0, len: 0.5 },
    crit: { at: 0, len: 1.0 },
    miss: { at: 0.2, len: 0.4 },
    heal: { at: 0.05, len: 1.0 },
    ko: { at: 0.05, len: 1.2 },
    egg_crack: { at: 0.55, len: 0.6 },
    egg_open: { at: 0.8, len: 2.0 },
    mix: { at: 0, len: 1.4 },
    win: { at: 0, len: 2.5 },
    lose: { at: 0, len: 1.4 },
};
const SFX_FADE = 0.12;
const MUSIC_GAIN = 0.45;
const FADE = 0.6;

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();
let wantedMusic: Music | null = null;
let current: { name: Music; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const lastPlayed = new Map<Sfx, number>();
/** Sounds still playing, so a screen change can cut them off. */
const activeSfx = new Set<{ src: AudioBufferSourceNode; gain: GainNode }>();

function settings() {
    return saveSystem.data?.settings ?? { sfx: 1, music: 0.6, haptics: true };
}

function ensureCtx(): AudioContext | null {
    if (ctx) return ctx;
    try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        sfxBus = ctx.createGain();
        musicBus = ctx.createGain();
        sfxBus.connect(ctx.destination);
        musicBus.connect(ctx.destination);
        applyVolumes();
    } catch {
        ctx = null;
    }
    return ctx;
}

function load(name: string): Promise<AudioBuffer | null> {
    const hit = buffers.get(name);
    if (hit) return Promise.resolve(hit);
    const pending = loading.get(name);
    if (pending) return pending;
    const p = (async () => {
        const c = ensureCtx();
        if (!c) return null;
        try {
            const res = await fetch(`audio/${name}.mp3`);
            if (!res.ok) return null;
            const buf = await c.decodeAudioData(await res.arrayBuffer());
            buffers.set(name, buf);
            return buf;
        } catch {
            return null;
        }
    })();
    loading.set(name, p);
    // Don't cache failures: a later call may succeed (slow network, file added).
    void p.then((buf) => {
        if (!buf) loading.delete(name);
    });
    return p;
}

/** Call once after boot: unlock on first tap, then warm every file in the background. */
export function initAudio(): void {
    const unlock = () => {
        const c = ensureCtx();
        if (!c) return;
        const start = () => wantedMusic && playMusic(wantedMusic);
        if (c.state === 'suspended') void c.resume().then(start).catch(() => {});
        else start();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    // UI click sound for every chunky button.
    window.addEventListener(
        'pointerdown',
        (e) => {
            const el = (e.target as HTMLElement | null)?.closest?.('.btn') as HTMLButtonElement | null;
            if (el && !el.disabled) sfx('button');
        },
        { capture: true }
    );
    // Warm in the background, music first (it's the long one).
    setTimeout(() => {
        void load('music_lab');
        void load('music_battle');
        for (const s of SFX_FILES) void load(`sfx_${s}`);
    }, 300);
}

export function applyVolumes(): void {
    const s = settings();
    if (sfxBus) sfxBus.gain.value = s.sfx;
    if (musicBus) musicBus.gain.value = s.music;
}

export function sfx(name: Sfx, opts: { pitch?: number; volume?: number } = {}): void {
    const c = ctx;
    if (!c || !sfxBus || c.state !== 'running' || settings().sfx <= 0) return;
    // Debounce identical sounds within 40 ms (stacked hits sound like one).
    const now = c.currentTime;
    if (now - (lastPlayed.get(name) ?? -1) < 0.04) return;
    lastPlayed.set(name, now);
    const buf = buffers.get(`sfx_${name}`);
    if (!buf) {
        void load(`sfx_${name}`);
        return;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    // Slight random pitch so repeats don't sound robotic.
    src.playbackRate.value = (opts.pitch ?? 1) * (0.94 + Math.random() * 0.12);
    const g = c.createGain();
    const level = (SFX_GAIN[name] ?? 1) * (opts.volume ?? 1);
    const clip = SFX_CLIP[name];
    // Wall-clock length of the clip at this playback rate, then a short fade instead of a hard cut.
    const span = clip.len / src.playbackRate.value;
    g.gain.setValueAtTime(level, now);
    g.gain.setValueAtTime(level, now + span);
    g.gain.linearRampToValueAtTime(0, now + span + SFX_FADE);
    src.connect(g).connect(sfxBus);
    src.start(now, Math.min(clip.at, Math.max(0, buf.duration - 0.05)));
    src.stop(now + span + SFX_FADE + 0.02);
    const entry = { src, gain: g };
    activeSfx.add(entry);
    src.onended = () => activeSfx.delete(entry);
}

/** Fade out every sound effect still playing (called on screen changes). */
export function stopAllSfx(): void {
    const c = ctx;
    if (!c) return;
    const now = c.currentTime;
    for (const e of activeSfx) {
        try {
            e.gain.gain.cancelScheduledValues(now);
            e.gain.gain.setValueAtTime(e.gain.gain.value, now);
            e.gain.gain.linearRampToValueAtTime(0, now + SFX_FADE);
            e.src.stop(now + SFX_FADE + 0.02);
        } catch {
            /* already stopped */
        }
    }
    activeSfx.clear();
}

export function playMusic(name: Music): void {
    wantedMusic = name;
    const c = ctx;
    if (!c || !musicBus || c.state !== 'running') return;
    if (current?.name === name) return;
    const buf = buffers.get(`music_${name}`);
    if (!buf) {
        void load(`music_${name}`).then((b) => b && wantedMusic === name && playMusic(name));
        return;
    }
    const now = c.currentTime;
    if (current) {
        const old = current;
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + FADE);
        old.src.stop(now + FADE + 0.05);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(MUSIC_GAIN, now + FADE);
    src.connect(g).connect(musicBus);
    src.start();
    current = { name, src, gain: g };
}

export function setAudioPaused(paused: boolean): void {
    if (!ctx) return;
    if (paused) void ctx.suspend().catch(() => {});
    else void ctx.resume().catch(() => {});
}

/** Toggle both buses (settings persist in the save). Returns the new muted state. */
export function toggleMute(): boolean {
    const s = saveSystem.data?.settings;
    if (!s) return false;
    const muted = s.sfx > 0 || s.music > 0;
    s.sfx = muted ? 0 : 1;
    s.music = muted ? 0 : 0.6;
    saveSystem.save();
    applyVolumes();
    return muted;
}

// Dev-only inspection handle.
if (import.meta.env.DEV) {
    (window as unknown as { __audio: unknown }).__audio = {
        state: () => ctx?.state ?? 'none',
        loaded: () => [...buffers.keys()],
        music: () => current?.name ?? null,
        playingSfx: () => activeSfx.size,
    };
}
