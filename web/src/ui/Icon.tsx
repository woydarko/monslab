/**
 * MONSLAB icon set. 24 px grid, 2.5 px square-cap strokes
 * to match the chunky low-poly world. Replaces emoji, which render differently
 * on every platform.
 */
export type IconName =
    | 'sword' | 'mail' | 'flask' | 'sound' | 'mute' | 'help' | 'home' | 'pencil'
    | 'eye' | 'egg' | 'lock' | 'close' | 'back' | 'next' | 'trophy' | 'keyboard'
    | 'skip' | 'mix' | 'skull' | 'check' | 'book' | 'gift';

const PATHS: Record<IconName, React.ReactNode> = {
    sword: (
        <>
            <path d="M14 4h6v6L9 21l-6-6z" />
            <path d="M5 13l6 6M3 21l3-3" />
        </>
    ),
    mail: (
        <>
            <rect x="3" y="5" width="18" height="14" />
            <path d="M3 6l9 7 9-7" />
        </>
    ),
    flask: (
        <>
            <path d="M9 3h6M10 3v6L4 20h16l-6-11V3" />
            <path d="M7 15h10" />
        </>
    ),
    sound: (
        <>
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            <path d="M16 9c1.5 1.5 1.5 4.5 0 6M19 6c3 3 3 9 0 12" />
        </>
    ),
    mute: (
        <>
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            <path d="M16 9l5 6M21 9l-5 6" />
        </>
    ),
    help: (
        <>
            <path d="M8.5 8.5A3.5 3.5 0 1 1 13 12c-1 .5-1 1.5-1 2.5" />
            <path d="M12 18.5v.5" />
        </>
    ),
    home: (
        <>
            <path d="M3 11l9-7 9 7" />
            <path d="M5 10v10h14V10" />
            <path d="M10 20v-6h4v6" />
        </>
    ),
    pencil: (
        <>
            <path d="M4 20l1-5L16 4l4 4L9 19z" />
            <path d="M13 7l4 4" />
        </>
    ),
    eye: (
        <>
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <rect x="10" y="10" width="4" height="4" />
        </>
    ),
    egg: <path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z" />,
    lock: (
        <>
            <rect x="5" y="11" width="14" height="10" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
    ),
    close: <path d="M6 6l12 12M18 6L6 18" />,
    back: <path d="M15 5l-7 7 7 7" />,
    next: <path d="M9 5l7 7-7 7" />,
    trophy: (
        <>
            <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8" />
        </>
    ),
    keyboard: (
        <>
            <rect x="2" y="6" width="20" height="12" />
            <path d="M6 10h1M10 10h1M14 10h1M18 10h1M7 14h10" />
        </>
    ),
    skip: <path d="M5 5l8 7-8 7zM16 5v14" />,
    mix: (
        <>
            <path d="M4 18c4-1 6-5 8-6s4-5 8-6" />
            <path d="M4 6c4 1 6 5 8 6s4 5 8 6" />
        </>
    ),
    skull: (
        <>
            <path d="M5 11a7 7 0 1 1 14 0v4h-3v4H8v-4H5z" />
            <rect x="8" y="10" width="2.5" height="2.5" />
            <rect x="13.5" y="10" width="2.5" height="2.5" />
        </>
    ),
    check: <path d="M4 12l5 5L20 6" />,
    /** Daily gift: a wrapped box with a bow. */
    gift: <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1-3-5-4-5-1.5S10 7 12 7c2 0 5-.5 5-1.5S13 4 12 7z" />,
    /** Collection Book: an open book. */
    book: <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14" />,
};

export default function Icon({ name, size = 24, className = '', title }: { name: IconName; size?: number; className?: string; title?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="square"
            strokeLinejoin="miter"
            className={`shrink-0 ${className}`}
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
        >
            {title && <title>{title}</title>}
            {PATHS[name]}
        </svg>
    );
}
