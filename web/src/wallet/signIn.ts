import { api } from '../chain/api.ts';

type Hex = `0x${string}`;

/** App session: server-issued message → wallet signature → httpOnly cookie. */
export async function signIn(address: Hex, signMessage: (m: string) => Promise<Hex>): Promise<void> {
    const { message } = await api.nonce(address);
    const signature = await signMessage(message);
    await api.verify(address, message, signature);
}
