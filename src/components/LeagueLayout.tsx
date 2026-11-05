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
  `border-b-2 px-4 py-2 text-sm font-medium transition ${
    isActive ? 'border-gdut-700 text-gdut-700' : 'border-transparent text-slate-500 hover:text-slate-800'
  }`;

export default function LeagueLayout() {
  const { sport, leagueId } = useParams();
  const { leagues } = useData();
  if (!isSport(sport)) return <NotFound />;
  const meta = SPORT_MAP[sport];
  const found = leagues.find((item) => item.league.id === leagueId && item.league.sport === sport);
  if (!found) return <NotFound />;
  const base = `/${sport}/${found.league.id}`;

  return (
    <div>
      <p className="text-sm text-slate-400">
        <NavLink to={`/${sport}`} className="hover:text-gdut-600">
          {meta.icon} {meta.name}
        </NavLink>
      </p>
      <h1 className="mb-1 text-2xl font-bold">{found.league.name}</h1>
      {found.league.season && <p className="mb-4 text-sm text-slate-500">{found.league.season}</p>}
      <div className="mb-6 flex border-b border-slate-200">
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
      <Outlet />
    </div>
  );
}
