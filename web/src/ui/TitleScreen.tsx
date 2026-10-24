/**
 * Title screen: logo, PLAY, HOW TO PLAY over the live 3D lab with the
 * player's monster spinning on the pedestal. One focal point: PLAY.
 */
import { useStore } from '../state/store.ts';
import { activeMonster, play, showHowTo } from '../game/actions.ts';
import { SoundButton, useSave } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

/** The five eyeballs above the logo: the five iris colors monsters can roll. */
const IRIS = ['#e63946', '#9b5de5', '#b6ff3b', '#4cc9f0', '#ffc300'];

export default function TitleScreen() {
    const s = useSave();
    const pending = useStore((st) => st.pendingCode);
    const returning = s.ftue.done;
    const m = activeMonster();
    const wide = useLayout() === 'wide';

    const eyes = (
        <div className="mb-2 flex items-center gap-2" aria-hidden>
            {IRIS.map((c, i) => (
                <span
                    key={c}
                    className="blink inline-block rounded-full border-[3px] border-[#140b20] bg-[#f2ead8]"
                    style={{ width: i === 2 ? 26 : 16, height: i === 2 ? 26 : 16, boxShadow: `inset ${i === 2 ? 6 : 4}px 0 0 ${c}`, animationDelay: `${i * 0.35}s` }}
                />
            ))}
        </div>
    );
    const context = pending ? (
        <div className="pop-in panel flex items-center gap-2 px-3 py-2">
            <Icon name="mail" size={20} className="text-primary" />
            <span className="t-body">A friend challenged you!</span>
        </div>
    ) : returning ? (
        <p className="t-body on-scene">
            Your champion: <span className="text-primary">{m.name}</span>
        </p>
    ) : null;
    const buttons = (
        <>
            <button type="button" autoFocus className="btn btn-primary btn-lg attention w-full" onClick={play}>
                <span className="t-button-lg">{pending && returning ? 'ACCEPT CHALLENGE' : 'PLAY'}</span>
            </button>
            <button type="button" className="btn btn-secondary btn-md w-full" onClick={() => showHowTo(true)}>
                <span className="t-button">HOW TO PLAY</span>
            </button>
        </>
    );

    // Desktop: logo and actions on the left, the monster showcased on the right half.
    if (wide) {
        return (
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute right-6 top-4">
                    <SoundButton />
                </div>
                <div className="absolute left-24 top-1/2 flex w-[400px] -translate-y-1/2 flex-col items-start gap-6">
                    <div className="pop-in flex flex-col items-start">
                        {eyes}
                        <h1 className="t-hero-wide text-primary" style={{ textShadow: '0 8px 0 #140b20', WebkitTextStroke: '4px #140b20' }}>
                            MONSLAB
                        </h1>
                        <p className="t-body on-scene mt-4">Build a monster. Beat your friends.</p>
                    </div>
                    {context}
                    <div className="pointer-events-auto flex w-[340px] flex-col gap-3">{buttons}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center">
            <div className="pt-safe-top flex w-full justify-end px-4">
                <SoundButton />
            </div>

            {/* ── logo ── */}
            <div className="pop-in mt-2 flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2" aria-hidden>
                    {IRIS.map((c, i) => (
                        <span
                            key={c}
                            className="blink inline-block rounded-full border-[3px] border-[#140b20] bg-[#f2ead8]"
                            style={{ width: i === 2 ? 26 : 16, height: i === 2 ? 26 : 16, boxShadow: `inset ${i === 2 ? 6 : 4}px 0 0 ${c}`, animationDelay: `${i * 0.35}s` }}
                        />
                    ))}
                </div>
                <h1 className="t-hero text-center text-primary" style={{ textShadow: '0 6px 0 #140b20', WebkitTextStroke: '3px #140b20' }}>
                    MONSLAB
                </h1>
                <p className="t-body on-scene mt-3 text-center">Build a monster. Beat your friends.</p>
            </div>

            <div className="flex-1" />

            {/* ── context line: returning player or pending challenge ── */}
            {pending ? (
                <div className="pop-in panel mb-3 flex items-center gap-2 px-3 py-2">
                    <Icon name="mail" size={20} className="text-primary" />
                    <span className="t-body">A friend challenged you!</span>
                </div>
            ) : (
                returning && (
                    <p className="t-body on-scene mb-3 text-center">
                        Your champion: <span className="text-primary">{m.name}</span>
                    </p>
                )
            )}

            {/* ── actions ── */}
            <div className="pb-safe-bottom pointer-events-auto flex w-full max-w-sm flex-col gap-3 px-6 pb-6">
                <button type="button" autoFocus className="btn btn-primary btn-lg attention w-full" onClick={play}>
                    <span className="t-button-lg">{pending && returning ? 'ACCEPT CHALLENGE' : 'PLAY'}</span>
                </button>
                <button type="button" className="btn btn-secondary btn-md w-full" onClick={() => showHowTo(true)}>
                    <span className="t-button">HOW TO PLAY</span>
                </button>
            </div>
        </div>
    );
}
