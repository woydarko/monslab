/**
 * S-04 top bar: who you are and what you have. On chain state (`me`) it shows
 * the username, Gloo, eggs and Brain, plus the way into the profile menu.
 */
import { useStore } from '../state/store.ts';
import { openPhase } from '../game/actions.ts';
import { GooIcon, SoundButton } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

export default function TopBar() {
    const me = useStore((s) => s.me);
    const wide = useLayout() === 'wide';
    const eggs = me?.eggs ?? 0;
    return (
        <div className={`pt-safe-top flex items-center justify-between gap-2 ${wide ? 'px-6 pt-4' : 'px-3'}`}>
            <div className="flex items-center gap-2">
                <span className="chip px-2.5" aria-label={`Signed in as ${me?.username ?? 'guest'}`}>
                    <span className="t-num">@{me?.username ?? '…'}</span>
                </span>
                <div className="chip px-2.5" aria-label={`${me?.gloo ?? 0} Gloo`}>
                    <GooIcon size={18} />
                    <span className="t-num">{me?.gloo ?? 0}</span>
                    {wide && <span className="t-caption text-muted">Gloo</span>}
                </div>
                <button type="button" className="btn btn-secondary pointer-events-auto px-2.5" aria-label={`${eggs} eggs`} onClick={() => openPhase('egg')}>
                    <Icon name="egg" size={18} />
                    <span className="t-num">{eggs}</span>
                </button>
                <div className="chip px-2.5" aria-label={`${me?.brain ?? 0} Brain`}>
                    <Icon name="skull" size={18} className="text-eye" />
                    <span className="t-num">{me?.brain ?? 0}</span>
                    {wide && <span className="t-caption text-muted">Brain</span>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <SoundButton />
                <button type="button" aria-label="Menu" title="Menu" className="btn btn-secondary btn-icon pointer-events-auto" onClick={() => openPhase('profile')}>
                    <Icon name="book" />
                </button>
            </div>
        </div>
    );
}
