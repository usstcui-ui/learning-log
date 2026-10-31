import { db } from '../db';
import type { ID, Tag } from '../types';

export const TAG_PALETTE = [
  '#4F46E5',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
] as const;

const DEFAULT_TAGS = ['算法', '英语', '读书'];

function now(): string {
  return new Date().toISOString();
}

function pickColor(count: number): string {
  return TAG_PALETTE[count % TAG_PALETTE.length];
}

export async function listTags(): Promise<Tag[]> {
  const all = await db.tags.toArray();
  return all
    .filter((t) => t.deletedAt == null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getTag(id: ID): Promise<Tag | undefined> {
  return db.tags.get(id);
}

export async function findTagByName(name: string): Promise<Tag | undefined> {
  const trimmed = name.trim().toLowerCase();
  const all = await db.tags.toArray();
  return all.find((t) => t.deletedAt == null && t.name.trim().toLowerCase() === trimmed);
}

export async function createTag(name: string, color?: string): Promise<Tag> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('标签名不能为空');
  if (trimmed.length > 12) throw new Error('标签名最多 12 个字');

  const existing = await findTagByName(trimmed);
  if (existing) throw new Error('标签名已存在');

  const count = (await db.tags.toArray()).length;
  const tag: Tag = {
    id: crypto.randomUUID(),
    name: trimmed,
    color: color ?? pickColor(count),
    createdAt: now(),
    deletedAt: null,
  };
  await db.tags.add(tag);
  return tag;
}

export async function updateTag(
  id: ID,
  patch: Partial<Pick<Tag, 'name' | 'color'>>,
): Promise<void> {
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length === 0) throw new Error('标签名不能为空');
    if (trimmed.length > 12) throw new Error('标签名最多 12 个字');
    const duplicate = await findTagByName(trimmed);
    if (duplicate && duplicate.id !== id) throw new Error('标签名已存在');
    patch = { ...patch, name: trimmed };
  }
  await db.tags.update(id, patch);
}

/** 软删除：打卡里的 tagId 保留，展示为“已删除标签” */
export async function softDeleteTag(id: ID): Promise<void> {
  await db.tags.update(id, { deletedAt: now() });
}

export async function countCheckInsByTag(id: ID): Promise<number> {
  const items = await db.checkIns.where('tagIds').equals(id).toArray();
  return items.filter((c) => c.deletedAt == null).length;
}

/** 首次使用时写入几个默认标签，避免第一次打卡就被“先去建标签”挡住 */
export async function ensureSeedTags(): Promise<void> {
  const count = await db.tags.count();
  if (count > 0) return;
  await db.tags.bulkAdd(
    DEFAULT_TAGS.map((name, i) => ({
      id: crypto.randomUUID(),
      name,
      color: pickColor(i),
      createdAt: now(),
      deletedAt: null,
    })),
  );
}