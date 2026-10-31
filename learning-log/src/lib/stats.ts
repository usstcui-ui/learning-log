import type { DateStr, ID } from '../data/types';
import { addDays, diffDays, rangeDays, startOfMonth, weekdayIndex } from './date';

export interface StreakInfo {
  current: number;
  includingToday: boolean;
  lastDate: DateStr | null;
  /** 距上次打卡过了多少天（今天打卡为 0） */
  gapDays: number | null;
}

/**
 * 连续打卡天数。
 * 关键规则：昨天有打卡、今天还没打卡时，连续数保持，不归零。
 */
export function calcStreak(activeDates: Set<DateStr>, today: DateStr): StreakInfo {
  const sorted = [...activeDates].filter((d) => d <= today).sort();
  if (sorted.length === 0) {
    return { current: 0, includingToday: false, lastDate: null, gapDays: null };
  }
  const last = sorted[sorted.length - 1];
  const gap = diffDays(last, today);
  if (gap > 1) {
    return { current: 0, includingToday: false, lastDate: last, gapDays: gap };
  }
  let current = 0;
  let cursor = last;
  while (activeDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, includingToday: gap === 0, lastDate: last, gapDays: gap };
}

/** 热力图 5 档：0 无记录，1: 1–29，2: 30–59，3: 60–119，4: ≥120 分钟 */
export function levelByMinutes(min: number): 0 | 1 | 2 | 3 | 4 {
  if (min <= 0) return 0;
  if (min < 30) return 1;
  if (min < 60) return 2;
  if (min < 120) return 3;
  return 4;
}

export interface DayPoint {
  date: DateStr;
  min: number;
}

/** 折线图数据：无记录的日期补 0，保证曲线连续 */
export function buildDaySeries(
  byDay: Record<DateStr, number>,
  from: DateStr,
  to: DateStr,
): DayPoint[] {
  return rangeDays(from, to).map((date) => ({ date, min: byDay[date] ?? 0 }));
}

export interface TagShare {
  id: ID;
  min: number;
  percent: number;
}

/**
 * 按占比拆分，使用最大余数法，保证 percent 合计恰好 100。
 * 输入 byTag 已按“多标签均分”得到。
 */
export function percentBreakdown(byTag: Record<ID, number>): TagShare[] {
  const entries = Object.entries(byTag).filter(([, min]) => min > 0);
  const total = entries.reduce((sum, [, min]) => sum + min, 0);
  if (total <= 0) return [];

  const withRaw = entries.map(([id, min]) => {
    const raw = (min / total) * 100;
    return { id, min, raw, percent: Math.floor(raw), rest: raw - Math.floor(raw) };
  });

  let left = 100 - withRaw.reduce((sum, e) => sum + e.percent, 0);
  const order = [...withRaw].sort((a, b) => b.rest - a.rest);
  for (let i = 0; i < order.length && left > 0; i++) {
    order[i].percent += 1;
    left -= 1;
  }

  return withRaw.map(({ id, min, percent }) => ({ id, min, percent }));
}

export function sumMinutes(byDay: Record<DateStr, number>): number {
  return Object.values(byDay).reduce((a, b) => a + b, 0);
}

export function longestStreak(activeDates: Set<DateStr>): number {
  const sorted = [...activeDates].sort();
  let best = 0;
  let run = 0;
  let prev: DateStr | null = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export type RangeKey = 'week' | 'month' | '30d' | 'year';

export interface DateRange {
  from: DateStr;
  to: DateStr;
  days: number;
}

/** 统计区间：本周 / 本月 / 近 30 天 / 本年，均以今天为右端点 */
export function resolveRange(
  key: RangeKey,
  today: DateStr,
  weekStartsOn: 0 | 1,
): DateRange {
  let from: DateStr;
  if (key === 'week') {
    const idx = weekdayIndex(today);
    const back = weekStartsOn === 1 ? (idx + 6) % 7 : idx;
    from = addDays(today, -back);
  } else if (key === 'month') {
    from = startOfMonth(today);
  } else if (key === '30d') {
    from = addDays(today, -29);
  } else {
    from = `${today.slice(0, 4)}-01-01`;
  }
  return { from, to: today, days: diffDays(from, today) + 1 };
}