/**
 * Every number that defines the PS1 look (GDD §11.1), in one place so it can
 * be tuned without hunting through shaders.
 */
export const PSX = {
    /** Portrait: internal render width in pixels; height follows the screen aspect. */
    internalWidth: 240,
    /** Landscape: internal height (PS1 native was 240; a little more keeps text-sized details legible on desktop). */
    internalHeight: 256,
    /**
     * Vertex snap grid as a fraction of the internal resolution. 0.5 = snap to
     * every 2nd internal pixel → clearly visible PS1 "wobble".
     */
    snapScale: 0.5,
    /** Affine (non-perspective) texture mapping amount, 0..1. */
    affine: 1,
    /** Bayer dither strength before 15-bit quantisation (0 = off). */
    dither: 0.6,
    /** Bits per colour channel after quantisation (PS1 = 5). */
    colorBits: 5,
    /**
     * Fog / background. Brightened 18 Oct: a lighter dusk purple so the room reads
     * instead of melting into black; fog starts further away so the play area is clear.
     */
    fogColor: 0x3b2b5c,
    fogNear: 10,
    fogFar: 30,
    /** Warm key light + purple sky fill, like the moodboard but readable. */
    keyLight: { color: 0xfff0dc, intensity: 3.2, position: [3, 7, 5] as const },
    ambient: { color: 0x8c78c0, intensity: 1.0 },
    /** Sky/ground fill so shadowed sides keep their colour instead of going black. */
    hemi: { sky: 0xd8c8ff, ground: 0x5a4a3a, intensity: 1.6 },
    /** Green glow from the lab tubes. */
    rimLight: { color: 0x7cff4a, intensity: 1.4, position: [-4, 2, -3] as const },
} as const;

export const PALETTE = {
    bgTop: 0x2d1b45,
    bgBottom: 0x1b1029,
    accent: 0xb6ff3b,
    tubeGlow: 0x7cff4a,
    metal: 0x5a5560,
    bone: 0xe8dcc0,
    slime: 0x7bd389,
    flesh: 0x9b5de5,
    blood: 0xe63946,
    chitin: 0x5a4878,
    /** Brand purple (#836EF9, DESIGN_SYSTEM §7): accessory crown, UI accents. */
    brand: 0x836ef9,
} as const;
