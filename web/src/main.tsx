import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.tsx';
import { store } from './state/store.ts';
import { warmAssets } from './assets/preload.ts';
import { saveSystem } from './game/localSave.ts';
import { enterTitle } from './game/actions.ts';
import { engine } from './game/engine.ts';
import { initAudio, setAudioPaused } from './game/audio.ts';
import './styles/app.css';

/** Boot: save → React → lift cover → warm fonts → title. */
async function boot() {
    // Save before first render so the first screen shows real progress.
    await saveSystem.load();

    createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // Lift the boot cover once the loading screen has painted.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const cover = document.getElementById('boot-cover');
            if (!cover) return;
            cover.classList.add('hidden');
            setTimeout(() => cover.remove(), 400);
        });
    });

    initAudio();
    await warmAssets((p) => store.patch({ loadProgress: p }));
    enterTitle();

    // A hidden tab pauses rendering and audio.
    document.addEventListener('visibilitychange', () => store.patch({ paused: document.hidden }));
    let wasPaused = false;
    store.subscribe(() => {
        const p = store.get().paused;
        if (p === wasPaused) return;
        wasPaused = p;
        engine.setPaused(p);
        setAudioPaused(p);
    });
}

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);
