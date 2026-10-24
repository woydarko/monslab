/**
 * Battle playback (GDD §22.3). The fight is already decided by sim/battle.ts;
 * this scene only replays the event list with juice.
 *
 * Each HEAD has an attack style (sim/battle.ts › AttackStyle):
 *   melee:  bite, claw, headbutt: wind-up → lunge → impact → recover
 *   ranged: spit, laser, spore, wail: wind-up → projectile flies → impact
 * Every 4th own action is a special: longer charge, its name on screen,
 * bigger projectile/impact. Trait effects (poison, stun, block, revive,
 * haunt) each get their own beat so fights read as more than "hit, hit".
 */
import * as THREE from 'three';
import type { AttackStyle, MonsterParts } from '../data/types.ts';
import { FAMILIES } from '../data/families.ts';
import { getPart } from '../data/parts.ts';
import type { AttackEvent, BattleEvent, Side } from '../sim/battle.ts';
import { gameEvents, type FloatKind } from '../events.ts';
import { haptic } from '../haptic.ts';
import { sfx } from '../audio.ts';
import { PALETTE } from './psxConfig.ts';
import { getLayout } from '../../ui/layout.ts';
import { addLights, buildArena } from './environment.ts';
import { MonsterView } from './monsterView.ts';
import { makePsxBasic } from './psxMaterial.ts';
import { Vfx } from './vfx.ts';
import type { PsxScene } from './psxRenderer.ts';

export interface BattleSetup {
    parts: [MonsterParts, MonsterParts];
    skins: [number, number];
    events: BattleEvent[];
    /** Size of the opponent; the daily boss stands taller. */
    enemyScale?: number;
    project: (p: THREE.Vector3, cam: THREE.Camera) => { x: number; y: number };
}

/** How high the opponent starts its intro drop. Low enough that its head never hides under the HUD bars. */
const INTRO_DROP = 2.2;

// Stacked in depth so both fit a portrait screen: player near/bottom, enemy far/top.
const TALL_HOME: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(0.4, 0, 2.3), new THREE.Vector3(-0.4, 0, -2.5)];
const TALL_YAW: [number, number] = [-0.6, 0.25];
// Wide (desktop): classic side-on face-off, player left, enemy right, both turned a little toward the camera.
const WIDE_HOME: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(-2.0, 0, 0.5), new THREE.Vector3(2.0, 0, -0.5)];
const WIDE_YAW: [number, number] = [1.05, -1.05];
const FRAME = 1 / 60;

const RANGED: AttackStyle[] = ['spit', 'laser', 'spore', 'wail'];
/** Projectile / effect colour per style. */
const STYLE_COLOR: Record<AttackStyle, number> = {
    bite: 0xe63946, spit: 0x7bd389, laser: 0xc77dff, claw: 0xf4a261, headbutt: 0xe6dfc8, spore: 0xf15bb5, wail: 0x9fffe0,
};

type Step =
    | { kind: 'wait'; time: number }
    | { kind: 'intro'; time: number }
    | { kind: 'windup'; time: number; ev: AttackEvent }
    | { kind: 'lunge'; time: number; ev: AttackEvent }
    | { kind: 'shoot'; time: number; ev: AttackEvent }
    | { kind: 'recover'; time: number; ev: AttackEvent }
    | { kind: 'regen'; time: number; ev: Extract<BattleEvent, { type: 'regen' }> }
    | { kind: 'poison'; time: number; ev: Extract<BattleEvent, { type: 'poison' }> }
    | { kind: 'stunSkip'; time: number; actor: Side }
    | { kind: 'revive'; time: number; ev: Extract<BattleEvent, { type: 'revive' }> }
    | { kind: 'ko'; time: number; loser: Side }
    | { kind: 'victory'; time: number; winner: Side };

/** A short-lived 3D effect (projectile, slash, ring, beam). */
interface Fx {
    obj: THREE.Object3D;
    life: number;
    max: number;
    tick(k: number, dt: number): void;
}

export class BattleScene implements PsxScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(40, 0.56, 0.1, 60);
    private env = buildArena();
    private vfx = new Vfx();
    private mons: [MonsterView, MonsterView];
    private steps: Step[] = [];
    private step: Step | null = null;
    private elapsed = 0;
    private hitstop = 0;
    private kick = new THREE.Vector3();
    // High 3/4 view: stacks the two monsters vertically so neither hides the other on a portrait screen.
    private camBase = new THREE.Vector3(1.2, 7.8, 10.0);
    private camLook = new THREE.Vector3(0, 0.9, 0.2);
    private wide = getLayout() === 'wide';
    private home: [THREE.Vector3, THREE.Vector3] = this.wide ? WIDE_HOME : TALL_HOME;
    private yaw: [number, number] = this.wide ? WIDE_YAW : TALL_YAW;
    private speed = 1;
    private done = false;
    private koSide: Side | null = null;
    private koT = 0;
    private winner: Side | null = null;
    private danceT = 0;
    private t = 0;
    private fx: Fx[] = [];
    private stunStars: (THREE.Group | null)[] = [null, null];

    constructor(private setup: BattleSetup) {
        addLights(this.scene);
        this.scene.add(this.env.group, this.vfx.points);
        this.mons = [0, 1].map((i) => {
            const m = new MonsterView(setup.parts[i], setup.skins[i], i * 7);
            m.root.position.copy(this.home[i]);
            if (i === 1 && setup.enemyScale) m.root.scale.setScalar(setup.enemyScale);
            m.root.rotation.y = this.yaw[i];
            this.scene.add(m.root);
            return m;
        }) as [MonsterView, MonsterView];
        this.mons[0].lookAt(this.headOf(1));
        this.mons[1].lookAt(this.headOf(0));
        if (this.wide) {
            // Side view for a landscape screen: both monsters fully visible, centered between the HP bars.
            this.camBase.set(0, 3.2, 9.0);
            this.camLook.set(0, 1.1, 0);
        }
        this.camera.position.copy(this.camBase);
        this.camera.lookAt(this.camLook);
        this.buildSteps(setup.events);
        this.mons[1].root.position.y = INTRO_DROP; // drops in during the intro
    }

    setSpeed(s: number): void {
        this.speed = s;
    }

    /** Jump to the final state (Skip button). */
    skip(): void {
        if (this.done) return;
        const end = this.setup.events.find((e) => e.type === 'end');
        for (const e of this.setup.events) {
            if (e.type === 'attack') {
                gameEvents.emit('hp', { side: e.target, hp: e.targetHp });
                if (e.heal) gameEvents.emit('hp', { side: e.actor, hp: e.actorHp });
            }
            if (e.type === 'regen') gameEvents.emit('hp', { side: e.actor, hp: e.actorHp });
            if (e.type === 'poison') gameEvents.emit('hp', { side: e.target, hp: e.targetHp });
            if (e.type === 'revive') gameEvents.emit('hp', { side: e.actor, hp: e.hp });
        }
        const ko = this.setup.events.find((e) => e.type === 'ko');
        for (const m of this.mons) {
            m.root.position.y = 0;
            m.energy = 0;
        }
        this.mons.forEach((m, i) => m.root.position.copy(this.home[i]));
        this.clearFx();
        this.clearStun(0);
        this.clearStun(1);
        if (ko && ko.type === 'ko') {
            this.mons[ko.loser].knockOut();
            this.koSide = ko.loser;
            this.koT = 1;
        }
        this.steps = [];
        if (end && end.type === 'end') this.steps.push({ kind: 'victory', time: 1.4, winner: end.winner });
        this.step = null;
        this.hitstop = 0;
    }

    private headOf(side: Side): THREE.Vector3 {
        const m = this.mons?.[side];
        const p = (m ? m.root.position : this.home[side]).clone();
        p.y += (m?.height ?? 2) * 0.8;
        return p;
    }

    private buildSteps(events: BattleEvent[]): void {
        this.steps.push({ kind: 'intro', time: 1.1 });
        for (const e of events) {
            if (e.type === 'attack') {
                const ranged = RANGED.includes(e.style);
                if (e.followUp) {
                    // Frenzy: no wind-up, a quick second swipe.
                    this.steps.push({ kind: 'lunge', time: 0.1, ev: e });
                    this.steps.push({ kind: 'recover', time: 0.22, ev: e });
                    this.steps.push({ kind: 'wait', time: 0.15 });
                    continue;
                }
                this.steps.push({ kind: 'windup', time: e.special ? 0.7 : 0.26, ev: e });
                if (ranged) {
                    this.steps.push({ kind: 'shoot', time: e.style === 'laser' ? 0.16 : 0.28, ev: e });
                    this.steps.push({ kind: 'recover', time: 0.22, ev: e });
                } else {
                    this.steps.push({ kind: 'lunge', time: e.style === 'headbutt' ? 0.11 : 0.14, ev: e });
                    this.steps.push({ kind: 'recover', time: 0.34, ev: e });
                }
                this.steps.push({ kind: 'wait', time: e.special ? 0.35 : 0.2 });
            } else if (e.type === 'regen') {
                this.steps.push({ kind: 'regen', time: 0.4, ev: e });
            } else if (e.type === 'poison') {
                this.steps.push({ kind: 'poison', time: 0.45, ev: e });
            } else if (e.type === 'stunSkip') {
                this.steps.push({ kind: 'stunSkip', time: 0.7, actor: e.actor });
            } else if (e.type === 'revive') {
                this.steps.push({ kind: 'revive', time: 1.0, ev: e });
            } else if (e.type === 'ko') {
                this.steps.push({ kind: 'ko', time: 0.9, loser: e.loser });
            } else if (e.type === 'end') {
                this.steps.push({ kind: 'victory', time: 1.6, winner: e.winner });
            }
        }
    }

    private float(at: THREE.Vector3, text: string, kind: FloatKind): void {
        const p = this.setup.project(at, this.camera);
        gameEvents.emit('float', { x: p.x, y: p.y, text, kind });
    }

    private dirTo(from: Side): THREE.Vector3 {
        return this.home[from === 0 ? 1 : 0].clone().sub(this.home[from]).normalize();
    }

    // ───────────── effects ─────────────

    private addFx(obj: THREE.Object3D, life: number, tick: Fx['tick']): void {
        this.scene.add(obj);
        this.fx.push({ obj, life, max: life, tick });
    }

    private clearFx(): void {
        for (const f of this.fx) f.obj.removeFromParent();
        this.fx = [];
    }

    /** Ranged projectile(s) from actor head to target head over `time`. */
    private launch(ev: AttackEvent, time: number): void {
        const from = this.headOf(ev.actor);
        const to = this.headOf(ev.target);
        const color = STYLE_COLOR[ev.style];
        const big = ev.special ? 1.6 : 1;
        if (ev.style === 'laser') {
            // Beam: a thin box stretched between the eyes and the target, fading out.
            const len = from.distanceTo(to);
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09 * big, 0.09 * big, len), makePsxBasic(color));
            beam.position.copy(from).lerp(to, 0.5);
            beam.lookAt(to);
            const core = new THREE.Mesh(new THREE.BoxGeometry(0.035 * big, 0.035 * big, len), makePsxBasic(0xffffff));
            beam.add(core);
            this.addFx(beam, time + 0.12, (k) => beam.scale.set(1 - k * 0.7, 1 - k * 0.7, 1));
            return;
        }
        if (ev.style === 'wail') {
            // Rings of sound rolling toward the target.
            const n = ev.special ? 4 : 2;
            for (let i = 0; i < n; i++) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 3, 14), makePsxBasic(color));
                const delay = i * 0.06;
                ring.lookAt(to.clone().sub(from).add(ring.position));
                this.addFx(ring, time, (k) => {
                    const kk = Math.max(0, Math.min(1, (k * time - delay) / (time - delay * 0.5)));
                    ring.position.copy(from).lerp(to, kk);
                    ring.lookAt(to);
                    ring.scale.setScalar((0.6 + kk * 1.4) * big);
                });
            }
            return;
        }
        // spit (one fat glob, three on a special) / spore (a drifting cloud of puffs)
        const n = ev.style === 'spore' ? (ev.special ? 8 : 5) : ev.special ? 3 : 1;
        for (let i = 0; i < n; i++) {
            const r = ev.style === 'spore' ? 0.08 + Math.random() * 0.06 : 0.17 * big;
            const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), makePsxBasic(color));
            const off = new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
            const lag = i * 0.04;
            this.addFx(ball, time, (k) => {
                const kk = Math.max(0, Math.min(1, k * 1.15 - lag));
                ball.position.copy(from).lerp(to, kk).add(off.clone().multiplyScalar(Math.sin(kk * Math.PI)));
                ball.position.y += Math.sin(kk * Math.PI) * (ev.style === 'spit' ? 0.7 : 0.2);
                ball.rotation.x += 0.3;
            });
        }
    }

    /** Claw: diagonal slash streaks over the target. */
    private slash(at: THREE.Vector3, count: number, color: number): void {
        for (let i = 0; i < count; i++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), makePsxBasic(i % 2 ? 0xffffff : color));
            s.position.copy(at).add(new THREE.Vector3((i - (count - 1) / 2) * 0.22, 0, 0.3));
            s.rotation.z = 0.7;
            this.addFx(s, 0.22, (k) => {
                s.scale.set(1 - k, 1 + k * 0.4, 1 - k);
            });
        }
    }

    /** Headbutt special / heavy hits: a shockwave ring on the floor. */
    private shockwave(side: Side, color: number): void {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 3, 18), makePsxBasic(color));
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(this.home[side]).setY(0.05);
        this.addFx(ring, 0.4, (k) => ring.scale.setScalar(1 + k * 3));
    }

    /** Spinning stars over a stunned monster's head until its turn is lost. */
    private showStun(side: Side): void {
        this.clearStun(side);
        const g = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), makePsxBasic(0xffd23f));
            const a = (i / 4) * Math.PI * 2;
            star.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
            g.add(star);
        }
        g.position.copy(this.headOf(side)).add(new THREE.Vector3(0, 0.5, 0));
        this.scene.add(g);
        this.stunStars[side] = g;
    }

    private clearStun(side: Side): void {
        this.stunStars[side]?.removeFromParent();
        this.stunStars[side] = null;
    }

    // ───────────── step logic ─────────────

    private enter(step: Step): void {
        this.elapsed = 0;
        if (step.kind === 'windup' && step.ev.special) {
            const m = this.mons[step.ev.actor];
            this.float(this.headOf(step.ev.actor).add(new THREE.Vector3(0, 0.6, 0)), `${step.ev.specialName}!`, 'special');
            this.vfx.rise(m.root.position.clone(), STYLE_COLOR[step.ev.style], 16, 0.8);
            sfx('mix', { pitch: 1.3, volume: 0.6 });
            haptic('medium');
        }
        if (step.kind === 'shoot') {
            this.launch(step.ev, step.time);
            sfx('miss', { pitch: step.ev.style === 'laser' ? 1.8 : 0.8, volume: 0.6 });
        }
        if (step.kind === 'regen') {
            const m = this.mons[step.ev.actor];
            this.vfx.rise(m.root.position.clone(), PALETTE.slime, 8, 0.5);
            this.float(this.headOf(step.ev.actor), `+${step.ev.heal}`, 'heal');
            sfx('heal');
            gameEvents.emit('hp', { side: step.ev.actor, hp: step.ev.actorHp });
        }
        if (step.kind === 'poison') {
            const side = step.ev.target;
            this.mons[side].hit();
            this.vfx.rise(this.mons[side].root.position.clone(), 0xf15bb5, 10, 0.6);
            this.float(this.headOf(side), `-${step.ev.damage}`, 'poison');
            gameEvents.emit('hp', { side, hp: step.ev.targetHp });
            sfx('hit', { pitch: 0.7, volume: 0.5 });
        }
        if (step.kind === 'stunSkip') {
            this.float(this.headOf(step.actor), 'STUNNED', 'info');
            this.mons[step.actor].squash.set(1.1, 0.85, 1.1);
        }
        if (step.kind === 'revive') {
            const side = step.ev.actor;
            const m = this.mons[side];
            m.knockOut();
            this.koSide = side;
            this.koT = 0;
            this.hitstop = 12 * FRAME;
            sfx('ko', { volume: 0.7 });
        }
        if (step.kind === 'ko') {
            this.hitstop = 20 * FRAME;
            this.mons[step.loser].knockOut();
            this.koSide = step.loser;
            this.koT = 0;
            this.clearStun(step.loser);
            this.vfx.splat(this.headOf(step.loser), 0xffffff, 1.5);
            sfx('ko');
            haptic('heavy');
        }
        if (step.kind === 'victory') {
            this.winner = step.winner;
            this.danceT = 0;
        }
    }

    private impact(ev: AttackEvent): void {
        const target = this.mons[ev.target];
        const at = this.headOf(ev.target);
        const up = (n: number) => at.clone().setY(at.y + n);
        if (ev.dodged) {
            this.float(at, 'MISS', 'miss');
            sfx('miss');
            const side = this.dirTo(ev.actor).cross(new THREE.Vector3(0, 1, 0)).multiplyScalar(0.4);
            target.root.position.add(side);
            haptic('light');
            return;
        }
        if (ev.blocked) {
            this.float(at, 'BLOCK', 'info');
            this.vfx.burst(at, 0xffffff, 10);
            sfx('hit', { pitch: 1.6 });
            haptic('light');
            return;
        }
        target.hit();
        sfx(ev.crit || ev.special ? 'crit' : 'hit');
        const color = STYLE_COLOR[ev.style];
        const family = getPart(this.mons[ev.actor].parts[0]).family;
        this.vfx.splat(up(-0.4), FAMILIES[family].color, ev.crit || ev.special ? 1.6 : 1);
        if (ev.style === 'claw') this.slash(at, ev.special ? 5 : 3, color);
        if (ev.style === 'headbutt' || ev.special) this.shockwave(ev.target, color);
        if (ev.style === 'bite') this.vfx.burst(at, 0xe63946, ev.special ? 14 : 6);
        if (ev.crit) this.vfx.burst(at, PALETTE.accent, 18);
        this.float(at, ev.crit ? `${ev.damage}!` : `${ev.damage}`, ev.crit || ev.special ? 'crit' : 'damage');
        // Status callouts stack above the number.
        const notes: string[] = [];
        if (ev.slowed) notes.push('SLOWED');
        if (ev.resisted) notes.push('RESISTED');
        if (ev.stunned) notes.push('STUN!');
        if (ev.poisoned) notes.push('POISON');
        if (ev.haunt > 0) notes.push('ATK DOWN');
        notes.forEach((n, i) => this.float(up(0.5 + i * 0.35), n, 'info'));
        if (ev.stunned) this.showStun(ev.target);
        gameEvents.emit('hp', { side: ev.target, hp: ev.targetHp });
        if (ev.heal > 0) {
            this.float(this.headOf(ev.actor), `+${ev.heal}`, 'heal');
            gameEvents.emit('hp', { side: ev.actor, hp: ev.actorHp });
        }
        const heavy = ev.crit || ev.special;
        this.hitstop = (ev.special ? 12 : ev.crit ? 10 : ev.style === 'headbutt' ? 6 : 4) * FRAME;
        // Camera kick along the hit direction.
        this.kick.copy(this.dirTo(ev.actor)).multiplyScalar(heavy ? 0.24 : 0.1);
        if (heavy) gameEvents.emit('shake', { strength: 1 });
        haptic(heavy ? 'medium' : 'light');
    }

    update(rawDt: number): void {
        this.t += rawDt;
        this.env.update(rawDt);
        this.vfx.update(rawDt);

        // Hitstop freezes gameplay time but not particles.
        let dt = rawDt * this.speed;
        if (this.hitstop > 0) {
            this.hitstop -= rawDt;
            dt = 0;
        }

        // Camera kick decays.
        this.kick.multiplyScalar(Math.pow(0.001, rawDt));
        this.camera.position.copy(this.camBase).add(this.kick);
        this.camera.lookAt(this.camLook);

        // Transient effects.
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i];
            f.life -= dt;
            f.tick(Math.min(1, 1 - f.life / f.max), dt);
            if (f.life <= 0) {
                f.obj.removeFromParent();
                this.fx.splice(i, 1);
            }
        }
        for (const s of this.stunStars) if (s) s.rotation.y += rawDt * 5;

        this.advance(dt);
        for (const m of this.mons) m.update(dt);
        this.mons[0].lookAt(this.headOf(1));
        this.mons[1].lookAt(this.headOf(0));

        if (this.koSide !== null) {
            this.koT = Math.min(1, this.koT + dt * 2);
            const m = this.mons[this.koSide];
            m.body.rotation.z = (this.koSide === 0 ? 1 : -1) * this.koT * 1.35;
            m.body.scale.set(1 + this.koT * 0.15, 1 - this.koT * 0.3, 1);
        }
        if (this.winner !== null) {
            this.danceT += dt;
            const m = this.mons[this.winner];
            m.root.position.y = Math.abs(Math.sin(this.danceT * 7)) * 0.35;
            m.root.rotation.y = this.yaw[this.winner] + Math.sin(this.danceT * 3.5) * 0.6;
            m.energy = 0.5 + Math.sin(this.danceT * 7) * 0.5;
            if (Math.random() < dt * 6) this.vfx.rise(m.root.position.clone(), PALETTE.accent, 2, 0.6);
        }
    }

    private advance(dt: number): void {
        if (this.done) return;
        if (!this.step) {
            const next = this.steps.shift();
            if (!next) return;
            this.step = next;
            this.enter(next);
        }
        const s = this.step;
        this.elapsed += dt;
        const k = Math.min(1, this.elapsed / s.time);

        if (s.kind === 'intro') {
            const enemy = this.mons[1];
            enemy.root.position.y = k < 1 ? Math.abs(Math.cos(k * Math.PI * 2)) * (1 - k) * INTRO_DROP : 0;
        } else if (s.kind === 'windup') {
            const a = s.ev.actor;
            const m = this.mons[a];
            m.energy = k;
            const back = this.dirTo(a).multiplyScalar(-0.25 * Math.sin(k * Math.PI * 0.5) * (s.ev.special ? 1.6 : 1));
            m.root.position.copy(this.home[a]).add(back);
            const sq = s.ev.special ? 0.2 : 0.12;
            m.squash.set(1 + k * sq, 1 - k * sq, 1 + k * sq);
            // Specials shake while charging.
            if (s.ev.special) m.root.position.x += Math.sin(this.t * 60) * 0.03 * k;
        } else if (s.kind === 'lunge') {
            const a = s.ev.actor;
            const m = this.mons[a];
            const reach = s.ev.style === 'headbutt' ? 0.7 : 0.55;
            const toward = this.home[1 - a].clone().sub(this.home[a]).multiplyScalar(reach * k);
            m.root.position.copy(this.home[a]).add(toward);
            m.squash.set(1 - k * 0.1, 1 + k * 0.18, 1 - k * 0.1);
            if (s.ev.style === 'headbutt') m.body.rotation.x = k * 0.5;
        } else if (s.kind === 'shoot') {
            // Ranged attackers recoil in place while the projectile flies.
            const a = s.ev.actor;
            const m = this.mons[a];
            m.squash.set(1 - k * 0.08, 1 + k * 0.12, 1 - k * 0.08);
            m.energy = 1;
        } else if (s.kind === 'recover') {
            const a = s.ev.actor;
            const m = this.mons[a];
            const ranged = RANGED.includes(s.ev.style) && !s.ev.followUp;
            if (!ranged) {
                const reach = s.ev.style === 'headbutt' ? 0.7 : 0.55;
                const from = this.home[1 - a].clone().sub(this.home[a]).multiplyScalar(reach * (1 - k));
                m.root.position.copy(this.home[a]).add(from);
            } else {
                m.root.position.lerp(this.home[a], k);
            }
            m.body.rotation.x *= 1 - k;
            m.energy = 1 - k;
            m.squash.set(1, 1, 1).lerp(new THREE.Vector3(0.92, 1.12, 0.92), 1 - k);
            // The dodger hops back home too.
            const other = this.mons[1 - a];
            other.root.position.lerp(this.home[1 - a], k);
        } else if (s.kind === 'stunSkip') {
            const m = this.mons[s.actor];
            m.root.rotation.y = this.yaw[s.actor] + Math.sin(k * Math.PI * 4) * 0.25;
        } else if (s.kind === 'revive') {
            // Collapse for the first half, then pop back up with a burst.
            if (k > 0.5 && this.koSide === s.ev.actor) {
                const m = this.mons[s.ev.actor];
                m.revive();
                m.body.rotation.z = 0;
                m.body.scale.set(1, 1, 1);
                this.koSide = null;
                this.vfx.burst(this.headOf(s.ev.actor), 0xe6dfc8, 20);
                this.vfx.rise(m.root.position.clone(), 0xffffff, 14, 0.7);
                this.float(this.headOf(s.ev.actor), 'REASSEMBLED!', 'special');
                gameEvents.emit('hp', { side: s.ev.actor, hp: s.ev.hp });
                sfx('pop');
            }
        }

        if (k >= 1) {
            if (s.kind === 'lunge' || s.kind === 'shoot') this.impact(s.ev);
            if (s.kind === 'stunSkip') {
                this.clearStun(s.actor);
                this.mons[s.actor].squash.set(1, 1, 1);
                this.mons[s.actor].root.rotation.y = this.yaw[s.actor];
            }
            if (s.kind === 'intro') this.float(this.headOf(1), 'VS', 'info');
            if (s.kind === 'victory') {
                this.done = true;
                gameEvents.emit('battleDone', { winner: s.winner });
            }
            this.step = null;
        }
    }

    dispose(): void {
        this.clearFx();
        this.clearStun(0);
        this.clearStun(1);
        for (const m of this.mons) m.dispose();
        this.vfx.dispose();
        this.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
    }
}
