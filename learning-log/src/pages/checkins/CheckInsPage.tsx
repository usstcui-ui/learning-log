import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { checkInRepo, tagRepo } from '@/data/repository';
import type { CheckIn, Tag } from '@/data/types';
import { formatDateCN, formatDuration } from '@/lib/date';
import { CheckInCard } from '@/components/CheckInCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { PlusIcon, SearchIcon } from '@/components/icons';

const PAGE_SIZE = 20;

export function CheckInsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { push } = useToast();

  const [tags, setTags] = useState<Tag[]>([]);
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '');
  const [debounced, setDebounced] = useState(keyword);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => searchParams.getAll('tag'));
  const [items, setItems] = useState<CheckIn[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CheckIn | null>(null);

  useEffect(() => {
    tagRepo.listTags().then(setTags);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(keyword), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const filterKey = selectedTags.join('|');

  const loadPage = useCallback(
    async (offset: number, reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await checkInRepo.listCheckIns({
          keyword: debounced,
          tagIds: selectedTags,
          limit: PAGE_SIZE,
          offset,
        });
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setHasMore(res.hasMore);
        setTotal(res.total);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // filterKey 变化代表筛选条件变化，selectedTags 引用随之一并更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounced, filterKey],
  );

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debounced) next.set('q', debounced);
    for (const id of selectedTags) next.append('tag', id);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filterKey]);

  const groups = useMemo(() => {
    const map = new Map<string, CheckIn[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return [...map.entries()];
  }, [items]);

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const clearFilters = () => {
    setKeyword('');
    setDebounced('');
    setSelectedTags([]);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await checkInRepo.softDeleteCheckIn(target.id);
    setItems((prev) => prev.filter((i) => i.id !== target.id));
    setTotal((t) => Math.max(0, t - 1));
    push('已删除', {
      actionLabel: '撤销',
      onAction: async () => {
        await checkInRepo.restoreCheckIn(target.id);
        void loadPage(0, true);
      },
    });
  };

  const hasFilter = debounced.trim().length > 0 || selectedTags.length > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">打卡记录</h1>
          <p className="page-subtitle">
            {loading ? '加载中…' : `共 ${total} 条记录`}
          </p>
        </div>
        <div className="page-actions">
          <Link to="/checkin/new" className="btn btn-primary">
            <PlusIcon size={16} />
            新建打卡
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <SearchIcon size={16} />
          <input
            className="input"
            type="search"
            placeholder="搜索学习内容、收获、疑问…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="搜索打卡"
          />
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`chip${selectedTags.length === 0 ? ' active' : ''}`}
            onClick={() => setSelectedTags([])}
          >
            全部
          </button>
          {tags.map((tag) => (
            <button
              type="button"
              key={tag.id}
              className={`chip${selectedTags.includes(tag.id) ? ' active' : ''}`}
              onClick={() => toggleTag(tag.id)}
            >
              <span className="tag-dot" style={{ background: tag.color }} />
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ height: 200 }} aria-busy="true" />
      ) : items.length === 0 ? (
        hasFilter ? (
          <EmptyState
            title="没有匹配的记录"
            description="换个关键词，或者清除筛选条件再看看"
            action={
              <button type="button" className="btn" onClick={clearFilters}>
                清除筛选
              </button>
            }
          />
        ) : (
          <EmptyState
            title="还没有打卡记录"
            description="今天学了什么？记一笔，一年后你会感谢现在的自己。"
            action={
              <Link to="/checkin/new" className="btn btn-primary">
                新建打卡
              </Link>
            }
          />
        )
      ) : (
        <>
          {groups.map(([date, list]) => (
            <section key={date} className="date-group">
              <div className="date-group-head">
                <strong>{formatDateCN(date)}</strong>
                <span>{formatDuration(list.reduce((sum, i) => sum + i.durationMin, 0))}</span>
              </div>
              {list.map((item) => (
                <CheckInCard
                  key={item.id}
                  item={item}
                  tags={tags}
                  onDelete={setPendingDelete}
                />
              ))}
            </section>
          ))}

          {hasMore ? (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button
                type="button"
                className="btn"
                disabled={loadingMore}
                onClick={() => void loadPage(items.length, false)}
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </button>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
              没有更多了
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这条打卡？"
        description={
          pendingDelete
            ? `「${pendingDelete.content.slice(0, 40)}」删除后，相关时长与统计会一并减少。5 秒内可以在提示条里撤销。`
            : undefined
        }
        confirmText="删除"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}