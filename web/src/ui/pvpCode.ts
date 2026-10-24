/**
 * PvP codes and invite links (F-07). A code is `MONS-` + six Crockford base32
 * characters, so `O` never appears in the body: stripping a typed `MONS` prefix
 * can't eat a real character. Pure, so the accepted input forms stay pinned.
 */
const BODY = /^[0-9A-Z]{6}$/;

/** Accepts `MONS-AB12CD`, `mons-ab12cd`, `MONSAB12CD` or plain `AB12CD`. Returns null when it can't be a code. */
export function normalizeCode(raw: string): string | null {
    const alnum = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
    const body = alnum.length > 6 && alnum.startsWith('MONS') ? alnum.slice(4) : alnum;
    return BODY.test(body) ? `MONS-${body}` : null;
}

/** The invite link a player shares: `origin/?vs=CODE`. */
export function inviteLink(code: string, origin: string): string {
    return `${origin}/?vs=${code}`;
}
