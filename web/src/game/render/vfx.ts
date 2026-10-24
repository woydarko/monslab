/**
 * Pooled particle bursts (THREE.Points, one draw call per pool). Mixed sizes
 * per burst: one big, a few medium, many tiny (polish skill, layer 5).
 */
import * as THREE from 'three';

const MAX = 160;

export class Vfx {
    readonly points: THREE.Points;
    private pos = new Float32Array(MAX * 3);
    private col = new Float32Array(MAX * 3);
    private size = new Float32Array(MAX);
    private vel = new Float32Array(MAX * 3);
    private life = new Float32Array(MAX);
    private maxLife = new Float32Array(MAX);
    private next = 0;
    private gravity = new Float32Array(MAX);

    constructor() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
        const m = new THREE.ShaderMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            vertexShader: /* glsl */ `
                attribute float size;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (9.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                varying vec3 vColor;
                void main() {
                    vec2 d = gl_PointCoord - 0.5;
                    if (max(abs(d.x), abs(d.y)) > 0.5 || vColor == vec3(0.0)) discard;
                    gl_FragColor = vec4(vColor, 1.0);
                }`,
        });
        this.points = new THREE.Points(g, m);
        this.points.frustumCulled = false;
    }

    private spawn(p: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, size: number, life: number, gravity: number): void {
        const i = this.next;
        this.next = (this.next + 1) % MAX;
        this.pos.set([p.x, p.y, p.z], i * 3);
        this.vel.set([v.x, v.y, v.z], i * 3);
        this.col.set([color.r, color.g, color.b], i * 3);
        this.size[i] = size;
        this.life[i] = life;
        this.maxLife[i] = life;
        this.gravity[i] = gravity;
    }

    /** Splat in the attacker's colour: 1 big, 4 medium, 10 tiny. */
    splat(at: THREE.Vector3, color: THREE.ColorRepresentation, power = 1): void {
        const c = new THREE.Color(color);
        const spec: [number, number, number][] = [[1, 9, 0.5], [4, 5, 1.6], [10, 2.5, 2.6]];
        for (const [n, size, speed] of spec)
            for (let k = 0; k < n * power; k++) {
                const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize();
                this.spawn(at, dir.multiplyScalar(speed * (0.5 + Math.random())), c, size * (0.8 + Math.random() * 0.4), 0.5 + Math.random() * 0.3, 7);
            }
    }

    /** Star-ish crit burst in the accent colour. */
    burst(at: THREE.Vector3, color: THREE.ColorRepresentation, count = 16): void {
        const c = new THREE.Color(color);
        for (let k = 0; k < count; k++) {
            const a = (k / count) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), (Math.random() - 0.5) * 0.4);
            this.spawn(at, dir.multiplyScalar(3.2), c, k % 4 === 0 ? 7 : 3.5, 0.35, 0);
        }
    }

    /** Rising sparkles (heal / mix). */
    rise(at: THREE.Vector3, color: THREE.ColorRepresentation, count = 10, radius = 0.6): void {
        const c = new THREE.Color(color);
        for (let k = 0; k < count; k++) {
            const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius * 2, Math.random() * 0.4, (Math.random() - 0.5) * radius * 2));
            this.spawn(p, new THREE.Vector3(0, 1.2 + Math.random(), 0), c, 2.5 + Math.random() * 3, 0.8 + Math.random() * 0.4, -0.5);
        }
    }

    update(dt: number): void {
        for (let i = 0; i < MAX; i++) {
            if (this.life[i] <= 0) continue;
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                this.size[i] = 0;
                this.col.set([0, 0, 0], i * 3);
                continue;
            }
            this.vel[i * 3 + 1] -= this.gravity[i] * dt;
            this.pos[i * 3] += this.vel[i * 3] * dt;
            this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
            this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            if (this.pos[i * 3 + 1] < 0.02) {
                this.pos[i * 3 + 1] = 0.02;
                this.vel[i * 3 + 1] = 0;
                this.vel[i * 3] *= 0.8;
                this.vel[i * 3 + 2] *= 0.8;
            }
        }
        const g = this.points.geometry;
        g.attributes.position.needsUpdate = true;
        g.attributes.color.needsUpdate = true;
        g.attributes.size.needsUpdate = true;
    }

    dispose(): void {
        this.points.geometry.dispose();
        (this.points.material as THREE.Material).dispose();
        this.points.removeFromParent();
    }
}
