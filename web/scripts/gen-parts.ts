/** Writes ../contracts/script/parts.json ({ slots, rarities } per PARTS index) for the MonsGame constructor. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PARTS } from '../src/game/data/parts.ts';

const SLOT = { head: 0, body: 1, legs: 2 } as const;
const RARITY = { common: 0, rare: 1, epic: 2 } as const;
const out = { slots: PARTS.map((p) => SLOT[p.slot]), rarities: PARTS.map((p) => RARITY[p.rarity]) };
const dir = new URL('../../contracts/script/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('parts.json', dir), JSON.stringify(out) + '\n');
console.log(JSON.stringify(out));
