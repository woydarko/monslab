export const TIERS = { theme: [5, 10, 20], hatch: [10, 25, 50] } as const;
export type TierState = 'locked' | 'claimable' | 'claimed' | 'needContribution';

/** Per-tier claim state for one weekly task (claimedMask bit i = tier i claimed). */
export function tierState(progress: number, contribution: number, claimedMask: number, tiers: readonly number[]): TierState[] {
    return tiers.map((goal, i) => {
        if (claimedMask & (1 << i)) return 'claimed';
        if (progress < goal) return 'locked';
        return contribution > 0 ? 'claimable' : 'needContribution';
    });
}
