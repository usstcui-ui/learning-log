import { db } from '../db';
import type { Draft, ID } from '../types';

export function draftId(kind: 'checkin' | 'note', targetId?: ID | null): ID {
  return targetId ? `${kind}:${targetId}` : `${kind}:new`;
}

export async function getDraft(id: ID): Promise<Draft | undefined> {
  return db.drafts.get(id);
}

export async function saveDraft(
  id: ID,
  kind: 'checkin' | 'note',
  payload: unknown,
): Promise<void> {
  const record: Draft = {
    id,
    kind,
    payload: JSON.stringify(payload),
    updatedAt: new Date().toISOString(),
  };
  await db.drafts.put(record);
}

export async function deleteDraft(id: ID): Promise<void> {
  await db.drafts.delete(id);
}

/** 读取草稿；解析失败说明是旧版本结构，直接丢弃，不阻断编辑 */
export async function readDraftPayload<T>(id: ID): Promise<T | null> {
  const draft = await db.drafts.get(id);
  if (!draft) return null;
  try {
    return JSON.parse(draft.payload) as T;
  } catch {
    await db.drafts.delete(id);
    return null;
  }
}