export type ID = string;
/** 本地日历日，格式 YYYY-MM-DD，不带时区 */
export type DateStr = string;
/** ISO 8601 带时区偏移的时间戳 */
export type ISODateTime = string;

export interface Tag {
  id: ID;
  name: string;
  color: string;
  createdAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

export interface CheckIn {
  id: ID;
  date: DateStr;
  tagIds: ID[];
  durationMin: number;
  content: string;
  gain: string;
  question: string;
  nextPlan: string;
  attachmentIds: ID[];
  noteId: ID | null;
  templateId: ID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

export interface Note {
  id: ID;
  title: string;
  body: string;
  tagIds: ID[];
  checkInId: ID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

export interface Attachment {
  id: ID;
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  size: number;
  createdAt: ISODateTime;
}

export interface Template {
  id: ID;
  name: string;
  builtin: boolean;
  content: string;
  gain: string;
  question: string;
  nextPlan: string;
}

export interface Draft {
  id: ID;
  kind: 'checkin' | 'note';
  payload: string;
  updatedAt: ISODateTime;
}

export interface TimeSession {
  id: 'current';
  mode: 'stopwatch' | 'countdown';
  targetMs: number;
  accumulatedMs: number;
  runningSince: ISODateTime | null;
  tagIds: ID[];
  memo: string;
  startedAt: ISODateTime;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  id: 'app';
  theme: ThemeMode;
  weekStartsOn: 1 | 0;
  dailyGoalMin: number;
  lastExportAt: ISODateTime | null;
  updatedAt: ISODateTime;
}

export interface NewCheckInInput {
  date: DateStr;
  tagIds: ID[];
  durationMin: number;
  content: string;
  gain?: string;
  question?: string;
  nextPlan?: string;
  attachmentIds?: ID[];
  templateId?: ID | null;
}

export interface CheckInQuery {
  from?: DateStr;
  to?: DateStr;
  tagIds?: ID[];
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface CheckInSummary {
  totalMin: number;
  count: number;
  days: number;
  byDay: Record<DateStr, number>;
  byTag: Record<ID, number>;
}

export interface NoteQuery {
  keyword?: string;
  tagIds?: ID[];
  limit?: number;
  offset?: number;
}

export interface NoteSummaryPage {
  items: Note[];
  hasMore: boolean;
  total: number;
}