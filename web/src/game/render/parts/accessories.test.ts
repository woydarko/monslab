/**
 * Accessory slot (G3): every cosmetic token builds a named group with real
 * meshes, an anchor and an idle animation; unknown tokens build nothing.
 * Runs in Node — geometry + materials only, no WebGL, no canvas textures.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ACCESSORIES, ACC_NAMES } from '../../data/tokenIds.ts';
import { buildAccessory, type AccessoryUserData } from './accessories.ts';
import type { Kit } from './kit.ts';

const kit: Kit = { seed: 1234, tint: new THREE.Color(0xffffff) };
const noTint: Kit = { seed: 99, tint: new THREE.Color(0xc0c0c0) };

function meshCount(obj: THREE.Object3D): number {
    let n = 0;
    obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) n++;
    });
    return n;
}

/** World-space centre of everything under a group (geometry only). */
function centreOf(group: THREE.Object3D): THREE.Vector3 {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    return box.getCenter(new THREE.Vector3());
}

describe('buildAccessory', () => {
    const names: Record<number, string> = { 201: 'acc-crown', 202: 'acc-trail', 203: 'acc-orb' };

    it.each([
        [201, 'Monad Crown'],
        [202, 'Goo Trail'],
        [203, 'War Orb'],
    ])('%i builds a named group with at least one mesh (%s)', (token) => {
        const group = buildAccessory(token, kit);
        expect(group).not.toBeNull();
        expect(group!.name).toBe(names[token]);
        expect(meshCount(group!)).toBeGreaterThanOrEqual(1);
        expect(ACC_NAMES[token]).toBe(token === 201 ? 'Monad Crown' : token === 202 ? 'Goo Trail' : 'War Orb');
    });

    it('covers every token in ACCESSORIES and nothing else is named', () => {
        expect(ACCESSORIES).toEqual([201, 202, 203]);
        for (const token of ACCESSORIES) expect(buildAccessory(token, kit)?.name).toBe(names[token]);
    });

    it('returns null for a part token, the empty slot and out-of-range ids', () => {
        expect(buildAccessory(7, kit)).toBeNull();
        expect(buildAccessory(0, kit)).toBeNull();
        expect(buildAccessory(101, kit)).toBeNull();
        expect(buildAccessory(-1, kit)).toBeNull();
    });

    it('is deterministic: same kit, same geometry count and size', () => {
        const a = buildAccessory(202, kit)!;
        const b = buildAccessory(202, kit)!;
        expect(meshCount(a)).toBe(meshCount(b));
        const sizeA = new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3());
        const sizeB = new THREE.Box3().setFromObject(b).getSize(new THREE.Vector3());
        expect(sizeA.distanceTo(sizeB)).toBeLessThan(1e-6);
        // The second build with a different tint is still the same shape.
        const c = buildAccessory(202, noTint)!;
        expect(c.name).toBe('acc-trail');
    });

    it('anchors the crown and the orb on the head, the trail behind the legs', () => {
        const anchor = (t: number) => (buildAccessory(t, kit)!.userData as AccessoryUserData).anchor;
        expect(anchor(201)).toBe('head');
        expect(anchor(202)).toBe('legs');
        expect(anchor(203)).toBe('head');
    });

    it('sits above the anchor origin for the crown (worn, not floating under it)', () => {
        const crown = buildAccessory(201, kit)!;
        const box = new THREE.Box3().setFromObject(crown);
        expect(box.min.y).toBeGreaterThan(-0.05);
        expect(box.max.y).toBeGreaterThan(0.2);
    });

    it('orbits the orb at roughly 0.6 units beside the head', () => {
        const orb = buildAccessory(203, kit)!;
        (orb.userData as AccessoryUserData).update(0);
        const at0 = centreOf(orb);
        expect(at0.length()).toBeGreaterThan(0.4);
        expect(at0.length()).toBeLessThan(0.95);
        (orb.userData as AccessoryUserData).update(1.2);
        const at1 = centreOf(orb);
        expect(at0.distanceTo(at1)).toBeGreaterThan(0.1); // it actually moves
        expect(at1.y).toBeGreaterThan(0); // stays beside the head, never under the floor
    });

    it('bobs the trail blobs over time without drifting away', () => {
        const trail = buildAccessory(202, kit)!;
        const data = trail.userData as AccessoryUserData;
        const y0 = trail.children.map((c) => c.position.y);
        data.update(0);
        data.update(0.7);
        const y1 = trail.children.map((c) => c.position.y);
        expect(y1.some((y, i) => Math.abs(y - y0[i]) > 1e-4)).toBe(true);
        for (const y of y1) expect(Math.abs(y)).toBeLessThan(1); // bob only, no drift
    });

    it('keeps every accessory small enough to read as a cosmetic', () => {
        for (const token of ACCESSORIES) {
            const box = new THREE.Box3().setFromObject(buildAccessory(token, kit)!);
            const size = box.getSize(new THREE.Vector3());
            expect(size.length()).toBeLessThan(1.5);
        }
    });
});
