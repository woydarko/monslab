/** Balance gate (F-16): exits 1 unless the full sweep is inside the approved bounds. */
import { sweep } from './sweep.ts';

const { overall, bestCounter, part } = sweep();
const pv = Object.values(part);
const r3 = (x: number) => +x.toFixed(3);
const report = {
    top: r3(Math.max(...overall)),
    bottom: r3(Math.min(...overall)),
    over65: overall.filter((x) => x > 0.65).length,
    partMax: r3(Math.max(...pv)),
    partMin: r3(Math.min(...pv)),
    worstCounter: r3(Math.min(...bestCounter)),
};
console.log(JSON.stringify(report));
const ok = report.partMax <= 0.56 && report.partMin >= 0.44 && report.worstCounter >= 0.8 && report.over65 <= 15;
if (!ok) process.exit(1);
