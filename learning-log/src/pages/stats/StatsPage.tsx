import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/app/settings-context';
import { checkInRepo, tagRepo } from '@/data/repository';
import type { CheckInSummary, Tag } from '@/data/types';
import {
  addDays,
  diffDays,
  endOfMonth,
  formatYearMonth,
  rangeDays,
  shiftMonth,
  startOfMonth,
  todayStr,
} from '@/lib/date';
import {
  buildDaySeries,
  percentBreakdown,
  resolveRange,
  type RangeKey,
} from '@/lib/stats';
import { LineChart, type LinePoint } from '@/components/charts/LineChart';
import { DonutChart, type DonutSlice } from '@/components/charts/DonutChart';
import { MonthHeatmap } from '@/components/charts/MonthHeatmap';
import { EmptyState } from '@/components/EmptyState';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Link } from 'react-router-dom';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: '30d', label: '近 30 天' },
  { key: 'year', label: '本年' },
];

const UNCATEGORIZED_COLOR = '#94A3B8';
const OTHER_COLOR = '#CBD5E1';

function toShort(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

/** 区间较长时按周、再长时按月聚合，避免折线点过密 */
function buildSeries(summary: CheckInSummary, from: string, to: string): LinePoint[] {
  const days = diffDays(from, to) + 1;

  if (days <= 31) {
    return buildDaySeries(summary.byDay, from, to).map((p) => ({
      label: toShort(p.date),
      value: p.min,
      title: p.date,
    }));
  }

  if (days <= 120) {
    const points: LinePoint[] = [];
    let cursor = from;
    while (cursor <= to) {
      const rawEnd = addDays(cursor, 6);
      const end = rawEnd > to ? to : rawEnd;
      let sum = 0;
      for (const d of rangeDays(cursor, end)) sum += summary.byDay[d] ?? 0;
      points.push({ label: toShort(cursor), value: sum, title: `${cursor} ~ ${end}` });
      cursor = addDays(end, 1);
    }
    return points;
  }

  const points: LinePoint[] = [];
  let cursor = startOfMonth(from);
  while (cursor <= to) {
    const start = cursor < from ? from : cursor;
    const rawEnd = endOfMonth(cursor);
    const end = rawEnd > to ? to : rawEnd;
    let sum = 0;
    for (const d of rangeDays(start, end)) sum += summary.byDay[d] ?? 0;
    points.push({
      label: `${Number(cursor.slice(5, 7))}月`,
      value: sum,
      title: formatYearMonth(cursor),
    });
    cursor = shiftMonth(cursor, 1);
  }
  return points;
}

export function StatsPage() {
  const { settings } = useSettings();
  const today = todayStr();

  const [rangeKey, setRangeKey] = useState<RangeKey>('month');
  const [rangeSummary, setRangeSummary] = useState<CheckInSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<CheckInSummary | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(today));
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () => resolveRange(rangeKey, today, settings.weekStartsOn),
    [rangeKey, today, settings.weekStartsOn],
  );

  useEffect(() => {
    tagRepo.listTags().then(setTags);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const [ranged, monthly] = await Promise.all([
        checkInRepo.summarize(range.from, range.to),
        checkInRepo.summarize(startOfMonth(monthCursor), endOfMonth(monthCursor)),
      ]);
      if (!alive) return;
      setRangeSummary(ranged);
      setMonthSummary(monthly);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range.from, range.to, monthCursor]);

  const series = useMemo(
    () => (rangeSummary ? buildSeries(rangeSummary, range.from, range.to) : []),
    [rangeSummary, range.from, range.to],
  );

  const slices = useMemo<DonutSlice[]>(() => {
    if (!rangeSummary) return [];
    const shares = percentBreakdown(rangeSummary.byTag).sort((a, b) => b.min - a.min);
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const top = shares.slice(0, 8).map((s) => {
      const tag = tagById.get(s.id);
      return {
        id: s.id,
        label: tag?.name ?? '未分类',
        value: s.min,
        percent: s.percent,
        color: tag?.color ?? UNCATEGORIZED_COLOR,
      };
    });
    const rest = shares.slice(8);
    if (rest.length > 0) {
      const restMin = rest.reduce((sum, s) => sum + s.min, 0);
      const restPercent = Math.max(
        0,
        100 - top.reduce((sum, s) => sum + s.percent, 0),
      );
      top.push({
        id: '__other__',
        label: '其他',
        value: restMin,
        percent: restPercent,
        color: OTHER_COLOR,
      });
    }
    return top;
  }, [rangeSummary, tags]);

  const stats = useMemo(() => {
    const totalMin = rangeSummary?.totalMin ?? 0;
    const activeDays = rangeSummary?.days ?? 0;
    return {
      totalMin,
      activeDays,
      avgMin: range.days > 0 ? Math.round(totalMin / range.days) : 0,
      attendance: range.days > 0 ? Math.round((activeDays / range.days) * 100) : 0,
    };
  }, [rangeSummary, range.days]);

  const monthTitle = formatYearMonth(monthCursor);
  const canGoNext = monthCursor < startOfMonth(today);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">统计</h1>
          <p className="page-subtitle">{range.from} 至 {range.to}</p>
        </div>
        <div className="chip-row">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`chip${rangeKey === opt.key ? ' active' : ''}`}
              onClick={() => setRangeKey(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !rangeSummary ? (
        <div className="card" style={{ height: 260 }} aria-busy="true" />
      ) : rangeSummary.count === 0 ? (
        <EmptyState
          title="该区间还没有打卡记录"
          description="攒够几条打卡后，这里会长出折线、占比和热力图。"
          action={
            <Link to="/checkin/new" className="btn btn-primary">
              新建打卡
            </Link>
          }
        />
      ) : (
        <>
          <div className="meta-row">
            <div className="meta-item">
              <div className="meta-label">总时长</div>
              <div className="meta-value">
                {Math.round(stats.totalMin)} 分钟
              </div>
            </div>
            <div className="meta-item">
              <div className="meta-label">日均</div>
              <div className="meta-value">{stats.avgMin} 分钟</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">打卡天数</div>
              <div className="meta-value">{stats.activeDays} 天</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">出勤率</div>
              <div className="meta-value">{stats.attendance}%</div>
            </div>
          </div>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">时长趋势</h2>
              <span className="section-link">
                {diffDays(range.from, range.to) + 1 <= 31
                  ? '按日'
                  : diffDays(range.from, range.to) + 1 <= 120
                    ? '按周'
                    : '按月'}
              </span>
            </div>
            <div className="card">
              <LineChart data={series} height={220} />
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">标签时间占比</h2>
              <span className="section-link">多标签按时长均分</span>
            </div>
            <div className="card">
              <div className="share-layout">
                <DonutChart
                  slices={slices}
                  centerValue={`${Math.round(stats.totalMin)}`}
                  centerLabel="分钟"
                />
                <div className="legend-list">
                  {slices.map((slice) => (
                    <div key={slice.id} className="legend-row">
                      <span className="tag-dot" style={{ background: slice.color }} />
                      <span className="legend-name">{slice.label}</span>
                      <span className="legend-bar">
                        <i
                          style={{
                            width: `${slice.percent}%`,
                            background: slice.color,
                          }}
                        />
                      </span>
                      <span className="legend-value">
                        {Math.round(slice.value)} 分钟 · {slice.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">打卡热力</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  aria-label="上一个月"
                  onClick={() => setMonthCursor((m) => shiftMonth(m, -1))}
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{monthTitle}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  aria-label="下一个月"
                  disabled={!canGoNext}
                  onClick={() => setMonthCursor((m) => shiftMonth(m, 1))}
                >
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </div>
            <div className="card">
              {monthSummary ? (
                <MonthHeatmap
                  month={monthCursor}
                  byDay={monthSummary.byDay}
                  weekStartsOn={settings.weekStartsOn}
                  today={today}
                />
              ) : null}
              <div className="heatmap-legend">
                <span>少</span>
                <span className="legend-swatch" data-level="0" />
                <span className="legend-swatch" data-level="1" />
                <span className="legend-swatch" data-level="2" />
                <span className="legend-swatch" data-level="3" />
                <span className="legend-swatch" data-level="4" />
                <span>多</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}