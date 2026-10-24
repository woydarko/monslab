/** Test helpers: signed-in requests and fake receipts. Never imported by handlers. */
import { encodeAbiParameters, encodeEventTopics, type AbiEvent, type AbiParameter, type Hex, type Log } from 'viem';
import { signJwt } from '../server/session.ts';

export const PLAYER = '0x1111111111111111111111111111111111111111' as const;
export const OTHER = '0x2222222222222222222222222222222222222222' as const;
export const ZERO = '0x0000000000000000000000000000000000000000' as const;
export const GAME = '0x00000000000000000000000000000000000000aa' as const;

export function authed(path: string, body?: unknown, player: string = PLAYER): Request {
    process.env.SESSION_SECRET ??= 'test-secret-test-secret-test-secret!!';
    const headers = { cookie: `ms_session=${signJwt(player, Date.now())}`, 'content-type': 'application/json' };
    return body === undefined
        ? new Request(`http://x${path}`, { headers })
        : new Request(`http://x${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

export function get(path: string): Request {
    return new Request(`http://x${path}`);
}

export async function errorCode(res: Response): Promise<string> {
    return ((await res.json()) as { error: { code: string } }).error.code;
}

/** A receipt log that viem can decode back into `event`. */
export function fakeLog(event: AbiEvent, args: Record<string, unknown>): Log {
    const topics = encodeEventTopics({ abi: [event], eventName: event.name, args: args as never }) as Hex[];
    const plain = event.inputs.filter((i: AbiParameter & { indexed?: boolean }) => !i.indexed);
    const data = plain.length ? encodeAbiParameters(plain as never, plain.map((i: AbiParameter) => args[i.name as string]) as never) : '0x';
    return {
        address: GAME,
        topics,
        data: data as Hex,
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: `0x${'11'.repeat(32)}`,
        transactionIndex: 0,
        blockHash: `0x${'22'.repeat(32)}`,
        removed: false,
    } as unknown as Log;
}

/** A successful receipt carrying `logs`. */
export function receiptWith(logs: Log[], txHash: Hex = `0x${'33'.repeat(32)}`) {
    return { hash: txHash, receipt: { status: 'success', transactionHash: txHash, logs } };
}
