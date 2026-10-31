import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/app/settings-context';
import { checkInRepo, tagRepo } from '@/data/repository';
import type { CheckIn, CheckInSummary, Tag } from '@/data/types';
import {
  addDays,
  formatDateCN,
  formatDuration,
  startOfMonth,
  todayStr,
  weekdayIndex,
} from '@/lib/date';
import { calcStreak, levelByMinutes, longestStreak } from '@/lib/stats';
import { CheckInCard } from '@/components/CheckInCard';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import {
  ChartIcon,
  ClockIcon,
  NoteIcon,
  PlusIcon,
} from '@/components/icons';

const HEAT_WEEKS = 26;

function durationParts(min: number): { value: string; unit: string } {
  if (min < 60) return { value: String(Math.round(min)), unit: '分钟' };
  return { value: (min / 60).toFixed(1), unit: '小时' };
}

export function DashboardPage() {
  const { settings } = useSettings();
  const { push } = useToast();
  const today = todayStr();

  const [tags, setTags] = useState<Tag[]>([]);
  const [summary, setSummary] = useState<CheckInSummary | null>(null);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<CheckIn[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [tagList, all, dates, recentRes, todayRes] = await Promise.all([
        tagRepo.listTags(),
        checkInRepo.summarize('2000-01-01', today),
        checkInRepo.listActiveDates(),
        checkInRepo.listCheckIns({ limit: 5 }),
        checkInRepo.listCheckIns({ from: today, to: today, limit: 1 }),
      ]);
      if (!alive) return;
      setTags(tagList);
      setSummary(all);
      setActiveDates(dates);
      setRecent(recentRes.items);
      setTodayCount(todayRes.total);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [today]);

  const stats = useMemo(() => {
    const goal = Math.max(1, settings.dailyGoalMin);
    const todayMin = summary?.byDay[today] ?? 0;
    const monthStart = startOfMonth(today);
    let monthMin = 0;
    let monthDays = 0;
    if (summary) {
      for (const [date, min] of Object.entries(summary.byDay)) {
        if (date >= monthStart && date <= today) {
          monthMin += min;
          monthDays += 1;
        }
      }
    }
    return {
      todayMin,
      todayCount,
      goalPercent: Math.min(100, Math.round((todayMin / goal) * 100)),
      totalMin: summary?.totalMin ?? 0,
      monthMin,
      monthDays,
      streak: calcStreak(activeDates, today),
      longest: longestStreak(activeDates),
    };
  }, [summary, activeDates, today, settings.dailyGoalMin, todayCount]);

  const heatCells = useMemo(() => {
    const mondayOffset = (weekdayIndex(today) + 6) % 7;
    const start = addDays(today, -mondayOffset - (HEAT_WEEKS - 1) * 7);
    const cells: { date: string; min: number }[] = [];
    for (let w = 0; w < HEAT_WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        cells.push({ date, min: summary?.byDay[date] ?? 0 });
      }
    }
    return cells;
  }, [today, summary]);

  const streakText = stats.streak.includingToday
    ? `连续打卡 ${stats.streak.current} 天`
    : stats.streak.current > 0
      ? `连续打卡 ${stats.streak.current} 天 · 今天待打卡`
      : stats.streak.lastDate
        ? `重新开始：上次是 ${stats.streak.gapDays} 天前`
        : '从今天开始记录';

  const todayDuration = durationParts(stats.todayMin);
  const totalDuration = durationParts(stats.totalMin);
  const monthDuration = durationParts(stats.monthMin);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{formatDateCN(today)}</h1>
          <div className="today-line">
            <span className={`streak-badge${stats.streak.current > 0 ? '' : ' idle'}`}>
              {streakText}
            </span>
            {settings.dailyGoalMin > 0 ? <span>每日目标 {settings.dailyGoalMin} 分钟</span> : null}
          </div>
        </div>
        <div className="page-actions">
          <Link to="/checkins" className="btn">
            查看记录
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ height: 220 }} aria-busy="true" />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">今日时长</div>
              <div className="stat-value">
                {todayDuration.value}
                <small>{todayDuration.unit}</small>
              </div>
              <div className="stat-hint">
                {stats.todayMin === 0 ? '今天还没有打卡' : `目标完成 ${stats.goalPercent}%`}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">今日达标</div>
              <div className="stat-value">
                {stats.goalPercent}
                <small>%</small>
              </div>
              <div className="stat-hint">目标 {settings.dailyGoalMin} 分钟</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">今日记录</div>
              <div className="stat-value">
                {stats.todayCount}
                <small>条</small>
              </div>
              <div className="stat-hint">{stats.todayCount === 0 ? '动手记一笔吧' : '保持这个节奏'}</div>
            </div>
          </div>

          <div className="quick-actions">
            <Link to="/checkin/new" className="btn btn-primary">
              <PlusIcon size={16} />
              新建打卡
            </Link>
            <Link to="/notes" className="btn">
              <NoteIcon size={16} />
              写笔记
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => push('计时器排在下个版本（M3）上线')}
            >
              <ClockIcon size={16} />
              开始计时
            </button>
          </div>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">学习热力</h2>
              <span className="section-link">最近 {HEAT_WEEKS} 周</span>
            </div>
            <div className="card">
              <div className="heatmap-wrap">
                <div className="heatmap" role="img" aria-label={`最近 ${HEAT_WEEKS} 周每天的学习时长`}>
                  {heatCells.map((cell) =>
                    cell.date > today ? (
                      <div key={cell.date} className="heat-cell" style={{ opacity: 0.3 }} />
                    ) : (
                      <div
                        key={cell.date}
                        className="heat-cell"
                        data-level={levelByMinutes(cell.min)}
                        title={`${formatDateCN(cell.date)} · ${
                          cell.min > 0 ? formatDuration(cell.min) : '没有记录'
                        }`}
                      />
                    ),
                  )}
                </div>
              </div>
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

          <section className="section">
            <div className="meta-row">
              <div className="meta-item">
                <div className="meta-label">累计时长</div>
                <div className="meta-value">
                  {totalDuration.value} {totalDuration.unit}
                </div>
              </div>
              <div className="meta-item">
                <div className="meta-label">本月时长</div>
                <div className="meta-value">
                  {monthDuration.value} {monthDuration.unit}
                </div>
              </div>
              <div className="meta-item">
                <div className="meta-label">本月打卡</div>
                <div className="meta-value">{stats.monthDays} 天</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">最长连续</div>
                <div className="meta-value">{stats.longest} 天</div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">最近打卡</h2>
              <Link to="/checkins" className="section-link">
                查看全部
              </Link>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                title="还没有打卡记录"
                description="今天开始记一笔？标签、时长、学习内容，一分钟搞定。"
                action={
                  <Link to="/checkin/new" className="btn btn-primary">
                    新建打卡
                  </Link>
                }
              />
            ) : (
              recent.map((item) => (
                <CheckInCard key={item.id} item={item} tags={tags} compact />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}