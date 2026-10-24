/** Player-facing error copy keyed by API error code (strings exactly as the design copy list). */
const COPY: Record<string, string> = {
    username_taken: 'That name is taken. Try another one.',
    invalid_username: 'Use 3–16 letters, numbers or _.',
    player_not_found: 'No lab with that code. Check the code and try again.',
    bad_code_format: 'Codes look like MONS-AB12CD.',
    self_battle: "You can't fight your own monster.",
    no_egg: 'No eggs left. Win PvP or buy one with Gloo.',
    insufficient_gloo: 'Not enough Gloo. Win levels to earn more.',
    tier_locked: 'Beat the level before this one first.',
    no_attack_left: "You've used your war attack. Cheer your team on!",
    drop_closed: 'This code has expired.',
    drop_not_started: "This code isn't active yet.",
    already_redeemed: 'You already claimed this item.',
    sold_out: 'All of these have been claimed.',
    invalid_code: "That code doesn't work.",
    community_full: 'This community is full (30/30).',
    network: 'Monad is slow right now. Try again.',
    login_cancelled: 'Login cancelled. Try again.',
    // Community + weekly tasks (F-09, F-10). The design copy list does not pin these
    // codes, so they follow its shape: what happened, then what to do.
    name_taken: 'That name is taken. Try another one.',
    invalid_community_name: 'Use 3–20 letters, numbers, space, - or _.',
    community_not_found: 'No community with that number. Check it and try again.',
    leader_cannot_leave: "Leaders can't leave while the community has other members.",
    no_contribution: "You didn't help with this task this week.",
    already_claimed: 'You already claimed this tier.',
};

export const FALLBACK_COPY = 'Something went wrong. Try again.';

export function errorCopy(code: string, details?: Record<string, unknown>): string {
    if (code === 'target_taken') return `${String(details?.lockedByName ?? 'A teammate')} already took this target. Pick another one.`;
    if (code === 'cooldown') return `You can join a new community next week (${String(details?.timeLeft ?? 'a few days')} left).`;
    return COPY[code] ?? FALLBACK_COPY;
}
