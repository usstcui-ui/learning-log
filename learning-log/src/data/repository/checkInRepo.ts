import { db } from '../db';
import type {
  CheckIn,
  CheckInQuery,
  CheckInSummary,
  DateStr,
  ID,
  NewCheckInInput,
} from '../types';

function now(): string {
  return new Date().toISOString();
}

function sortDesc(a: CheckIn, b: CheckIn): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

async function loadRange(from?: DateStr, to?: DateStr): Promise<CheckIn[]> {
  let items: CheckIn[];
  if (from && to) {
    items = await db.checkIns.where('date').between(from, to, true, true).toArray();
  } else {
    items = await db.checkIns.toArray();
  }
  return items.filter((c) => c.deletedAt == null);
}

export interface ListResult {
  items: CheckIn[];
  hasMore: boolean;
  total: number;
}

export async function listCheckIns(query: CheckInQuery = {}): Promise<ListResult> {
  const { from, to, tagIds, keyword, limit = 20, offset = 0 } = query;
  let items = await loadRange(from, to);

  if (tagIds && tagIds.length > 0) {
    const wanted = new Set(tagIds);
    items = items.filter((c) => c.tagIds.some((id) => wanted.has(id)));
  }

  const kw = keyword?.trim().toLowerCase();
  if (kw) {
    const tags = await db.tags.toArray();
    const matchedTagIds = new Set(
      tags.filter((t) => t.deletedAt == null && t.name.toLowerCase().includes(kw)).map((t) => t.id),
    );
    items = items.filter(
      (c) =>
        c.content.toLowerCase().includes(kw) ||
        c.gain.toLowerCase().includes(kw) ||
        c.question.toLowerCase().includes(kw) ||
        c.nextPlan.toLowerCase().includes(kw) ||
        c.tagIds.some((id) => matchedTagIds.has(id)),
    );
  }

  items.sort(sortDesc);
  const total = items.length;
  const page = items.slice(offset, offset + limit);
  return { items: page, hasMore: offset + page.length < total, total };
}

export async function getCheckIn(id: ID): Promise<CheckIn | undefined> {
  return db.checkIns.get(id);
}

export async function createCheckIn(input: NewCheckInInput): Promise<CheckIn> {
  const ts = now();
  const item: CheckIn = {
    id: crypto.randomUUID(),
    date: input.date,
    tagIds: input.tagIds,
    durationMin: input.durationMin,
    content: input.content,
    gain: input.gain ?? '',
    question: input.question ?? '',
    nextPlan: input.nextPlan ?? '',
    attachmentIds: input.attachmentIds ?? [],
    noteId: null,
    templateId: input.templateId ?? null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await db.checkIns.add(item);
  return item;
}

export async function updateCheckIn(
  id: ID,
  patch: Partial<Omit<CheckIn, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.checkIns.update(id, { ...patch, updatedAt: now() });
}

export async function softDeleteCheckIn(id: ID): Promise<void> {
  await db.checkIns.update(id, { deletedAt: now(), updatedAt: now() });
}

export async function restoreCheckIn(id: ID): Promise<void> {
  await db.checkIns.update(id, { deletedAt: null, updatedAt: now() });
}

/** 指定区间内的统计，全部由打卡派生，不存任何累加值 */
export async function summarize(from: DateStr, to: DateStr): Promise<CheckInSummary> {
  const items = await loadRange(from, to);
  const byDay: Record<DateStr, number> = {};
  const byTag: Record<ID, number> = {};
  let totalMin = 0;

  for (const c of items) {
    totalMin += c.durationMin;
    byDay[c.date] = (byDay[c.date] ?? 0) + c.durationMin;
    const tagCount = c.tagIds.length;
    if (tagCount === 0) {
      byTag.__uncategorized__ = (byTag.__uncategorized__ ?? 0) + c.durationMin;
    } else {
      const share = c.durationMin / tagCount;
      for (const id of c.tagIds) {
        byTag[id] = (byTag[id] ?? 0) + share;
      }
    }
  }

  return {
    totalMin,
    count: items.length,
    days: Object.keys(byDay).length,
    byDay,
    byTag,
  };
}

/** 有打卡的所有日期，用于连续天数与热力图 */
export async function listActiveDates(): Promise<Set<DateStr>> {
  const items = await db.checkIns.toArray();
  return new Set(items.filter((c) => c.deletedAt == null).map((c) => c.date));
}

export async function listAllForExport(): Promise<CheckIn[]> {
  const items = await db.checkIns.toArray();
  return items.filter((c) => c.deletedAt == null).sort(sortDesc);
}