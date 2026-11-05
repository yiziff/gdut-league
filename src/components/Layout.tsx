import { NavLink, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { SPORTS } from '../sports';
import { DataGate } from '../data/store';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
    isActive ? 'bg-white text-gdut-700 font-semibold' : 'text-gdut-50 hover:bg-white/15'
  }`;

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-gdut-700 shadow-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <NavLink to="/" className="flex items-center gap-2 text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-sm font-black tracking-tighter text-gdut-700">
              广工
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold">广东工业大学球类联赛</span>
              <span className="block text-xs text-gdut-100">2026 秋季 · 篮球 足球 排球 羽毛球 乒乓球</span>
            </span>
          </NavLink>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            <NavLink to="/" end className={navClass}>
              首页
            </NavLink>
            {SPORTS.map((s) => (
              <NavLink key={s.id} to={`/${s.id}`} className={navClass}>
                {s.icon} {s.name}
              </NavLink>
            ))}
            <NavLink to="/teams" className={navClass}>
              队伍
            </NavLink>
            <NavLink to="/admin" className={navClass}>
              管理
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <DataGate>
          <Outlet />
        </DataGate>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        广东工业大学体育部 · 校园球类联赛信息站 · 数据仅供参考，以赛事组委会公告为准
      </footer>
    </div>
  );
}
