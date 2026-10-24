import { describe, expect, it } from 'vitest';
import { eggReducer, EGG_START, type EggFlow } from './eggFlow.ts';

const run = (events: Parameters<typeof eggReducer>[1][], from: EggFlow = EGG_START) => events.reduce(eggReducer, from);

describe('eggReducer', () => {
    it('first tap requests', () => {
        expect(run(['tap'])).toEqual({ state: 'requesting', cracks: 1 });
    });

    it('cracks at most three stages', () => {
        expect(run(['tap', 'tap', 'tap', 'tap', 'tap']).cracks).toBe(3);
        expect(run(['tap', 'requested', 'tap']).state).toBe('cracking');
    });

    it('hatched wins from any non-failed state', () => {
        expect(run(['tap', 'hatched']).state).toBe('hatched');
        expect(run(['tap', 'requested', 'timeout2s', 'hatched']).state).toBe('hatched');
        expect(run(['tap', 'error', 'hatched']).state).toBe('failed');
    });

    it('slow callback goes waiting then still', () => {
        expect(run(['tap', 'requested', 'timeout2s']).state).toBe('waiting');
        expect(run(['tap', 'requested', 'timeout2s', 'timeout60s']).state).toBe('still');
    });

    it('error fails', () => {
        expect(run(['tap', 'error']).state).toBe('failed');
    });
});
