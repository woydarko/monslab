/** One JSON line per request. Whitelisted fields only: no signatures, cookies, keys or codes. */
export interface LogEntry {
    route: string;
    player?: string;
    code?: string;
    txHash?: string;
    ms: number;
    level?: 'info' | 'error';
}

export function shortAddress(address: string): string {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function logRequest(entry: LogEntry): void {
    const line: Record<string, unknown> = { level: entry.level ?? 'info', route: entry.route, ms: entry.ms };
    if (entry.player) line.player = shortAddress(entry.player);
    if (entry.code) line.code = entry.code;
    if (entry.txHash) line.txHash = entry.txHash;
    console.log(JSON.stringify(line));
}
