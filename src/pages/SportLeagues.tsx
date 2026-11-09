import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { SPORT_MAP, isSport } from '../sports';
import { LEAGUE_LEVELS, type LeagueLevel } from '../types';
import { useData } from '../data/store';
import { clockOf, dateOf, formatDate } from '../lib/format';
import NotFound from './NotFound';

function levelLabel(level: LeagueLevel) {
  return LEAGUE_LEVELS.find((item) => item.id === level)?.label ?? '友谊赛';
}

const BASKETBALL_FACES = ['lebron', 'jordan', 'kobe', 'yao', 'curry', 'george'].map(
  (name) => `${import.meta.env.BASE_URL}sports/faces/${name}.webp`,
);

export default function SportLeagues() {
  const { sport } = useParams();
  const { leagues } = useData();
  const [query, setQuery] = useState('');
  if (!isSport(sport)) return <NotFound />;
  const meta = SPORT_MAP[sport];
  const q = query.trim();
  const all = leagues.filter((item) => item.league.sport === sport);
  const list = all.filter((item) => !q || item.league.name.includes(q) || item.league.season.includes(q));

  return (
    <div>
      <div className="sport-masthead mb-10" data-watermark={meta.name}>
        <p className="eyebrow mb-3">Competitions</p>
        <h1 className="sport-poster">
          <span className="sport-poster-name">{meta.name}</span>
          <span className="sport-poster-mark">赛事</span>
        </h1>
        <p className="masthead-copy mt-4 text-sm">查看当前赛季全部{meta.name}联赛及比赛进度</p>
      </div>
      {all.length > 0 && (
        <div className="mb-4 flex justify-end">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`搜索${meta.name}联赛`}
            className="field w-full sm:w-72"
          />
        </div>
      )}
      {all.length === 0 && (
        <div className="empty-state">
          还没有联赛。
          <Link to="/admin" className="ml-1 text-gdut-600 hover:underline">
            去管理端创建一个
          </Link>
        </div>
      )}
      {all.length > 0 && list.length === 0 && <div className="empty-state">没有找到联赛</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((item) => {
          const done = item.matches.filter((match) => match.status === 'finished').length;
          const index = all.findIndex((entry) => entry.league.id === item.league.id);
          const portrait = item.league.logo || (sport === 'basketball' ? BASKETBALL_FACES[index % BASKETBALL_FACES.length] : '');
          return (
            <Link
              key={item.league.id}
              to={`/${sport}/${item.league.id}/schedule`}
              className="surface-interactive group relative overflow-hidden p-5"
            >
              <span className="sport-card-accent" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <p className="sport-season truncate">{item.league.season || '当前赛季'}</p>
                  <span className={`league-level-mark league-level-${item.league.level}`}>{levelLabel(item.league.level)}</span>
                </div>
                <span className="sport-index">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div className="mt-5 flex items-center gap-3">
                {portrait ? <img src={portrait} alt="" className="league-face" /> : null}
                <h2 className={`sport-league-name min-w-0 truncate league-level-${item.league.level}`}>{item.league.name}</h2>
              </div>
              <div className="mt-7 flex items-center justify-between border-t border-neutral-200 pt-4 text-sm">
                {item.league.kind === 'single' ? (
                  <>
                    <span className="sport-card-meta">单场比赛</span>
                    <span className="font-semibold tabular-nums text-neutral-950">
                      {item.matches[0]?.score && item.matches[0].status !== 'scheduled'
                        ? `${item.matches[0].score.home} : ${item.matches[0].score.away}`
                        : item.matches[0]
                          ? `${formatDate(dateOf(item.matches[0].time))} ${clockOf(item.matches[0].time)}`
                          : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="sport-card-meta">{item.teams.length} 支队伍</span>
                    <span className="font-semibold tabular-nums text-neutral-950">已赛 {done}/{item.matches.length}</span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
