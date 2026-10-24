/** Para login with Monad testnet as the default chain. No API key → no Para (dev login only), never a crash. */
import '@getpara/react-sdk/styles.css';
import { Environment, ParaProvider, useLogout, useModal, useParaViemAccount } from '@getpara/react-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { monadTestnet } from 'wagmi/chains';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

type Hex = `0x${string}`;
const queryClient = new QueryClient();
const env = import.meta.env;
export const PARA_ENABLED = !!env.VITE_PARA_API_KEY;

/** Para hook values mirrored out of the provider so useSession works with or without Para. */
export interface ParaBridge {
    isOpen: boolean;
    account: { address: Hex; signMessage: (m: string) => Promise<Hex> } | null;
    openModal: () => void;
    logout: () => Promise<unknown>;
}
let bridge: ParaBridge = { isOpen: false, account: null, openModal: () => undefined, logout: async () => undefined };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
export const useParaBridge = () => useSyncExternalStore(subscribe, () => bridge);

function Bridge() {
    const { openModal, isOpen } = useModal();
    const { viemAccount } = useParaViemAccount();
    const { logoutAsync } = useLogout();
    useEffect(() => {
        bridge = {
            isOpen,
            account: viemAccount
                ? { address: viemAccount.address as Hex, signMessage: (m: string) => viemAccount.signMessage({ message: m }) as Promise<Hex> }
                : null,
            openModal: () => openModal(),
            logout: async () => logoutAsync?.(),
        };
        for (const l of listeners) l();
    }, [isOpen, viemAccount, openModal, logoutAsync]);
    return null;
}

export default function WalletProvider({ children }: { children: ReactNode }) {
    if (!PARA_ENABLED) return <>{children}</>;
    return (
        <QueryClientProvider client={queryClient}>
            <ParaProvider
                paraClientConfig={{
                    apiKey: env.VITE_PARA_API_KEY,
                    env: env.VITE_PARA_ENV === 'PROD' ? Environment.PROD : Environment.BETA,
                }}
                config={{ appName: 'MONSLAB' }}
                externalWalletConfig={{
                    evmConnector: {
                        config: {
                            // First chain = default; Para does not ship Monad, so pass it explicitly.
                            chains: [monadTestnet],
                            transports: { [monadTestnet.id]: http(env.VITE_RPC_URL || 'https://testnet-rpc.monad.xyz') },
                        },
                    },
                }}
            >
                <Bridge />
                {children}
            </ParaProvider>
        </QueryClientProvider>
    );
}
