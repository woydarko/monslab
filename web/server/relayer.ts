/**
 * Relayer: every on-chain write goes through here. One key per player (stable pick),
 * sends serialized per key, gas padded 10% (cap 3M), refuses below 12 MON.
 */
import { createWalletClient, encodeFunctionData, formatEther, http, keccak256, parseEther, type Abi, type TransactionReceipt } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { sendTransaction, sendTransactionSync, waitForTransactionReceipt } from 'viem/actions';
import { monadTestnet } from 'viem/chains';
import { getEnv } from './env.ts';
import { publicClient } from './contracts.ts';
import { ApiError } from './http.ts';
import type { Hex } from './types.ts';

export const MIN_BALANCE = parseEther('12');
export const GAS_CAP = 3_000_000n;
const NONCE_RETRY = /nonce too low|replacement (transaction )?underpriced|already known/i;

export interface ContractCall {
    address: Hex;
    abi: Abi | readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
}

export interface TxRequest {
    to: Hex;
    data: Hex;
    value?: bigint;
    gas: bigint;
    nonce: number;
}

export interface RelayerDeps {
    keys: Hex[];
    balanceOf(address: Hex): Promise<bigint>;
    nonceOf(address: Hex): Promise<number>;
    simulate(account: PrivateKeyAccount, call: ContractCall): Promise<void>;
    estimateGas(account: PrivateKeyAccount, call: ContractCall): Promise<bigint>;
    send(account: PrivateKeyAccount, tx: TxRequest): Promise<{ hash: Hex; receipt: TransactionReceipt }>;
}

export function pickKeyIndex(player: Hex, n: number): number {
    return Number(BigInt(keccak256(player.toLowerCase() as Hex)) % BigInt(n));
}

let syncSupported = true;

export function defaultDeps(): RelayerDeps {
    const pc = publicClient();
    return {
        keys: getEnv().relayerKeys,
        balanceOf: (address) => pc.getBalance({ address }),
        nonceOf: (address) => pc.getTransactionCount({ address, blockTag: 'pending' }),
        simulate: async (account, call) => {
            await pc.simulateContract({ account, address: call.address, abi: call.abi as Abi, functionName: call.functionName, args: call.args, value: call.value });
        },
        estimateGas: (account, call) =>
            pc.estimateContractGas({ account, address: call.address, abi: call.abi as Abi, functionName: call.functionName, args: call.args, value: call.value }),
        send: async (account, tx) => {
            const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(getEnv().rpcUrl) });
            const req = { account, chain: monadTestnet, to: tx.to, data: tx.data, value: tx.value, gas: tx.gas, nonce: tx.nonce };
            if (syncSupported) {
                try {
                    const receipt = await sendTransactionSync(wallet, req);
                    return { hash: receipt.transactionHash, receipt };
                } catch (e) {
                    // D-09 fallback: RPC without eth_sendRawTransactionSync.
                    if (!/method .*not (found|supported)|-32601|does not exist/i.test(String((e as Error)?.message))) throw e;
                    syncSupported = false;
                }
            }
            const hash = await sendTransaction(wallet, req);
            const receipt = await waitForTransactionReceipt(pc, { hash, pollingInterval: 200, timeout: 15_000 });
            return { hash, receipt };
        },
    };
}

export async function assertRelayerFunds(index: number, deps: RelayerDeps = defaultDeps()): Promise<void> {
    const address = privateKeyToAccount(deps.keys[index]).address;
    if ((await deps.balanceOf(address)) < MIN_BALANCE) throw new ApiError(503, 'relayer_unavailable');
}

const queues = new Map<number, Promise<unknown>>();

export function sendAs(player: Hex, call: ContractCall, deps: RelayerDeps = defaultDeps()): Promise<{ hash: Hex; receipt: TransactionReceipt }> {
    const index = pickKeyIndex(player, deps.keys.length);
    const run = (queues.get(index) ?? Promise.resolve()).then(() => sendNow(index, call, deps));
    queues.set(index, run.catch(() => undefined));
    return run;
}

async function sendNow(index: number, call: ContractCall, deps: RelayerDeps): Promise<{ hash: Hex; receipt: TransactionReceipt }> {
    const account = privateKeyToAccount(deps.keys[index]);
    await assertRelayerFunds(index, deps);
    await deps.simulate(account, call);
    const est = await deps.estimateGas(account, call);
    const padded = (est * 11n) / 10n;
    const gas = padded > GAS_CAP ? GAS_CAP : padded;
    const data = encodeFunctionData({ abi: call.abi as Abi, functionName: call.functionName, args: call.args });
    for (let attempt = 0; ; attempt++) {
        const nonce = await deps.nonceOf(account.address);
        try {
            const res = await deps.send(account, { to: call.address, data, value: call.value, gas, nonce });
            if (res.receipt.status === 'reverted') throw new ApiError(500, 'tx_reverted', { txHash: res.hash });
            return res;
        } catch (e) {
            if (attempt >= 2 || !NONCE_RETRY.test(String((e as Error)?.message))) throw e;
            console.error(JSON.stringify({ level: 'warn', route: 'relayer', keyIndex: index, code: 'nonce_retry', attempt: attempt + 1 }));
        }
    }
}

export async function relayerBalances(deps: RelayerDeps = defaultDeps()): Promise<Array<{ address: string; balanceMon: string }>> {
    return Promise.all(
        deps.keys.map(async (k) => {
            const address = privateKeyToAccount(k).address;
            return { address, balanceMon: formatEther(await deps.balanceOf(address)) };
        }),
    );
}
