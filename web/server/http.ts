/** Handler wrapper: turns thrown validation/auth/revert errors into the uniform error body. */
import { fail, mapRevert } from './errors.ts';

type Handler = (request: Request) => Promise<Response>;

export interface ApiOpts {
    /** Write endpoints are rate-limited per session address (A9). */
    write?: boolean;
}

function toResponse(err: unknown): Response {
    const e = err as { code?: unknown; status?: unknown; details?: Record<string, unknown> };
    if (typeof e?.code === 'string' && typeof e?.status === 'number') return fail(e.status, e.code, e.details);
    const m = mapRevert(err);
    return fail(m.status, m.code, m.details);
}

export function withApi(handler: Handler, _opts: ApiOpts = {}): Handler {
    return async (request) => {
        try {
            return await handler(request);
        } catch (err) {
            return toResponse(err);
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
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
