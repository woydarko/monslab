/**
 * Cosmetic 4th slot (DESIGN_SYSTEM §7, no stats): three low-poly accessories
 * built from the same kit as the parts.
 *
 * Each builder returns a group whose origin sits on its anchor, so the monster
 * view only has to place the group — nothing inside knows about the monster:
 *   201 Monad Crown — worn on the head (purple band + spikes, primary gem)
 *   202 Goo Trail   — slime blobs behind the legs (bobs per frame)
 *   203 War Orb     — an orb orbiting ~0.6 head units beside the head
 */
import * as THREE from 'three';
import { ACCESSORIES } from '../../data/tokenIds.ts';
import { makePsxMaterial } from '../psxMaterial.ts';
import { PALETTE } from '../psxConfig.ts';
import { ballGeo, blobGeo, mat, mesh, spikeGeo, tinted, type Kit } from './kit.ts';

/** Where the monster view hangs the group. */
export type AccAnchor = 'head' | 'legs';

/** Contract between the builder and `MonsterView` (kept in userData so the
 *  public signature stays `buildAccessory(token, kit): THREE.Group | null`). */
export interface AccessoryUserData {
    anchor: AccAnchor;
    /** Idle animation; t = seconds. */
    update(t: number): void;
}

/** One lookup table so tokens, names and anchors cannot drift apart. */
const SPECS: Record<number, { name: string; anchor: AccAnchor }> = {
    201: { name: 'acc-crown', anchor: 'head' },
    202: { name: 'acc-trail', anchor: 'legs' },
    203: { name: 'acc-orb', anchor: 'head' },
};

/** Accessory tokens, in the same order as the contract (201..203). */
export const ACC_TOKENS: readonly number[] = ACCESSORIES;

export function isAccessoryToken(token: number): boolean {
    return Object.prototype.hasOwnProperty.call(SPECS, token);
}

function tag(group: THREE.Group, token: number, anchor: AccAnchor, update: (t: number) => void): THREE.Group {
    group.name = SPECS[token].name;
    group.userData = { anchor, update } satisfies AccessoryUserData;
    return group;
}

/** 201 — Monad Crown: six-sided band with five spikes and a glowing gem. */
function crown(kit: Kit): THREE.Group {
    const group = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    const purple = mat(tinted(PALETTE.brand, kit.tint));
    purple.side = THREE.DoubleSide;
    const gemMat = makePsxMaterial({ color: PALETTE.accent, emissive: PALETTE.accent, emissiveIntensity: 0.4, flat: false });

    // Open-ended band so the head fits inside it.
    const band = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.16, 6, 1, true), purple, meshes);
    band.position.y = 0.08;
    group.add(band);

    const spikes: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = mesh(spikeGeo(0.07, 0.2, 4), purple, meshes);
        spike.position.set(Math.sin(a) * 0.28, 0.15, Math.cos(a) * 0.28);
        spike.rotation.z = -Math.sin(a) * 0.18;
        spike.rotation.x = Math.cos(a) * 0.18;
        group.add(spike);
        spikes.push(spike);
    }

    // Gem on the front of the band, facing +Z like every part.
    const gem = mesh(ballGeo(0.09, 6, 4, new THREE.Vector3(1, 1.2, 0.6)), gemMat, meshes);
    gem.position.set(0, 0.1, 0.32);
    group.add(gem);

    return tag(group, 201, 'head', (t) => {
        gem.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
        spikes.forEach((s, i) => (s.scale.y = 1 + Math.sin(t * 2 + i) * 0.05));
    });
}

/** 202 — Goo Trail: slime blobs dragging behind the feet, plus a flat puddle. */
function trail(kit: Kit): THREE.Group {
    const group = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    // Same slime token as the goo parts, shaded down a step: the parts get their
    // depth from a blotch texture, an untextured blob would blow out under the light.
    const slime = mat(tinted(PALETTE.slime, kit.tint).multiplyScalar(0.7));

    const puddle = mesh(blobGeo(0.3, 1, 0.16, kit.seed + 71, new THREE.Vector3(1.5, 0.22, 1.2)), slime, meshes);
    puddle.position.set(0, 0.02, -0.16);
    group.add(puddle);

    const blobs: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
    // Spread sideways as well as back, so the trail still reads from a 3/4 view.
    const spots: [number, number, number][] = [
        [-0.34, -0.2, 0.13],
        [0.36, -0.34, 0.15],
        [-0.12, -0.52, 0.11],
        [0.2, -0.6, 0.09],
    ];
    spots.forEach(([x, z, r], i) => {
        const b = mesh(blobGeo(r, 1, 0.2, kit.seed + 80 + i), slime, meshes);
        b.position.set(x, 0.02 + r * 0.55, z);
        group.add(b);
        blobs.push({ mesh: b, baseY: b.position.y, phase: i * 1.9 });
    });

    return tag(group, 202, 'legs', (t) => {
        puddle.scale.set(1 + Math.sin(t * 2.4) * 0.08, 1, 1 + Math.cos(t * 2.4) * 0.08);
        for (const b of blobs) {
            b.mesh.position.y = b.baseY + Math.sin(t * 3 + b.phase) * 0.05;
            b.mesh.scale.setScalar(1 + Math.sin(t * 2.2 + b.phase) * 0.12);
        }
    });
}

/** 203 — War Orb: one sphere + a smaller satellite, orbiting 0.6 beside the head. */
function orb(kit: Kit): THREE.Group {
    const group = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    const core = makePsxMaterial({ color: PALETTE.brand, emissive: PALETTE.brand, emissiveIntensity: 0.45, flat: false });
    const sparkle = mat(PALETTE.accent);

    // The group hangs on the head top, so the pivot sits half a head lower: the
    // orb circles the skull, not the air above it.
    const pivot = new THREE.Group();
    pivot.position.y = -0.5;
    group.add(pivot);

    const ball = mesh(blobGeo(0.16, 1, 0.06, kit.seed + 91), core, meshes);
    ball.position.set(0.6, 0, 0);
    pivot.add(ball);

    const shard = mesh(spikeGeo(0.05, 0.14, 4), sparkle, meshes);
    shard.position.set(0.6, 0.16, 0);
    pivot.add(shard);

    return tag(group, 203, 'head', (t) => {
        pivot.rotation.y = t * 1.6;
        pivot.position.y = -0.5 + Math.sin(t * 2.1) * 0.05;
        ball.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
        shard.rotation.y = -t * 2.4;
    });
}

const BUILDERS: Record<number, (kit: Kit) => THREE.Group> = { 201: crown, 202: trail, 203: orb };

/** Build a cosmetic for an accessory token; `null` for anything else. */
export function buildAccessory(token: number, kit: Kit): THREE.Group | null {
    const build = BUILDERS[token];
    return build ? build(kit) : null;
}
