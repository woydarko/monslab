/**
 * PS1-style material: MeshLambertMaterial patched with
 *   - vertex snapping to a coarse screen grid (the PS1 "wobble"),
 *   - affine texture mapping (no perspective correction → warping on big tris).
 * Fog, lights and flat shading keep working because we only patch chunks.
 */
import * as THREE from 'three';
import { PSX } from './psxConfig.ts';

/** Shared uniform: updated by the renderer on resize. */
export const psxUniforms = {
    uSnap: { value: new THREE.Vector2(120, 200) },
    uAffine: { value: PSX.affine as number },
};

export interface PsxMaterialOptions {
    color?: THREE.ColorRepresentation;
    map?: THREE.Texture | null;
    flat?: boolean;
    emissive?: THREE.ColorRepresentation;
    emissiveIntensity?: number;
    side?: THREE.Side;
    /** Skip snapping (UI-ish objects that must stay stable). */
    noSnap?: boolean;
}

export function makePsxMaterial(opts: PsxMaterialOptions = {}): THREE.MeshLambertMaterial {
    const mat = new THREE.MeshLambertMaterial({
        color: opts.color ?? 0xffffff,
        map: opts.map ?? null,
        flatShading: opts.flat ?? true,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        side: opts.side ?? THREE.FrontSide,
    });
    patchPsx(mat, !opts.noSnap);
    return mat;
}

/** Unlit glowing material (tubes, eyes' shine) with the same snapping. */
export function makePsxBasic(color: THREE.ColorRepresentation, map: THREE.Texture | null = null): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({ color, map });
    patchPsx(mat, true);
    return mat;
}

function patchPsx(mat: THREE.Material, snap: boolean): void {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uSnap = psxUniforms.uSnap;
        shader.uniforms.uAffine = psxUniforms.uAffine;

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>
                uniform vec2 uSnap;
                uniform float uAffine;
                varying vec3 vAffineUv;`
            )
            .replace(
                '#include <project_vertex>',
                `#include <project_vertex>
                ${
                    snap
                        ? `{
                    vec4 snapped = gl_Position;
                    snapped.xyz /= snapped.w;
                    snapped.xy = floor(snapped.xy * uSnap + 0.5) / uSnap;
                    snapped.xyz *= snapped.w;
                    gl_Position = snapped;
                }`
                        : ''
                }
                #ifdef USE_MAP
                    // Pre-multiply by w; dividing in the fragment cancels perspective correction.
                    float affineW = mix(1.0, gl_Position.w, uAffine);
                    vAffineUv = vec3(vMapUv * affineW, affineW);
                #else
                    vAffineUv = vec3(0.0, 0.0, 1.0);
                #endif`
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
                varying vec3 vAffineUv;`
            )
            .replace(
                '#include <map_fragment>',
                `#ifdef USE_MAP
                    vec4 sampledDiffuseColor = texture2D(map, vAffineUv.xy / vAffineUv.z);
                    diffuseColor *= sampledDiffuseColor;
                #endif`
            );
    };
    // Distinct program per snap mode.
    mat.customProgramCacheKey = () => (snap ? 'psx-snap' : 'psx-nosnap');
}
