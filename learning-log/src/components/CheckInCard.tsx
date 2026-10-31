import { Link } from 'react-router-dom';
import type { CheckIn, Tag } from '@/data/types';
import { EditIcon, TrashIcon } from '@/components/icons';

interface CheckInCardProps {
  item: CheckIn;
  tags: Tag[];
  compact?: boolean;
  onDelete?: (item: CheckIn) => void;
}

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CheckInCard({ item, tags, compact = false, onDelete }: CheckInCardProps) {
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const tagNodes = item.tagIds.map((id) => {
    const tag = tagById.get(id);
    return (
      <span key={id} className={`tag${tag ? '' : ' tag-deleted'}`}>
        <span className="tag-dot" style={{ background: tag?.color ?? '#9CA3AF' }} />
        {tag?.name ?? '已删除标签'}
      </span>
    );
  });

  return (
    <article className="checkin-card">
      <div className="checkin-head">
        <div className="checkin-tags">{tagNodes}</div>
        <div className="checkin-duration">
          {item.durationMin}
          <small>分钟</small>
        </div>
      </div>

      <p className="checkin-content">{item.content}</p>
      {item.gain ? <p className="checkin-gain">收获：{item.gain}</p> : null}

      <div className="checkin-foot">
        <span>{timeOfDay(item.createdAt)} 记录</span>
        {item.attachmentIds.length > 0 ? <span>{item.attachmentIds.length} 张图</span> : null}
        {item.question ? <span>有疑问</span> : null}
        {item.nextPlan ? <span>已定下一步</span> : null}
        {compact ? null : (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <Link to={`/checkin/${item.id}/edit`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <EditIcon size={13} />
              编辑
            </Link>
            <button
              type="button"
              onClick={() => onDelete?.(item)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <TrashIcon size={13} />
              删除
            </button>
          </span>
        )}
      </div>
    </article>
  );
}