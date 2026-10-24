// Rehearsal/E2E only (VITE_FLAG_DEV_LOGIN=1, never in production): a burner key per browser tab.
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

type Hex = `0x${string}`;
const KEY = 'monslab.devKey';

export function devAccount() {
    let pk: Hex | null = null;
    try {
        pk = sessionStorage.getItem(KEY) as Hex | null;
    } catch {
        /* storage blocked: fresh burner each load */
    }
    if (!pk) {
        pk = generatePrivateKey();
        try {
            sessionStorage.setItem(KEY, pk);
        } catch {
            /* ignore */
        }
    }
    const acct = privateKeyToAccount(pk);
    return { address: acct.address, signMessage: (message: string) => acct.signMessage({ message }) };
}
