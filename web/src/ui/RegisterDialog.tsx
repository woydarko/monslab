/** S-03 Register: pick a username, the relayer creates the lab on chain. */
import { useState } from 'react';
import { register } from '../game/actions.ts';
import { useStore } from '../state/store.ts';
import { errorCopy } from './copy.ts';
import { useAction } from './useAction.ts';
import { useLayout } from './layout.ts';
import TxChip from './TxChip.tsx';
import Icon from './Icon.tsx';

const VALID = /^[a-z0-9_]{3,16}$/;

export default function RegisterDialog() {
    const [name, setName] = useState('');
    const [invalid, setInvalid] = useState<string | null>(null);
    const { run, pending, error } = useAction('register', 'Create lab');
    const tx = useStore((s) => s.tx);
    const wide = useLayout() === 'wide';
    const check = () => {
        const ok = VALID.test(name.trim().toLowerCase());
        setInvalid(ok ? null : errorCopy('invalid_username'));
        return ok;
    };
    const submit = () => {
        if (pending || !check()) return;
        void run(() => register(name.trim().toLowerCase()));
    };
    const shown = invalid ?? error;

    return (
        <div className={`pointer-events-auto absolute inset-0 flex bg-black/55 ${wide ? 'items-center justify-center p-6' : 'flex-col justify-end'}`}>
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="register-title"
                className={wide ? 'pop-in w-full max-w-[420px] rounded-[var(--radius-lg)] border-2 border-edge bg-surface p-6' : 'slide-up pb-safe-bottom w-full rounded-t-[var(--radius-lg)] border-t-2 border-edge bg-surface p-4'}
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <h2 id="register-title" className="t-title mb-4 text-ink">Name your lab</h2>
                <label htmlFor="username" className="t-caption text-muted">Username</label>
                <input
                    id="username"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={16}
                    value={name}
                    aria-invalid={!!shown}
                    aria-describedby="username-help"
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => name && check()}
                    className={`t-num mt-2 w-full rounded-[var(--radius-sm)] border-2 bg-panel px-3 py-2 text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-primary ${shown ? 'border-danger' : 'border-edge-strong'}`}
                />
                {shown ? (
                    <p id="username-help" className="t-caption mt-2 flex items-center gap-2 text-danger"><Icon name="close" size={16} />{shown}</p>
                ) : (
                    <p id="username-help" className="t-caption mt-2 text-muted">3–16 chars: a–z, 0–9, _</p>
                )}
                <p className="t-caption mt-3 text-muted">Your username and battles are public on Monad testnet.</p>
                <button type="submit" className="btn btn-primary btn-lg mt-4 w-full" disabled={pending} aria-busy={pending}>
                    <span className="t-button-lg">{pending ? 'Sending…' : 'Create Lab'}</span>
                </button>
                {tx?.label === 'Create lab' && tx.status !== 'confirmed' && (
                    <div className="mt-3">
                        <TxChip {...tx} onRetry={submit} />
                    </div>
                )}
            </form>
        </div>
    );
}
