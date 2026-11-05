import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { DataGate } from '../../data/store';
import { PlayerSessionProvider } from './session';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `relative shrink-0 px-1 py-5 text-sm font-medium transition after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:bg-player-500 after:transition-transform ${
    isActive ? 'text-navy-950 after:scale-x-100' : 'text-slate-500 after:scale-x-0 hover:text-navy-900'
  }`;

export default function PlayerLayout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <PlayerSessionProvider>
      <div className="app-shell flex flex-col">
        <header className="site-header sticky top-0 z-30 border-t-2 border-t-player-500 border-b border-slate-200/90 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-5">
              <NavLink to="/player" className="flex min-w-0 items-center gap-3">
                <span className="brand-mark">
                  GDUT
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-bold tracking-tight text-navy-950 sm:text-base">球员中心</span>
                  <span className="hidden text-[11px] font-medium tracking-wide text-player-600 sm:block">PLAYER PORTAL</span>
                </span>
              </NavLink>

              <div className="hidden items-center gap-6 md:flex">
                <nav className="flex items-center gap-6">
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
                </nav>
                <span className="h-5 w-px bg-slate-200" />
                <NavLink to="/" className="btn-secondary px-3 py-1.5 text-xs">
                  返回联赛站
                </NavLink>
              </div>

              <NavLink to="/" className="btn-secondary px-2.5 py-1.5 text-xs md:hidden">
                联赛站
              </NavLink>
            </div>

            <nav className="-mx-1 flex gap-6 overflow-x-auto px-1 md:hidden [scrollbar-width:none]">
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
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
          <DataGate>
            <Outlet />
          </DataGate>
        </main>
        <footer className="border-t border-white/10 bg-navy-950 py-7 text-center text-xs text-slate-400">
          <span className="font-medium text-slate-300">广东工业大学校园球类联赛</span>
          <span className="mx-2 text-slate-600">/</span>
          球员中心
        </footer>
      </div>
    </PlayerSessionProvider>
  );
}
