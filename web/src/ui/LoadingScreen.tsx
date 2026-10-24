/** Loading screen while fonts warm (store.loadProgress). Says what it is doing. */
import { useStore } from '../state/store.ts';

export default function LoadingScreen() {
    const progress = useStore((s) => s.loadProgress);
    const pct = Math.round(progress * 100);
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-10">
            <div className="flex gap-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="blink inline-block h-6 w-6 rounded-full border-4 border-[#140b20] bg-[#f2ead8]"
                        style={{ boxShadow: 'inset 5px 0 0 #9b5de5', animationDelay: `${i * 0.3}s` }}
                    />
                ))}
            </div>
            <h1 className="t-banner text-primary" style={{ textShadow: '0 5px 0 #140b20' }}>
                MONSLAB
            </h1>
            <div className="h-3 w-full max-w-xs overflow-hidden rounded-[4px] border-2 border-edge bg-black/50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Loading">
                <div className="h-full bg-primary transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <p className="t-caption text-muted">
                Warming up the vats <span className="t-num text-ink">{pct}%</span>
            </p>
        </div>
    );
}
