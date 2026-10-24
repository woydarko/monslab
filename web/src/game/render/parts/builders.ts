/**
 * The original 9 parts as procedural low-poly builders (GDD §21.1);
 * the 12 newer ones live in builders2.ts and are merged into BUILDERS below.
 *
 * Conventions (all parts face +Z):
 *   HEAD: origin at the neck joint, grows up (+Y).
 *   BODY: origin at the hips, `neck` = where the head attaches.
 *   LEGS: origin at the hip, grows down; `height` = hip → floor.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../sim/rng.ts';
import { blotchTex } from '../textures.ts';
import { PALETTE } from '../psxConfig.ts';
import {
    ballGeo, blobGeo, limb, mat, mesh, scatterEyes, spikeGeo, tinted,
    type EyeAnchor, type PartBuild, type PartBuilder,
} from './kit.ts';
import { BUILDERS_EXTRA } from './builders2.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DARK = 0x140b20;

function legsHeight(group: THREE.Group): number {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    return Math.max(0.2, -box.min.y);
}

// ───────────────────────────── FANG ─────────────────────────────

const fangHead: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const bone = mat(tinted(PALETTE.bone, tint), blotchTex('bone', 0xe8dcc0, { spots: 10, dark: 0.82, light: 1.05 }));
    const dark = mat(DARK);

    const skull = mesh(ballGeo(0.5, 8, 6, V(1, 0.92, 1.05)), bone, meshes);
    skull.position.y = 0.5;
    group.add(skull);

    const jaw = new THREE.Group();
    jaw.position.set(0, 0.26, 0.05);
    const jawMesh = mesh(ballGeo(0.34, 6, 4, V(1, 0.45, 1.05)), bone, meshes);
    jawMesh.position.set(0, -0.06, 0.1);
    jaw.add(jawMesh);
    group.add(jaw);

    for (const sx of [-1, 1]) {
        const socket = mesh(ballGeo(0.16, 6, 4, V(1, 1.1, 0.5)), dark);
        socket.position.set(0.19 * sx, 0.52, 0.43);
        group.add(socket);
        const fang = mesh(spikeGeo(0.065, 0.26, 4), bone, meshes);
        fang.rotation.x = Math.PI;
        fang.position.set(0.12 * sx, 0.27, 0.42);
        group.add(fang);
    }
    const nose = mesh(ballGeo(0.07, 4, 3, V(1, 1.3, 0.6)), dark);
    nose.position.set(0, 0.36, 0.5);
    group.add(nose);

    const eyes: EyeAnchor[] = [-1, 1].map((sx) => ({
        parent: group, position: V(0.19 * sx, 0.52, 0.42), normal: V(0, 0, 1), size: 0.13,
    }));

    return {
        group, eyes, meshes,
        animate(t, energy) {
            jaw.rotation.x = 0.08 + Math.max(0, Math.sin(t * 3)) * 0.08 + energy * 0.45;
        },
    };
};

const fangBody: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const cloth = mat(tinted(PALETTE.blood, tint), blotchTex('cloth', 0xb02a36, { spots: 8, dark: 0.75, light: 1.1 }));
    const inner = mat(tinted(0x3a2a3a, tint), blotchTex('leather', 0x3a2a3a, { spots: 8 }));

    const torso = mesh(ballGeo(0.42, 7, 5, V(1, 1.25, 0.9)), inner, meshes);
    torso.position.y = 0.5;
    group.add(torso);

    const profile = [V(0.28, 1.0, 0), V(0.42, 0.8, 0), V(0.58, 0.45, 0), V(0.72, 0.1, 0), V(0.78, 0.0, 0)].map(
        (v) => new THREE.Vector2(v.x, v.y)
    );
    const capeGeo = new THREE.LatheGeometry(profile, 7, Math.PI * 0.28, Math.PI * 1.44);
    cloth.side = THREE.DoubleSide;
    const cape = mesh(capeGeo, cloth, meshes);
    group.add(cape);

    for (const sx of [-1, 1]) {
        const collar = mesh(spikeGeo(0.12, 0.42, 4), cloth, meshes);
        collar.position.set(0.24 * sx, 0.92, -0.12);
        collar.rotation.z = -0.5 * sx;
        collar.rotation.x = -0.25;
        group.add(collar);
    }

    return {
        group, eyes: [], meshes, neck: V(0, 1.02, 0),
        animate(t, energy) {
            cape.rotation.y = Math.sin(t * 1.7) * 0.06 + energy * 0.1;
            cape.scale.setScalar(1 + energy * 0.15);
        },
    };
};

const fangLegs: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const leather = mat(tinted(0x5a2a2e, tint), blotchTex('batleather', 0x5a2a2e, { spots: 10 }));
    const claw = mat(tinted(PALETTE.bone, tint));
    const legs: THREE.Group[][] = [];
    for (const sx of [-1, 1]) {
        const l = limb(
            [
                { length: 0.34, radius: 0.08, angle: new THREE.Euler(0.25, 0, 0.3 * sx) },
                { length: 0.34, radius: 0.065, angle: new THREE.Euler(-0.55, 0, -0.42 * sx) },
            ],
            leather, meshes, { geo: spikeGeo(0.06, 0.2, 4), material: claw }
        );
        l.root.position.x = 0.22 * sx;
        // three toe claws
        for (const a of [-0.6, 0, 0.6]) {
            const toe = mesh(spikeGeo(0.04, 0.18, 4), claw, meshes);
            toe.rotation.set(Math.PI / 2 - 0.3, a, 0);
            l.end.add(toe);
        }
        group.add(l.root);
        legs.push(l.joints);
    }
    // stubby bat wings on the hips
    for (const sx of [-1, 1]) {
        const wingGeo = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0.55 * sx, 0.25, -0.1), V(0.4 * sx, -0.15, -0.1)]);
        wingGeo.computeVertexNormals();
        const wingMat = mat(tinted(0x3a1a20, tint));
        wingMat.side = THREE.DoubleSide;
        const wing = mesh(wingGeo, wingMat, meshes);
        wing.position.set(0.25 * sx, 0.05, -0.2);
        group.add(wing);
        legs.push([wing as unknown as THREE.Group]);
    }
    const height = legsHeight(group);
    return {
        group, eyes: [], meshes, height,
        animate(t, energy) {
            const k = 0.12 + energy * 0.3;
            legs[0][0].rotation.x = 0.25 + Math.sin(t * 4) * k;
            legs[1][0].rotation.x = 0.25 - Math.sin(t * 4) * k;
            legs[2][0].rotation.y = Math.sin(t * 9) * 0.4;
            legs[3][0].rotation.y = -Math.sin(t * 9) * 0.4;
        },
    };
};

// ───────────────────────────── GOO ─────────────────────────────

function slimeMat(tint: THREE.Color, flat = false) {
    return mat(tinted(PALETTE.slime, tint), blotchTex('slime', 0x5fb86a, { spots: 16, dark: 0.7, light: 1.3 }), flat);
}

const gooHead: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const slime = slimeMat(tint);
    const head = mesh(blobGeo(0.46, 1, 0.13, seed + 11, V(1.05, 0.95, 1)), slime, meshes);
    head.position.y = 0.44;
    group.add(head);

    const mouth = mesh(ballGeo(0.2, 6, 4, V(1.5, 0.55, 0.5)), mat(DARK));
    mouth.position.set(0, 0.3, 0.38);
    group.add(mouth);
    const tongue = mesh(ballGeo(0.09, 5, 3, V(1.2, 0.5, 1.4)), mat(tinted(0xd8506a, tint)), meshes);
    tongue.position.set(0.04, 0.25, 0.45);
    group.add(tongue);

    const drips: THREE.Mesh[] = [];
    for (const [x, z, l] of [[-0.2, 0.28, 0.22], [0.16, 0.32, 0.3], [0.32, 0.1, 0.16]]) {
        const d = mesh(spikeGeo(0.05, l, 4), slime, meshes);
        d.rotation.x = Math.PI;
        d.position.set(x, 0.14, z);
        group.add(d);
        drips.push(d);
    }
    return {
        group, meshes,
        eyes: [{ parent: group, position: V(0.02, 0.68, 0.32), normal: V(0, 0.4, 1).normalize(), size: 0.17 }],
        animate(t, energy) {
            head.scale.set(1 + Math.sin(t * 3.1) * 0.03, 1 - Math.sin(t * 3.1) * 0.03, 1);
            mouth.scale.y = 1 + energy * 0.8;
            drips.forEach((d, i) => (d.scale.y = 1 + Math.sin(t * 2 + i * 2) * 0.25));
        },
    };
};

const gooBody: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const slime = slimeMat(tint);
    const body = mesh(blobGeo(0.62, 2, 0.08, seed + 22, V(1.12, 0.92, 1)), slime, meshes);
    body.position.y = 0.55;
    group.add(body);
    const rnd = mulberry32(seed + 5);
    const bubbleMat = mat(tinted(0xb8f5a0, tint));
    for (let i = 0; i < 4; i++) {
        const b = mesh(ballGeo(0.06 + rnd() * 0.07, 5, 4), bubbleMat, meshes);
        const a = rnd() * Math.PI * 1.2 - 0.6;
        b.position.set(Math.sin(a) * 0.62, 0.35 + rnd() * 0.45, Math.cos(a) * 0.55);
        group.add(b);
    }
    return {
        group, meshes, eyes: [], neck: V(0, 1.05, 0.02),
        animate(t, energy) {
            const s = Math.sin(t * 2.2) * 0.035;
            body.scale.set(1 + s + energy * 0.08, 1 - s, 1 + s);
        },
    };
};

const gooLegs: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const slime = slimeMat(tint);
    const puddle = mesh(blobGeo(0.5, 1, 0.15, seed + 33, V(1.35, 0.32, 1.3)), slime, meshes);
    puddle.position.y = -0.3;
    group.add(puddle);
    const stem = mesh(blobGeo(0.3, 1, 0.1, seed + 34, V(1, 1.1, 1)), slime, meshes);
    stem.position.y = -0.08;
    group.add(stem);
    const tentacles: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
        const a = -0.9 + i * 0.9;
        const t = mesh(spikeGeo(0.09, 0.4, 5), slime, meshes);
        t.position.set(Math.sin(a) * 0.5, -0.36, Math.cos(a) * 0.45);
        t.rotation.set(Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2);
        group.add(t);
        tentacles.push(t);
    }
    return {
        group, meshes, eyes: [], height: 0.42,
        animate(t, energy) {
            puddle.scale.set(1 + Math.sin(t * 2.6) * 0.05, 1, 1 + Math.cos(t * 2.6) * 0.05);
            tentacles.forEach((m, i) => (m.rotation.y = Math.sin(t * 3 + i) * (0.3 + energy * 0.6)));
        },
    };
};

// ───────────────────────────── EYE ─────────────────────────────

function fleshMat(tint: THREE.Color) {
    return mat(tinted(PALETTE.flesh, tint), blotchTex('flesh', 0x8a4fd0, { spots: 14, dark: 0.72, light: 1.2 }));
}

const eyeHead: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const dome = mesh(ballGeo(0.48, 8, 6, V(1, 1.02, 1)), fleshMat(tint), meshes);
    dome.position.y = 0.46;
    group.add(dome);
    const mouth = mesh(ballGeo(0.16, 6, 3, V(1.6, 0.3, 0.6)), mat(DARK));
    mouth.position.set(0, 0.18, 0.38);
    group.add(mouth);
    const eyes = scatterEyes(dome, 5, seed + 44, [0.1, 0.17], (p, n) => n.z > 0.05 && p.y > -0.25);
    return {
        group, meshes, eyes,
        animate(t, energy) {
            dome.rotation.z = Math.sin(t * 1.3) * 0.05;
            mouth.scale.y = 1 + energy * 1.5;
        },
    };
};

const eyeBody: PartBuilder = ({ seed, tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const mass = mesh(ballGeo(0.62, 9, 7, V(1, 1.12, 0.95)), fleshMat(tint), meshes);
    mass.position.y = 0.62;
    group.add(mass);
    const eyes = scatterEyes(mass, 7, seed + 55, [0.1, 0.18], (p, n) => n.z > -0.1 && p.y < 0.5);
    return {
        group, meshes, eyes, neck: V(0, 1.26, 0),
        animate(t, energy) {
            const s = Math.sin(t * 1.8) * 0.03;
            mass.scale.set(1 - s + energy * 0.06, 1 + s, 1 - s);
        },
    };
};

const eyeLegs: PartBuilder = ({ tint }) => {
    const meshes: THREE.Mesh[] = [];
    const group = new THREE.Group();
    const chitin = mat(tinted(PALETTE.chitin, tint), blotchTex('chitin', 0x5a4878, { spots: 10, dark: 0.6, light: 1.4 }));
    const joints: THREE.Group[][] = [];
    const eyes: EyeAnchor[] = [];
    const yaws = [-1.0, -0.45, 0.25, Math.PI - 0.25, Math.PI + 0.45, Math.PI + 1.0];
    yaws.forEach((yaw, i) => {
        const holder = new THREE.Group();
        holder.rotation.y = yaw;
        const l = limb(
            [
                { length: 0.42, radius: 0.06, angle: new THREE.Euler(0, 0, 2.0) },
                { length: 0.7, radius: 0.045, angle: new THREE.Euler(0, 0, -1.75) },
            ],
            chitin, meshes
        );
        holder.add(l.root);
        group.add(holder);
        joints.push(l.joints);
        if (i % 2 === 0) {
            const knee = l.joints[1].parent!;
            eyes.push({ parent: knee, position: V(0, 0.07, 0), normal: V(0, 1, 0), size: 0.09 });
        }
    });
    const hub = mesh(ballGeo(0.2, 6, 4, V(1.2, 0.7, 1.2)), chitin, meshes);
    hub.position.y = -0.02;
    group.add(hub);
    const height = legsHeight(group);
    return {
        group, meshes, eyes, height,
        animate(t, energy) {
            const speed = 6 + energy * 10;
            joints.forEach((j, i) => {
                const ph = t * speed + i * 1.1;
                j[0].rotation.z = 2.0 + Math.sin(ph) * (0.08 + energy * 0.12);
                j[0].rotation.y = Math.cos(ph) * 0.12;
            });
        },
    };
};

export const BUILDERS: Record<string, PartBuilder> = {
    fangHead, fangBody, fangLegs,
    gooHead, gooBody, gooLegs,
    eyeHead, eyeBody, eyeLegs,
    ...BUILDERS_EXTRA,
};

export type { PartBuild };
