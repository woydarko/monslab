/**
 * Screen router. After loading, the 3D canvas stays mounted behind every
 * screen; overlays switch with the phase. Everything lives in #app-frame.
 */
import { useStore } from '../state/store.ts';
import LoadingScreen from './LoadingScreen.tsx';
import GameCanvas from '../game/GameCanvas.tsx';
import LabScreen from './LabScreen.tsx';
import ArenaSheet from './ArenaSheet.tsx';
import CollectionSheet from './CollectionSheet.tsx';
import BattleHud from './BattleHud.tsx';
import ResultPanel from './ResultPanel.tsx';
import CapsuleOverlay from './CapsuleOverlay.tsx';
import TitleScreen from './TitleScreen.tsx';
import HowToPlay from './HowToPlay.tsx';
import { SceneFade, UiScale } from './bits.tsx';
import { FloatLayer } from './BattleHud.tsx';

export default function App() {
    const phase = useStore((s) => s.phase);
    const paused = useStore((s) => s.paused);
    const toast = useStore((s) => s.toast);
    const howTo = useStore((s) => s.howTo);
    const inLab = phase === 'lab' || phase === 'arena' || phase === 'collection';
    return (
        <div id="app-frame" className="bg-surface">
            {phase !== 'loading' && (
                <>
                    {/* 3D and screen effects fill the real frame; only the UI layer scales. */}
                    <GameCanvas />
                    <SceneFade />
                    <div className="crt" />
                </>
            )}
            <UiScale>
                {phase === 'loading' ? (
                    <div className="pointer-events-auto absolute inset-0">
                        <LoadingScreen />
                    </div>
                ) : (
                    <>
                        {phase === 'title' && <TitleScreen />}
                        {inLab && <LabScreen />}
                        {phase === 'arena' && <ArenaSheet />}
                        {phase === 'collection' && <CollectionSheet />}
                        {(phase === 'battle' || phase === 'result') && <BattleHud />}
                        {phase === 'result' && <ResultPanel />}
                        {phase === 'capsule' && <CapsuleOverlay />}
                        {howTo && <HowToPlay />}
                    </>
                )}
                {/* Toasts sit just under the top bar, never over the main actions. */}
                <div className="pointer-events-none absolute inset-x-0 top-[68px] flex justify-center px-4" role="status" aria-live="polite">
                    {toast && <div className="pop-in t-body rounded-[var(--radius-md)] border-2 border-primary bg-surface px-4 py-2 text-center">{toast}</div>}
                </div>
                {paused && (
                    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70">
                        <p className="t-banner text-ink">Paused</p>
                    </div>
                )}
            </UiScale>
            {/* Battle numbers are positioned in real canvas pixels, so they live outside the scaled layer. */}
            {(phase === 'battle' || phase === 'result') && <FloatLayer />}
        </div>
    );
}
