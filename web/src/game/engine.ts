/**
 * Owns the single PsxRenderer and which 3D scene is showing. actions.ts drives
 * it; React only mounts/unmounts the host element (GameCanvas).
 */
import { PsxRenderer } from './render/psxRenderer.ts';
import { LabScene } from './render/labScene.ts';
import { BattleScene, type BattleSetup } from './render/battleScene.ts';
import { gameEvents } from './events.ts';

class Engine {
    private r: PsxRenderer | null = null;
    /** The last scene request, replayed if the canvas is (re)mounted later. */
    private sceneRequest: ((e: Engine) => void) | null = null;

    get mounted(): boolean {
        return this.r !== null;
    }

    mount(host: HTMLElement): void {
        if (this.r) return;
        this.r = new PsxRenderer(host);
        this.r.start();
        this.sceneRequest?.(this);
    }

    unmount(): void {
        this.r?.dispose();
        this.r = null;
    }

    /**
     * Show a scene: runs now if the canvas exists, and is remembered so a
     * remount (React StrictMode in dev, phase changes) rebuilds it.
     */
    show(fn: (e: Engine) => void): void {
        this.sceneRequest = fn;
        if (this.r) fn(this);
    }

    setPaused(paused: boolean): void {
        if (!this.r) return;
        if (paused) this.r.stop();
        else this.r.start();
    }

    /** The lab scene, creating it if another scene is active. */
    lab(): LabScene | null {
        if (!this.r) return null;
        const cur = this.r.scene;
        if (cur instanceof LabScene) return cur;
        const lab = new LabScene(this.r.canvas);
        this.r.setScene(lab);
        gameEvents.emit('sceneChange', {});
        return lab;
    }

    battle(setup: Omit<BattleSetup, 'project'>): BattleScene | null {
        const r = this.r;
        if (!r) return null;
        const scene = new BattleScene({ ...setup, project: (p, cam) => r.project(p, cam) });
        r.setScene(scene);
        gameEvents.emit('sceneChange', {});
        return scene;
    }

    currentBattle(): BattleScene | null {
        const cur = this.r?.scene;
        return cur instanceof BattleScene ? cur : null;
    }

    /** Dev tool: render the active scene to a square PNG data URL. */
    capture(size = 512): string {
        return this.r?.capture(size, size) ?? '';
    }

    /** Project a world point from the active scene to CSS px. */
    project(p: import('three').Vector3): { x: number; y: number } | null {
        const s = this.r?.scene;
        if (!this.r || !s) return null;
        return this.r.project(p, s.camera);
    }
}

export const engine = new Engine();

// Dev-only handle for debugging in the browser console.
if (import.meta.env.DEV) (window as unknown as { __monslab: Engine }).__monslab = engine;
