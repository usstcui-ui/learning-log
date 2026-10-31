import { db } from '../db';
import type { ID, Note, NoteQuery, NoteSummaryPage } from '../types';

function now(): string {
  return new Date().toISOString();
}

function sortByUpdatedDesc(a: Note, b: Note): number {
  return a.updatedAt < b.updatedAt ? 1 : -1;
}

export async function listNotes(query: NoteQuery = {}): Promise<NoteSummaryPage> {
  const { keyword, tagIds, limit = 20, offset = 0 } = query;
  let items = (await db.notes.toArray()).filter((n) => n.deletedAt == null);

  if (tagIds && tagIds.length > 0) {
    const wanted = new Set(tagIds);
    items = items.filter((n) => n.tagIds.some((id) => wanted.has(id)));
  }

  const kw = keyword?.trim().toLowerCase();
  if (kw) {
    items = items.filter(
      (n) => n.title.toLowerCase().includes(kw) || n.body.toLowerCase().includes(kw),
    );
  }

  items.sort(sortByUpdatedDesc);
  const total = items.length;
  const page = items.slice(offset, offset + limit);
  return { items: page, hasMore: offset + page.length < total, total };
}

export async function getNote(id: ID): Promise<Note | undefined> {
  return db.notes.get(id);
}

export async function listNotesForCheckIn(checkInId: ID): Promise<Note[]> {
  const items = await db.notes.where('checkInId').equals(checkInId).toArray();
  return items.filter((n) => n.deletedAt == null).sort(sortByUpdatedDesc);
}

export interface NewNoteInput {
  title: string;
  body: string;
  tagIds: string[];
  checkInId: string | null;
}

export async function createNote(input: NewNoteInput): Promise<Note> {
  const ts = now();
  const note: Note = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    body: input.body,
    tagIds: input.tagIds,
    checkInId: input.checkInId,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
  await db.notes.add(note);
  return note;
}

export async function updateNote(
  id: ID,
  patch: Partial<Pick<Note, 'title' | 'body' | 'tagIds' | 'checkInId'>>,
): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: now() });
}

export async function softDeleteNote(id: ID): Promise<void> {
  await db.notes.update(id, { deletedAt: now(), updatedAt: now() });
}

export async function restoreNote(id: ID): Promise<void> {
  await db.notes.update(id, { deletedAt: null, updatedAt: now() });
}

export async function countNotes(): Promise<number> {
  return (await db.notes.toArray()).filter((n) => n.deletedAt == null).length;
}