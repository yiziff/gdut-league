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
      <Link to="/teams" className="text-xs font-medium text-slate-500 hover:text-gdut-700">
        队伍 / 返回列表
      </Link>
      <div className="page-masthead mt-4 mb-10 flex flex-wrap items-center gap-5">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-md text-lg font-bold text-white shadow-lg ring-1 ring-white/20"
          style={{ backgroundColor: team.color }}
        >
          {team.short.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{team.name}</h1>
          {league && meta && (
            <p className="masthead-copy mt-2 text-sm">{meta.name} · {league.league.name}</p>
          )}
        </div>
        <div className="border-l border-white/15 pl-5 text-right">
          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">报名队员</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{(team.players ?? []).length}</p>
        </div>
      </div>

      <h2 className="section-title mb-4">队员名单</h2>
      {(team.players ?? []).length === 0 ? (
        <div className="empty-state mb-8">队员名单还没公布</div>
      ) : (
        <div className="surface mb-8 overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">班级</th>
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">号码</th>
              </tr>
            </thead>
            <tbody>
              {(team.players ?? []).map((player) => (
                <tr key={player.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{player.className || '—'}</td>
                  <td className="px-4 py-3 font-medium text-navy-950">{player.name}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{player.number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-title mb-4">参赛项目</h2>
      {entries.length === 0 && <p className="mb-6 text-sm text-slate-400">还没有比赛</p>}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const sport = SPORT_MAP[entry.sport];
          const place = placement(data, entry, team.id);
          return (
            <Link
              key={`${entry.leagueId}-${entry.division}`}
              to={`/${entry.sport}/${entry.leagueId}/standings?division=${entry.division}`}
              className="surface-interactive p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy-950">{entry.leagueName} · {DIVISION_LABEL[entry.division]}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${PLACEMENT_STYLE[place] ?? 'bg-slate-100 text-slate-500'}`}>
                  {place}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-gdut-600">{sport.name}</p>
              <div className="mt-3 text-sm text-slate-500">
                {entry.group && `小组赛 ${entry.group} 组第 ${entry.rank}/${entry.groupSize} · `}
                总战绩 {entry.won} 胜{entry.drawn > 0 && ` ${entry.drawn} 平`} {entry.lost} 负
              </div>
            </Link>
          );
        })}
      </div>

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title mb-4">即将进行</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </section>
      )}
      {results.length > 0 && (
        <section>
          <h2 className="section-title mb-4">比赛结果</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
