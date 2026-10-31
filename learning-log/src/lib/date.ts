import type { DateStr } from '../data/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** 用 UTC 归一化到“日序号”，避开夏令时导致的 23/25 小时问题 */
function dayIndex(s: DateStr): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function fromDayIndex(n: number): DateStr {
  const dt = new Date(n * 86_400_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(): DateStr {
  return toDateStr(new Date());
}

export function addDays(s: DateStr, n: number): DateStr {
  return fromDayIndex(dayIndex(s) + n);
}

export function diffDays(from: DateStr, to: DateStr): number {
  return dayIndex(to) - dayIndex(from);
}

export function rangeDays(from: DateStr, to: DateStr): DateStr[] {
  const start = dayIndex(from);
  const end = dayIndex(to);
  if (end < start) return [];
  const out: DateStr[] = [];
  for (let i = start; i <= end; i++) out.push(fromDayIndex(i));
  return out;
}

export function startOfMonth(s: DateStr): DateStr {
  const [y, m] = s.split('-').map(Number);
  return `${y}-${pad(m)}-01`;
}

export function endOfMonth(s: DateStr): DateStr {
  const [y, m] = s.split('-').map(Number);
  return fromDayIndex(dayIndex(`${y}-${pad(m)}-01`) + new Date(Date.UTC(y, m, 0)).getUTCDate() - 1);
}

export function shiftMonth(s: DateStr, delta: number): DateStr {
  const [y, m] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayCN(s: DateStr, short = false): string {
  const idx = parseDateStr(s).getDay();
  return short ? WEEKDAYS_SHORT[idx] : WEEKDAYS[idx];
}

/** 0 = 周日 … 6 = 周六 */
export function weekdayIndex(s: DateStr): number {
  return parseDateStr(s).getDay();
}

export function formatMonthDay(s: DateStr): string {
  const [, m, d] = s.split('-').map(Number);
  return `${m}月${d}日`;
}

export function formatDateCN(s: DateStr): string {
  return `${formatMonthDay(s)} ${weekdayCN(s)}`;
}

export function formatYearMonth(s: DateStr): string {
  const [y, m] = s.split('-').map(Number);
  return `${y}年${m}月`;
}

export function formatDuration(min: number): string {
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded} 分钟`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分钟`;
}

/** 紧凑形式：45m / 1h15m，用于图表与徽标 */
export function formatDurationCompact(min: number): string {
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const deltaSec = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (deltaSec < 10) return '刚刚';
  if (deltaSec < 60) return `${deltaSec} 秒前`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin} 分钟前`;
  const deltaHour = Math.floor(deltaMin / 60);
  if (deltaHour < 24) return `${deltaHour} 小时前`;
  const deltaDay = Math.floor(deltaHour / 24);
  if (deltaDay === 1) return '昨天';
  if (deltaDay < 7) return `${deltaDay} 天前`;
  const d = new Date(then);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}