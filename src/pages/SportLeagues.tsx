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
      <div className="page-masthead mb-10">
        <p className="eyebrow mb-3">Competitions</p>
        <h1 className="page-title">{meta.name}赛事</h1>
        <p className="masthead-copy mt-4 text-sm">查看当前赛季全部{meta.name}联赛及比赛进度</p>
      </div>
      {list.length === 0 && (
        <div className="empty-state">
          还没有联赛。
          <Link to="/admin" className="ml-1 text-gdut-600 hover:underline">
            去管理端创建一个
          </Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((item, index) => {
          const done = item.matches.filter((match) => match.status === 'finished').length;
          return (
            <Link
              key={item.league.id}
              to={`/${sport}/${item.league.id}/schedule`}
              className="surface-interactive group relative overflow-hidden p-5"
            >
              <span className="absolute top-0 left-0 h-0.5 w-full origin-left scale-x-0 bg-gdut-600 transition group-hover:scale-x-100" />
              <div className="flex justify-between gap-3">
                <p className="text-xs font-semibold tracking-wide text-gdut-600 uppercase">{item.league.season || '当前赛季'}</p>
                <span className="text-[10px] font-bold tracking-[0.14em] text-slate-300">0{index + 1}</span>
              </div>
              <h2 className="mt-5 text-lg font-bold tracking-tight text-navy-950 transition group-hover:text-gdut-700">{item.league.name}</h2>
              <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                <span>{item.teams.length} 支队伍</span>
                <span className="tabular-nums">已赛 {done}/{item.matches.length}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
