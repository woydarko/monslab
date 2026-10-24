/**
 * Screen router. After loading, the 3D canvas stays mounted behind every
 * screen; overlays switch with the phase. Everything lives in #app-frame.
 */
import { useEffect } from 'react';
import { store, useStore, type Phase } from '../state/store.ts';
import LoadingScreen from './LoadingScreen.tsx';
import GameCanvas from '../game/GameCanvas.tsx';
import LabScreen from './LabScreen.tsx';
import LevelsSheet from './LevelsSheet.tsx';
import CollectionSheet from './CollectionSheet.tsx';
import BattleHud from './BattleHud.tsx';
import ResultPanel from './ResultPanel.tsx';
import EggScreen from './EggScreen.tsx';
import TitleScreen from './TitleScreen.tsx';
import HowToPlay from './HowToPlay.tsx';
import TxChip from './TxChip.tsx';
import { SceneFade, Sheet, UiScale } from './bits.tsx';
import { FloatLayer } from './BattleHud.tsx';
import { parseDeepLink } from './deepLink.ts';
import { backToLab, openReplay, refreshMe } from '../game/actions.ts';
import RegisterDialog from './RegisterDialog.tsx';
import ReplayScreen from './ReplayScreen.tsx';
import PvpSheet from './PvpSheet.tsx';
import CommunitySheet from './CommunitySheet.tsx';
import WalletProvider from '../wallet/WalletProvider.tsx';

/** Screens shown over the Lab scene (the Lab stays mounted underneath). */
const OVER_LAB: Phase[] = ['lab', 'levels', 'collection', 'pvp', 'community', 'war', 'redeem', 'profile'];

export default function App() {
    return (
        <WalletProvider>
            <Frame />
        </WalletProvider>
    );
}

function Frame() {
    const phase = useStore((s) => s.phase);
    const paused = useStore((s) => s.paused);
    const toast = useStore((s) => s.toast);
    const howTo = useStore((s) => s.howTo);
    const tx = useStore((s) => s.tx);
    const inLab = OVER_LAB.includes(phase);

    useEffect(() => {
        const deepLink = parseDeepLink(window.location.search);
        store.patch({ deepLink, pendingCode: deepLink.vs ?? null });
        // A replay link is read-only: no login, straight to S-10.
        if (deepLink.replay) openReplay(deepLink.replay);
        // Restore an existing cookie session (Play then skips the wallet step).
        refreshMe()
            .then(() => store.patch({ session: 'signedIn' }))
            .catch(() => undefined);
    }, []);

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
                        {phase === 'register' && <RegisterDialog />}
                        {inLab && <LabScreen />}
                        {phase === 'levels' && <LevelsSheet />}
                        {phase === 'collection' && <CollectionSheet />}
                        {phase === 'pvp' && <PvpSheet />}
                        {phase === 'community' && <CommunitySheet />}
                        {(phase === 'war' || phase === 'redeem' || phase === 'profile') && <Placeholder phase={phase} />}
                        {phase === 'replay' && (
                            <>
                                <BattleHud />
                                <ReplayScreen />
                            </>
                        )}
                        {(phase === 'battle' || phase === 'result') && <BattleHud />}
                        {phase === 'result' && <ResultPanel />}
                        {phase === 'egg' && <EggScreen />}
                        {howTo && <HowToPlay />}
                    </>
                )}
                {/* Toasts sit just under the top bar, never over the main actions. */}
                <div className="pointer-events-none absolute inset-x-0 top-[68px] flex justify-center px-4" role="status" aria-live="polite">
                    {toast && <div className="pop-in t-body rounded-[var(--radius-md)] border-2 border-primary bg-surface px-4 py-2 text-center">{toast}</div>}
                </div>
                {tx && phase !== 'loading' && (
                    <div className="pointer-events-none absolute bottom-4 left-4">
                        <TxChip {...tx} />
                    </div>
                )}
                {paused && (
                    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70">
                        <p className="t-banner text-ink">Paused</p>
                    </div>
                )}
            </UiScale>
            {/* Battle numbers are positioned in real canvas pixels, so they live outside the scaled layer. */}
            {(phase === 'battle' || phase === 'result' || phase === 'replay') && <FloatLayer />}
        </div>
    );
}

// shortcut: placeholder until each screen's task lands (U2..U10).
function Placeholder({ phase }: { phase: Phase }) {
    return (
        <Sheet title={phase.toUpperCase()} onClose={backToLab}>
            <p className="t-body text-muted">Loading…</p>
        </Sheet>
    );
}
