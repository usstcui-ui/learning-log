import { db } from './db';
import type { CheckIn, ID, Tag } from './types';

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 多标签用 | 分隔，便于人读 */
export function checkInsToCsv(items: CheckIn[], tags: Tag[]): string {
  const nameById = new Map(tags.map((t) => [t.id, t.name]));
  const header = [
    '日期',
    '创建时间',
    '时长(分钟)',
    '标签',
    '学习内容',
    '收获',
    '疑问',
    '下一步',
    '图片数',
  ];
  const rows = items.map((c) =>
    [
      c.date,
      c.createdAt,
      c.durationMin,
      c.tagIds.map((id) => nameById.get(id) ?? '已删除标签').join('|'),
      c.content,
      c.gain,
      c.question,
      c.nextPlan,
      c.attachmentIds.length,
    ]
      .map(csvCell)
      .join(','),
  );
  // BOM 必须有，否则 Excel 打开中文乱码
  return `\uFEFF${header.join(',')}\n${rows.join('\n')}`;
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface JsonExport {
  app: 'learning-log';
  version: 1;
  exportedAt: string;
  data: {
    tags: Tag[];
    checkIns: CheckIn[];
    notes: unknown[];
    templates: unknown[];
    settings: unknown;
    attachments: unknown[];
  };
}

export async function buildJsonExport(): Promise<JsonExport> {
  const [tags, checkIns, notes, templates, settings] = await Promise.all([
    db.tags.toArray(),
    db.checkIns.toArray(),
    db.notes.toArray(),
    db.templates.toArray(),
    db.settings.get('app'),
  ]);
  return {
    app: 'learning-log',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      tags,
      checkIns: checkIns.filter((c) => c.deletedAt == null),
      notes,
      templates,
      settings,
      attachments: [],
    },
  };
}

export function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function countTagUsage(items: CheckIn[], tagId: ID): number {
  return items.filter((c) => c.tagIds.includes(tagId)).length;
}