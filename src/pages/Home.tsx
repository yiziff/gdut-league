import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useData } from '../data/store';
import { SPORTS } from '../sports';
import { buildBracket } from '../lib/bracket';
import { dateOf, todayString } from '../lib/format';
import MatchCard from '../components/MatchCard';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function Home() {
  const { leagues, teamMap, allMatches } = useData();
  const today = todayString();
  const todays = allMatches.filter((match) => dateOf(match.time) === today);
  const upcoming = allMatches.filter((match) => match.status === 'scheduled' && dateOf(match.time) > today).slice(0, 6);
  const results = allMatches.filter((match) => match.status === 'finished' && dateOf(match.time) < today).slice(-6).reverse();
  const live = allMatches.filter((match) => match.status === 'live').length;

  return (
    <div>
      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-gdut-700 to-gdut-900 p-6 text-white shadow-lg md:p-8">
        <p className="text-sm text-gdut-100">2026 秋季学期</p>
        <h1 className="mt-1 text-2xl font-black md:text-3xl">广东工业大学 · 校园球类联赛</h1>
        <p className="mt-2 text-sm text-gdut-100">
          {SPORTS.length} 个项目 · {leagues.length} 个联赛 · {Object.keys(teamMap).length} 支队伍 · 共 {allMatches.length} 场比赛
          {live > 0 && <span className="ml-2 rounded bg-red-500 px-1.5 py-0.5 text-xs text-white">{live} 场进行中</span>}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SPORTS.map((sport) => {
            const own = leagues.filter((item) => item.league.sport === sport.id);
            const done = own.reduce((sum, item) => sum + item.matches.filter((match) => match.status === 'finished').length, 0);
            const total = own.reduce((sum, item) => sum + item.matches.length, 0);
            const champions = own.flatMap((item) =>
              item.divisions
                .map((division) => ({
                  division,
                  league: item.league.name,
                  teamId: buildBracket(item.matches.filter((match) => match.division === division)).champion,
                }))
                .filter((row) => row.teamId),
            );
            return (
              <Link
                key={sport.id}
                to={`/${sport.id}`}
                className="rounded-xl bg-white/10 p-3 backdrop-blur transition hover:bg-white/20"
              >
                <div className="text-2xl">{sport.icon}</div>
                <div className="mt-1 font-semibold">{sport.name}</div>
                <div className="text-xs text-gdut-100">
                  {own.length} 个联赛 · 已赛 {done}/{total}
                </div>
                {champions.slice(0, 2).map((row) => (
                  <div key={`${row.league}-${row.division}`} className="mt-1 truncate text-xs text-amber-200">
                    🏆 {row.league} {teamMap[row.teamId!]?.short}
                  </div>
                ))}
              </Link>
            );
          })}
        </div>
      </div>

      <Section title="今日赛事">
        {todays.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">今天没有比赛</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((match) => (
              <MatchCard key={match.id} match={match} showSport />
            ))}
          </div>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section title="近期赛程">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </Section>
      )}

      {results.length > 0 && (
        <Section title="最新赛果">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
