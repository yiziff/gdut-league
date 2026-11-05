import { Link, useParams } from 'react-router';
import { useData } from '../data/store';
import { DIVISION_LABEL, SPORT_MAP } from '../sports';
import { placement, teamEntries, teamMatches } from '../lib/teamStats';
import MatchCard from '../components/MatchCard';
import NotFound from './NotFound';

const PLACEMENT_STYLE: Record<string, string> = {
  冠军: 'bg-amber-100 text-amber-700',
  亚军: 'bg-slate-200 text-slate-700',
  季军: 'bg-orange-100 text-orange-700',
  比赛中: 'bg-gdut-50 text-gdut-700',
};

export default function TeamDetail() {
  const { id } = useParams();
  const data = useData();
  const team = id ? data.teamMap[id] : undefined;
  if (!team) return <NotFound />;
  const league = data.leagues.find((item) => item.league.id === team.leagueId);
  const meta = league ? SPORT_MAP[league.league.sport] : undefined;

  const entries = teamEntries(data, team.id);
  const matches = teamMatches(data, team.id);
  const upcoming = matches.filter((match) => match.status !== 'finished');
  const results = matches.filter((match) => match.status === 'finished').reverse();

  return (
    <div>
      <Link to="/teams" className="text-sm text-gdut-600 hover:underline">
        ← 全部队伍
      </Link>
      <div className="mt-3 mb-6 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-xl text-lg font-bold text-white"
          style={{ backgroundColor: team.color }}
        >
          {team.short.slice(0, 2)}
        </span>
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {league && meta && (
            <p className="text-sm text-slate-500">
              {meta.icon} {meta.name} · {league.league.name}
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">
            {(team.players ?? []).length > 0 ? (team.players ?? []).map((player) => player.name).join('、') : '队员名单还没公布'}
          </p>
        </div>
      </div>

      <h2 className="mb-3 font-semibold">参赛项目</h2>
      {entries.length === 0 && <p className="mb-6 text-sm text-slate-400">还没有比赛</p>}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const sport = SPORT_MAP[entry.sport];
          const place = placement(data, entry, team.id);
          return (
            <Link
              key={`${entry.leagueId}-${entry.division}`}
              to={`/${entry.sport}/${entry.leagueId}/standings?division=${entry.division}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-gdut-500"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {sport.icon} {entry.leagueName} · {DIVISION_LABEL[entry.division]}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${PLACEMENT_STYLE[place] ?? 'bg-slate-100 text-slate-500'}`}>
                  {place}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {entry.group && `小组赛 ${entry.group} 组第 ${entry.rank}/${entry.groupSize} · `}
                总战绩 {entry.won} 胜{entry.drawn > 0 && ` ${entry.drawn} 平`} {entry.lost} 负
              </div>
            </Link>
          );
        })}
      </div>

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">即将进行</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </section>
      )}
      {results.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">比赛结果</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
