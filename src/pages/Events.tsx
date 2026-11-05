import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../data/store';
import { SPORTS } from '../sports';
import type { Sport } from '../types';

type Filter = 'all' | Sport;

export default function Events() {
  const { leagues } = useData();
  const [filter, setFilter] = useState<Filter>('all');
  const visible = useMemo(
    () => leagues.filter((item) => filter === 'all' || item.league.sport === filter),
    [filter, leagues],
  );

  return (
    <div>
      <div className="page-masthead pb-11">
        <div className="max-w-3xl">
          <p className="eyebrow mb-3">Competitions</p>
          <h1 className="page-title">赛事中心</h1>
          <p className="masthead-copy mt-4 text-sm leading-7 sm:text-base">
            按项目查看当前赛季的联赛、赛程进度和参赛队伍。进入具体联赛后可继续查看赛程、积分榜与淘汰赛对阵。
          </p>
        </div>
      </div>

      <div className="subnav-panel mb-8">
        <div className="flex min-w-max gap-7">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`border-b-2 pb-3 text-sm font-semibold transition ${
              filter === 'all' ? 'border-gdut-600 text-navy-950' : 'border-transparent text-slate-500 hover:text-navy-900'
            }`}
          >
            全部赛事
            <span className="ml-2 font-normal tabular-nums text-slate-400">{leagues.length}</span>
          </button>
          {SPORTS.map((sport) => {
            const count = leagues.filter((item) => item.league.sport === sport.id).length;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => setFilter(sport.id)}
                className={`border-b-2 pb-3 text-sm font-semibold transition ${
                  filter === sport.id
                    ? 'border-gdut-600 text-navy-950'
                    : 'border-transparent text-slate-500 hover:text-navy-900'
                }`}
              >
                <span className="mr-1.5" aria-hidden="true">{sport.icon}</span>
                {sport.name}
                <span className="ml-2 font-normal tabular-nums text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">这个项目暂时没有联赛</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item, index) => {
            const meta = SPORTS.find((sport) => sport.id === item.league.sport)!;
            const finished = item.matches.filter((match) => match.status === 'finished').length;
            const progress = item.matches.length > 0 ? Math.round((finished / item.matches.length) * 100) : 0;
            return (
              <Link
                key={item.league.id}
                to={`/${item.league.sport}/${item.league.id}/schedule`}
                className="surface-interactive group relative flex min-h-60 flex-col overflow-hidden p-5"
              >
                <span className="absolute top-0 left-0 h-0.5 w-full origin-left scale-x-0 bg-gdut-600 transition group-hover:scale-x-100" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-gdut-100 bg-gdut-50 text-2xl shadow-sm"
                      aria-hidden="true"
                    >
                      {meta.icon}
                    </span>
                    <span>
                      <span className="block text-base font-bold text-navy-950">{meta.name}</span>
                      <span className="mt-0.5 block text-[10px] font-bold tracking-[0.14em] text-gdut-600 uppercase">Sport</span>
                    </span>
                  </div>
                  <span className="flex items-center gap-3 text-xs text-slate-400">
                    {item.league.season || '当前赛季'}
                    <span className="font-bold tracking-[0.12em] text-slate-300">0{index + 1}</span>
                  </span>
                </div>
                <h2 className="mt-7 text-xl font-bold tracking-[-0.025em] text-navy-950 transition group-hover:text-gdut-700">
                  {item.league.name}
                </h2>
                <div className="mt-auto pt-8">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>赛事进度</span>
                    <span className="font-semibold tabular-nums text-slate-700">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gdut-600" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 border-t border-slate-100 pt-4 text-sm">
                    <div>
                      <p className="data-label">队伍</p>
                      <p className="mt-1 font-semibold tabular-nums text-navy-950">{item.teams.length}</p>
                    </div>
                    <div>
                      <p className="data-label">比赛</p>
                      <p className="mt-1 font-semibold tabular-nums text-navy-950">{item.matches.length}</p>
                    </div>
                    <div>
                      <p className="data-label">已完成</p>
                      <p className="mt-1 font-semibold tabular-nums text-navy-950">{finished}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
