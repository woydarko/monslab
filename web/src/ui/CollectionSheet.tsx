/**
 * Collection Book (PLAN-v0.3 A5): every part by family, owned or a silhouette,
 * and one egg for each family completed. Gives a goal after Arena tier 5.
 */
import { backToLab, claimFamilyEgg, completedFamilies } from '../game/actions.ts';
import { PARTS } from '../game/data/parts.ts';
import { FAMILIES } from '../game/data/families.ts';
import type { FamilyId } from '../game/data/types.ts';
import { FamilyDot, PartIcon, rarityColor, Sheet, useSave } from './bits.tsx';
import Icon from './Icon.tsx';
import { useLayout } from './layout.ts';

const FAMILY_ORDER = [...new Set(PARTS.map((p) => p.family))] as FamilyId[];

export default function CollectionSheet() {
    const s = useSave();
    const wide = useLayout() === 'wide';
    const owned = (id: string) => (s.ownedParts[id] ?? 0) > 0;
    const total = PARTS.length;
    const have = PARTS.filter((p) => owned(p.id)).length;
    const done = completedFamilies();

    return (
        <Sheet title="Collection" onClose={backToLab} width={860}>
            <div className="mb-3 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                    <span className="t-body text-ink">
                        {have} of {total} parts
                    </span>
                    <span className="t-caption text-muted">Complete a family to get an egg</span>
                </div>
                <div className="h-3 overflow-hidden rounded-[4px] border-2 border-[#140b20] bg-black/60" role="progressbar" aria-valuenow={have} aria-valuemax={total} aria-label="Parts collected">
                    <div className="h-full bg-primary" style={{ width: `${(have / total) * 100}%` }} />
                </div>
            </div>

            <div className={`flex flex-col gap-2 ${wide ? '' : 'max-h-[60vh] overflow-y-auto overflow-x-hidden pb-2 pr-1'}`}>
                {FAMILY_ORDER.map((f) => {
                    const parts = PARTS.filter((p) => p.family === f);
                    const count = parts.filter((p) => owned(p.id)).length;
                    const claimed = s.collectionClaimed.includes(f);
                    const complete = done.includes(f);
                    return (
                        <div key={f} className={`panel grid items-center gap-3 px-3 py-2 ${wide ? 'grid-cols-[130px_1fr_150px]' : 'grid-cols-[1fr_auto]'}`}>
                            <div className="flex min-w-0 items-center gap-2">
                                <FamilyDot family={f} size={14} />
                                <span className="flex flex-col">
                                    <span className="t-button">{FAMILIES[f].name}</span>
                                    <span className="t-caption text-muted">
                                        {count}/{parts.length}
                                    </span>
                                </span>
                            </div>

                            <div className={`flex gap-2 ${wide ? '' : 'col-span-2 row-start-2'}`}>
                                {parts.map((p) => {
                                    const has = owned(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--radius-sm)] border-2 px-1.5 py-1 ${wide ? 'max-w-[170px]' : ''} ${has ? 'bg-panel' : 'border-dashed bg-black/20'}`}
                                            style={{ borderColor: has ? rarityColor(p.rarity) : 'var(--color-edge)' }}
                                            title={has ? p.name : 'Not found yet'}
                                        >
                                            <PartIcon id={p.id} size={wide ? 36 : 32} locked={!has} />
                                            <span className={`t-caption min-w-0 leading-tight ${has ? '' : 'text-muted'}`}>{has ? p.name : '???'}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={`flex justify-end ${wide ? '' : 'col-start-2 row-start-1'}`}>
                                {claimed ? (
                                    <span className="t-caption flex items-center gap-1 text-primary">
                                        <Icon name="check" size={16} /> Egg claimed
                                    </span>
                                ) : complete ? (
                                    <button type="button" className="btn btn-primary px-3" onClick={() => claimFamilyEgg(f)}>
                                        <span className="t-button">CLAIM EGG</span>
                                    </button>
                                ) : (
                                    <span className="t-caption text-muted">
                                        {parts.length - count} to go
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Sheet>
    );
}
