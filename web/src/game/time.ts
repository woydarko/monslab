const WIB_OFFSET_MS = 7 * 3600_000;

/** Calendar day in WIB (UTC+7), YYYY-MM-DD. */
export function wibDayKey(ms: number): string {
    return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** `HH:MM:SS`, or `Nd HH:MM` from one day up. */
export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const p = (n: number) => String(n).padStart(2, '0');
    return d >= 1 ? `${d}d ${p(h)}:${p(m)}` : `${p(h)}:${p(m)}:${p(s)}`;
}
