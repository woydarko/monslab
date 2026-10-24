/**
 * Part thumbnails for the Build UI: each part's real procedural 3D model,
 * rendered once into a small offscreen canvas and cached as a data URL.
 * Rendered at 72 px and shown with pixelated scaling, so they match the PS1 look.
 */
import * as THREE from 'three';
import { getPart, PARTS } from '../data/parts.ts';
import type { MonsterParts } from '../data/types.ts';
import { MonsterView } from './monsterView.ts';
import { psxUniforms } from './psxMaterial.ts';

const SIZE = 72;
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let queued = false;

function setup(): boolean {
    if (renderer) return true;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(SIZE, SIZE, false);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xb8a8e0, 1.4));
        scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4a3a, 1.2));
        const key = new THREE.DirectionalLight(0xfff0dc, 3);
        key.position.set(2, 4, 5);
        scene.add(key);
        camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
        return true;
    } catch {
        return false;
    }
}

/** A dummy monster with the part in its own slot (MonsterView only builds that slot). */
function partsFor(id: string): MonsterParts {
    const slot = getPart(id).slot;
    return slot === 'head' ? [id, 'goo_body', 'goo_legs'] : slot === 'body' ? ['goo_head', id, 'goo_legs'] : ['goo_head', 'goo_body', id];
}

function render(id: string): string {
    if (!setup() || !renderer || !scene || !camera) return '';
    const view = new MonsterView(partsFor(id), 0, 0, getPart(id).slot);
    view.root.rotation.y = -0.45; // three-quarter view reads shape better than straight on
    view.update(0);
    scene.add(view.root);
    // Frame the model tightly: fit its bounding box's larger face in the view.
    view.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(view.root, true);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const half = Math.max(size.x, size.y, size.z * 0.8) / 2;
    const dist = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.12 + size.z / 2;
    camera.position.copy(center).add(new THREE.Vector3(0, half * 0.3, dist));
    camera.lookAt(center);
    // Snap to this small canvas's own pixel grid, then restore the game's.
    const prevSnap = psxUniforms.uSnap.value.clone();
    psxUniforms.uSnap.value.set(SIZE / 2, SIZE / 2);
    renderer.render(scene, camera);
    psxUniforms.uSnap.value.copy(prevSnap);
    const url = renderer.domElement.toDataURL('image/png');
    view.dispose();
    return url;
}

function drain(): void {
    queued = false;
    // Render a few per frame so opening the Lab never hitches.
    let budget = 4;
    for (const p of PARTS) {
        if (cache.has(p.id)) continue;
        cache.set(p.id, render(p.id));
        if (--budget === 0) break;
    }
    for (const l of listeners) l();
    if (PARTS.some((p) => !cache.has(p.id))) schedule();
}

function schedule(): void {
    if (queued) return;
    queued = true;
    requestAnimationFrame(drain);
}

/** Data URL for a part thumbnail, or '' while it is still being rendered. */
export function partIcon(id: string): string {
    const hit = cache.get(id);
    if (hit !== undefined) return hit;
    schedule();
    return '';
}

export function onPartIcons(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Bumps whenever new icons land (for useSyncExternalStore). */
export function partIconsVersion(): number {
    return cache.size;
}
