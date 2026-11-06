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
              filter === 'all' ? 'border-[#e08a3c] text-[#9a3e14]' : 'border-transparent text-slate-500 hover:text-[#9a3e14]'
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
                data-sport={sport.id}
                onClick={() => setFilter(sport.id)}
                className={`border-b-2 pb-3 text-sm font-semibold transition ${
                  filter === sport.id ? 'tone-tab-active' : 'border-transparent text-slate-500 hover:text-navy-900'
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
          {visible.map((item) => {
            const meta = SPORTS.find((sport) => sport.id === item.league.sport)!;
            const finished = item.matches.filter((match) => match.status === 'finished').length;
            const progress = item.matches.length > 0 ? Math.round((finished / item.matches.length) * 100) : 0;
            return (
              <Link
                key={item.league.id}
                to={`/${item.league.sport}/${item.league.id}/schedule`}
                data-sport={meta.id}
                data-watermark={meta.name}
                className="league-card min-h-60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="sport-chip" aria-hidden="true">
                      {meta.avatar ? <img src={meta.avatar} alt="" loading="lazy" /> : meta.icon}
                    </span>
                    <span>
                      <span className="sport-name block">{meta.name}</span>
                      <span className="sport-en mt-1.5 block">{meta.en}</span>
                    </span>
                  </div>
                  <span className="tone-muted text-xs">{item.league.season || '当前赛季'}</span>
                </div>
                <h2 className={`league-title mt-7 league-level-${item.league.level}`}>{item.league.name}</h2>
                <div className="mt-auto pt-8">
                  <div className="tone-muted mb-2 flex items-center justify-between text-xs">
                    <span>赛事进度</span>
                    <span className="tone-value font-semibold tabular-nums">{progress}%</span>
                  </div>
                  <div className="tone-track">
                    <div className="tone-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="tone-divider mt-4 grid grid-cols-3 border-t pt-4 text-sm">
                    <div>
                      <p className="tone-label">队伍</p>
                      <p className="tone-value mt-1 font-semibold tabular-nums">{item.teams.length}</p>
                    </div>
                    <div>
                      <p className="tone-label">比赛</p>
                      <p className="tone-value mt-1 font-semibold tabular-nums">{item.matches.length}</p>
                    </div>
                    <div>
                      <p className="tone-label">已完成</p>
                      <p className="tone-value mt-1 font-semibold tabular-nums">{finished}</p>
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
