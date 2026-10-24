/**
 * Assembles a 3D monster from 3 part builders (GDD §11.2): legs at the
 * bottom, body on the hips, head on the body's neck socket. Adds eyeballs at
 * every anchor (blink + look-at), a blob shadow, idle breathing, hit flash.
 *
 * The root's origin is on the floor between the feet; the monster faces +Z.
 */
import * as THREE from 'three';
import { getPart } from '../data/parts.ts';
import type { MonsterParts, SlotId } from '../data/types.ts';
import { hashString, mulberry32 } from '../sim/rng.ts';
import { BUILDERS, type PartBuild } from './parts/builders.ts';
import { makePsxMaterial } from './psxMaterial.ts';
import { eyeTex, shadowTex } from './textures.ts';
import { skinTint } from '../data/skins.ts';


const IRIS = [0xe63946, 0xffc300, 0x4cc9f0, 0x7bd389, 0xff7f11];

const eyeGeo = new THREE.SphereGeometry(1, 8, 6);
const eyeMats = new Map<string, THREE.MeshLambertMaterial>();
function eyeMat(iris: number, hurt: boolean): THREE.MeshLambertMaterial {
    const k = `${iris}-${hurt}`;
    let m = eyeMats.get(k);
    if (!m) {
        m = makePsxMaterial({ map: eyeTex(iris, hurt), flat: false });
        eyeMats.set(k, m);
    }
    return m;
}

interface Eye {
    mesh: THREE.Mesh;
    baseScale: number;
    blinkAt: number;
    blinkLeft: number;
    iris: number;
}

export class MonsterView {
    readonly root = new THREE.Group();
    /** Everything that bobs/squashes (shadow stays on the floor). */
    readonly body = new THREE.Group();
    readonly height: number;
    private builds: PartBuild[];
    private eyes: Eye[] = [];
    private t = Math.random() * 10;
    private flash = 0;
    private flashMats: { m: THREE.MeshLambertMaterial; base: THREE.Color }[] = [];
    private shadow: THREE.Mesh;
    private lookTarget: THREE.Vector3 | null = null;
    private rnd: () => number;
    /** 0..1: drives attack poses in part animations. */
    energy = 0;
    /** Extra squash & stretch multiplied into the idle breathing (battle juice). */
    readonly squash = new THREE.Vector3(1, 1, 1);
    private ko = false;

    /**
     * @param only show a single part (capsule reveal) instead of a full monster.
     */
    constructor(readonly parts: MonsterParts, skin = 0, seed = 0, only?: SlotId) {
        const tint = new THREE.Color(skinTint(skin));
        const baseSeed = hashString(parts.join('|')) ^ seed;
        this.rnd = mulberry32(baseSeed);
        const build = (i: number) => BUILDERS[getPart(parts[i]).builder]({ seed: baseSeed + i * 101, tint });

        if (only) {
            const i = only === 'head' ? 0 : only === 'body' ? 1 : 2;
            const b = build(i);
            this.builds = [b];
            if (only === 'legs') b.group.position.y = b.height ?? 0.5;
            this.body.add(b.group);
            this.height = only === 'legs' ? (b.height ?? 0.5) : only === 'body' ? (b.neck?.y ?? 1) : 1;
        } else {
            const [head, body, legs] = [build(0), build(1), build(2)];
            this.builds = [head, body, legs];
            const legH = legs.height ?? 0.5;
            legs.group.position.y = legH;
            body.group.position.y = legH;
            const neck = body.neck ?? new THREE.Vector3(0, 1, 0);
            head.group.position.copy(neck).add(new THREE.Vector3(0, legH, 0));
            this.body.add(legs.group, body.group, head.group);
            this.height = legH + neck.y + 0.95;
        }
        this.root.add(this.body);

        // Eyes at every anchor.
        for (const b of this.builds) {
            for (const a of b.eyes) {
                const iris = IRIS[Math.floor(this.rnd() * IRIS.length)];
                const m = new THREE.Mesh(eyeGeo, eyeMat(iris, false));
                m.scale.setScalar(a.size);
                m.position.copy(a.position).addScaledVector(a.normal, a.size * 0.45);
                a.parent.add(m);
                this.eyes.push({ mesh: m, baseScale: a.size, blinkAt: 1 + this.rnd() * 4, blinkLeft: 0, iris });
            }
        }

        for (const b of this.builds)
            for (const mesh of b.meshes) {
                const m = mesh.material as THREE.MeshLambertMaterial;
                if (!this.flashMats.some((f) => f.m === m)) this.flashMats.push({ m, base: m.emissive.clone() });
            }

        this.shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(1.6, 1.1),
            new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })
        );
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.y = 0.01;
        // Single-part views (Build thumbnails) float free: no floor shadow.
        if (!only) this.root.add(this.shadow);
    }

    get eyeCount(): number {
        return this.eyes.length;
    }

    lookAt(target: THREE.Vector3 | null): void {
        this.lookTarget = target;
    }

    hit(): void {
        this.flash = 0.12;
    }

    knockOut(): void {
        this.ko = true;
        for (const e of this.eyes) e.mesh.material = eyeMat(e.iris, true);
    }

    revive(): void {
        this.ko = false;
        for (const e of this.eyes) e.mesh.material = eyeMat(e.iris, false);
    }

    update(dt: number): void {
        this.t += dt;
        const t = this.t;
        for (const b of this.builds) b.animate?.(t, this.energy);

        if (!this.ko) {
            const breathe = Math.sin(t * 2.4) * 0.025;
            this.body.scale.set((1 - breathe * 0.5) * this.squash.x, (1 + breathe) * this.squash.y, (1 - breathe * 0.5) * this.squash.z);
        }

        // Eyes: blink + look.
        const world = new THREE.Vector3();
        for (const e of this.eyes) {
            if (this.ko) {
                e.mesh.scale.setScalar(e.baseScale);
                continue;
            }
            e.blinkAt -= dt;
            if (e.blinkAt <= 0) {
                e.blinkLeft = 0.09;
                e.blinkAt = 1.5 + this.rnd() * 4;
            }
            if (e.blinkLeft > 0) {
                e.blinkLeft -= dt;
                e.mesh.scale.set(e.baseScale, e.baseScale * 0.12, e.baseScale);
            } else {
                e.mesh.scale.setScalar(e.baseScale);
            }
            if (this.lookTarget) {
                e.mesh.getWorldPosition(world);
                e.mesh.lookAt(this.lookTarget);
            }
        }

        // Hit flash.
        if (this.flash > 0) {
            this.flash -= dt;
            const on = this.flash > 0;
            for (const f of this.flashMats) {
                if (on) f.m.emissive.setRGB(1, 1, 1);
                else f.m.emissive.copy(f.base);
            }
        }
    }

    dispose(): void {
        const shared = new Set<THREE.Material>(eyeMats.values());
        this.root.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            if (o.geometry !== eyeGeo) o.geometry.dispose();
            const m = o.material as THREE.Material;
            if (!shared.has(m)) m.dispose();
        });
        this.root.removeFromParent();
    }
}
