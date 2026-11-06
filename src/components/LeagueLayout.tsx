import { NavLink, Outlet, useParams } from 'react-router';
import { SPORT_MAP, isSport } from '../sports';
import { useData } from '../data/store';
import type { LeagueData } from '../data/prepare';
import NotFound from '../pages/NotFound';

export function useLeague(): LeagueData {
  const { sport, leagueId } = useParams();
  const { leagues } = useData();
  const found = leagues.find((item) => item.league.id === leagueId && item.league.sport === sport);
  if (!isSport(sport) || !found) throw new Error(`unknown league: ${leagueId}`);
  return found;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 border-b-2 px-1 pb-3 text-sm font-semibold transition ${
    isActive ? 'tone-tab-active' : 'border-transparent text-slate-500 hover:text-navy-900'
  }`;

export default function LeagueLayout() {
  const { sport, leagueId } = useParams();
  const { leagues } = useData();
  if (!isSport(sport)) return <NotFound />;
  const meta = SPORT_MAP[sport];
  const found = leagues.find((item) => item.league.id === leagueId && item.league.sport === sport);
  if (!found) return <NotFound />;
  const base = `/${sport}/${found.league.id}`;
  const finished = found.matches.filter((match) => match.status === 'finished').length;

  return (
    <div>
      <div className="page-masthead pb-11">
        <p className="mb-4 text-xs font-medium text-slate-400">
          <NavLink to="/events" className="hover:text-white">
            赛事中心
          </NavLink>
          <span className="mx-2">/</span>
          <NavLink to={`/${sport}`} className="hover:text-white">
            {meta.name}
          </NavLink>
        </p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-3">{meta.name}</p>
            <h1 className={`page-title league-level-${found.league.level}`}>{found.league.name}</h1>
            {found.league.season && <p className="masthead-copy mt-3 text-sm">{found.league.season}</p>}
          </div>
          <dl className="flex divide-x divide-white/15 text-sm">
            <div className="pr-6">
              <dt className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">队伍</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-white">{found.teams.length}</dd>
            </div>
            <div className="px-6">
              <dt className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">比赛</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-white">{found.matches.length}</dd>
            </div>
            <div className="pl-6">
              <dt className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">已完成</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-white">{finished}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="subnav-panel mb-8">
        <div className="flex min-w-max gap-8">
          <NavLink to={`${base}/schedule`} className={tabClass}>
            赛程
          </NavLink>
          <NavLink to={`${base}/standings`} className={tabClass}>
            积分榜
          </NavLink>
          <NavLink to={`${base}/bracket`} className={tabClass}>
            对阵图
          </NavLink>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
