/** Writes src/game/sim/__vectors__/v1.json: 20 fixed battles (PVE tiers 0/5/10 + PVP pairs). Run once per sim version. */
import { writeFileSync } from 'node:fs';
import { packLoadout, partIdToToken, partsFromLoadout, STARTER } from '../src/game/data/tokenIds.ts';
import { buildMonster } from '../src/game/sim/monster.ts';
import { outcomeOf, resultHash } from '../src/game/sim/outcome.ts';
import { opponentForTier, SIMS } from '../src/game/sim/registry.ts';

const tok = (id: string) => partIdToToken(id);
const STARTER_L = packLoadout({ ...STARTER, acc: 0 });
const L = (h: string, b: string, l: string, acc = 0) => packLoadout({ head: tok(h), body: tok(b), legs: tok(l), acc });
const builds = [
    STARTER_L,
    L('fang_head', 'goo_body', 'ghost_legs'),
    L('ghost_head', 'goo_body', 'shroom_legs', 201),
    L('bone_head', 'claw_body', 'eye_legs'),
    L('eye_head', 'eye_body', 'eye_legs', 203),
];
const SEEDS = [1, 2, 42, 4095, 2841937721, 7, 99991, 31337, 123456789, 4294967295];

const cases: Array<{ atk: bigint; def: bigint | null; tier: number | null; seed: number }> = [];
for (let i = 0; i < 12; i++) cases.push({ atk: builds[i % builds.length], def: null, tier: [0, 5, 10][i % 3], seed: SEEDS[i % SEEDS.length] });
for (let i = 0; i < 8; i++) cases.push({ atk: builds[i % builds.length], def: builds[(i + 2) % builds.length], tier: null, seed: SEEDS[(i + 3) % SEEDS.length] });

const out = cases.map((c, i) => {
    const battleId = BigInt(i + 1);
    const a = buildMonster(partsFromLoadout(c.atk).parts);
    const b = c.def !== null ? buildMonster(partsFromLoadout(c.def).parts) : opponentForTier(c.tier!);
    const outcome = outcomeOf(SIMS[1](a, b, c.seed));
    return { atk: String(c.atk), def: c.def === null ? null : String(c.def), tier: c.tier, seed: c.seed, battleId: String(battleId), outcome, resultHash: resultHash(battleId, c.seed, outcome) };
});
writeFileSync(new URL('../src/game/sim/__vectors__/v1.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${out.length} vectors`);
