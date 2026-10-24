/** Uniform error responses and contract revert mapping (ARCHITECTURE §HTTP API, DESIGN_SYSTEM §9). */

export const COPY: Record<string, string> = {
    username_taken: 'That name is taken. Try another one.',
    player_not_found: 'No lab with that code. Check the code and try again.',
    bad_code_format: 'Codes look like MONS-AB12CD.',
    target_taken: '{name} already took this target. Pick another one.',
    drop_closed: 'This code has expired.',
    drop_not_started: "This code isn't active yet.",
    invalid_code: "That code doesn't work.",
    network: 'Monad is slow right now. Try again.',
    invalid_username: 'Names are 3–16 letters, numbers or _.',
    invalid_name: 'Names are 3–20 letters, numbers, spaces, _ or -.',
    invalid_request: "That request didn't look right. Try again.",
    invalid_address: "That address doesn't look right.",
    invalid_signature: "Sign-in didn't go through. Try again.",
    unauthenticated: 'Sign in to keep playing.',
    payload_too_large: "That request didn't look right. Try again.",
    rate_limited: 'Slow down a little. Try again in a minute.',
    relayer_unavailable: 'The game is busy right now. Try again soon.',
    already_registered: 'You already have a lab.',
    insufficient_gloo: 'Not enough Gloo yet.',
    no_egg: 'No eggs to open yet.',
    egg_not_found: "We couldn't find that egg.",
    code_taken: 'Player codes are busy right now. Try again.',
    tier_locked: 'Beat the level before this one first.',
    self_battle: "That's your own code. Pick a friend's lab.",
    not_locked_by_you: 'Lock this target before you fight.',
    community_full: 'This community is full.',
    already_redeemed: 'You already used this code.',
    sold_out: 'All items from this code are gone.',
};

const DEFAULT_COPY = 'Something went wrong. Try again.';

export function ok(data: unknown, init?: ResponseInit): Response {
    return Response.json(data, init);
}

export function fail(status: number, code: string, details?: Record<string, unknown>): Response {
    const name = typeof details?.lockedByName === 'string' ? details.lockedByName : 'Someone';
    const message = (COPY[code] ?? DEFAULT_COPY).replace('{name}', name);
    return Response.json({ error: details ? { code, message, details } : { code, message } }, { status });
}

/** Contract custom error name → [status, code]. */
const REVERTS: Record<string, [number, string]> = {
    UsernameTaken: [409, 'username_taken'], AlreadyRegistered: [409, 'already_registered'], InvalidUsername: [400, 'invalid_username'],
    CodeTaken: [409, 'code_taken'],
    NotOwner: [403, 'not_owner'], WrongSlot: [400, 'wrong_slot'], NoEgg: [400, 'no_egg'], InsufficientGloo: [400, 'insufficient_gloo'],
    TierLocked: [400, 'tier_locked'], SelfBattle: [400, 'self_battle'], UnknownPlayer: [404, 'player_not_found'],
    AlreadyFinalized: [409, 'already_finalized'], DropNotStarted: [409, 'drop_not_started'], DropClosed: [409, 'drop_closed'],
    AlreadyRedeemed: [409, 'already_redeemed'], DropSoldOut: [409, 'sold_out'], InvalidCode: [400, 'invalid_code'],
    NameTaken: [409, 'name_taken'], InvalidName: [400, 'invalid_name'], CommunityFull: [409, 'community_full'], Cooldown: [409, 'cooldown'],
    LeaderCannotLeave: [409, 'leader_cannot_leave'], NotLeader: [403, 'not_leader'], NoContribution: [409, 'no_contribution'],
    TierNotReached: [409, 'tier_not_reached'], AlreadyClaimed: [409, 'already_claimed'], WeekNotClaimable: [409, 'week_not_claimable'],
    WarActive: [409, 'war_active'], WarExpired: [409, 'war_expired'], NotTeamMember: [403, 'not_team_member'], TargetTaken: [409, 'target_taken'],
    TargetDone: [409, 'target_done'], NoAttackLeft: [409, 'no_attack_left'], NotLockedByYou: [409, 'not_locked_by_you'],
    WarNotOver: [409, 'war_not_over'], NotWinner: [409, 'not_winner'], SameCommunity: [409, 'same_community'],
};

const NETWORK = /HttpRequestError|TimeoutError|RpcRequestError|TransportError|WebSocketRequestError|UnknownRpcError|LimitExceededRpcError/;

type ErrLike = { name?: unknown; cause?: unknown; data?: { errorName?: unknown; args?: readonly unknown[] } };

export function mapRevert(err: unknown): { status: number; code: string; details?: Record<string, unknown> } {
    let network = false;
    for (let e = err as ErrLike | undefined, depth = 0; e && typeof e === 'object' && depth < 10; e = e.cause as ErrLike, depth++) {
        const name = e.data?.errorName;
        if (typeof name === 'string' && REVERTS[name]) {
            const [status, code] = REVERTS[name];
            return name === 'TargetTaken' ? { status, code, details: { lockedBy: e.data?.args?.[0] } } : { status, code };
        }
        if (typeof e.name === 'string' && NETWORK.test(e.name)) network = true;
    }
    return network ? { status: 503, code: 'network' } : { status: 500, code: 'internal' };
}
