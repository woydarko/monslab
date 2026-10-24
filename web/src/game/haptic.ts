const MS = { light: 10, medium: 20, heavy: 35 } as const;

export function haptic(kind: 'light' | 'medium' | 'heavy'): void {
    try {
        navigator.vibrate?.(MS[kind]);
    } catch {
        /* vibration unsupported or blocked */
    }
}
