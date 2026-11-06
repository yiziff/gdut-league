import { Link } from 'react-router';
import MatchCard from '../../components/MatchCard';
import { useData } from '../../data/store';
import { SPORT_MAP } from '../../sports';
import { usePlayerSession } from './session';

export default function PlayerHome() {
  const { leagues, allMatches } = useData();
  const { profile } = usePlayerSession();
  const upcoming = allMatches.filter((match) => match.status !== 'finished').slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="hero-panel px-5 py-7 sm:px-8">
        <span className="absolute top-0 left-0 h-1 w-24 bg-player-500" aria-hidden="true" />
        <p className="text-xs font-semibold tracking-[0.16em] text-white/75 uppercase">Player center</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{profile ? `${profile.player.name}，你好` : '球员中心'}</h1>
        <p className="mt-2 text-sm text-white/80">{profile ? `${profile.team.name} · ${profile.league.name}` : '登录后查看本队赛程、生涯数据与个人资料。'}</p>
        {!profile && (
          <Link to="/player/login" className="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-slate-100">
            球员登录
          </Link>
        )}
      </section>

      <section>
        <h2 className="section-title mb-4">参赛联赛</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map(({ league }) => (
            <Link key={league.id} to={`/${league.sport}/${league.id}/schedule`} className="surface-interactive block px-4 py-4">
              <p className="text-xs font-medium text-gdut-600">
                {SPORT_MAP[league.sport].name}
                {league.season ? ` · ${league.season}` : ''}
              </p>
              <p className="mt-1 font-semibold text-navy-950">{league.name}</p>
            </Link>
          ))}
          {leagues.length === 0 && <p className="text-sm text-slate-400">还没有联赛。</p>}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-4">最近的比赛</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {upcoming.map((match) => <MatchCard key={match.id} match={match} showSport showDate />)}
          {upcoming.length === 0 && <p className="text-sm text-slate-400">没有未结束的比赛。</p>}
        </div>
      </section>
    </div>
  );
}
