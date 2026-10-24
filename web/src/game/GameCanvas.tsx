/**
 * React ↔ Three boundary. Mounts the single PSX renderer once after loading;
 * scenes are swapped by actions.ts through the engine, never by React.
 */
import { useEffect, useRef } from 'react';
import { engine } from './engine.ts';

export default function GameCanvas() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (hostRef.current) engine.mount(hostRef.current);
        return () => engine.unmount();
    }, []);
    return <div ref={hostRef} className="absolute inset-0" />;
}
