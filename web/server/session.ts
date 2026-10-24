/** Sign-in nonce + HS256 session token in an HttpOnly cookie (SECURITY.md §Session). */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Hex } from './types.ts';

const COOKIE = 'ms_session';
const NONCE_TTL_MS = 300_000;
const SESSION_TTL_S = 86_400;

export class AuthError extends Error {
    code = 'unauthenticated';
    status = 401;
}

function secret(): string {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 32) throw new Error('missing_env: SESSION_SECRET');
    return s;
}

const hmac = (data: string): Buffer => createHmac('sha256', secret()).update(data).digest();

function safeEqual(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
}

export function signInMessage(address: string, nonce: string, issuedMs: number): string {
    return `MONSLAB sign-in\nAddress: ${address}\nNonce: ${nonce}\nIssued: ${new Date(issuedMs).toISOString()}`;
}

export function issueNonce(address: string, now = Date.now()): { nonce: string; message: string } {
    const body = `${now}.${randomBytes(16).toString('hex')}`;
    const nonce = Buffer.from(`${body}.${hmac(body).toString('hex')}`).toString('base64url');
    return { nonce, message: signInMessage(address, nonce, now) };
}

/** Issued time of a valid, unexpired nonce; null otherwise. */
export function nonceIssuedAt(nonce: string, now = Date.now()): number | null {
    const parts = Buffer.from(nonce, 'base64url').toString().split('.');
    if (parts.length !== 3 || !/^[0-9a-f]{64}$/.test(parts[2])) return null;
    const body = `${parts[0]}.${parts[1]}`;
    if (!safeEqual(hmac(body), Buffer.from(parts[2], 'hex'))) return null;
    const issued = Number(parts[0]);
    return Number.isFinite(issued) && now - issued <= NONCE_TTL_MS && now >= issued ? issued : null;
}

export function verifyNonce(nonce: string, now = Date.now()): boolean {
    return nonceIssuedAt(nonce, now) !== null;
}

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export function signJwt(sub: string, now = Date.now()): string {
    const iat = Math.floor(now / 1000);
    const payload = Buffer.from(JSON.stringify({ sub, iat, exp: iat + SESSION_TTL_S })).toString('base64url');
    return `${HEADER}.${payload}.${hmac(`${HEADER}.${payload}`).toString('base64url')}`;
}

export function verifyJwt(token: string, now = Date.now()): string | null {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s || h !== HEADER) return null;
    if (!safeEqual(hmac(`${h}.${p}`), Buffer.from(s, 'base64url'))) return null;
    try {
        const { sub, exp } = JSON.parse(Buffer.from(p, 'base64url').toString()) as { sub?: unknown; exp?: unknown };
        return typeof sub === 'string' && typeof exp === 'number' && Math.floor(now / 1000) < exp ? sub : null;
    } catch {
        return null;
    }
}

export function readSession(request: Request): Hex | null {
    const cookie = request.headers.get('cookie') ?? '';
    const m = cookie.match(/(?:^|;\s*)ms_session=([^;]+)/);
    const sub = m ? verifyJwt(m[1]) : null;
    return sub && /^0x[0-9a-fA-F]{40}$/.test(sub) ? (sub as Hex) : null;
}

export function requireSession(request: Request): Hex {
    const a = readSession(request);
    if (!a) throw new AuthError('unauthenticated');
    return a;
}

export function sessionCookie(token: string): string {
    return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_S}`;
}

export function clearCookie(): string {
    return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
