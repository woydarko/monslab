/**
 * Lab top bar for phones (tall layout). The desktop bar holds nine controls in
 * one row; a 360 px screen fits about five. So the phone keeps what is checked
 * every visit in view (Goo, eggs, daily gift) and moves the rest into two
 * labelled sheets: EGGS (open, buy, ad) and MENU (collection, help, sound, title).
 */
import { useState } from 'react';
import { buyEgg, DAILY_CAPSULE_WINS, eggWinsToday, EGG_PRICE, enterTitle, openCapsule, openCollection, showHowTo } from '../game/actions.ts';
import { PARTS } from '../game/data/parts.ts';
import { toggleMute } from '../game/audio.ts';
import { store } from '../state/store.ts';
import { GooIcon, Sheet, SoundButton, useSave } from './bits.tsx';
import Icon from './Icon.tsx';

export default function PhoneTopBar({ veteran }: { veteran: boolean }) {
    const s = useSave();
    const [sheet, setSheet] = useState<'eggs' | 'menu' | null>(null);
    const close = () => setSheet(null);

    if (!veteran) {
        // Tutorial: only help and sound, nothing to manage yet.
        return (
            <div className="pt-safe-top flex items-center justify-end gap-2 px-4">
                <button type="button" aria-label="How to play" className="btn btn-secondary btn-icon pointer-events-auto" onClick={() => showHowTo(true)}>
                    <Icon name="help" />
                </button>
                <SoundButton />
            </div>
        );
    }

    const eggs = s.capsules.stored;
    const owned = PARTS.filter((p) => (s.ownedParts[p.id] ?? 0) > 0).length;
    const soundOn = s.settings.sfx > 0 || s.settings.music > 0;

    return (
        <>
            <div className="pt-safe-top flex items-center justify-between gap-2 px-3">
                <div className="flex items-center gap-2">
                    <div className="chip px-2.5" aria-label={`${s.goo} Goo`}>
                        <GooIcon size={18} />
                        <span className="t-num">{s.goo}</span>
                    </div>
                    <button
                        type="button"
                        aria-label={`Eggs: ${eggs} waiting`}
                        className={`btn pointer-events-auto px-3 ${eggs > 0 ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSheet('eggs')}
                    >
                        <span className="t-button">{`EGGS ${eggs}`}</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" className="btn btn-secondary pointer-events-auto px-3" onClick={() => setSheet('menu')}>
                        <span className="t-button">MENU</span>
                    </button>
                </div>
            </div>

            {sheet === 'eggs' && (
                <Sheet title="Spooky Eggs" onClose={close}>
                    <div className="flex flex-col gap-2 pb-2">
                        <p className="t-body text-center text-muted">
                            {eggWinsToday() < DAILY_CAPSULE_WINS
                                ? `Win a battle for an egg (${eggWinsToday()}/${DAILY_CAPSULE_WINS} today).`
                                : 'Daily egg wins used up. Wins now give Goo.'}
                        </p>
                        <button
                            type="button"
                            className="btn btn-primary btn-lg w-full"
                            disabled={eggs <= 0}
                            onClick={() => {
                                close();
                                openCapsule();
                            }}
                        >
                            <span className="t-button-lg">{eggs > 0 ? `OPEN EGG (${eggs})` : 'NO EGGS YET'}</span>
                        </button>
                        <button type="button" className="btn btn-secondary btn-md w-full" disabled={s.goo < EGG_PRICE} onClick={buyEgg}>
                            <span className="t-button">{`BUY EGG · ${EGG_PRICE} GOO`}</span>
                        </button>
                        {s.goo < EGG_PRICE && <p className="t-caption text-center text-muted">Goo comes from duplicate parts and wins past the daily egg limit.</p>}
                    </div>
                </Sheet>
            )}

            {sheet === 'menu' && (
                <Sheet title="Menu" onClose={close}>
                    <div className="flex flex-col gap-2 pb-2">
                        <MenuRow
                            label={`COLLECTION ${owned}/${PARTS.length}`}
                            onClick={() => {
                                close();
                                openCollection();
                            }}
                        />
                        <MenuRow
                            label="HOW TO PLAY"
                            onClick={() => {
                                close();
                                showHowTo(true);
                            }}
                        />
                        <MenuRow
                            label={soundOn ? 'SOUND: ON' : 'SOUND: OFF'}
                            onClick={() => {
                                toggleMute();
                                store.patch({ rev: store.get().rev + 1 });
                            }}
                        />
                        <MenuRow
                            label="BACK TO TITLE"
                            onClick={() => {
                                close();
                                enterTitle();
                            }}
                        />
                    </div>
                </Sheet>
            )}
        </>
    );
}

function MenuRow({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button type="button" className="btn btn-secondary btn-md w-full" onClick={onClick}>
            <span className="t-button">{label}</span>
        </button>
    );
}
