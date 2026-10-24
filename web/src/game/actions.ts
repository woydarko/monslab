/**
 * The ONLY place that changes game state (GDD §23): React calls these, they
 * use sim/, mutate the save, patch the store, and drive the 3D engine.
 */
import { store, type BattleMode } from '../state/store.ts';
import { saveSystem, type MonsSave, type SavedMonster } from './localSave.ts';
import { getPart, PARTS } from './data/parts.ts';
import { ARENA, MAX_SLICE_TIER } from './data/arena.ts';
import type { FamilyId, MonsterParts, Rarity, SlotId } from './data/types.ts';
import { buildMonster, scaleMonster, type Monster } from './sim/monster.ts';
import { simulate } from './sim/battle.ts';
import { ADVICE_TRIALS, allPartIds, bestSwap, practiceWins } from './sim/advice.ts';
import { autoName, sanitizeName } from './names.ts';
import { engine } from './engine.ts';
import { gameEvents } from './events.ts';
import { haptic } from './haptic.ts';
import { playMusic, sfx, stopAllSfx } from './audio.ts';
import { wibDayKey } from './time.ts';
import { api } from '../chain/api.ts';
import { effectiveLoadout } from '../ui/effectiveLoadout.ts';
import type { BattleRequest, BattleView, Loadout, MeView } from '../../server/types.ts';

export const DAILY_CAPSULE_WINS = 5;
const PITY_EVERY = 8;
const DUPE_GOO: Record<Rarity, number> = { common: 10, rare: 30, epic: 100 };
const WIN_GOO = 15;
/** Goo's one use in the slice: buy an extra egg (4 capped wins, or a couple of dupes). */
export const EGG_PRICE = 60;
/** FTUE's guaranteed first capsule: an EYE part (GDD §9). */
const FTUE_CAPSULE_PART = 'eye_legs';

// ───────────────────────── helpers ─────────────────────────

export function save(): MonsSave {
    return saveSystem.data!;
}

export function activeMonster(): SavedMonster {
    const s = save();
    return s.monsters[s.active];
}

function commit(): void {
    saveSystem.save();
    store.patch({ rev: store.get().rev + 1 });
}

function todayKey(): string {
    return wibDayKey(Date.now());
}

function rollDailyReset(s: MonsSave): void {
    const k = todayKey();
    if (s.capsules.dayKey !== k) {
        s.capsules.dayKey = k;
        s.capsules.winsToday = 0;
    }
}

/** Eggs won today, without waiting for the next battle to roll the day over. */
export function eggWinsToday(): number {
    const c = save().capsules;
    return c.dayKey === todayKey() ? c.winsToday : 0;
}

export function toast(text: string): void {
    store.patch({ toast: text });
    const mine = text;
    setTimeout(() => {
        if (store.get().toast === mine) store.patch({ toast: null });
    }, 2200);
}

// ───────────────────────── boot / lab ─────────────────────────

export function enterLab(opts: { mix?: boolean } = {}): void {
    stopAllSfx(); // a battle's KO or jingle must not follow the player into the lab
    store.patch({ phase: 'lab', battle: null, result: null, capsule: null, howTo: false });
    // FTUE step 4 is derived from the save, so the pointer survives an app restart.
    const s = save();
    if (!s.ftue.done && s.ftue.step === 4) {
        store.patch({ traySlot: getPart(FTUE_CAPSULE_PART).slot, highlightPart: FTUE_CAPSULE_PART });
    }
    playMusic('lab');
    engine.show((e) => {
        const m = activeMonster();
        const lab = e.lab();
        if (!lab) return;
        lab.autoSpin = false;
        lab.setMonster(m.parts, m.skin, opts.mix ?? false);
    });
}

/** Title screen: the player's monster showcased on the pedestal behind the logo. */
export function enterTitle(): void {
    stopAllSfx();
    store.patch({ phase: 'title', battle: null, result: null, capsule: null, howTo: false });
    playMusic('lab');
    engine.show((e) => {
        const m = activeMonster();
        const lab = e.lab();
        if (!lab) return;
        lab.autoSpin = true;
        lab.setMonster(m.parts, m.skin, false);
    });
}

/** PLAY on the title screen. */
export function play(): void {
    enterLab();
}

export function showHowTo(open: boolean): void {
    store.patch({ howTo: open });
}

/** FTUE step 0: the very first MIX! */
export function mix(): void {
    const s = save();
    s.stats.mixes++;
    if (!s.ftue.done && s.ftue.step === 0) s.ftue.step = 1;
    commit();
    const m = activeMonster();
    engine.lab()?.setMonster(m.parts, m.skin, true);
    sfx('mix');
    setTimeout(() => sfx('pop'), 350);
    haptic('medium');
}

export function selectTraySlot(slot: SlotId | 'skin'): void {
    store.patch({ traySlot: slot });
}

export function equipPart(partId: string): void {
    const s = save();
    if (!s.ownedParts[partId]) return;
    const part = getPart(partId);
    const m = activeMonster();
    const idx = part.slot === 'head' ? 0 : part.slot === 'body' ? 1 : 2;
    if (m.parts[idx] === partId) return;
    const parts = [...m.parts] as MonsterParts;
    parts[idx] = partId;
    m.parts = parts;
    if (!m.customName) m.name = autoName(parts);
    if (!s.ftue.done && s.ftue.step === 4) {
        s.ftue.step = 5;
        s.ftue.done = true;
    }
    commit();
    store.patch({ highlightPart: store.get().highlightPart === partId ? null : store.get().highlightPart });
    engine.lab()?.swapMonster(parts, m.skin);
    sfx('pop', { pitch: 1.15, volume: 0.7 });
    haptic('light');
}

export function renameMonster(raw: string): boolean {
    const name = sanitizeName(raw);
    if (!name) return false;
    const m = activeMonster();
    m.name = name;
    m.customName = true;
    commit();
    return true;
}

// ───────────────────────── battles ─────────────────────────

function opponentFor(mode: BattleMode, tier: number): { monster: Monster; parts: MonsterParts; name: string } {
    const t = ARENA[Math.min(tier, ARENA.length - 1)];
    return { monster: scaleMonster(buildMonster(t.parts), t.statMult), parts: t.parts, name: t.name };
}

function startBattleWith(
    mode: BattleMode,
    tier: number,
    enemy: { monster: Monster; parts: MonsterParts; name: string; skin: number },
    seed: number,
    challengeCode?: string
): void {
    stopAllSfx();
    const me = activeMonster();
    const mine = buildMonster(me.parts);
    const result = simulate(mine, enemy.monster, seed);
    const s = save();
    s.stats.battles++;
    if (!s.ftue.done && s.ftue.step === 1) s.ftue.step = 2;
    commit();

    store.patch({
        phase: 'battle',
        battle: {
            mode, tier,
            names: [me.name, enemy.name],
            parts: [me.parts, enemy.parts],
            maxHp: result.maxHp,
            winner: result.winner,
            challengeCode,
        },
        result: null,
    });
    playMusic('battle');
    const off = gameEvents.on('battleDone', () => {
        off();
        finishBattle(result.winner === 0, mode, tier, enemy, me.parts);
    });
    engine.show((e) => {
        e.battle({ parts: [me.parts, enemy.parts], skins: [me.skin, enemy.skin], events: result.events, enemyScale: 1 });
    });
}

export function startArenaBattle(tier: number): void {
    const s = save();
    // Steps 1–2: the FTUE fight (step 2 = quit mid-fight → replay the same safe fight).
    const ftue = !s.ftue.done && s.ftue.step <= 2;
    const t = ftue ? 0 : Math.max(1, Math.min(tier, MAX_SLICE_TIER));
    const opp = opponentFor(ftue ? 'ftue' : 'arena', t);
    startBattleWith(ftue ? 'ftue' : 'arena', t, { ...opp, skin: 0 }, (Math.random() * 2 ** 31) >>> 0);
}

export function canFightTier(tier: number): boolean {
    return tier <= save().arena.highestTier + 1;
}

/**
 * After a loss: name the one swap that would have helped most, backed by
 * practice fights against this exact opponent. Owned parts first; otherwise
 * a part the player could still win from eggs.
 */
function lossTip(myParts: MonsterParts, enemy: Monster, enemyName: string, mode: BattleMode): string {
    const s = save();
    const owned = Object.keys(s.ownedParts).filter((id) => s.ownedParts[id] > 0);
    const mine = bestSwap(myParts, enemy, owned);
    if (mine) {
        return `Try ${getPart(mine.partId).name}. With it you won ${mine.wins} of ${mine.trials} practice fights against ${enemyName}, up from ${mine.baseWins}.`;
    }
    const locked = allPartIds().filter((id) => !owned.includes(id));
    const wish = bestSwap(myParts, enemy, locked);
    if (wish) return `${getPart(wish.partId).name} would beat ${enemyName} more often. Eggs can drop it.`;
    const base = practiceWins(myParts, enemy);
    if (base <= ADVICE_TRIALS * 0.4) {
        return `${enemyName} won ${ADVICE_TRIALS - base} of ${ADVICE_TRIALS} practice fights against this build, and no single swap fixes that. Try a different mix of families.`;
    }
    return mode === 'challenge'
        ? 'The same code always plays the same fight, so change a part before the rematch.'
        : `This build won ${base} of ${ADVICE_TRIALS} practice fights against ${enemyName}. Every fight rolls differently, so a rematch can go your way.`;
}

function finishBattle(won: boolean, mode: BattleMode, tier: number, enemy: { monster: Monster; parts: MonsterParts; name: string }, myParts: MonsterParts): void {
    const enemyParts = enemy.parts;
    const s = save();
    rollDailyReset(s);
    let capsule = false;
    let goo = 0;
    let trophyPart: string | null = null;
    let newTier: number | null = null;

    if (won) {
        s.stats.wins++;
        if (s.capsules.winsToday < DAILY_CAPSULE_WINS || mode === 'ftue') {
            s.capsules.stored++;
            s.capsules.winsToday++;
            capsule = true;
        } else {
            goo = WIN_GOO;
            s.goo += goo;
        }
        if (mode === 'arena' && tier > s.arena.highestTier) {
            s.arena.highestTier = tier;
            newTier = tier;
            // Beating the final tier: one extra egg that always hatches epic.
            if (tier === MAX_SLICE_TIER) {
                s.capsules.stored++;
                s.capsules.epicPending++;
                grantSkin(2); // Pumpkin (data/skins.ts)
            }
        }
        if (mode === 'arena') s.arena.wins++;
        if (mode === 'challenge') {
            s.stats.challengesWon++;
            const unowned = enemyParts.filter((p) => !s.ownedParts[p]);
            trophyPart = (unowned.length ? unowned : enemyParts)[Math.floor(Math.random() * (unowned.length || 3))];
            s.ownedParts[trophyPart] = (s.ownedParts[trophyPart] ?? 0) + 1;
        }
        if (!s.ftue.done && s.ftue.step === 2) s.ftue.step = 3;
    }
    commit();
    store.patch({
        phase: 'result',
        result: {
            won, mode, capsule, goo, trophyPart, newTier,
            tip: won ? null : lossTip(myParts, enemy.monster, enemy.name, mode),
        },
    });
    sfx(won ? 'win' : 'lose');
    haptic(won ? 'medium' : 'heavy');
}

export function setBattleSpeed(speed: number): void {
    engine.currentBattle()?.setSpeed(speed);
}

export function skipBattle(): void {
    engine.currentBattle()?.skip();
}

// ───────────────────────── capsules ─────────────────────────

function rollCapsule(s: MonsSave): { partId: string; rarity: Rarity } {
    if (!s.ftue.done && s.capsules.opened === 0) return { partId: FTUE_CAPSULE_PART, rarity: getPart(FTUE_CAPSULE_PART).rarity };
    let r = Math.random();
    let rarity: Rarity = r < 0.05 ? 'epic' : r < 0.3 ? 'rare' : 'common';
    if (s.capsules.epicPending > 0) {
        s.capsules.epicPending--;
        rarity = 'epic';
    }
    if (rarity === 'common' && s.capsules.pity + 1 >= PITY_EVERY) rarity = Math.random() < 0.2 ? 'epic' : 'rare';
    const pool = PARTS.filter((p) => p.rarity === rarity);
    const weights = pool.map((p) => (s.ownedParts[p.id] ? 1 : 3));
    r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return { partId: pool[i].id, rarity };
    }
    return { partId: pool[pool.length - 1].id, rarity };
}

/** Roll and APPLY the reward before any animation (closing the app can't reroll). */
export function openCapsule(): void {
    const s = save();
    if (s.capsules.stored <= 0) return;
    const { partId, rarity } = rollCapsule(s);
    s.capsules.stored--;
    s.capsules.opened++;
    s.capsules.pity = rarity === 'common' ? s.capsules.pity + 1 : 0;
    const isNew = !s.ownedParts[partId];
    let goo = 0;
    if (isNew) s.ownedParts[partId] = 1;
    else {
        s.ownedParts[partId]++;
        goo = DUPE_GOO[rarity];
        s.goo += goo;
    }
    commit();
    store.patch({ phase: 'egg', capsule: { rarity, partId, isNew, goo, stage: 'egg', cracks: 0 } });
    engine.show((e) => e.lab()?.showEgg(rarity));
    playMusic('lab');
}

/** Spend Goo on an egg. Bought eggs skip the daily win limit; that's the point of saving up. */
export function buyEgg(): void {
    const s = save();
    if (s.goo < EGG_PRICE) return;
    s.goo -= EGG_PRICE;
    s.capsules.stored++;
    commit();
    sfx('pop', { pitch: 0.9 });
    haptic('light');
    toast('Egg bought');
}

export function tapCapsule(): void {
    const c = store.get().capsule;
    if (!c || c.stage !== 'egg') return;
    const lab = engine.lab();
    const done = lab?.crackEgg() ?? true;
    haptic(done ? 'heavy' : 'light');
    sfx(done ? 'egg_open' : 'egg_crack', { pitch: 1 + c.cracks * 0.12 });
    if (done) {
        const part = getPart(c.partId);
        const view: MonsterParts =
            part.slot === 'head' ? [c.partId, 'goo_body', 'goo_legs'] : part.slot === 'body' ? ['goo_head', c.partId, 'goo_legs'] : ['goo_head', 'goo_body', c.partId];
        lab?.openEgg(view, part.slot, c.rarity);
        store.patch({ capsule: { ...c, stage: 'open', cracks: 3 } });
        const s = save();
        if (!s.ftue.done && s.ftue.step === 3) {
            s.ftue.step = 4;
            commit();
        }
    } else {
        store.patch({ capsule: { ...c, cracks: c.cracks + 1 } });
    }
}

export function finishCapsule(equip: boolean): void {
    const c = store.get().capsule;
    const part = c ? getPart(c.partId) : null;
    store.patch({ highlightPart: c?.isNew ? c.partId : null, traySlot: part?.slot ?? store.get().traySlot });
    enterLab();
    if (equip && c) equipPart(c.partId);
}

// ───────────────────────── skins ─────────────────────────

/** Add a skin to the collection (idempotent). Caller commits. */
export function grantSkin(id: number): void {
    const s = save();
    if (!s.ownedSkins.includes(id)) s.ownedSkins.push(id);
}

export function equipSkin(id: number): void {
    const s = save();
    if (!s.ownedSkins.includes(id)) return;
    const m = activeMonster();
    if (m.skin === id) return;
    m.skin = id;
    commit();
    engine.lab()?.swapMonster(m.parts, m.skin);
    sfx('pop', { pitch: 1.3, volume: 0.6 });
}

export function openCollection(): void {
    store.patch({ phase: 'collection' });
}

/** Families the player owns every part of. */
export function completedFamilies(): FamilyId[] {
    const s = save();
    const fams = [...new Set(PARTS.map((p) => p.family))];
    return fams.filter((f) => PARTS.filter((p) => p.family === f).every((p) => (s.ownedParts[p.id] ?? 0) > 0));
}

/** Completing a family's three parts is worth one egg, claimed once. */
export function claimFamilyEgg(family: FamilyId): void {
    const s = save();
    if (s.collectionClaimed.includes(family) || !completedFamilies().includes(family)) return;
    s.collectionClaimed.push(family);
    s.capsules.stored++;
    commit();
    sfx('pop', { pitch: 1.1 });
    haptic('medium');
    toast('Egg added');
}

export function openArena(): void {
    store.patch({ phase: 'levels' });
}

export function backToLab(): void {
    if (store.get().phase === 'lab') return;
    const ph = store.get().phase;
    const fromScene = ph === 'levels' || ph === 'collection' || ph === 'pvp' || ph === 'profile' || ph === 'redeem';
    if (fromScene) store.patch({ phase: 'lab' });
    else enterLab();
}

// ───────────────────────── chain bridge ─────────────────────────
// Chain is the source of truth: MeView from /api/me is mirrored into the local
// save so the existing screens render real balances, eggs, Gloo and loadout.

// shortcut: local token map until game/data/tokenIds.ts (G2) lands; same rule (PARTS index + 1, starters 101–103).
const STARTER_TOKEN: Record<string, number> = { goo_head: 101, goo_body: 102, goo_legs: 103 };
const STARTER_PART: Record<number, string> = { 101: 'goo_head', 102: 'goo_body', 103: 'goo_legs' };

export function tokenToPartId(id: number): string | null {
    if (id >= 1 && id <= PARTS.length) return PARTS[id - 1].id;
    return STARTER_PART[id] ?? null;
}

export function partToToken(partId: string): number {
    return STARTER_TOKEN[partId] ?? PARTS.findIndex((p) => p.id === partId) + 1;
}

export function loadoutParts(l: Loadout): MonsterParts {
    return [tokenToPartId(l.head) ?? 'goo_head', tokenToPartId(l.body) ?? 'goo_body', tokenToPartId(l.legs) ?? 'goo_legs'];
}

/** Accessory picked in the Lab (cosmetic; saved with the loadout). */
let accChoice = 0;
export const currentAcc = (): number => accChoice;
export function selectAcc(id: number): void {
    accChoice = id;
    store.patch({ rev: store.get().rev + 1 });
}

export function applyMe(me: MeView): void {
    const s = save();
    const owned: Record<string, number> = {};
    for (const [id, n] of Object.entries(me.balances)) {
        const p = tokenToPartId(Number(id));
        if (p && n > 0) owned[p] = (owned[p] ?? 0) + n;
    }
    s.ownedParts = owned;
    s.goo = me.gloo;
    s.capsules.stored = me.eggs;
    s.arena.highestTier = me.highestTier;
    s.ftue = { step: 5, done: true };
    if (me.registered) {
        const eff = effectiveLoadout(me.loadout, me.balances);
        const m = activeMonster();
        m.parts = loadoutParts(eff);
        if (!m.customName) m.name = autoName(m.parts);
        accChoice = eff.acc;
    }
    commit();
    store.patch({ me });
}

export async function refreshMe(): Promise<MeView> {
    const me = await api.me();
    applyMe(me);
    return me;
}

/** After the wallet signed in: registered players go to the Lab (or a deep link), new ones to Register. */
export async function afterSignIn(): Promise<void> {
    const me = await refreshMe();
    store.patch({ session: 'signedIn' });
    if (!me.registered) {
        store.patch({ phase: 'register' });
        return;
    }
    routeHome();
}

function routeHome(): void {
    const dl = store.get().deepLink;
    enterLab();
    if (dl.vs) store.patch({ phase: 'pvp', pendingCode: dl.vs, deepLink: { ...dl, vs: undefined } });
    else if (dl.war) store.patch({ phase: 'war', warId: dl.war, deepLink: { ...dl, war: undefined } });
}

export async function register(username: string) {
    const res = await api.register(username);
    applyMe(res.me);
    routeHome();
    return res;
}

/** Loadout currently shown in the Lab, as token ids. */
export function labLoadout(): Loadout {
    const [h, b, l] = activeMonster().parts;
    return { head: partToToken(h), body: partToToken(b), legs: partToToken(l), acc: accChoice };
}

export function labDirty(): boolean {
    const me = store.get().me;
    if (!me?.registered) return false;
    const a = labLoadout();
    const b = effectiveLoadout(me.loadout, me.balances);
    return a.head !== b.head || a.body !== b.body || a.legs !== b.legs || a.acc !== b.acc;
}

export async function saveLoadout() {
    const res = await api.setLoadout(labLoadout());
    const me = store.get().me;
    if (me) store.patch({ me: { ...me, loadout: res.loadout } });
    return res;
}

async function chainBattle(req: BattleRequest, enemyName: string): Promise<BattleView> {
    const bv = await api.battle(req);
    playChainBattle(bv, enemyName);
    void refreshMe().catch(() => undefined);
    return bv;
}

/** Animate a chain battle locally from its on-chain seed and loadouts (replay uses mode 'replay'). */
export function playChainBattle(bv: BattleView, enemyName: string, mode: BattleMode = bv.mode === 'pve' ? 'arena' : bv.mode === 'pvp' ? 'challenge' : 'war'): void {
    stopAllSfx();
    const myParts = loadoutParts(bv.attacker.loadout);
    let enemy: { monster: Monster; parts: MonsterParts; name: string };
    if (bv.mode === 'pve') {
        const t = ARENA[Math.min(bv.defender.tier ?? 0, ARENA.length - 1)];
        enemy = { monster: scaleMonster(buildMonster(t.parts), t.statMult), parts: t.parts, name: t.name };
    } else {
        const parts = loadoutParts(bv.defender.loadout ?? { head: 101, body: 102, legs: 103, acc: 0 });
        enemy = { monster: buildMonster(parts), parts, name: enemyName };
    }
    // shortcut: plain simulate() until G5 buildFighters/playBattle land; server outcome stays authoritative for rewards.
    const result = simulate(buildMonster(myParts), enemy.monster, bv.seed);
    const myName = mode === 'replay' ? 'Attacker' : activeMonster().name;
    store.patch({
        phase: mode === 'replay' ? 'replay' : 'battle',
        battleView: bv,
        battle: { mode, tier: bv.defender.tier ?? 0, names: [myName, enemy.name], parts: [myParts, enemy.parts], maxHp: result.maxHp, winner: result.winner },
        result: null,
    });
    playMusic('battle');
    const off = gameEvents.on('battleDone', () => {
        off();
        if (mode === 'replay') return;
        const won = bv.outcome.winner === 0;
        store.patch({
            phase: 'result',
            result: { won, mode, capsule: bv.rewards.eggs > 0, goo: bv.rewards.gloo, trophyPart: null, newTier: null, tip: null },
        });
        sfx(won ? 'win' : 'lose');
        haptic(won ? 'medium' : 'heavy');
    });
    engine.show((e) => {
        e.battle({ parts: [myParts, enemy.parts], skins: [0, 0], events: result.events, enemyScale: 1 });
    });
}

export const fightLevel = (tier: number) => chainBattle({ mode: 'pve', tier }, ARENA[tier]?.name ?? 'Monster');
export const fightPvp = (code: string, name: string) => chainBattle({ mode: 'pvp', code }, name);
export const fightWar = (warId: number, targetIdx: number, name: string) => chainBattle({ mode: 'war', warId, targetIdx }, name);

export async function finalizePending(): Promise<BattleView | null> {
    const bv = store.get().battleView;
    if (!bv) return null;
    const next = await api.finalizeBattle(bv.battleId);
    store.patch({ battleView: next });
    void refreshMe().catch(() => undefined);
    return next;
}

export function openPhase(phase: 'levels' | 'pvp' | 'community' | 'war' | 'redeem' | 'profile' | 'egg'): void {
    store.patch({ phase });
}
