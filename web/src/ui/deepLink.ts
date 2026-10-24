export type DeepLink = { vs?: string; replay?: string; war?: number };

/** Query params from shared links; anything malformed is dropped. */
export function parseDeepLink(search: string): DeepLink {
    const q = new URLSearchParams(search);
    const out: DeepLink = {};
    const vs = q.get('vs')?.trim().toUpperCase();
    if (vs && /^MONS-[0-9A-Z]{6}$/.test(vs)) out.vs = vs;
    const replay = q.get('replay')?.trim();
    if (replay && /^[1-9][0-9]{0,18}$/.test(replay)) out.replay = replay;
    const war = q.get('war')?.trim();
    if (war && /^[1-9][0-9]{0,8}$/.test(war)) out.war = Number(war);
    return out;
}
