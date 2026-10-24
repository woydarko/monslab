/**
 * Building blocks for procedural low-poly parts (GDD §11.2): noisy blobs,
 * jointed limbs, cones, and eye placement on surfaces. Everything is seeded so
 * the same monster looks identical on every device.
 */
import * as THREE from 'three';
import { mulberry32 } from '../../sim/rng.ts';
import { makePsxMaterial } from '../psxMaterial.ts';

export interface EyeAnchor {
    /** Object the eye is parented to (moves with the part). */
    parent: THREE.Object3D;
    position: THREE.Vector3;
    normal: THREE.Vector3;
    size: number;
}

export interface PartBuild {
    group: THREE.Group;
    /** BODY: where the head attaches (local). */
    neck?: THREE.Vector3;
    /** LEGS: distance from hip (y=0) down to the floor. */
    height?: number;
    eyes: EyeAnchor[];
    /** Procedural idle/attack animation. t = seconds, energy 0..1 (1 = attacking). */
    animate?(t: number, energy: number): void;
    /** Meshes whose materials flash white on hit. */
    meshes: THREE.Mesh[];
}

/** Everything a procedural builder needs: a deterministic seed and the skin tint. */
export interface Kit {
    seed: number;
    tint: THREE.Color;
}

export type PartBuilder = (opts: Kit) => PartBuild;

/** Tint helper: multiply a base hex by the skin tint. */
export function tinted(base: number, tint: THREE.Color): THREE.Color {
    return new THREE.Color(base).multiply(tint);
}

export function mat(color: THREE.ColorRepresentation, map: THREE.Texture | null = null, flat = true): THREE.MeshLambertMaterial {
    return makePsxMaterial({ color, map, flat });
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, list?: THREE.Mesh[]): THREE.Mesh {
    const m = new THREE.Mesh(geo, material);
    list?.push(m);
    return m;
}

/** Hash a position so duplicated (non-indexed) vertices displace identically. */
function posNoise(x: number, y: number, z: number, seed: number): number {
    const k = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let h = seed >>> 0;
    for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 0x01000193);
    return mulberry32(h)() * 2 - 1;
}

/** Lumpy blob from an icosahedron, displaced along normals. */
export function blobGeo(radius: number, detail: number, amp: number, seed: number, scale = new THREE.Vector3(1, 1, 1)): THREE.BufferGeometry {
    const g = new THREE.IcosahedronGeometry(radius, detail);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = posNoise(v.x, v.y, v.z, seed);
        v.multiplyScalar(1 + n * amp).multiply(scale);
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

/** Low-segment sphere, optionally squashed. */
export function ballGeo(radius: number, w = 8, h = 6, scale = new THREE.Vector3(1, 1, 1)): THREE.BufferGeometry {
    const g = new THREE.SphereGeometry(radius, w, h);
    g.scale(scale.x, scale.y, scale.z);
    return g;
}

/** Cone pointing along +Y by default; 4–5 sides for that PS1 crunch. */
export function spikeGeo(radius: number, height: number, sides = 4): THREE.BufferGeometry {
    const g = new THREE.ConeGeometry(radius, height, sides);
    g.translate(0, height / 2, 0);
    return g;
}

/**
 * A jointed limb: chain of 4-sided segments hanging from the origin.
 * Returns the root and the joint pivots so animations can bend them.
 */
export function limb(
    segments: { length: number; radius: number; angle: THREE.Euler }[],
    material: THREE.Material,
    meshes: THREE.Mesh[],
    tip?: { geo: THREE.BufferGeometry; material: THREE.Material }
): { root: THREE.Group; joints: THREE.Group[]; end: THREE.Group } {
    const root = new THREE.Group();
    const joints: THREE.Group[] = [];
    let parent: THREE.Object3D = root;
    for (const s of segments) {
        const joint = new THREE.Group();
        joint.rotation.copy(s.angle);
        parent.add(joint);
        const geo = new THREE.CylinderGeometry(s.radius * 0.8, s.radius, s.length, 4, 1);
        geo.translate(0, -s.length / 2, 0);
        joint.add(mesh(geo, material, meshes));
        const next = new THREE.Group();
        next.position.y = -s.length;
        joint.add(next);
        joints.push(joint);
        parent = next;
    }
    if (tip) {
        const t = mesh(tip.geo, tip.material, meshes);
        t.rotation.x = Math.PI;
        parent.add(t);
    }
    return { root, joints, end: parent as THREE.Group };
}

/**
 * Scatter `count` eye anchors over a mesh's surface (area-weighted, seeded),
 * keeping them apart and mostly on the camera-facing side.
 */
export function scatterEyes(
    target: THREE.Mesh,
    count: number,
    seed: number,
    size: [number, number],
    filter: (pos: THREE.Vector3, normal: THREE.Vector3) => boolean = (_p, n) => n.z > -0.15 && n.y > -0.6
): EyeAnchor[] {
    if (count <= 0) return [];
    const geo = target.geometry.index ? target.geometry.toNonIndexed() : target.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const tris: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; n: THREE.Vector3; area: number }[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i);
        b.fromBufferAttribute(pos, i + 1);
        c.fromBufferAttribute(pos, i + 2);
        const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
        const area = n.length() / 2;
        if (area <= 1e-6) continue;
        n.normalize();
        const centre = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
        if (!filter(centre, n)) continue;
        tris.push({ a: a.clone(), b: b.clone(), c: c.clone(), n, area });
    }
    const total = tris.reduce((s, t) => s + t.area, 0);
    const rnd = mulberry32(seed);
    const out: EyeAnchor[] = [];
    for (let attempt = 0; attempt < count * 40 && out.length < count; attempt++) {
        let r = rnd() * total;
        let tri = tris[0];
        for (const t of tris) {
            r -= t.area;
            if (r <= 0) { tri = t; break; }
        }
        if (!tri) break;
        let u = rnd();
        let v = rnd();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        const p = tri.a.clone()
            .add(tri.b.clone().sub(tri.a).multiplyScalar(u))
            .add(tri.c.clone().sub(tri.a).multiplyScalar(v));
        const s = size[0] + rnd() * (size[1] - size[0]);
        if (out.some((e) => e.position.distanceTo(p) < (e.size + s) * 1.15)) continue;
        out.push({ parent: target, position: p, normal: tri.n.clone(), size: s });
    }
    return out;
}
