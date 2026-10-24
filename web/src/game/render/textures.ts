/**
 * Tiny procedural canvas textures (32–64 px, nearest filtering), the crunchy
 * PS1 look without loading files. Deterministic per key. Cached.
 */
import * as THREE from 'three';
import { mulberry32 } from '../sim/rng.ts';

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, rnd: () => number) => void, repeat = 1): THREE.Texture {
    const hit = cache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    draw(ctx, mulberry32(h));
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    cache.set(key, tex);
    return tex;
}

function hex(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
}

function shade(base: number, f: number): string {
    const r = Math.min(255, Math.max(0, ((base >> 16) & 255) * f));
    const g = Math.min(255, Math.max(0, ((base >> 8) & 255) * f));
    const b = Math.min(255, Math.max(0, (base & 255) * f));
    return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Noisy base + blotches: works for slime, flesh, bone, leather. */
export function blotchTex(key: string, base: number, opts: { spots?: number; spotScale?: number; dark?: number; light?: number } = {}): THREE.Texture {
    const { spots = 14, spotScale = 6, dark = 0.7, light = 1.25 } = opts;
    return canvasTex(key, 64, (ctx, rnd) => {
        ctx.fillStyle = hex(base);
        ctx.fillRect(0, 0, 64, 64);
        // per-pixel noise in 2x2 blocks
        for (let y = 0; y < 64; y += 2)
            for (let x = 0; x < 64; x += 2) {
                ctx.fillStyle = shade(base, 0.88 + rnd() * 0.24);
                ctx.fillRect(x, y, 2, 2);
            }
        for (let i = 0; i < spots; i++) {
            const r = 2 + rnd() * spotScale;
            const x = rnd() * 64;
            const y = rnd() * 64;
            ctx.fillStyle = shade(base, rnd() < 0.6 ? dark : light);
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

/** Rusty metal grating floor. */
export function gratingTex(): THREE.Texture {
    return canvasTex('grating', 64, (ctx, rnd) => {
        ctx.fillStyle = '#2c2440';
        ctx.fillRect(0, 0, 64, 64);
        for (let y = 0; y < 64; y += 8)
            for (let x = 0; x < 64; x += 8) {
                ctx.fillStyle = shade(0x7a7490, 0.8 + rnd() * 0.4);
                ctx.fillRect(x, y, 8, 2);
                ctx.fillRect(x, y, 2, 8);
                if (rnd() < 0.15) {
                    ctx.fillStyle = 'rgba(140,70,30,0.6)';
                    ctx.fillRect(x + 2, y, 3, 2);
                }
            }
    }, 6);
}

/** Dirty lab wall panels. */
export function wallTex(): THREE.Texture {
    return canvasTex('wall', 64, (ctx, rnd) => {
        ctx.fillStyle = '#4a3d66';
        ctx.fillRect(0, 0, 64, 64);
        for (let y = 0; y < 64; y += 2)
            for (let x = 0; x < 64; x += 2) {
                ctx.fillStyle = shade(0x4a3d66, 0.85 + rnd() * 0.3);
                ctx.fillRect(x, y, 2, 2);
            }
        ctx.fillStyle = '#2e2540';
        ctx.fillRect(0, 31, 64, 2);
        ctx.fillRect(31, 0, 2, 64);
        for (const [x, y] of [[4, 4], [58, 4], [4, 58], [58, 58], [36, 36], [26, 26]]) {
            ctx.fillStyle = '#4a4058';
            ctx.fillRect(x, y, 2, 2);
        }
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = 'rgba(80,140,40,0.35)';
            ctx.fillRect(rnd() * 64, 34, 2, 6 + rnd() * 20);
        }
    }, 3);
}

/** Rusty metal for pedestal / cage. */
export function metalTex(): THREE.Texture {
    return blotchTex('metal', 0x5a5560, { spots: 18, spotScale: 4, dark: 0.6, light: 1.15 });
}

/**
 * Eyeball: white with a coloured iris centred where SphereGeometry's +Z
 * direction lands (u = 0.25, v = 0.5), so mesh.lookAt aims the pupil.
 */
export function eyeTex(iris: number, hurt = false): THREE.Texture {
    return canvasTex(`eye-${iris}-${hurt}`, 64, (ctx) => {
        ctx.fillStyle = '#f2ead8';
        ctx.fillRect(0, 0, 64, 64);
        // faint veins
        ctx.strokeStyle = 'rgba(200,60,60,0.45)';
        ctx.lineWidth = 1;
        for (const y of [10, 52]) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(64, y + 3);
            ctx.stroke();
        }
        const cx = 16;
        const cy = 32;
        if (hurt) {
            ctx.strokeStyle = '#140b20';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 7); ctx.lineTo(cx + 5, cy + 7);
            ctx.moveTo(cx + 5, cy - 7); ctx.lineTo(cx - 5, cy + 7);
            ctx.stroke();
            return;
        }
        ctx.fillStyle = hex(iris);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#140b20';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 3, cy - 5, 2, 2);
    });
}

/** Soft blob shadow. */
export function shadowTex(): THREE.Texture {
    const hit = cache.get('shadow');
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    cache.set('shadow', tex);
    return tex;
}
