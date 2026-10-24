/**
 * Assembles a 3D monster from 3 part builders (GDD §11.2): legs at the
 * bottom, body on the hips, head on the body's neck socket. Adds eyeballs at
 * every anchor (blink + look-at), a blob shadow, idle breathing, hit flash,
 * and the cosmetic accessory slot (G3).
 *
 * The root's origin is on the floor between the feet; the monster faces +Z.
 */
import * as THREE from 'three';
import { getPart } from '../data/parts.ts';
import type { MonsterParts, SlotId } from '../data/types.ts';
import { hashString, mulberry32 } from '../sim/rng.ts';
import { BUILDERS, type PartBuild } from './parts/builders.ts';
import { buildAccessory, type AccessoryUserData } from './parts/accessories.ts';
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

/** Free the geometry and materials of a detached subtree. */
export function disposeTree(root: THREE.Object3D): void {
    root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
    });
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
    /** Skin tint + seed kept so the accessory slot can be swapped later. */
    private readonly tint: THREE.Color;
    private readonly seed: number;
    /** Head top / hip height in body space — where accessories hang. */
    private headTop = 0;
    private hipY = 0;
    private acc: THREE.Group | null = null;
    private accToken = 0;
    /** 0..1: drives attack poses in part animations. */
    energy = 0;
    /** Extra squash & stretch multiplied into the idle breathing (battle juice). */
    readonly squash = new THREE.Vector3(1, 1, 1);
    private ko = false;

    /**
     * @param only show a single part (capsule reveal) instead of a full monster.
     * @param acc accessory token for the cosmetic 4th slot (201/202/203), 0 = none.
     */
    constructor(readonly parts: MonsterParts, skin = 0, seed = 0, only?: SlotId, acc?: number) {
        const tint = new THREE.Color(skinTint(skin));
        this.tint = tint;
        this.seed = seed;
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
            this.hipY = legH;
            // Measure the real head so a tall skull and a flat blob both wear the crown.
            this.body.updateMatrixWorld(true);
            this.headTop = new THREE.Box3().setFromObject(head.group).max.y;
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

        // Single-part views never wear an accessory (thumbnails stay per-slot).
        if (!only) this.setAccessory(acc);
    }

    get eyeCount(): number {
        return this.eyes.length;
    }

    /**
     * Equip a cosmetic accessory (201 crown / 202 trail / 203 orb), or clear the
     * slot with 0/undefined. An unknown token leaves the slot empty.
     */
    setAccessory(token?: number): void {
        const next = token ?? 0;
        if (next === this.accToken) return;
        if (this.acc) {
            this.body.remove(this.acc);
            disposeTree(this.acc);
            this.acc = null;
        }
        this.accToken = 0;
        if (!next) return;
        const group = buildAccessory(next, { seed: this.seed, tint: this.tint });
        if (!group) return;
        const data = group.userData as AccessoryUserData;
        if (data.anchor === 'legs') group.position.set(0, this.hipY * 0.3, -0.5);
        else group.position.set(0, this.headTop, 0);
        this.body.add(group);
        this.acc = group;
        this.accToken = next;
    }

    /** Accessory token currently worn (0 = empty slot). */
    get accessory(): number {
        return this.accToken;
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
        (this.acc?.userData as AccessoryUserData | undefined)?.update(t);

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
        this.acc = null;
        this.accToken = 0;
        this.root.removeFromParent();
    }
}
