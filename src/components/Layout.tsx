import { NavLink, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { isSport } from '../sports';
import { DataGate } from '../data/store';

const navClass = (active: boolean) =>
  `relative shrink-0 px-1 py-5 text-sm font-medium transition after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:origin-center after:bg-gdut-600 after:transition-transform ${
    active ? 'text-navy-950 after:scale-x-100' : 'text-slate-500 after:scale-x-0 hover:text-navy-900'
  }`;

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  const eventArea = pathname === '/events' || isSport(pathname.split('/')[1]);

  return (
    <div className="app-shell flex flex-col">
      <header className="site-header sticky top-0 z-30 border-t-2 border-t-navy-950 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-5">
            <NavLink to="/" className="flex min-w-0 items-center gap-3">
              <span className="brand-mark">
                GDUT
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold tracking-[-0.02em] text-navy-950 sm:text-base">校园球类联赛</span>
                <span className="hidden text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase sm:block">2026 Autumn Season</span>
              </span>
            </NavLink>

            <div className="hidden items-center gap-6 md:flex">
              <nav className="flex items-center gap-6">
                <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
                  首页
                </NavLink>
                <NavLink to="/events" className={() => navClass(eventArea)}>
                  赛事
                </NavLink>
                <NavLink to="/teams" className={({ isActive }) => navClass(isActive)}>
                  队伍
                </NavLink>
                <NavLink to="/player" className={({ isActive }) => navClass(isActive)}>
                  球员
                </NavLink>
              </nav>
              <span className="h-5 w-px bg-slate-200" />
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`
                }
              >
                管理后台
              </NavLink>
            </div>

            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-md border px-2.5 py-1.5 text-xs font-semibold md:hidden ${
                  isActive ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-300 text-slate-600'
                }`
              }
            >
              管理
            </NavLink>
          </div>

          <nav className="-mx-1 flex gap-6 overflow-x-auto px-1 md:hidden [scrollbar-width:none]">
            <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
              首页
            </NavLink>
            <NavLink to="/events" className={() => navClass(eventArea)}>
              赛事
            </NavLink>
            <NavLink to="/teams" className={({ isActive }) => navClass(isActive)}>
              队伍
            </NavLink>
            <NavLink to="/player" className={({ isActive }) => navClass(isActive)}>
              球员
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <DataGate>
          <Outlet />
        </DataGate>
      </main>
      <footer className="border-t border-white/10 bg-navy-950 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-8 place-items-center rounded-[3px] border border-white/15 text-[8px] font-black tracking-wider text-white">GDUT</span>
            <span className="text-xs font-medium text-slate-300">广东工业大学校园球类联赛</span>
          </div>
          <div className="flex flex-col gap-1 text-[11px] sm:text-right">
            <span className="font-semibold tracking-[0.14em] text-slate-500 uppercase">Official Competition Center</span>
            <span>赛程与结果以赛事组委会公告为准</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
