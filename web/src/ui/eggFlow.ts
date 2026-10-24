export type EggState = 'idle' | 'requesting' | 'cracking' | 'waiting' | 'hatched' | 'still' | 'failed';
export type EggEvent = 'tap' | 'requested' | 'hatched' | 'timeout2s' | 'timeout60s' | 'error' | 'reset';
export interface EggFlow { state: EggState; cracks: number }

export const EGG_START: EggFlow = { state: 'idle', cracks: 0 };
const MAX_CRACKS = 3;

export function eggReducer(s: EggFlow, e: EggEvent): EggFlow {
    if (e === 'reset') return EGG_START;
    if (s.state === 'failed' || s.state === 'hatched') return s;
    switch (e) {
        case 'tap':
            if (s.state === 'idle') return { state: 'requesting', cracks: 1 };
            if (s.state === 'requesting' || s.state === 'cracking' || s.state === 'waiting')
                return { ...s, cracks: Math.min(MAX_CRACKS, s.cracks + 1) };
            return s;
        case 'requested':
            return s.state === 'requesting' ? { ...s, state: 'cracking' } : s;
        case 'timeout2s':
            return s.state === 'cracking' || s.state === 'requesting' ? { ...s, state: 'waiting' } : s;
        case 'timeout60s':
            return s.state === 'waiting' || s.state === 'cracking' ? { ...s, state: 'still' } : s;
        case 'hatched':
            return { state: 'hatched', cracks: MAX_CRACKS };
        case 'error':
            return { ...s, state: 'failed' };
    }
}
