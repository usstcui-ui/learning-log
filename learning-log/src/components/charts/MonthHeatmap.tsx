import { useMemo } from 'react';
import type { DateStr } from '@/data/types';
import { addDays, diffDays, endOfMonth, formatMonthDay, weekdayIndex } from '@/lib/date';
import { levelByMinutes } from '@/lib/stats';

interface MonthHeatmapProps {
  month: DateStr;
  byDay: Record<DateStr, number>;
  weekStartsOn: 0 | 1;
  today: DateStr;
}

const WEEK_LABELS_MONDAY = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_LABELS_SUNDAY = ['日', '一', '二', '三', '四', '五', '六'];

export function MonthHeatmap({ month, byDay, weekStartsOn, today }: MonthHeatmapProps) {
  const { cells, labels } = useMemo(() => {
    const firstIndex = weekdayIndex(month);
    const offset = weekStartsOn === 1 ? (firstIndex + 6) % 7 : firstIndex;
    const daysInMonth = diffDays(month, addDays(endOfMonth(month), 1));
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    const result: { date: DateStr | null; day: number | null }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const day = i - offset + 1;
      if (day < 1 || day > daysInMonth) {
        result.push({ date: null, day: null });
      } else {
        result.push({ date: addDays(month, day - 1), day });
      }
    }
    return {
      cells: result,
      labels: weekStartsOn === 1 ? WEEK_LABELS_MONDAY : WEEK_LABELS_SUNDAY,
    };
  }, [month, weekStartsOn]);

  return (
    <div className="month-heat">
      <div className="mh-weekdays">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mh-grid">
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={`empty-${i}`} className="mh-cell empty" />;
          const min = byDay[cell.date] ?? 0;
          const future = cell.date > today;
          return (
            <div
              key={cell.date}
              className={`mh-cell${future ? ' future' : ''}`}
              data-level={future ? 0 : levelByMinutes(min)}
              title={`${formatMonthDay(cell.date)} · ${min > 0 ? `${min} 分钟` : '没有记录'}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}