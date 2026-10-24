/** Input validation at the trust boundary (DATABASE.md §Data validation). */
import type { BattleRequest, Hex } from './types.ts';

export class ValidationError extends Error {
    code: string;
    status: number;
    constructor(code: string, status = 400) {
        super(code);
        this.code = code;
        this.status = status;
    }
}

const fail = (code: string, status = 400): never => {
    throw new ValidationError(code, status);
};

export async function parseJson(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) fail('payload_too_large', 413);
    let body: unknown;
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        return fail('invalid_request');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('invalid_request');
    return body as Record<string, unknown>;
}

export function username(s: unknown): string {
    const v = typeof s === 'string' ? s.trim().toLowerCase() : '';
    return /^[a-z0-9_]{3,16}$/.test(v) ? v : fail('invalid_username');
}

export function communityName(s: unknown): string {
    const v = typeof s === 'string' ? s.trim() : '';
    return /^[A-Za-z0-9 _-]{3,20}$/.test(v) ? v : fail('invalid_name');
}

const CROCKFORD = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

/** Accepts `mons-ab12cd`, `AB12CD`, `ab 12 cd`; fixes O→0, I/L→1, U→V. */
export function playerCode(s: unknown): { code: string; bytes6: Hex } {
    if (typeof s !== 'string') return fail('bad_code_format');
    let v = s.toUpperCase().replace(/[\s-]/g, '');
    if (v.length === 10 && v.startsWith('MONS')) v = v.slice(4);
    v = v.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
    if (!CROCKFORD.test(v)) fail('bad_code_format');
    const bytes6 = `0x${[...v].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}` as Hex;
    return { code: `MONS-${v}`, bytes6 };
}

export function redeemCode(s: unknown): string {
    const v = typeof s === 'string' ? s.trim().toUpperCase() : '';
    return /^[A-Z0-9-]{4,32}$/.test(v) ? v : fail('invalid_code');
}

function int(n: unknown, min: number, max: number): number {
    return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : fail('invalid_request');
}

export const eggCount = (n: unknown): number => int(n, 1, 10);
export const tier = (n: unknown): number => int(n, 0, 10);
export const uint = (n: unknown, max = 2 ** 32 - 1): number => int(n, 0, max);

export function eggType(s: unknown): 0 | 1 {
    return s === 'normal' ? 0 : s === 'rare' ? 1 : fail('invalid_request');
}

/** Week index (uint32) for weekly claims. */
export const week = (n: unknown): number => uint(n, 4_294_967_295);

/** Community / war id (uint32). */
export const communityId = (n: unknown): number => uint(n, 4_294_967_295);

/** Weekly task: 0 = THEME, 1 = HATCH. */
export function weeklyTask(s: unknown): 0 | 1 {
    return s === 'theme' ? 0 : s === 'hatch' ? 1 : fail('invalid_request');
}

/** Weekly tier: 0 bronze, 1 silver, 2 gold. */
export function weeklyTier(s: unknown): 0 | 1 | 2 {
    return s === 'bronze' ? 0 : s === 'silver' ? 1 : s === 'gold' ? 2 : fail('invalid_request');
}

export function battleRequest(body: Record<string, unknown>): BattleRequest {
    switch (body.mode) {
        case 'pve':
            return { mode: 'pve', tier: tier(body.tier) };
        case 'pvp':
            return { mode: 'pvp', code: playerCode(body.code).code };
        case 'war':
            return { mode: 'war', warId: uint(body.warId), targetIdx: int(body.targetIdx, 0, 4) };
        default:
            return fail('invalid_request');
    }
}
