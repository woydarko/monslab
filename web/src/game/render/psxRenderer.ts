/**
 * One WebGL renderer for the whole app (scenes swap, the context never does).
 * Pipeline: scene → low-res render target (short side PSX.internalWidth/Height) →
 * full-screen pass with Bayer dither + 15-bit quantisation, upscaled with
 * nearest filtering to the canvas.
 *
 * No renderer.setPixelRatio(), no AA, and
 * the canvas backing size is set manually with DPR capped at 2.
 */
import * as THREE from 'three';
import { PSX } from './psxConfig.ts';
import { psxUniforms } from './psxMaterial.ts';

export interface PsxScene {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    /** dt in seconds (already clamped). */
    update(dt: number): void;
    resize?(width: number, height: number): void;
    dispose(): void;
}

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const POST_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uDither;
uniform float uLevels;
varying vec2 vUv;

float bayer4(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return float(m[i]) / 16.0 - 0.5;
}

void main() {
    vec3 lin = texture2D(tScene, vUv).rgb;
    vec3 c = mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), lin));
    vec2 px = floor(vUv * uRes);
    c += bayer4(px) * uDither / uLevels;
    c = floor(c * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class PsxRenderer {
    readonly renderer: THREE.WebGLRenderer;
    readonly canvas: HTMLCanvasElement;
    private rt: THREE.WebGLRenderTarget;
    private postScene = new THREE.Scene();
    private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private postMat: THREE.ShaderMaterial;
    private active: PsxScene | null = null;
    private raf = 0;
    private last = 0;
    private running = false;
    private resizeObs: ResizeObserver;
    private cssW = 1;
    private cssH = 1;

    constructor(private host: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.imageRendering = 'pixelated';
        host.appendChild(this.canvas);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(PSX.fogColor, 1);

        this.rt = new THREE.WebGLRenderTarget(PSX.internalWidth, 400, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            generateMipmaps: false,
            depthBuffer: true,
        });
        // RT stays linear; the post pass converts to sRGB before quantising,
        // so dithering happens in display space like real hardware.

        this.postMat = new THREE.ShaderMaterial({
            vertexShader: POST_VERT,
            fragmentShader: POST_FRAG,
            uniforms: {
                tScene: { value: this.rt.texture },
                uRes: { value: new THREE.Vector2(PSX.internalWidth, 400) },
                uDither: { value: PSX.dither },
                uLevels: { value: Math.pow(2, PSX.colorBits) - 1 },
            },
            depthTest: false,
            depthWrite: false,
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
        quad.frustumCulled = false;
        this.postScene.add(quad);

        this.resizeObs = new ResizeObserver(() => this.resize());
        this.resizeObs.observe(host);
        this.resize();
    }

    /** CSS size of the canvas (for projecting 3D points to DOM overlays). */
    get size(): { width: number; height: number } {
        return { width: this.cssW, height: this.cssH };
    }

    setScene(next: PsxScene | null): void {
        if (this.active && this.active !== next) this.active.dispose();
        this.active = next;
        if (next) next.resize?.(this.cssW, this.cssH);
        if (next) this.applyAspect(next.camera);
    }

    get scene(): PsxScene | null {
        return this.active;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.last = performance.now();
        const loop = (now: number) => {
            if (!this.running) return;
            this.raf = requestAnimationFrame(loop);
            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            this.frame(dt);
        };
        this.raf = requestAnimationFrame(loop);
    }

    stop(): void {
        this.running = false;
        cancelAnimationFrame(this.raf);
    }

    private frame(dt: number): void {
        const s = this.active;
        if (!s) return;
        s.update(dt);
        this.renderer.setRenderTarget(this.rt);
        this.renderer.render(s.scene, s.camera);
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.postScene, this.postCam);
    }

    private applyAspect(cam: THREE.PerspectiveCamera): void {
        cam.aspect = this.cssW / this.cssH;
        cam.updateProjectionMatrix();
    }

    resize(): void {
        const rect = this.host.getBoundingClientRect();
        this.cssW = Math.max(1, rect.width);
        this.cssH = Math.max(1, rect.height);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setSize(Math.round(this.cssW * dpr), Math.round(this.cssH * dpr), false);

        // Fix the SHORT side so the PS1 crunch looks the same in portrait (phone) and landscape (desktop).
        const landscape = this.cssW >= this.cssH;
        const w = landscape ? Math.round((PSX.internalHeight * this.cssW) / this.cssH) : PSX.internalWidth;
        const h = landscape ? PSX.internalHeight : Math.max(1, Math.round((w * this.cssH) / this.cssW));
        this.rt.setSize(w, h);
        (this.postMat.uniforms.uRes.value as THREE.Vector2).set(w, h);
        psxUniforms.uSnap.value.set((w / 2) * PSX.snapScale, (h / 2) * PSX.snapScale);

        if (this.active) {
            this.applyAspect(this.active.camera);
            this.active.resize?.(this.cssW, this.cssH);
        }
    }

    /**
     * Render the active scene once at an exact pixel size and return a JPEG
     * data URL (store thumbnail, marketing shots). Restores the live size after.
     */
    capture(width: number, height: number, internalWidth = 256): string {
        const s = this.active;
        if (!s) return '';
        const prevAspect = s.camera.aspect;
        const view = s.camera.view ? { ...s.camera.view } : null;
        s.camera.clearViewOffset();
        s.camera.aspect = width / height;
        s.camera.updateProjectionMatrix();
        const ih = Math.round((internalWidth * height) / width);
        this.rt.setSize(internalWidth, ih);
        (this.postMat.uniforms.uRes.value as THREE.Vector2).set(internalWidth, ih);
        psxUniforms.uSnap.value.set((internalWidth / 2) * PSX.snapScale, (ih / 2) * PSX.snapScale);
        this.renderer.setSize(width, height, false);
        this.renderer.setRenderTarget(this.rt);
        this.renderer.render(s.scene, s.camera);
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.postScene, this.postCam);
        const url = this.canvas.toDataURL('image/png');
        s.camera.aspect = prevAspect;
        if (view) s.camera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height);
        this.resize();
        return url;
    }

    /** Project a world point to CSS pixels inside the canvas. */
    project(point: THREE.Vector3, cam: THREE.Camera): { x: number; y: number } {
        const v = point.clone().project(cam);
        return { x: ((v.x + 1) / 2) * this.cssW, y: ((1 - v.y) / 2) * this.cssH };
    }

    dispose(): void {
        this.stop();
        this.resizeObs.disconnect();
        this.active?.dispose();
        this.active = null;
        this.rt.dispose();
        this.postMat.dispose();
        this.renderer.dispose();
        this.canvas.remove();
    }
}
