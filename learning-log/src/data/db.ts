import Dexie, { type Table } from 'dexie';
import type {
  Attachment,
  CheckIn,
  Draft,
  ID,
  Note,
  Settings,
  Tag,
  Template,
  TimeSession,
} from './types';

export class AppDB extends Dexie {
  tags!: Table<Tag, ID>;
  checkIns!: Table<CheckIn, ID>;
  notes!: Table<Note, ID>;
  attachments!: Table<Attachment, ID>;
  templates!: Table<Template, ID>;
  drafts!: Table<Draft, ID>;
  sessions!: Table<TimeSession, ID>;
  settings!: Table<Settings, ID>;

  constructor() {
    super('learning-log');
    this.version(1).stores({
      tags: 'id, name, deletedAt',
      checkIns: 'id, date, [date+createdAt], createdAt, deletedAt, *tagIds',
      notes: 'id, updatedAt, deletedAt, checkInId, *tagIds',
      attachments: 'id, createdAt',
      templates: 'id, name',
      drafts: 'id, kind',
      sessions: 'id',
      settings: 'id',
    });
  }
}

export const db = new AppDB();

/** 申请持久化存储，降低被浏览器回收的概率 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}