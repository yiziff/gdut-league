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
      <div className="sport-masthead mb-10" data-watermark={meta.name}>
        <p className="eyebrow mb-3">Competitions</p>
        <h1 className="sport-poster">
          <span className="sport-poster-name">{meta.name}</span>
          <span className="sport-poster-mark">赛事</span>
        </h1>
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
              <span className="sport-card-accent" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {item.league.logo ? <img src={item.league.logo} alt="" className="league-logo" /> : null}
                  <p className="sport-season truncate">{item.league.season || '当前赛季'}</p>
                </div>
                <span className="sport-index">0{index + 1}</span>
              </div>
              <h2 className="sport-league-name mt-5">{item.league.name}</h2>
              <div className="mt-7 flex items-center justify-between border-t border-neutral-200 pt-4 text-sm">
                <span className="sport-card-meta">{item.teams.length} 支队伍</span>
                <span className="font-semibold tabular-nums text-neutral-950">已赛 {done}/{item.matches.length}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
