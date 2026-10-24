/**
 * The lab (GDD §10.1): monster on a pedestal, swipe to rotate, MIX! pop,
 * and capsule mode (egg → 3 cracks → shatter → part reveal, GDD §22.4).
 */
import * as THREE from 'three';
import type { MonsterParts, Rarity, SlotId } from '../data/types.ts';
import { RARITY_COLOR } from '../data/families.ts';
import { PALETTE } from './psxConfig.ts';
import { getLayout } from '../../ui/layout.ts';
import { makePsxMaterial } from './psxMaterial.ts';
import { addLights, buildLab } from './environment.ts';
import { MonsterView } from './monsterView.ts';
import { Vfx } from './vfx.ts';
import { blobGeo } from './parts/kit.ts';
import type { PsxScene } from './psxRenderer.ts';

const PEDESTAL_TOP = 0.3;

function easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface Egg {
    group: THREE.Group;
    shell: THREE.Mesh;
    cracks: THREE.Mesh[];
    stage: number;
    shake: number;
    shards: { m: THREE.Mesh; v: THREE.Vector3; r: THREE.Vector3 }[];
    color: THREE.Color;
}

export class LabScene implements PsxScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(38, 0.56, 0.1, 60);
    private env = buildLab();
    private vfx = new Vfx();
    private monster: MonsterView | null = null;
    private monsterSkin = 0;
    private spawnT = 1;
    private yaw = 0;
    private yawVel = 0;
    private dragging = false;
    private lastX = 0;
    private egg: Egg | null = null;
    private reveal: MonsterView | null = null;
    private revealT = 0;
    private camTarget = new THREE.Vector3(0, 1.2, 0);
    private camT = 0;
    private offs: (() => void)[] = [];
    private spin = false;
    private viewW = 1;
    private viewH = 1;

    /** Title screen: slow showcase spin + monster centred (logo above, buttons below). */
    get autoSpin(): boolean {
        return this.spin;
    }
    set autoSpin(on: boolean) {
        this.spin = on;
        this.resize(this.viewW, this.viewH);
    }

    constructor(private canvas: HTMLCanvasElement) {
        addLights(this.scene);
        // Soft spotlight over the pedestal: the monster is the focal point of the lab.
        const spot = new THREE.PointLight(0xfff0e0, 9, 7, 1.6);
        spot.position.set(0.6, 3.6, 2.4);
        this.scene.add(spot);
        this.scene.add(this.env.group, this.vfx.points);
        this.camera.position.set(0, 2.2, 10.8);
        this.camera.lookAt(this.camTarget);
        this.bindInput();
    }

    private bindInput(): void {
        const down = (e: PointerEvent) => {
            this.dragging = true;
            this.lastX = e.clientX;
        };
        const move = (e: PointerEvent) => {
            if (!this.dragging) return;
            const dx = e.clientX - this.lastX;
            this.lastX = e.clientX;
            this.yawVel = dx * 0.012;
            this.yaw += this.yawVel;
        };
        const up = () => (this.dragging = false);
        this.canvas.addEventListener('pointerdown', down);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        this.offs.push(() => {
            this.canvas.removeEventListener('pointerdown', down);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        });
    }

    /** Show (or swap to) a monster. `mix` plays the birth pop + swirl. */
    setMonster(parts: MonsterParts, skin: number, mix = false): void {
        // Same monster already on the pedestal (title → lab): keep it, no re-spawn.
        if (!mix && !this.egg && this.monster && this.monster.parts.join() === parts.join() && this.monsterSkin === skin) return;
        this.monsterSkin = skin;
        this.clearEgg();
        this.monster?.dispose();
        this.monster = new MonsterView(parts, skin);
        this.monster.root.position.y = PEDESTAL_TOP;
        this.monster.lookAt(this.camera.position);
        this.scene.add(this.monster.root);
        this.spawnT = 0;
        if (mix) {
            this.vfx.rise(new THREE.Vector3(0, PEDESTAL_TOP, 0), PALETTE.accent, 18, 0.9);
            this.vfx.splat(new THREE.Vector3(0, PEDESTAL_TOP + 1, 0), PALETTE.slime, 1);
            this.vfx.burst(new THREE.Vector3(0, PEDESTAL_TOP + 1.2, 0), PALETTE.accent, 20);
        }
    }

    /** Part swap: quicker pop, no big burst. */
    swapMonster(parts: MonsterParts, skin: number): void {
        const yaw = this.yaw;
        this.setMonster(parts, skin, false);
        this.yaw = yaw;
        this.spawnT = 0.45;
        this.vfx.rise(new THREE.Vector3(0, PEDESTAL_TOP, 0), PALETTE.accent, 8, 0.7);
    }

    // ───────────── capsule ─────────────

    showEgg(rarity: Rarity): void {
        this.monster?.dispose();
        this.monster = null;
        this.clearEgg();
        const color = new THREE.Color(rarity === 'common' ? 0x9890a8 : RARITY_COLOR[rarity]);
        const group = new THREE.Group();
        const shellMat = makePsxMaterial({ color });
        const shell = new THREE.Mesh(blobGeo(0.62, 1, 0.05, 7, new THREE.Vector3(0.85, 1.15, 0.85)), shellMat);
        shell.position.y = 0.72;
        group.add(shell);
        // spots
        const spotMat = makePsxMaterial({ color: color.clone().multiplyScalar(0.55) });
        for (const [x, y, z, r] of [[0.3, 1.0, 0.38, 0.12], [-0.28, 0.6, 0.42, 0.1], [0.05, 1.3, 0.3, 0.08], [-0.4, 1.1, 0.1, 0.09]]) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(r, 5, 4), spotMat);
            s.position.set(x, y, z);
            group.add(s);
        }
        const crackMat = makePsxMaterial({ color: 0x140b20 });
        const cracks: THREE.Mesh[] = [];
        const crackSpecs = [
            [[0, 1.05, 0.52, 0.5, 0.05, 0.5]],
            [[-0.2, 0.8, 0.5, 0.4, 0.05, 0.9], [0.25, 0.9, 0.48, 0.35, 0.05, -0.7]],
            [[0.05, 0.55, 0.5, 0.45, 0.05, 0.2], [-0.35, 1.2, 0.35, 0.3, 0.05, -1.1], [0.38, 1.25, 0.32, 0.3, 0.05, 1.2]],
        ];
        for (const stage of crackSpecs)
            for (const [x, y, z, w, h, rot] of stage) {
                const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), crackMat);
                c.position.set(x, y, z);
                c.rotation.z = rot;
                c.visible = false;
                c.userData.stage = cracks.length < 1 ? 1 : cracks.length < 3 ? 2 : 3;
                group.add(c);
                cracks.push(c);
            }
        group.position.y = PEDESTAL_TOP + 4;
        this.scene.add(group);
        this.egg = { group, shell, cracks, stage: 0, shake: 0, shards: [], color };
        this.spawnT = 0;
    }

    /** Advance the crack stage (1..3). Returns true when the egg is fully cracked. */
    crackEgg(): boolean {
        const egg = this.egg;
        if (!egg || egg.stage >= 3) return true;
        egg.stage++;
        egg.shake = 0.35;
        for (const c of egg.cracks) c.visible = c.userData.stage <= egg.stage;
        this.vfx.splat(new THREE.Vector3(0, PEDESTAL_TOP + 1, 0.5), egg.color, 0.5);
        return egg.stage >= 3;
    }

    /** Shatter the egg and reveal a single part. */
    openEgg(parts: MonsterParts, slot: SlotId, rarity: Rarity): void {
        const egg = this.egg;
        if (egg) {
            const pieceMat = makePsxMaterial({ color: egg.color });
            for (let i = 0; i < 8; i++) {
                const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22 + Math.random() * 0.12), pieceMat);
                const a = (i / 8) * Math.PI * 2;
                m.position.set(Math.cos(a) * 0.3, PEDESTAL_TOP + 0.8 + Math.random() * 0.4, Math.sin(a) * 0.3);
                this.scene.add(m);
                egg.shards.push({
                    m,
                    v: new THREE.Vector3(Math.cos(a) * 3, 3 + Math.random() * 2, Math.sin(a) * 3),
                    r: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
                });
            }
            egg.group.visible = false;
        }
        const glow = rarity === 'common' ? 0xd0d0e0 : RARITY_COLOR[rarity];
        this.vfx.burst(new THREE.Vector3(0, PEDESTAL_TOP + 1, 0), glow, 28);
        this.vfx.rise(new THREE.Vector3(0, PEDESTAL_TOP, 0), glow, 20, 1);
        this.reveal?.dispose();
        this.reveal = new MonsterView(parts, 0, 0, slot);
        this.reveal.root.position.y = PEDESTAL_TOP + (slot === 'legs' ? 0 : 0.2);
        // Single parts are smaller than a whole monster; scale them up so the reveal reads.
        // The desktop camera is closer, so parts need less boost there.
        const boost = getLayout() === 'wide' ? 0.7 : 1;
        this.reveal.root.scale.setScalar((slot === 'head' ? 1.7 : slot === 'legs' ? 2.0 : 1.45) * boost);
        this.reveal.lookAt(this.camera.position);
        this.scene.add(this.reveal.root);
        this.revealT = 0;
    }

    private clearEgg(): void {
        if (this.egg) {
            this.egg.group.traverse((o) => {
                if (o instanceof THREE.Mesh) o.geometry.dispose();
            });
            this.egg.group.removeFromParent();
            for (const s of this.egg.shards) s.m.removeFromParent();
            this.egg = null;
        }
        this.reveal?.dispose();
        this.reveal = null;
    }

    /**
     * Lens shift: render the view window lower so the monster sits in the top
     * part of the screen, clear of the bottom panel, without tilting the camera.
     */
    resize(width: number, height: number): void {
        this.viewW = width;
        this.viewH = height;
        if (getLayout() === 'wide') {
            // Desktop: the lab panels sit left (info) and right (build), so centre the monster in the gap;
            // on the title the logo is on the left, so the monster moves to the right half.
            this.camera.position.set(0, 2.0, 7.4);
            const x = this.spin ? -0.2 : 0.03;
            this.camera.setViewOffset(width, height, width * x, height * 0.02, width, height);
        } else {
            this.camera.position.set(0, 2.2, 10.8);
            this.camera.setViewOffset(width, height, 0, height * (this.spin ? -0.07 : 0.07), width, height);
        }
        this.camera.updateProjectionMatrix();
    }

    /** World position of the monster's head, for DOM overlays. */
    headPosition(): THREE.Vector3 {
        return new THREE.Vector3(0, PEDESTAL_TOP + (this.monster?.height ?? 2) + 0.1, 0);
    }

    update(dt: number): void {
        this.env.update(dt);
        this.vfx.update(dt);
        this.camT += dt;
        // Slow cinematic drift.
        this.camera.position.x = Math.sin(this.camT * 0.25) * 0.35;
        this.camera.lookAt(this.camTarget);

        if (!this.dragging) {
            this.yawVel *= 0.92;
            this.yaw += this.yawVel;
            if (this.spin) this.yaw += dt * 0.5;
            // Ease back toward facing the camera when idle.
            else if (Math.abs(this.yawVel) < 0.002) this.yaw *= 0.97;
        }

        if (this.monster) {
            this.spawnT = Math.min(1, this.spawnT + dt * 1.6);
            const s = easeOutBack(this.spawnT);
            this.monster.root.scale.setScalar(Math.max(0.01, s));
            this.monster.root.rotation.y = this.yaw + (1 - this.spawnT) * Math.PI * 2;
            this.monster.update(dt);
        }

        const egg = this.egg;
        if (egg && egg.group.visible) {
            this.spawnT = Math.min(1, this.spawnT + dt * 1.4);
            // drop + bounce onto the pedestal
            const t = this.spawnT;
            const bounce = t < 1 ? Math.abs(Math.cos(t * Math.PI * 2.5)) * (1 - t) * 4 : 0;
            egg.group.position.y = PEDESTAL_TOP + bounce;
            egg.shake = Math.max(0, egg.shake - dt);
            const wob = egg.shake > 0 ? Math.sin(this.camT * 60) * egg.shake * 0.5 : Math.sin(this.camT * 3) * 0.04 * egg.stage;
            egg.group.rotation.z = wob;
            egg.group.rotation.y += dt * 0.4;
        }
        if (egg) {
            for (const s of egg.shards) {
                s.v.y -= 9 * dt;
                s.m.position.addScaledVector(s.v, dt);
                if (s.m.position.y < 0.1) {
                    s.m.position.y = 0.1;
                    s.v.multiplyScalar(0.4);
                    s.v.y = Math.abs(s.v.y) * 0.3;
                }
                s.m.rotation.x += s.r.x * dt;
                s.m.rotation.y += s.r.y * dt;
            }
        }
        if (this.reveal) {
            this.revealT = Math.min(1, this.revealT + dt * 1.5);
            const base = this.reveal.root.userData.base ?? this.reveal.root.scale.x;
            this.reveal.root.userData.base = base;
            const k = easeOutBack(this.revealT);
            this.reveal.root.scale.setScalar(Math.max(0.01, base * k));
            this.reveal.root.rotation.y += dt * 0.9;
            this.reveal.update(dt);
        }
    }

    dispose(): void {
        for (const off of this.offs) off();
        this.clearEgg();
        this.monster?.dispose();
        this.vfx.dispose();
        this.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
    }
}
