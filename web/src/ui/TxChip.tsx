/** On-chain action status: pending (spinner) / confirmed (check + explorer link) / failed (Retry). */
import { txUrl } from '../chain/config.ts';
import type { TxUi } from '../state/store.ts';
import Icon from './Icon.tsx';

export const shortHash = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);

export default function TxChip({ label, status, hash, onRetry }: TxUi & { onRetry?: () => void }) {
    const url = hash ? txUrl(hash) : '';
    return (
        <span
            role="status"
            className={`chip pointer-events-auto inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 ${status === 'failed' ? 'border-danger text-danger' : 'text-ink'}`}
        >
            {status === 'pending' && <span className="tx-spin" aria-hidden />}
            {status === 'confirmed' && <Icon name="check" size={18} className="text-primary" />}
            {status === 'failed' && <Icon name="close" size={18} />}
            <span className="t-caption">{label}</span>
            <span className="t-num">{status === 'pending' ? 'Sending…' : status === 'confirmed' ? 'Confirmed' : 'Failed'}</span>
            {status === 'confirmed' && url && (
                <a className="t-num underline" href={url} target="_blank" rel="noreferrer">
                    {shortHash(hash!)}
                </a>
            )}
            {status === 'failed' && onRetry && (
                <button type="button" className="t-num underline" onClick={onRetry}>
                    Retry
                </button>
            )}
        </span>
    );
}
