/** Login = Para modal (or dev burner) → sign-in message → app cookie; then route via actions.afterSignIn. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FLAGS } from '../flags.ts';
import { api } from '../chain/api.ts';
import { store } from '../state/store.ts';
import { afterSignIn, enterTitle } from '../game/actions.ts';
import { errorCopy } from '../ui/copy.ts';
import { errorText } from '../ui/useAction.ts';
import { signIn } from './signIn.ts';
import { devAccount } from './devLogin.ts';
import { PARA_ENABLED, useParaBridge } from './WalletProvider.tsx';

type Hex = `0x${string}`;
export type SessionStatus = 'signedOut' | 'connecting' | 'signing' | 'signedIn' | 'error';

export function useSession() {
    const para = useParaBridge();
    const [status, setStatus] = useState<SessionStatus>(store.get().session === 'signedIn' ? 'signedIn' : 'signedOut');
    const [error, setError] = useState<string | undefined>();
    const waiting = useRef(false);

    const finish = useCallback(async (address: Hex, sign: (m: string) => Promise<Hex>) => {
        setStatus('signing');
        setError(undefined);
        try {
            await signIn(address, sign);
            await afterSignIn();
            setStatus('signedIn');
        } catch (e) {
            setStatus('error');
            setError(errorText(e));
        }
    }, []);

    // Para hands back the embedded account after the modal flow.
    useEffect(() => {
        if (waiting.current && para.account) {
            waiting.current = false;
            void finish(para.account.address, para.account.signMessage);
        }
    }, [para.account, finish]);

    // Modal closed without an account → cancelled (grace period: the account can land just after close).
    useEffect(() => {
        if (para.isOpen || !waiting.current) return;
        const t = setTimeout(() => {
            if (!waiting.current) return;
            waiting.current = false;
            setStatus('error');
            setError(errorCopy('login_cancelled'));
        }, 1500);
        return () => clearTimeout(t);
    }, [para.isOpen]);

    const login = useCallback(async () => {
        if (store.get().session === 'signedIn') return afterSignIn().catch((e) => setError(errorText(e)));
        if (FLAGS.devLogin) {
            const dev = devAccount();
            return finish(dev.address as Hex, dev.signMessage);
        }
        if (!PARA_ENABLED) {
            setStatus('error');
            setError('Login is not set up yet. Try again later.');
            return;
        }
        if (para.account) return finish(para.account.address, para.account.signMessage);
        waiting.current = true;
        setStatus('connecting');
        para.openModal();
    }, [finish, para]);

    const logout = useCallback(async () => {
        await api.logout().catch(() => undefined);
        await para.logout().catch(() => undefined);
        store.patch({ session: 'signedOut', me: null });
        setStatus('signedOut');
        enterTitle();
    }, [para]);

    return { status, error, login, logout };
}
