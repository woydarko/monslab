/** Motion preferences. Decorative animation is dropped when the player asks for less (DESIGN_SYSTEM §8). */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/** Live value: follows the OS setting without a reload. */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(prefersReducedMotion);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(QUERY);
        const on = () => setReduced(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return reduced;
}
