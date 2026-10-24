import { describe, expect, it } from 'vitest';
import { formatCountdown, wibDayKey } from './time.ts';

describe('time', () => {
    it('rolls the WIB day at 17:00 UTC', () => {
        expect(wibDayKey(Date.UTC(2026, 9, 24, 16, 59, 59))).toBe('2026-10-24');
        expect(wibDayKey(Date.UTC(2026, 9, 24, 17, 0, 0))).toBe('2026-10-25');
    });
    it('formats countdowns', () => {
        expect(formatCountdown(3_723_000)).toBe('01:02:03');
        expect(formatCountdown(90_061_000)).toBe('1d 01:01');
        expect(formatCountdown(-5)).toBe('00:00:00');
    });
});
