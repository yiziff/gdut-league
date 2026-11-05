import { Link, useParams } from 'react-router';
import { SPORT_MAP, isSport } from '../sports';
import { useData } from '../data/store';
import NotFound from './NotFound';

export default function SportLeagues() {
  const { sport } = useParams();
  const { leagues } = useData();
  if (!isSport(sport)) return <NotFound />;
  const meta = SPORT_MAP[sport];
  const list = leagues.filter((item) => item.league.sport === sport);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">
        {meta.icon} {meta.name}
      </h1>
      <p className="mb-6 text-sm text-slate-500">这个项目下的全部联赛</p>
      {list.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-400">
          还没有联赛。
          <Link to="/admin" className="ml-1 text-gdut-600 hover:underline">
            去管理端创建一个
          </Link>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((item) => {
          const done = item.matches.filter((match) => match.status === 'finished').length;
          return (
            <Link
              key={item.league.id}
              to={`/${sport}/${item.league.id}/schedule`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-gdut-500"
            >
              <h2 className="text-lg font-bold">{item.league.name}</h2>
              {item.league.season && <p className="mt-1 text-sm text-slate-500">{item.league.season}</p>}
              <p className="mt-3 text-sm text-slate-500">
                {item.teams.length} 支队伍 · 已赛 {done}/{item.matches.length}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
