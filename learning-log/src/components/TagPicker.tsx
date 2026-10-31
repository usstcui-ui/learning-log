import { useState, type KeyboardEvent } from 'react';
import type { Tag } from '@/data/types';
import { CloseIcon, PlusIcon } from '@/components/icons';

interface TagPickerProps {
  tags: Tag[];
  value: string[];
  onChange: (next: string[]) => void;
  onCreate: (name: string) => Promise<Tag>;
  disabled?: boolean;
}

export function TagPicker({ tags, value, onChange, onCreate, disabled }: TagPickerProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selected = new Set(value);

  const toggle = (id: string) => {
    if (selected.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const commit = async () => {
    const name = draft.trim();
    if (!name) return;
    setError(null);
    const existing = tags.find((t) => t.name === name);
    if (existing) {
      if (!selected.has(existing.id)) onChange([...value, existing.id]);
      setDraft('');
      return;
    }
    try {
      const created = await onCreate(name);
      onChange([...value, created.id]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建标签失败');
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="tag-picker">
        {tags.map((tag) => {
          const active = selected.has(tag.id);
          return (
            <button
              type="button"
              key={tag.id}
              className={`chip${active ? ' active' : ''}`}
              onClick={() => toggle(tag.id)}
              disabled={disabled}
            >
              <span className="tag-dot" style={{ background: tag.color }} />
              {tag.name}
              {active ? <CloseIcon size={11} /> : null}
            </button>
          );
        })}
        <input
          className="input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => void commit()}
          placeholder="+ 新标签"
          maxLength={12}
          disabled={disabled}
          aria-label="新建标签"
        />
      </div>
      {error ? <div className="field-error" style={{ marginTop: 6 }}>{error}</div> : null}
      {tags.length === 0 && !error ? (
        <div className="field-hint" style={{ marginTop: 6 }}>
          <PlusIcon size={12} /> 输入名称后按回车，创建第一个标签
        </div>
      ) : null}
    </div>
  );
}