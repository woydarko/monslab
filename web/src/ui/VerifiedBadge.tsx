/**
 * F-12 badge: "Verified" only when the re-simulation reproduces the on-chain
 * result hash; "Mismatch" when it does not. Icon + text, never colour alone
 * (DESIGN_SYSTEM §12). Stamps in over 280 ms unless motion is reduced.
 */
import { usePrefersReducedMotion } from './motion.ts';
import type { ReplayBadge } from './replayView.ts';
import Icon from './Icon.tsx';

export default function VerifiedBadge({ badge, meta }: { badge: ReplayBadge; meta?: string }) {
    const reduced = usePrefersReducedMotion();
    const good = badge.tone === 'primary';
    return (
        <div
            role="status"
            aria-live="polite"
            className={`panel flex items-center gap-3 px-3 py-2 ${reduced ? '' : 'stamp'}`}
        >
            <span className={`shrink-0 ${good ? 'text-primary' : 'text-danger'}`}>
                <Icon name={good ? 'check' : 'close'} size={32} />
            </span>
            <span className="min-w-0">
                <span className={`t-title block ${good ? 'text-primary' : 'text-danger'}`}>{badge.text}</span>
                <span className="t-caption block truncate text-muted">
                    {badge.detail}
                    {meta ? ` · ${meta}` : ''}
                </span>
            </span>
        </div>
    );
}
