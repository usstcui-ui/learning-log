import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { noteRepo, tagRepo } from '@/data/repository';
import type { Note, Tag } from '@/data/types';
import { relativeTime } from '@/lib/date';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { PlusIcon, SearchIcon } from '@/components/icons';

function plainSummary(body: string, limit = 140): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>~#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, limit);
}

export function NotesPage() {
  const { push } = useToast();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);

  useEffect(() => {
    tagRepo.listTags().then(setTags);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(keyword), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    noteRepo.listNotes({ keyword: debounced, limit: 50 }).then((res) => {
      if (!alive) return;
      setNotes(res.items);
      setTotal(res.total);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [debounced]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await noteRepo.softDeleteNote(target.id);
    setNotes((prev) => prev.filter((n) => n.id !== target.id));
    setTotal((t) => Math.max(0, t - 1));
    push('笔记已删除');
  };

  const tagById = new Map(tags.map((t) => [t.id, t]));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">笔记</h1>
          <p className="page-subtitle">{loading ? '加载中…' : `共 ${total} 篇`}</p>
        </div>
        <div className="page-actions">
          <Link to="/notes/new" className="btn btn-primary">
            <PlusIcon size={16} />
            新建笔记
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <SearchIcon size={16} />
          <input
            className="input"
            type="search"
            placeholder="搜索标题与正文…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="搜索笔记"
          />
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ height: 180 }} aria-busy="true" />
      ) : notes.length === 0 ? (
        debounced ? (
          <EmptyState
            title="没有匹配的笔记"
            description="换个关键词试试"
            action={
              <button type="button" className="btn" onClick={() => setKeyword('')}>
                清除搜索
              </button>
            }
          />
        ) : (
          <EmptyState
            title="还没有笔记"
            description="把学过的东西写成一篇，支持 Markdown 与公式。"
            action={
              <Link to="/notes/new" className="btn btn-primary">
                新建笔记
              </Link>
            }
          />
        )
      ) : (
        notes.map((note) => (
          <article key={note.id} className="note-card">
            <div className="note-card-head">
              <Link to={`/notes/${note.id}`} className="note-title-link">
                {note.title || '无标题'}
              </Link>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setPendingDelete(note)}
              >
                删除
              </button>
            </div>
            <Link to={`/notes/${note.id}`} style={{ display: 'block' }}>
              <p className="note-summary">{plainSummary(note.body) || '（空白笔记）'}</p>
              <div className="note-meta">
                {note.tagIds.map((tagId) => {
                  const tag = tagById.get(tagId);
                  return (
                    <span key={tagId} className={`tag${tag ? '' : ' tag-deleted'}`}>
                      <span
                        className="tag-dot"
                        style={{ background: tag?.color ?? '#9CA3AF' }}
                      />
                      {tag?.name ?? '已删除标签'}
                    </span>
                  );
                })}
                {note.checkInId ? <span className="note-badge">关联打卡</span> : null}
                <span style={{ marginLeft: 'auto' }}>{relativeTime(note.updatedAt)}更新</span>
              </div>
            </Link>
          </article>
        ))
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这篇笔记？"
        description={
          pendingDelete ? `「${pendingDelete.title || '无标题'}」删除后无法在列表中看到。` : undefined
        }
        confirmText="删除"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}