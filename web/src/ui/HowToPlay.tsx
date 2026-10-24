/** How to Play: five short cards with Back/Next. Escape or ✕ closes. */
import { useState } from 'react';
import { DAILY_CAPSULE_WINS, EGG_PRICE, showHowTo } from '../game/actions.ts';
import { useEscape } from './bits.tsx';
import Icon, { type IconName } from './Icon.tsx';

const CARDS: { icon: IconName; title: string; body: string }[] = [
    {
        icon: 'flask',
        title: 'Mix a monster',
        body: 'Pick a head, a body and legs. Every part changes HP, ATK and SPD and adds a trait. The head decides how you attack: bite, claw, headbutt, spit, laser, spores or a wail.',
    },
    {
        icon: 'mix',
        title: 'Mix families',
        body: 'Three parts from one family give a Set Bonus. Three different families give the Mix Bonus. More eyes means more critical hits.',
    },
    {
        icon: 'sword',
        title: 'Battle',
        body: 'Fights play out on their own, so your build decides who wins. Every 4th attack is the head’s special move: 1.6× damage and a stronger trait effect. Climb 10 Arena tiers, and hit Tonight’s Boss for a high score (3 tries a day).',
    },
    {
        icon: 'egg',
        title: 'Eggs and Goo',
        body: `Each win gives a Spooky Egg with a random part, up to ${DAILY_CAPSULE_WINS} a day. Duplicate parts and wins past that limit give Goo. ${EGG_PRICE} Goo buys another egg.`,
    },
    {
        icon: 'mail',
        title: 'Challenge friends',
        body: 'Send your monster as a link or code. If a friend beats it, they steal a copy of one of its parts. Then you can send yours back.',
    },
];

export default function HowToPlay() {
    const [i, setI] = useState(0);
    const close = () => showHowTo(false);
    useEscape(close);
    const card = CARDS[i];
    const last = i === CARDS.length - 1;
    return (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 px-4" onClick={close}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="How to play"
                className="pop-in w-full max-w-sm rounded-[var(--radius-lg)] border-2 border-edge bg-panel p-4"
                key={i}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <span className="t-label text-muted">
                        HOW TO PLAY {i + 1}/{CARDS.length}
                    </span>
                    <button type="button" aria-label="Close" className="btn btn-secondary btn-icon" onClick={close}>
                        <Icon name="close" />
                    </button>
                </div>
                <div className="my-4 flex justify-center text-primary">
                    <Icon name={card.icon} size={64} />
                </div>
                <h2 className="t-title text-center text-ink">{card.title}</h2>
                <p className="t-body mt-2 text-center text-muted">{card.body}</p>
                <div className="mt-4 flex justify-center gap-2" aria-hidden>
                    {CARDS.map((_, k) => (
                        <span key={k} className={`h-2 w-2 rounded-full ${k === i ? 'bg-primary' : 'bg-white/25'}`} />
                    ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" className="btn btn-secondary btn-md" disabled={i === 0} onClick={() => setI(i - 1)}>
                        <span className="t-button">BACK</span>
                    </button>
                    <button type="button" autoFocus className="btn btn-primary btn-md" onClick={() => (last ? close() : setI(i + 1))}>
                        <span className="t-button">{last ? 'GOT IT' : 'NEXT'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
