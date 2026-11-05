import { useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../data/store';
import { SPORT_MAP } from '../sports';
import { teamEntries } from '../lib/teamStats';

export default function Teams() {
  const data = useData();
  const [query, setQuery] = useState('');
  const q = query.trim();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">参赛队伍</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索队伍"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-gdut-500 focus:outline-none sm:w-60"
        />
      </div>
      {data.leagues.map((item) => {
        const teams = item.teams.filter((team) => !q || team.name.includes(q) || team.short.includes(q));
        if (teams.length === 0) return null;
        const meta = SPORT_MAP[item.league.sport];
        return (
          <section key={item.league.id} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-500">
              {meta.icon} {meta.name} · {item.league.name}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => {
                const entries = teamEntries(data, team.id);
                const won = entries.reduce((sum, entry) => sum + entry.won, 0);
                const lost = entries.reduce((sum, entry) => sum + entry.lost, 0);
                return (
                  <Link
                    key={team.id}
                    to={`/teams/${team.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-gdut-500 hover:shadow"
                  >
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.short.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{team.name}</span>
                      <span className="block truncate text-xs text-slate-400">{item.league.name}</span>
                    </span>
                    <span className="text-right text-xs text-slate-500 tabular-nums">
                      {won} 胜 {lost} 负
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
      {data.leagues.every((item) => item.teams.filter((team) => !q || team.name.includes(q) || team.short.includes(q)).length === 0) && (
        <p className="py-12 text-center text-slate-400">没有找到队伍</p>
      )}
    </div>
  );
}
