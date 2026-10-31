import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ChartIcon,
  HomeIcon,
  ListIcon,
  PlusIcon,
  NoteIcon,
  SettingsIcon,
} from '@/components/icons';

const NAV_ITEMS = [
  { to: '/', label: '首页', icon: HomeIcon, end: true },
  { to: '/checkins', label: '记录', icon: ListIcon, end: false },
  { to: '/notes', label: '笔记', icon: NoteIcon, end: false },
  { to: '/stats', label: '统计', icon: ChartIcon, end: false },
  { to: '/settings', label: '设置', icon: SettingsIcon, end: false },
];

function isNavActive(pathname: string, to: string, end: boolean): boolean {
  if (to === '/checkins') return pathname.startsWith('/checkins') || pathname.startsWith('/checkin/');
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell() {
  const { pathname } = useLocation();
  const hideFab = pathname.startsWith('/checkin/');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          学习日志
          <small>每天记一笔</small>
        </div>
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.to, item.end);
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={`nav-item${active ? ' active' : ''}`}>
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <NavLink to="/checkin/new" className="btn btn-primary side-cta">
          <PlusIcon size={16} />
          新建打卡
        </NavLink>
      </aside>

      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>

      <nav className="tabbar" aria-label="主导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.to, item.end);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`tab-item${active ? ' active' : ''}`}
            >
              <Icon size={20} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {hideFab ? null : (
        <NavLink to="/checkin/new" className="fab" aria-label="新建打卡">
          <PlusIcon size={22} />
        </NavLink>
      )}
    </div>
  );
}