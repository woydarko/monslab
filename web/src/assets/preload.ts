/**
 * Asset warming. MONSLAB builds its monsters and textures procedurally, so
 * the critical path is just the web fonts (Lilita One / Nunito / VT323) and
 * compiling the first scene. Progress is reported so the bar never sits still.
 *
 * Failure posture: a missing asset must never brick boot.
 */
export async function warmAssets(onProgress: (progress: number) => void = () => {}): Promise<void> {
    onProgress(0.2);
    try {
        await Promise.race([
            Promise.all(
                ['400 1em "Lilita One"', '800 1em Nunito', '400 1em VT323'].map((f) => document.fonts.load(f).catch(() => []))
            ),
            new Promise((r) => setTimeout(r, 2500)),
        ]);
    } catch {
        /* fonts are cosmetic */
    }
    onProgress(0.8);
    try {
        await document.fonts.ready;
    } catch {
        /* older engines */
    }
    onProgress(1);
}
