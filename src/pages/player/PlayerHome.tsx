import { Link } from 'react-router';
import { useData } from '../../data/store';
import { clockOf, dateOf, formatDate } from '../../lib/format';
import { SPORT_MAP, STAGE_LABEL } from '../../sports';
import { usePlayerSession } from './session';

export default function PlayerHome() {
  const { leagues, teamMap, allMatches } = useData();
  const { profile } = usePlayerSession();
  const teamName = (id: string | null) => (id && teamMap[id]?.short) || '待定';
  const upcoming = allMatches.filter((match) => match.status !== 'finished').slice(0, 5);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-player-600 px-4 py-4 text-white">
        <p className="text-xs text-player-100">球员端</p>
        <h1 className="mt-1 text-lg font-bold">{profile ? `${profile.player.name}，你好` : '看看最近的比赛'}</h1>
        <p className="mt-1 text-sm text-player-100">{profile ? `${profile.team.name} · ${profile.league.name}` : '登录后可以看自己队伍的赛程和生涯数据。'}</p>
        {!profile && (
          <Link to="/player/login" className="mt-3 inline-block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-player-700">
            球员登录
          </Link>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">联赛</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map(({ league }) => (
            <Link key={league.id} to={`/${league.sport}/${league.id}/schedule`} className="block rounded-xl border border-player-100 bg-white px-4 py-3">
              <p className="text-xs text-slate-400">
                {SPORT_MAP[league.sport].icon} {SPORT_MAP[league.sport].name}
                {league.season ? ` · ${league.season}` : ''}
              </p>
              <p className="font-medium">{league.name}</p>
            </Link>
          ))}
          {leagues.length === 0 && <p className="text-sm text-slate-400">还没有联赛。</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">最近的比赛</h2>
        <div className="grid gap-2 lg:grid-cols-2">
          {upcoming.map((match) => {
            const league = leagues.find((item) => item.league.id === match.leagueId)?.league;
            return (
              <Link key={match.id} to={league ? `/${league.sport}/${league.id}/matches/${match.id}` : '/player/matches'} className="block rounded-xl border border-player-100 bg-white px-4 py-3">
                <p className="text-xs text-slate-400">
                  {formatDate(dateOf(match.time))} {clockOf(match.time)} · {STAGE_LABEL[match.stage]}
                </p>
                <p className="mt-1 font-medium">
                  {teamName(match.home)} <span className="text-slate-300">vs</span> {teamName(match.away)}
                </p>
                {league && <p className="mt-0.5 text-xs text-slate-400">{league.name}</p>}
              </Link>
            );
          })}
          {upcoming.length === 0 && <p className="text-sm text-slate-400">没有未结束的比赛。</p>}
        </div>
      </section>
    </div>
  );
}
