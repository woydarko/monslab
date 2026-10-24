/**
 * The 12 parts added on 18 Oct (CLAW, BONE, SHROOM, GHOST families), same
 * conventions as builders.ts (all parts face +Z):
 *   HEAD: origin at the neck joint, grows up (+Y).
 *   BODY: origin at the hips, `neck` = where the head attaches.
 *   LEGS: origin at the hip, grows down; `height` = hip → floor.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../sim/rng.ts';
import { blotchTex } from '../textures.ts';
import { makePsxBasic, makePsxMaterial } from '../psxMaterial.ts';
import {
    ballGeo, blobGeo, limb, mat, mesh, spikeGeo, tinted,
    type EyeAnchor, type PartBuilder,
} from './kit.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DARK = 0x140b20;

function legsHeight(group: THREE.Group): number {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    return Math.max(0.2, -box.min.y);
}

// ───────────────────────────── CLAW (werewolf) ─────────────────────────────

const FUR = 0x8a5a3a;
function furMat(tint: THREE.Color) {
    return mat(tinted(FUR, tint), blotchTex('fur', 0x8a5a3a, { spots: 22, spotScale: 3, dark: 0.7, light: 1.25 }));
}

const clawHead: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const fur = furMat(tint);
    const skull = mesh(ballGeo(0.44, 8, 6, V(1, 0.95, 1.05)), fur, meshes);
    skull.position.y = 0.46;
    group.add(skull);
    // Snout: tapered box pointing forward, with a jaw that opens on attack.
    const snoutGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.42, 5);
    snoutGeo.rotateX(Math.PI / 2);
    const snout = mesh(snoutGeo, fur, meshes);
    snout.position.set(0, 0.36, 0.48);
    group.add(snout);
    const nose = mesh(ballGeo(0.07, 5, 4), mat(DARK));
    nose.position.set(0, 0.4, 0.7);
    group.add(nose);
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.24, 0.32);
    const jawGeo = new THREE.BoxGeometry(0.26, 0.07, 0.34);
    jawGeo.translate(0, 0, 0.17);
    jaw.add(mesh(jawGeo, fur, meshes));
    const toothMat = mat(tinted(0xf2ead8, tint));
    for (const x of [-0.08, 0.08]) {
        const t = mesh(spikeGeo(0.035, 0.12, 4), toothMat, meshes);
        t.position.set(x, 0.03, 0.3);
        jaw.add(t);
        const top = mesh(spikeGeo(0.035, 0.12, 4), toothMat, meshes);
        top.rotation.x = Math.PI;
        top.position.set(x, 0.3, 0.62);
        group.add(top);
    }
    group.add(jaw);
    const ears: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) {
        const ear = mesh(spikeGeo(0.12, 0.34, 4), fur, meshes);
        ear.position.set(0.24 * sx, 0.78, -0.05);
        ear.rotation.z = -0.35 * sx;
        group.add(ear);
        ears.push(ear);
    }
    const eyes: EyeAnchor[] = [-1, 1].map((sx) => ({ parent: group, position: V(0.17 * sx, 0.56, 0.37), normal: V(0.3 * sx, 0.2, 1).normalize(), size: 0.1 }));
    return {
        group, eyes, meshes,
        animate(t, energy) {
            jaw.rotation.x = 0.05 + Math.max(0, Math.sin(t * 2.4)) * 0.06 + energy * 0.5;
            ears.forEach((e, i) => (e.rotation.x = Math.sin(t * 3 + i) * 0.08 - energy * 0.4));
        },
    };
};

const clawBody: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const fur = furMat(tint);
    const torso = mesh(blobGeo(0.55, 1, 0.16, seed + 61, V(1.05, 1.15, 0.9)), fur, meshes);
    torso.position.y = 0.6;
    group.add(torso);
    const belly = mesh(ballGeo(0.34, 6, 5, V(1, 1.2, 0.6)), mat(tinted(0xc89a6a, tint)), meshes);
    belly.position.set(0, 0.55, 0.32);
    group.add(belly);
    // Mane: ring of spiky fur tufts around the neck.
    const maneMat = mat(tinted(0x5a3a26, tint));
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const tuft = mesh(spikeGeo(0.11, 0.36, 4), maneMat, meshes);
        tuft.position.set(Math.sin(a) * 0.42, 1.0, Math.cos(a) * 0.36);
        tuft.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
        group.add(tuft);
    }
    return {
        group, meshes, eyes: [], neck: V(0, 1.12, 0.02),
        animate(t, energy) {
            const s = Math.sin(t * 2.6) * 0.03;
            torso.scale.set(1 + s + energy * 0.08, 1 - s, 1 + s);
        },
    };
};

const clawLegs: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const fur = furMat(tint);
    const claw = mat(tinted(0x2a2030, tint));
    const legs: THREE.Group[][] = [];
    for (const sx of [-1, 1]) {
        // Digitigrade: thigh forward, shin back, paw forward.
        const l = limb(
            [
                { length: 0.32, radius: 0.12, angle: new THREE.Euler(-0.5, 0, 0.15 * sx) },
                { length: 0.32, radius: 0.09, angle: new THREE.Euler(1.1, 0, -0.1 * sx) },
                { length: 0.14, radius: 0.07, angle: new THREE.Euler(-0.6, 0, 0) },
            ],
            fur, meshes
        );
        l.root.position.x = 0.24 * sx;
        for (const a of [-0.35, 0, 0.35]) {
            const c = mesh(spikeGeo(0.035, 0.16, 4), claw, meshes);
            c.rotation.set(Math.PI / 2 + 0.3, a, 0);
            c.position.z = 0.04;
            l.end.add(c);
        }
        group.add(l.root);
        legs.push(l.joints);
    }
    const tail = mesh(spikeGeo(0.1, 0.5, 5), fur, meshes);
    tail.position.set(0, 0.05, -0.3);
    tail.rotation.x = -2.2;
    group.add(tail);
    const height = legsHeight(group);
    return {
        group, meshes, eyes: [], height,
        animate(t, energy) {
            const k = 0.1 + energy * 0.35;
            legs[0][0].rotation.x = -0.5 + Math.sin(t * 5) * k;
            legs[1][0].rotation.x = -0.5 - Math.sin(t * 5) * k;
            tail.rotation.z = Math.sin(t * 6) * 0.5;
        },
    };
};

// ───────────────────────────── BONE (skeleton) ─────────────────────────────

const BONE = 0xe6dfc8;
function boneMat(tint: THREE.Color) {
    return mat(tinted(BONE, tint), blotchTex('bone2', 0xe6dfc8, { spots: 12, dark: 0.8, light: 1.05 }));
}

const boneHead: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const bone = boneMat(tint);
    const skull = mesh(ballGeo(0.5, 8, 6, V(1.05, 1, 1)), bone, meshes);
    skull.position.y = 0.52;
    group.add(skull);
    // Glowing sockets instead of eyeballs.
    const glow = makePsxBasic(0xff5a3c);
    const sockets: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) {
        const s = mesh(ballGeo(0.15, 6, 4, V(1, 1.15, 0.45)), mat(DARK));
        s.position.set(0.19 * sx, 0.55, 0.42);
        group.add(s);
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), glow);
        ember.position.set(0.19 * sx, 0.55, 0.48);
        group.add(ember);
        sockets.push(ember);
    }
    const nose = mesh(spikeGeo(0.06, 0.1, 3), mat(DARK));
    nose.rotation.x = Math.PI;
    nose.position.set(0, 0.42, 0.5);
    group.add(nose);
    // Jaw with a full row of square teeth (the "grin").
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.24, 0.08);
    const jawMesh = mesh(new THREE.BoxGeometry(0.46, 0.12, 0.34), bone, meshes);
    jawMesh.position.set(0, -0.04, 0.16);
    jaw.add(jawMesh);
    group.add(jaw);
    for (let i = 0; i < 6; i++) {
        const tooth = mesh(new THREE.BoxGeometry(0.055, 0.08, 0.04), bone, meshes);
        tooth.position.set(-0.15 + i * 0.06, 0.29, 0.44);
        group.add(tooth);
    }
    // A crack on the crown.
    const crack = mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), mat(DARK));
    crack.position.set(0.15, 0.88, 0.25);
    crack.rotation.z = 0.5;
    group.add(crack);
    return {
        group, meshes, eyes: [],
        animate(t, energy) {
            jaw.rotation.x = Math.abs(Math.sin(t * 9)) * 0.06 + energy * 0.4;
            const k = 0.8 + Math.sin(t * 4) * 0.2;
            sockets.forEach((s) => s.scale.setScalar(k + energy * 0.6));
        },
    };
};

const boneBody: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const bone = boneMat(tint);
    const spine = mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 5), bone, meshes);
    spine.position.set(0, 0.6, -0.18);
    group.add(spine);
    const pelvis = mesh(ballGeo(0.3, 6, 3, V(1.3, 0.45, 0.9)), bone, meshes);
    pelvis.position.y = 0.1;
    group.add(pelvis);
    // Ribs: open arcs curving forward around a glowing heart.
    for (let i = 0; i < 4; i++) {
        const r = 0.42 - Math.abs(i - 1.5) * 0.06;
        const rib = mesh(new THREE.TorusGeometry(r, 0.045, 3, 10, Math.PI * 1.3), bone, meshes);
        rib.rotation.set(Math.PI / 2, 0, -Math.PI * 0.15 + Math.PI / 2);
        rib.position.set(0, 0.38 + i * 0.2, 0.02);
        group.add(rib);
    }
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), makePsxBasic(0x7cff4a));
    heart.position.set(0, 0.65, 0.02);
    group.add(heart);
    const collar = mesh(new THREE.BoxGeometry(0.7, 0.08, 0.14), bone, meshes);
    collar.position.set(0, 1.1, -0.05);
    group.add(collar);
    return {
        group, meshes, eyes: [], neck: V(0, 1.15, 0),
        animate(t, energy) {
            const beat = 1 + Math.max(0, Math.sin(t * 6)) * 0.25 + energy * 0.3;
            heart.scale.setScalar(beat);
            heart.rotation.y = t;
        },
    };
};

const boneLegs: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const bone = boneMat(tint);
    const legs: THREE.Group[][] = [];
    for (const sx of [-1, 1]) {
        const l = limb(
            [
                { length: 0.45, radius: 0.06, angle: new THREE.Euler(0.1, 0, 0.12 * sx) },
                { length: 0.45, radius: 0.05, angle: new THREE.Euler(-0.2, 0, -0.12 * sx) },
            ],
            bone, meshes
        );
        l.root.position.x = 0.22 * sx;
        // Knobby knee + flat foot.
        const knee = mesh(ballGeo(0.08, 5, 4), bone, meshes);
        l.joints[1].add(knee);
        const foot = mesh(new THREE.BoxGeometry(0.16, 0.06, 0.28), bone, meshes);
        foot.position.set(0, -0.02, 0.08);
        l.end.add(foot);
        group.add(l.root);
        legs.push(l.joints);
    }
    const height = legsHeight(group);
    return {
        group, meshes, eyes: [], height,
        animate(t, energy) {
            // A rattly little jitter: bones never quite sit still.
            const j = Math.sin(t * 17) * 0.02 + energy * Math.sin(t * 30) * 0.06;
            legs[0][0].rotation.x = 0.1 + j;
            legs[1][0].rotation.x = 0.1 - j;
        },
    };
};

// ───────────────────────────── SHROOM (fungus) ─────────────────────────────

const CAP = 0xf15bb5;
const STEM = 0xf2e6cc;
function stemMat(tint: THREE.Color) {
    return mat(tinted(STEM, tint), blotchTex('stem', 0xf2e6cc, { spots: 8, dark: 0.85, light: 1.05 }), false);
}

function mushroomCap(radius: number, tint: THREE.Color, meshes: THREE.Mesh[], seed: number): THREE.Group {
    const g = new THREE.Group();
    const capGeo = new THREE.SphereGeometry(radius, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.scale(1, 0.7, 1);
    const cap = mesh(capGeo, mat(tinted(CAP, tint)), meshes);
    g.add(cap);
    const rim = mesh(new THREE.CylinderGeometry(radius, radius * 0.95, radius * 0.08, 10), mat(tinted(0xd0408c, tint)), meshes);
    rim.position.y = -radius * 0.02;
    g.add(rim);
    const rnd = mulberry32(seed);
    const spotMat = mat(tinted(0xffffff, tint));
    for (let i = 0; i < 6; i++) {
        const a = rnd() * Math.PI * 2;
        const el = 0.3 + rnd() * 0.9;
        const spot = mesh(ballGeo(radius * (0.1 + rnd() * 0.06), 5, 3, V(1, 0.35, 1)), spotMat, meshes);
        const r = radius * Math.cos(el);
        spot.position.set(Math.sin(a) * r, Math.sin(el) * radius * 0.7, Math.cos(a) * r);
        spot.lookAt(spot.position.clone().multiplyScalar(2));
        spot.rotateX(Math.PI / 2);
        g.add(spot);
    }
    return g;
}

const shroomHead: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const face = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 8), stemMat(tint), meshes);
    face.position.y = 0.25;
    group.add(face);
    const mouth = mesh(ballGeo(0.1, 6, 3, V(1.4, 0.5, 0.5)), mat(DARK));
    mouth.position.set(0, 0.16, 0.29);
    group.add(mouth);
    const cap = mushroomCap(0.62, tint, meshes, seed + 71);
    cap.position.y = 0.5;
    group.add(cap);
    return {
        group, meshes,
        eyes: [{ parent: group, position: V(0, 0.34, 0.3), normal: V(0, 0, 1), size: 0.12 }],
        animate(t, energy) {
            cap.rotation.z = Math.sin(t * 1.8) * 0.05;
            cap.scale.setScalar(1 + energy * 0.12);
            mouth.scale.y = 1 + energy * 1.4;
        },
    };
};

const shroomBody: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const trunk = mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.0, 9), stemMat(tint), meshes);
    trunk.position.y = 0.5;
    group.add(trunk);
    // Gills ring under the head.
    const gills = mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.12, 12), mat(tinted(0xe0b8a8, tint)), meshes);
    gills.position.y = 1.0;
    group.add(gills);
    // Little mushrooms sprouting from the trunk.
    const sprouts: THREE.Group[] = [];
    for (const [a, y, r] of [[-1.1, 0.45, 0.16], [0.9, 0.7, 0.13], [2.6, 0.3, 0.14]] as const) {
        const s = new THREE.Group();
        const stem = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 5), stemMat(tint), meshes);
        stem.position.y = 0.08;
        s.add(stem);
        const cap = mushroomCap(r, tint, meshes, seed + Math.round(a * 10));
        cap.position.y = 0.16;
        s.add(cap);
        s.position.set(Math.sin(a) * 0.48, y, Math.cos(a) * 0.48);
        s.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
        group.add(s);
        sprouts.push(s);
    }
    return {
        group, meshes, eyes: [], neck: V(0, 1.05, 0),
        animate(t, energy) {
            sprouts.forEach((s, i) => s.scale.setScalar(1 + Math.sin(t * 2 + i * 2) * 0.08 + energy * 0.2));
        },
    };
};

const shroomLegs: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const root = mat(tinted(0x7a5a3a, tint), blotchTex('root', 0x7a5a3a, { spots: 12 }));
    const roots: THREE.Group[] = [];
    const base = mesh(ballGeo(0.4, 7, 4, V(1.2, 0.55, 1.2)), root, meshes);
    base.position.y = -0.12;
    group.add(base);
    for (let i = 0; i < 5; i++) {
        const holder = new THREE.Group();
        holder.rotation.y = (i / 5) * Math.PI * 2 + 0.3;
        const l = limb(
            [
                { length: 0.28, radius: 0.08, angle: new THREE.Euler(0, 0, 1.1) },
                { length: 0.3, radius: 0.05, angle: new THREE.Euler(0, 0, -0.9) },
            ],
            root, meshes, { geo: spikeGeo(0.04, 0.12, 4), material: root }
        );
        l.root.position.y = -0.15;
        holder.add(l.root);
        group.add(holder);
        roots.push(l.joints[0]);
    }
    const height = legsHeight(group);
    return {
        group, meshes, eyes: [], height,
        animate(t, energy) {
            roots.forEach((r, i) => (r.rotation.z = 1.1 + Math.sin(t * 2 + i) * (0.05 + energy * 0.15)));
        },
    };
};

// ───────────────────────────── GHOST (spirit) ─────────────────────────────

const ECTO = 0xdffff4;
function ectoMat(tint: THREE.Color) {
    // A faint self-glow: ghosts read as light in a dark lab, no transparency needed.
    return makePsxMaterial({ color: tinted(ECTO, tint), emissive: tinted(0x2a8a74, tint), emissiveIntensity: 0.6, flat: false });
}

const ghostHead: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const ecto = ectoMat(tint);
    const head = mesh(ballGeo(0.44, 9, 7, V(1, 1.08, 1)), ecto, meshes);
    head.position.y = 0.48;
    group.add(head);
    // The wail: a big open mouth that stretches when it attacks.
    const mouth = mesh(ballGeo(0.15, 7, 5, V(0.9, 1.4, 0.4)), mat(DARK));
    mouth.position.set(0, 0.32, 0.4);
    group.add(mouth);
    // Wispy flame tips on top.
    const wisps: THREE.Mesh[] = [];
    for (const [x, h] of [[-0.14, 0.32], [0.05, 0.42], [0.2, 0.28]] as const) {
        const w = mesh(spikeGeo(0.1, h, 5), ecto, meshes);
        w.position.set(x, 0.86, -0.05);
        group.add(w);
        wisps.push(w);
    }
    const eyes: EyeAnchor[] = [-1, 1].map((sx) => ({ parent: group, position: V(0.16 * sx, 0.6, 0.36), normal: V(0.2 * sx, 0, 1).normalize(), size: 0.11 }));
    return {
        group, eyes, meshes,
        animate(t, energy) {
            mouth.scale.set(1, 1 + Math.sin(t * 2) * 0.1 + energy * 1.2, 1);
            wisps.forEach((w, i) => (w.rotation.z = Math.sin(t * 5 + i * 1.7) * 0.25));
        },
    };
};

const ghostBody: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const ecto = ectoMat(tint);
    ecto.side = THREE.DoubleSide;
    // Bell-shaped sheet; the hem is wavy.
    const profile = [
        new THREE.Vector2(0.18, 1.12), new THREE.Vector2(0.4, 0.95), new THREE.Vector2(0.52, 0.6),
        new THREE.Vector2(0.6, 0.25), new THREE.Vector2(0.72, 0.0),
    ];
    const sheetGeo = new THREE.LatheGeometry(profile, 12);
    const pos = sheetGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < 0.05) {
            const a = Math.atan2(pos.getZ(i), pos.getX(i));
            pos.setY(i, pos.getY(i) + Math.sin(a * 6) * 0.08);
        }
    }
    sheetGeo.computeVertexNormals();
    const sheet = mesh(sheetGeo, ecto, meshes);
    group.add(sheet);
    // Floppy sheet "arms".
    const arms: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) {
        const arm = mesh(spikeGeo(0.14, 0.45, 5), ecto, meshes);
        arm.position.set(0.5 * sx, 0.7, 0);
        arm.rotation.z = (Math.PI / 2 + 0.3) * sx;
        group.add(arm);
        arms.push(arm);
    }
    return {
        group, meshes, eyes: [], neck: V(0, 1.12, 0),
        animate(t, energy) {
            arms.forEach((a, i) => (a.rotation.x = Math.sin(t * 2.5 + i * Math.PI) * 0.3 - energy * 0.6));
            sheet.rotation.y = Math.sin(t * 1.5) * 0.08;
        },
    };
};

const ghostLegs: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const ecto = ectoMat(tint);
    // A twisting ectoplasm tail: shrinking puffs spiralling down, floating off the floor.
    const puffs: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const r = 0.34 - i * 0.07;
        const p = mesh(ballGeo(r, 7, 5, V(1, 0.75, 1)), ecto, meshes);
        p.position.set(0, -0.1 - i * 0.17, 0);
        group.add(p);
        puffs.push(p);
    }
    const tip = mesh(spikeGeo(0.06, 0.2, 5), ecto, meshes);
    tip.rotation.x = Math.PI;
    tip.position.y = -0.68;
    group.add(tip);
    return {
        group, meshes, eyes: [], height: 0.85,
        animate(t, energy) {
            puffs.forEach((p, i) => p.position.set(Math.sin(t * 3 + i) * (0.04 + i * 0.03), -0.1 - i * 0.17 + Math.sin(t * 2) * 0.03, Math.cos(t * 3 + i) * 0.03 * i));
            tip.position.x = Math.sin(t * 3 + 4) * 0.15;
            group.rotation.y = Math.sin(t) * 0.2 + energy * 0.5;
        },
    };
};

export const BUILDERS_EXTRA: Record<string, PartBuilder> = {
    clawHead, clawBody, clawLegs,
    boneHead, boneBody, boneLegs,
    shroomHead, shroomBody, shroomLegs,
    ghostHead, ghostBody, ghostLegs,
};
