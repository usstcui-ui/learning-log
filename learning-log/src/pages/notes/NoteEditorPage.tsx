import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { checkInRepo, draftRepo, noteRepo, tagRepo } from '@/data/repository';
import type { CheckIn, Tag } from '@/data/types';
import { relativeTime } from '@/lib/date';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { MarkdownView } from '@/components/MarkdownView';
import { TagPicker } from '@/components/TagPicker';
import { useToast } from '@/components/Toast';
import { ArrowLeftIcon, TrashIcon } from '@/components/icons';

const DRAFT_ID = 'note:new';
const MAX_TITLE = 100;

interface NoteDraft {
  title: string;
  body: string;
  tagIds: string[];
  checkInId: string | null;
}

function fallbackTitle(title: string, body: string): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed.slice(0, MAX_TITLE);
  const firstLine = body
    .trim()
    .split('\n')
    .find((line) => line.trim().length > 0);
  if (!firstLine) return '无标题';
  return firstLine.replace(/^#{1,6}\s*/, '').slice(0, 20) || '无标题';
}

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [tagList, checkInRes] = await Promise.all([
        tagRepo.listTags(),
        checkInRepo.listCheckIns({ limit: 50 }),
      ]);
      if (!alive) return;
      setTags(tagList);
      setCheckIns(checkInRes.items);

      if (isEdit && id) {
        const note = await noteRepo.getNote(id);
        if (!alive) return;
        if (!note || note.deletedAt) {
          setNotFound(true);
          setLoaded(true);
          return;
        }
        setTitle(note.title);
        setBody(note.body);
        setTagIds(note.tagIds);
        setCheckInId(note.checkInId);
        setLoaded(true);
        return;
      }

      const params = new URLSearchParams(location.search);
      const presetCheckIn = params.get('checkInId');
      const draft = await draftRepo.readDraftPayload<NoteDraft>(DRAFT_ID);
      if (!alive) return;
      if (draft && (draft.title.trim() || draft.body.trim())) {
        setTitle(draft.title);
        setBody(draft.body);
        setTagIds(draft.tagIds ?? []);
        setCheckInId(draft.checkInId ?? presetCheckIn);
        setDraftRestored(true);
      } else if (presetCheckIn) {
        setCheckInId(presetCheckIn);
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // 新建笔记时自动保存草稿
  useEffect(() => {
    if (isEdit || !loaded) return;
    if (!title.trim() && !body.trim()) return;
    const timer = window.setTimeout(async () => {
      await draftRepo.saveDraft(DRAFT_ID, 'note', { title, body, tagIds, checkInId });
      setDraftSavedAt(new Date().toISOString());
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [title, body, tagIds, checkInId, isEdit, loaded]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const touch = () => setDirty(true);

  const insert = (before: string, after = '', placeholder = '文本') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    setBody(next);
    touch();
    window.requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const save = async () => {
    if (saving) return;
    if (!body.trim()) {
      push('笔记正文不能为空');
      return;
    }
    setSaving(true);
    try {
      const finalTitle = fallbackTitle(title, body);
      if (isEdit && id) {
        await noteRepo.updateNote(id, { title: finalTitle, body, tagIds, checkInId });
        setDirty(false);
        push('已保存');
      } else {
        const created = await noteRepo.createNote({ title: finalTitle, body, tagIds, checkInId });
        await draftRepo.deleteDraft(DRAFT_ID);
        setDirty(false);
        push('已创建');
        navigate(`/notes/${created.id}`, { replace: true });
      }
    } catch (error) {
      console.error(error);
      push('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    setConfirmDelete(false);
    await noteRepo.softDeleteNote(id);
    push('笔记已删除');
    navigate('/notes', { replace: true });
  };

  const handleCreateTag = async (name: string): Promise<Tag> => {
    const created = await tagRepo.createTag(name);
    setTags((prev) => [...prev, created]);
    return created;
  };

  if (notFound) {
    return (
      <EmptyState
        title="这篇笔记不存在或已删除"
        description="可能链接不完整，或者笔记已被移除。"
        action={
          <Link to="/notes" className="btn btn-primary">
            返回笔记列表
          </Link>
        }
      />
    );
  }

  if (!loaded) {
    return <div className="card" style={{ height: 300 }} aria-busy="true" />;
  }

  const draftLabel = draftSavedAt ? `草稿已保存 · ${relativeTime(draftSavedAt)}` : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link
            to="/notes"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: -10, marginBottom: 6 }}
          >
            <ArrowLeftIcon size={15} />
            返回
          </Link>
          <h1 className="page-title">{isEdit ? '笔记' : '新建笔记'}</h1>
          <p className="page-subtitle">
            {draftLabel ?? '支持 Markdown、表格与 $公式$'}
          </p>
        </div>
        <div className="page-actions">
          {isEdit ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmDelete(true)}
            >
              <TrashIcon size={15} />
              删除
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      {draftRestored && !isEdit ? (
        <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 13 }}>已恢复上次未保存的草稿</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await draftRepo.deleteDraft(DRAFT_ID);
              setTitle('');
              setBody('');
              setTagIds([]);
              setDraftRestored(false);
              setDraftSavedAt(null);
            }}
          >
            丢弃草稿
          </button>
        </div>
      ) : null}

      <div className="editor-shell">
        <input
          className="input"
          placeholder="标题（留空则取正文首行）"
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => {
            setTitle(e.target.value);
            touch();
          }}
          style={{ fontSize: 16, fontWeight: 600, padding: '10px 12px' }}
        />

        <div className="editor-meta">
          <div style={{ flex: 1, minWidth: 220 }}>
            <TagPicker
              tags={tags}
              value={tagIds}
              onChange={(next) => {
                setTagIds(next);
                touch();
              }}
              onCreate={handleCreateTag}
            />
          </div>
          <select
            className="select"
            value={checkInId ?? ''}
            onChange={(e) => {
              setCheckInId(e.target.value || null);
              touch();
            }}
            style={{ maxWidth: 280 }}
            aria-label="关联打卡"
          >
            <option value="">不关联打卡</option>
            {checkIns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.date} · {c.content.slice(0, 24)}
              </option>
            ))}
          </select>
        </div>

        <div className="editor-tabs">
          <button
            type="button"
            className={`chip${mode === 'edit' ? ' active' : ''}`}
            onClick={() => setMode('edit')}
          >
            编辑
          </button>
          <button
            type="button"
            className={`chip${mode === 'preview' ? ' active' : ''}`}
            onClick={() => setMode('preview')}
          >
            预览
          </button>
        </div>

        <div className="editor-grid" data-mode={mode}>
          <div className="editor-pane editor-source">
            <div className="editor-toolbar">
              <button type="button" className="editor-tool" onClick={() => insert('**', '**')}>
                B
              </button>
              <button type="button" className="editor-tool" onClick={() => insert('## ', '')}>
                H2
              </button>
              <button type="button" className="editor-tool" onClick={() => insert('- ', '')}>
                列表
              </button>
              <button type="button" className="editor-tool" onClick={() => insert('`', '`', 'code')}>
                代码
              </button>
              <button type="button" className="editor-tool" onClick={() => insert('$', '$', 'x')}>
                公式
              </button>
              <button type="button" className="editor-tool" onClick={() => insert('$$', '$$', '\\int_0^1 x dx')}>
                块公式
              </button>
              <button type="button" className="editor-tool" onClick={() => insert('[', '](https://)', '链接文字')}>
                链接
              </button>
              <button type="button" className="editor-tool" onClick={() => insert('\n| 列1 | 列2 |\n| --- | --- |\n|  |  |\n')}>
                表格
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              placeholder={'# 标题\n\n写成 Markdown，右侧实时预览。\n\n行内公式 $E = mc^2$，块级公式 $$\\sum_{i=1}^n i$$'}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                touch();
              }}
            />
          </div>

          <div className="editor-pane editor-preview">
            {body.trim() ? (
              <MarkdownView source={body} />
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                预览区：在左侧写点内容就能看到渲染结果。
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这篇笔记？"
        description="删除后不会出现在列表里，关联的打卡不受影响。"
        confirmText="删除"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}