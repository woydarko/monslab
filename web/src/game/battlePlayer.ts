/**
 * One path for live battles and replays: build both fighters from on-chain data,
 * run the recorded sim version, then play the result in the 3D battle scene.
 */
import { ARENA } from './data/arena.ts';
import { partsFromLoadout } from './data/tokenIds.ts';
import type { MonsterParts } from './data/types.ts';
import type { BattleResult } from './sim/battle.ts';
import { buildMonster, scaleMonster } from './sim/monster.ts';
import { outcomeOf, type Outcome } from './sim/outcome.ts';
import { SIMS } from './sim/registry.ts';

export interface FighterSpec {
    name: string;
    parts: MonsterParts;
    acc: number;
    skin?: number;
    /** Arena opponents are scaled; players never are. */
    statMult?: number;
}

export function buildFighters(spec: {
    mode: 'pve' | 'pvp' | 'war';
    atk: bigint;
    def: bigint | null;
    tier: number | null;
    atkName: string;
    defName: string;
}): [FighterSpec, FighterSpec] {
    const a = partsFromLoadout(spec.atk);
    const attacker: FighterSpec = { name: spec.atkName, parts: a.parts, acc: a.acc };
    if (spec.mode === 'pve') {
        const t = ARENA[spec.tier ?? 0];
        return [attacker, { name: spec.defName, parts: t.parts, acc: 0, statMult: t.statMult }];
    }
    const d = partsFromLoadout(spec.def ?? 0n);
    return [attacker, { name: spec.defName, parts: d.parts, acc: d.acc }];
}

function monsterOf(f: FighterSpec) {
    const m = buildMonster(f.parts);
    return f.statMult === undefined ? m : scaleMonster(m, f.statMult);
}

export function computeBattle(a: FighterSpec, b: FighterSpec, seed: number, simVersion: number): { result: BattleResult; outcome: Outcome } {
    const sim = SIMS[simVersion];
    if (!sim) throw new Error('unsupported_sim_version');
    const result = sim(monsterOf(a), monsterOf(b), seed);
    return { result, outcome: outcomeOf(result) };
}

/** Drives the existing battle scene with a precomputed result. `readOnly` is for the UI (no "Again" on replays). */
export function playBattle(opts: { a: FighterSpec; b: FighterSpec; result: BattleResult; readOnly: boolean; onEnd: () => void }): void {
    // Loaded lazily so the pure functions above stay importable from Node (API, tests).
    void Promise.all([import('./engine.ts'), import('./events.ts'), import('./audio.ts')]).then(([{ engine }, { gameEvents }, audio]) => {
        audio.stopAllSfx();
        audio.playMusic('battle');
        const off = gameEvents.on('battleDone', () => {
            off();
            opts.onEnd();
        });
        engine.show((e) => {
            e.battle({ parts: [opts.a.parts, opts.b.parts], skins: [opts.a.skin ?? 0, opts.b.skin ?? 0], events: opts.result.events, enemyScale: 1 });
        });
    });
}
