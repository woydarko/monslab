/** ElementChip (F-16, DESIGN_SYSTEM §Element system): shape icon on the element colour. */
import { ELEMENT_COLOR, ELEMENT_NAMES, ELEMENT_SHAPE, type ElementId } from './elements.ts';

const DOT = 20;

export default function ElementChip({ el, size = 'sm' }: { el: ElementId; size?: 'sm' | 'md' }) {
    const name = ELEMENT_NAMES[el];
    return (
        <span className="inline-flex items-center gap-1.5" title={name}>
            <span
                className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[#140b20]"
                style={{ width: DOT, height: DOT, background: ELEMENT_COLOR[el] }}
                role="img"
                aria-label={name}
            >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="#140b20" aria-hidden>
                    <path d={ELEMENT_SHAPE[el]} />
                </svg>
            </span>
            {size === 'md' && <span className="t-caption text-ink">{name}</span>}
        </span>
    );
}
