import { useEffect, useState } from 'react';
import { useSettings } from '@/app/settings-context';
import { checkInRepo, tagRepo } from '@/data/repository';
import { TAG_PALETTE } from '@/data/repository/tagRepo';
import { buildJsonExport, checkInsToCsv, downloadFile, todayStamp } from '@/data/export';
import type { Tag, ThemeMode } from '@/data/types';
import { relativeTime } from '@/lib/date';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { PlusIcon } from '@/components/icons';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { push } = useToast();

  const [tags, setTags] = useState<Tag[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [newTagName, setNewTagName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);
  const [goalDraft, setGoalDraft] = useState(String(settings.dailyGoalMin));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [tagList, all] = await Promise.all([tagRepo.listTags(), checkInRepo.listAllForExport()]);
    setTags(tagList);
    const counts: Record<string, number> = {};
    for (const c of all) {
      for (const id of c.tagIds) counts[id] = (counts[id] ?? 0) + 1;
    }
    setUsage(counts);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setGoalDraft(String(settings.dailyGoalMin));
  }, [settings.dailyGoalMin]);

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      await tagRepo.createTag(name);
      setNewTagName('');
      await load();
      push('标签已创建');
    } catch (e) {
      push(e instanceof Error ? e.message : '创建失败');
    }
  };

  const saveName = async (tag: Tag) => {
    try {
      await tagRepo.updateTag(tag.id, { name: editName });
      setEditingId(null);
      await load();
      push('已改名');
    } catch (e) {
      push(e instanceof Error ? e.message : '改名失败');
    }
  };

  const saveColor = async (tag: Tag, color: string) => {
    await tagRepo.updateTag(tag.id, { color });
    setPaletteId(null);
    await load();
    push('颜色已更新');
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await tagRepo.softDeleteTag(target.id);
    await load();
    push('标签已删除，历史打卡会显示为“已删除标签”');
  };

  const saveGoal = async () => {
    const n = Number(goalDraft);
    if (!Number.isFinite(n) || n < 0 || n > 1440) {
      push('每日目标需在 0–1440 分钟之间');
      setGoalDraft(String(settings.dailyGoalMin));
      return;
    }
    await update({ dailyGoalMin: Math.round(n) });
    push('每日目标已保存');
  };

  const exportCsv = async () => {
    setBusy(true);
    try {
      const items = await checkInRepo.listAllForExport();
      if (items.length === 0) {
        push('还没有打卡记录可以导出');
        return;
      }
      downloadFile(
        `learning-log-checkins-${todayStamp()}.csv`,
        checkInsToCsv(items, tags),
        'text/csv;charset=utf-8',
      );
      await update({ lastExportAt: new Date().toISOString() });
      push(`已导出 ${items.length} 条打卡`);
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async () => {
    setBusy(true);
    try {
      const payload = await buildJsonExport();
      downloadFile(
        `learning-log-backup-${todayStamp()}.json`,
        JSON.stringify(payload, null, 2),
        'application/json',
      );
      await update({ lastExportAt: new Date().toISOString() });
      push('已导出全量备份');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">设置</h1>
          <p className="page-subtitle">标签、外观、目标与数据备份</p>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <h2 className="section-title">标签管理</h2>
          <span className="section-link">{tags.length} 个标签</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            className="input"
            placeholder="新标签名称，最多 12 字"
            value={newTagName}
            maxLength={12}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTag();
            }}
            style={{ maxWidth: 260 }}
          />
          <button type="button" className="btn btn-primary" onClick={() => void addTag()}>
            <PlusIcon size={15} />
            新增
          </button>
        </div>

        {tags.length === 0 ? (
          <EmptyState
            title="还没有标签"
            description="先创建一个，比如「算法」「英语」「读书」，打卡时就能直接选。"
          />
        ) : (
          <div className="tag-table">
            {tags.map((tag) => (
              <div key={tag.id} className="tag-row">
                <div className="tag-row-main">
                  <span className="tag-dot" style={{ background: tag.color, width: 10, height: 10 }} />
                  {editingId === tag.id ? (
                    <>
                      <input
                        className="input"
                        value={editName}
                        maxLength={12}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveName(tag);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        style={{ maxWidth: 160 }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => void saveName(tag)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tag-name">{tag.name}</span>
                      <span className="tag-count">{usage[tag.id] ?? 0} 条打卡</span>
                    </>
                  )}
                </div>
                {editingId === tag.id ? null : (
                  <div className="settings-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditName(tag.name);
                        setPaletteId(null);
                      }}
                    >
                      改名
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setPaletteId(paletteId === tag.id ? null : tag.id)}
                    >
                      改色
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setPendingDelete(tag)}
                    >
                      删除
                    </button>
                  </div>
                )}
                {paletteId === tag.id ? (
                  <div className="color-palette">
                    {TAG_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`选择颜色 ${color}`}
                        className={`swatch${tag.color === color ? ' selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => void saveColor(tag, color)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2 className="section-title">外观</h2>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">主题</div>
            <div className="settings-desc">深色模式立即生效，跟随系统时会自动切换</div>
          </div>
          <div className="chip-row">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`chip${settings.theme === opt.value ? ' active' : ''}`}
                onClick={() => void update({ theme: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">每周起始</div>
            <div className="settings-desc">影响统计与热力图的周划分</div>
          </div>
          <div className="chip-row">
            <button
              type="button"
              className={`chip${settings.weekStartsOn === 1 ? ' active' : ''}`}
              onClick={() => void update({ weekStartsOn: 1 })}
            >
              周一
            </button>
            <button
              type="button"
              className={`chip${settings.weekStartsOn === 0 ? ' active' : ''}`}
              onClick={() => void update({ weekStartsOn: 0 })}
            >
              周日
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2 className="section-title">目标</h2>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">每日目标时长</div>
            <div className="settings-desc">用于首页「今日达标」的计算，填 0 表示不设目标</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="number"
              min={0}
              max={1440}
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              style={{ width: 90 }}
            />
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>分钟</span>
            <button type="button" className="btn btn-sm" onClick={() => void saveGoal()}>
              保存
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2 className="section-title">数据</h2>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">导出打卡 CSV</div>
            <div className="settings-desc">UTF-8 带 BOM，Excel 直接打开不乱码</div>
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void exportCsv()}>
            导出 CSV
          </button>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">导出全量备份 JSON</div>
            <div className="settings-desc">包含打卡、标签与设置，换设备时用它恢复</div>
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void exportJson()}>
            导出 JSON
          </button>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">上次备份</div>
            <div className="settings-desc">建议每两周导出一次，本地存储可能被浏览器清理</div>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {settings.lastExportAt ? relativeTime(settings.lastExportAt) : '还没有备份过'}
          </span>
        </div>
      </section>

      <p className="page-subtitle" style={{ marginTop: 20 }}>
        数据保存在当前浏览器的本地数据库中，不会上传到任何服务器。
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除标签？"
        description={
          pendingDelete
            ? `「${pendingDelete.name}」下有 ${usage[pendingDelete.id] ?? 0} 条打卡。删除后这些打卡会保留，标签显示为「已删除标签」。`
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