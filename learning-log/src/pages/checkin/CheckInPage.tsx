import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { checkInRepo, draftRepo, tagRepo } from '@/data/repository';
import type { Tag } from '@/data/types';
import { addDays, isValidDateStr, relativeTime, todayStr } from '@/lib/date';
import { DurationInput } from '@/components/DurationInput';
import { TagPicker } from '@/components/TagPicker';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { ArrowLeftIcon } from '@/components/icons';

interface FormState {
  date: string;
  tagIds: string[];
  durationMin: number | '';
  content: string;
  gain: string;
  question: string;
  nextPlan: string;
}

const MAX_LEN = 2000;
const LOOKBACK_DAYS = 30;

function emptyForm(date: string): FormState {
  return {
    date,
    tagIds: [],
    durationMin: '',
    content: '',
    gain: '',
    question: '',
    nextPlan: '',
  };
}

function hasContent(form: FormState): boolean {
  return (
    form.content.trim().length > 0 ||
    form.gain.trim().length > 0 ||
    form.question.trim().length > 0 ||
    form.nextPlan.trim().length > 0 ||
    form.tagIds.length > 0 ||
    form.durationMin !== ''
  );
}

export function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();

  const today = todayStr();
  const minDate = addDays(today, -LOOKBACK_DAYS);

  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const restoredRef = useRef(false);

  const draftKey = 'checkin:new';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoaded(false);
      const tagList = await tagRepo.listTags();
      if (!alive) return;
      setTags(tagList);

      if (isEdit && id) {
        const item = await checkInRepo.getCheckIn(id);
        if (!alive) return;
        if (!item || item.deletedAt) {
          setNotFound(true);
          setLoaded(true);
          return;
        }
        setForm({
          date: item.date,
          tagIds: item.tagIds,
          durationMin: item.durationMin,
          content: item.content,
          gain: item.gain,
          question: item.question,
          nextPlan: item.nextPlan,
        });
        setLoaded(true);
        return;
      }

      const params = new URLSearchParams(location.search);
      const presetDuration = Number(params.get('duration'));
      const presetDate = params.get('date');

      const draft = await draftRepo.readDraftPayload<FormState>(draftKey);
      if (!alive) return;
      const base = emptyForm(
        presetDate && isValidDateStr(presetDate) ? presetDate : today,
      );
      if (presetDuration > 0 && presetDuration <= 1440) base.durationMin = presetDuration;

      if (draft && hasContent({ ...base, ...draft })) {
        setForm({ ...base, ...draft });
        setDraftRestored(true);
      } else {
        setForm(base);
      }
      restoredRef.current = true;
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // 仅当路由 id 或预填参数变化时重新加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // 新建模式下自动保存草稿：输入停顿 2 秒落盘
  useEffect(() => {
    if (isEdit || !loaded || !restoredRef.current) return;
    if (!hasContent(form)) return;
    const timer = window.setTimeout(async () => {
      await draftRepo.saveDraft(draftKey, 'checkin', form);
      setDraftSavedAt(new Date().toISOString());
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [form, isEdit, loaded]);

  // 有未提交内容时，关闭页面前提醒
  useEffect(() => {
    if (!loaded || !hasContent(form)) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [form, loaded]);

  const draftLabel = useMemo(
    () => (draftSavedAt ? `草稿已保存 · ${relativeTime(draftSavedAt)}` : null),
    [draftSavedAt],
  );

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.date) next.date = '请选择日期';
    else if (!isValidDateStr(form.date)) next.date = '日期格式不正确';
    else if (form.date > today) next.date = '不能记录未来';
    else if (form.date < minDate) next.date = `最多回补 ${LOOKBACK_DAYS} 天`;

    if (form.tagIds.length === 0) next.tagIds = '请至少选择一个标签';

    const duration = Number(form.durationMin);
    if (form.durationMin === '' || !Number.isFinite(duration) || !Number.isInteger(duration)) {
      next.durationMin = '请填写整数分钟';
    } else if (duration < 1 || duration > 1440) {
      next.durationMin = '时长需在 1–1440 分钟之间';
    }

    if (!form.content.trim()) next.content = '请填写学习内容';
    else if (form.content.length > MAX_LEN) next.content = `最多 ${MAX_LEN} 字`;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      push('还有必填项未完成');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date,
        tagIds: form.tagIds,
        durationMin: Number(form.durationMin),
        content: form.content.trim(),
        gain: form.gain.trim(),
        question: form.question.trim(),
        nextPlan: form.nextPlan.trim(),
      };
      if (isEdit && id) {
        await checkInRepo.updateCheckIn(id, payload);
        push('已更新');
      } else {
        await checkInRepo.createCheckIn(payload);
        await draftRepo.deleteDraft(draftKey);
        push('打卡成功');
      }
      navigate('/checkins');
    } catch (error) {
      console.error(error);
      push('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTag = async (name: string): Promise<Tag> => {
    const created = await tagRepo.createTag(name);
    setTags((prev) => [...prev, created]);
    return created;
  };

  if (notFound) {
    return (
      <EmptyState
        title="这条打卡不存在或已删除"
        description="可能在其他设备上删除了，或者链接不完整。"
        action={
          <Link to="/checkins" className="btn btn-primary">
            返回记录列表
          </Link>
        }
      />
    );
  }

  if (!loaded) {
    return <div className="card" style={{ height: 280 }} aria-busy="true" />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link
            to={isEdit ? '/checkins' : '/'}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: -10, marginBottom: 6 }}
          >
            <ArrowLeftIcon size={15} />
            返回
          </Link>
          <h1 className="page-title">{isEdit ? '编辑打卡' : '新建打卡'}</h1>
          <p className="page-subtitle">
            {isEdit ? '修改后保存，统计数据会同步更新' : '标签、时长、学习内容为必填，其余可以留空'}
          </p>
        </div>
        {!isEdit && draftLabel ? <span className="page-subtitle">{draftLabel}</span> : null}
      </div>

      {draftRestored && !isEdit ? (
        <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 13 }}>已恢复上次未提交的草稿</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await draftRepo.deleteDraft(draftKey);
              setForm(emptyForm(today));
              setDraftRestored(false);
              setDraftSavedAt(null);
            }}
          >
            丢弃草稿
          </button>
        </div>
      ) : null}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="checkin-date">
            日期
            <span className="req">*</span>
          </label>
          <input
            id="checkin-date"
            type="date"
            className={`input${errors.date ? ' invalid' : ''}`}
            style={{ maxWidth: 220 }}
            value={form.date}
            min={minDate}
            max={today}
            onChange={(e) => patch('date', e.target.value)}
          />
          {errors.date ? <div className="field-error">{errors.date}</div> : null}
        </div>

        <div className="field">
          <span className="field-label">
            标签
            <span className="req">*</span>
          </span>
          <TagPicker
            tags={tags}
            value={form.tagIds}
            onChange={(next) => patch('tagIds', next)}
            onCreate={handleCreateTag}
          />
          {errors.tagIds ? <div className="field-error">{errors.tagIds}</div> : null}
        </div>

        <div className="field">
          <span className="field-label">
            时长
            <span className="req">*</span>
          </span>
          <DurationInput
            value={form.durationMin}
            onChange={(next) => patch('durationMin', next)}
            invalid={Boolean(errors.durationMin)}
          />
          {errors.durationMin ? <div className="field-error">{errors.durationMin}</div> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="checkin-content">
            学习内容
            <span className="req">*</span>
          </label>
          <textarea
            id="checkin-content"
            className={`textarea${errors.content ? ' invalid' : ''}`}
            placeholder="章节 / 内容：今天学了什么"
            value={form.content}
            maxLength={MAX_LEN}
            onChange={(e) => patch('content', e.target.value)}
          />
          <div className="counter">{form.content.length}/{MAX_LEN}</div>
          {errors.content ? <div className="field-error">{errors.content}</div> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="checkin-gain">
            收获
          </label>
          <textarea
            id="checkin-gain"
            className="textarea"
            placeholder="学会了什么，一句话也行"
            value={form.gain}
            maxLength={MAX_LEN}
            onChange={(e) => patch('gain', e.target.value)}
            style={{ minHeight: 64 }}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="checkin-question">
            疑问
          </label>
          <textarea
            id="checkin-question"
            className="textarea"
            placeholder="还没搞懂的地方"
            value={form.question}
            maxLength={MAX_LEN}
            onChange={(e) => patch('question', e.target.value)}
            style={{ minHeight: 64 }}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="checkin-next">
            下一步
          </label>
          <textarea
            id="checkin-next"
            className="textarea"
            placeholder="下次从哪继续"
            value={form.nextPlan}
            maxLength={MAX_LEN}
            onChange={(e) => patch('nextPlan', e.target.value)}
            style={{ minHeight: 64 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <Link to="/checkins" className="btn btn-ghost">
            取消
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '保存中…' : isEdit ? '保存修改' : '提交打卡'}
          </button>
        </div>
      </form>
    </div>
  );
}