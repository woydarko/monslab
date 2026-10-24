/** Handler wrapper: uniform error body, rate limits and one structured log line per request. */
import { fail, mapRevert } from './errors.ts';
import { logRequest } from './log.ts';
import { take } from './rateLimit.ts';
import { readSession } from './session.ts';

type Handler = (request: Request) => Promise<Response>;

export interface ApiOpts {
    /** Write endpoints are rate-limited per session address (A9). */
    write?: boolean;
}

const WRITE_LIMIT = 20;
const REGISTER_LIMIT = 5;

function toResponse(err: unknown): Response {
    const e = err as { code?: unknown; status?: unknown; details?: Record<string, unknown> };
    if (typeof e?.code === 'string' && typeof e?.status === 'number') return fail(e.status, e.code, e.details);
    const m = mapRevert(err);
    return fail(m.status, m.code, m.details);
}

function clientIp(request: Request): string {
    return (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
}

function limitFor(request: Request, path: string, player: string | null): { key: string; limit: number } | null {
    if (path.endsWith('/api/register')) return { key: `register:${clientIp(request)}`, limit: REGISTER_LIMIT };
    if (request.method === 'GET' || request.method === 'HEAD') return null;
    return { key: `write:${player ?? clientIp(request)}`, limit: WRITE_LIMIT };
}

async function txHashOf(response: Response): Promise<string | undefined> {
    try {
        const body = (await response.clone().json()) as { txHash?: unknown };
        return typeof body?.txHash === 'string' ? body.txHash : undefined;
    } catch {
        return undefined;
    }
}

export function withApi(handler: Handler, _opts: ApiOpts = {}): Handler {
    return async (request) => {
        const started = Date.now();
        const route = new URL(request.url).pathname;
        const player = readSession(request);
        const limit = limitFor(request, route, player);

        if (limit) {
            const result = take(limit.key, limit.limit);
            if (!result.allowed) {
                logRequest({ route, player: player ?? undefined, code: 'rate_limited', ms: Date.now() - started, level: 'error' });
                return fail(429, 'rate_limited', { retryAfter: result.retryAfter });
            }
        }

        try {
            const response = await handler(request);
            logRequest({ route, player: player ?? undefined, txHash: await txHashOf(response), ms: Date.now() - started });
            return response;
        } catch (err) {
            const response = toResponse(err);
            const code = ((await response.clone().json()) as { error?: { code?: string } }).error?.code;
            logRequest({ route, player: player ?? undefined, code, ms: Date.now() - started, level: 'error' });
            return response;
        }
    };
}

/** An error the handler throws on purpose (status + code + optional details). */
export class ApiError extends Error {
    code: string;
    status: number;
    details?: Record<string, unknown>;
    constructor(status: number, code: string, details?: Record<string, unknown>) {
        super(code);
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
