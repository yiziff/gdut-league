import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { DataGate } from '../../data/store';
import { PlayerSessionProvider } from './session';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
    isActive ? 'bg-white font-semibold text-player-700' : 'text-player-50 hover:bg-white/15'
  }`;

export default function PlayerLayout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <PlayerSessionProvider>
      <div className="flex min-h-screen flex-col bg-player-50 text-slate-800">
        <header className="sticky top-0 z-20 bg-player-600 shadow-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <NavLink to="/player" className="flex items-center gap-2 text-white">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-sm font-black tracking-tighter text-player-700">
                球员
              </span>
              <span className="leading-tight">
                <span className="block text-base font-bold">球员端</span>
                <span className="block text-xs text-player-100">赛程、报名和生涯数据</span>
              </span>
            </NavLink>
            <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
              <NavLink to="/player" end className={navClass}>
                首页
              </NavLink>
              <NavLink to="/player/matches" className={navClass}>
                比赛
              </NavLink>
              <NavLink to="/player/career" className={navClass}>
                生涯
              </NavLink>
              <NavLink to="/player/me" className={navClass}>
                我的
              </NavLink>
              <NavLink to="/" className={navClass}>
                返回联赛站
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <DataGate>
            <Outlet />
          </DataGate>
        </main>
        <footer className="border-t border-player-100 py-6 text-center text-xs text-slate-400">
          广东工业大学体育部 · 球员端网页版
        </footer>
      </div>
    </PlayerSessionProvider>
  );
}
