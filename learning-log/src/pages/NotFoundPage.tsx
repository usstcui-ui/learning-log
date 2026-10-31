import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="页面不存在"
      description="链接可能过期了，回首页继续记录吧。"
      action={
        <Link to="/" className="btn btn-primary">
          回到首页
        </Link>
      }
    />
  );
}