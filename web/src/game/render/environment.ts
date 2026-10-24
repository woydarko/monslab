/**
 * Shared PS1 environments: the lab (moodboard concept_ps1_hero) and the
 * caged arena (concept_ps1_battle). Low-poly, fogged, procedural.
 */
import * as THREE from 'three';
import { PALETTE, PSX } from './psxConfig.ts';
import { makePsxBasic, makePsxMaterial } from './psxMaterial.ts';
import { gratingTex, metalTex, wallTex } from './textures.ts';

export interface Environment {
    group: THREE.Group;
    update(dt: number): void;
}

export function addLights(scene: THREE.Scene): void {
    scene.fog = new THREE.Fog(PSX.fogColor, PSX.fogNear, PSX.fogFar);
    scene.background = new THREE.Color(PSX.fogColor);
    scene.add(new THREE.AmbientLight(PSX.ambient.color, PSX.ambient.intensity));
    scene.add(new THREE.HemisphereLight(PSX.hemi.sky, PSX.hemi.ground, PSX.hemi.intensity));
    const key = new THREE.DirectionalLight(PSX.keyLight.color, PSX.keyLight.intensity);
    key.position.set(...PSX.keyLight.position);
    scene.add(key, key.target);
    const rim = new THREE.PointLight(PSX.rimLight.color, PSX.rimLight.intensity * 6, 12, 1.5);
    rim.position.set(...PSX.rimLight.position);
    scene.add(rim);
}

function floor(size: number): THREE.Mesh {
    const tex = gratingTex();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 6, 6), makePsxMaterial({ map: tex, color: 0xffffff }));
    m.rotation.x = -Math.PI / 2;
    return m;
}

function tube(height: number): { group: THREE.Group; liquid: THREE.Mesh } {
    const group = new THREE.Group();
    const metal = makePsxMaterial({ map: metalTex(), color: 0x8a8090 });
    const capGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.25, 8);
    const base = new THREE.Mesh(capGeo, metal);
    base.position.y = 0.12;
    const top = new THREE.Mesh(capGeo, metal);
    top.position.y = height - 0.12;
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, height - 0.5, 8), makePsxBasic(PALETTE.tubeGlow));
    liquid.position.y = height / 2;
    group.add(base, top, liquid);
    return { group, liquid };
}

export function buildLab(): Environment {
    const group = new THREE.Group();
    group.add(floor(24));

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 8, 4, 2), makePsxMaterial({ map: wallTex(), color: 0xffffff }));
    wall.position.set(0, 4, -5);
    group.add(wall);

    const liquids: THREE.Mesh[] = [];
    for (const [x, z, h] of [[-2.4, -3.4, 3.2], [-1.3, -4.2, 3.6], [2.2, -3.6, 3.4]] as const) {
        const t = tube(h);
        t.group.position.set(x, 0, z);
        group.add(t.group);
        liquids.push(t.liquid);
    }

    // Workbench with flasks on the right.
    const metal = makePsxMaterial({ map: metalTex(), color: 0x6a6070 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.9), metal);
    bench.position.set(2.4, 0.45, -1.4);
    group.add(bench);
    for (const [x, h, c] of [[2.0, 0.5, PALETTE.tubeGlow], [2.5, 0.35, 0xc04cff], [3.1, 0.6, PALETTE.tubeGlow]] as const) {
        const flask = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 6), makePsxBasic(c));
        flask.position.set(x, 0.9 + h / 2, -1.3);
        group.add(flask);
    }
    // Machine console on the left.
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.9), metal);
    console_.position.set(-2.5, 0.6, -1.2);
    group.add(console_);
    for (const [x, c] of [[-3.2, 0xff3040], [-2.9, PALETTE.accent], [-2.6, PALETTE.accent]] as const) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), makePsxBasic(c));
        led.position.set(x + 0.3, 1.0, -0.73);
        group.add(led);
    }

    // Pedestal the monster stands on.
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.3, 10), makePsxMaterial({ map: metalTex(), color: 0x9a90a0 }));
    ped.position.y = 0.15;
    ped.name = 'pedestal';
    group.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.04, 4, 20), makePsxBasic(PALETTE.accent));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.31;
    group.add(ring);

    let t = 0;
    return {
        group,
        update(dt) {
            t += dt;
            liquids.forEach((l, i) => {
                const m = l.material as THREE.MeshBasicMaterial;
                const k = 0.5 + Math.sin(t * 2 + i * 1.7) * 0.15;
                m.color.setHex(PALETTE.tubeGlow).multiplyScalar(k);
            });
        },
    };
}

export function buildArena(): Environment {
    const group = new THREE.Group();
    group.add(floor(26));
    const metal = makePsxMaterial({ map: metalTex(), color: 0xa89cb4 });
    const half = 3.4;
    const barGeo = new THREE.BoxGeometry(0.08, 3, 0.08);
    for (let i = -half; i <= half + 0.01; i += 0.55) {
        for (const [x, z] of [[i, -half], [i, half], [-half, i], [half, i]]) {
            if (z === half) continue; // keep the camera side fully open
            const bar = new THREE.Mesh(barGeo, metal);
            bar.position.set(x, 1.5, z);
            group.add(bar);
        }
    }
    const railGeo = new THREE.BoxGeometry(half * 2, 0.12, 0.12);
    // [x, z, rotationY, includeBottomRail]; the front (camera) side stays open.
    const sides: [number, number, number, boolean][] = [
        [0, -half, 0, true],
        [-half, 0, Math.PI / 2, true],
        [half, 0, Math.PI / 2, true],
    ];
    for (const [x, z, ry, bottom] of sides) {
        for (const y of bottom ? [0.1, 3.0] : [3.0]) {
            const r = new THREE.Mesh(railGeo, metal);
            r.position.set(x, y, z);
            r.rotation.y = ry;
            group.add(r);
        }
    }
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9, 4, 2), makePsxMaterial({ map: wallTex(), color: 0xe0d8f0 }));
    wall.position.set(0, 4.5, -7);
    group.add(wall);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.3), makePsxBasic(PALETTE.tubeGlow));
    lamp.position.set(-4.5, 6.2, -6.8);
    group.add(lamp);
    // Two warm stage lights over the ring so the fighters are the brightest thing on screen.
    for (const x of [-2.2, 2.2]) {
        const light = new THREE.PointLight(0xffe8c8, 14, 11, 1.4);
        light.position.set(x, 5.5, 1.5);
        group.add(light);
    }
    return { group, update() {} };
}
