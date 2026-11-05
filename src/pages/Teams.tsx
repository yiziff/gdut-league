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
      <div className="page-masthead mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">Teams directory</p>
          <h1 className="page-title">参赛队伍</h1>
          <p className="masthead-copy mt-3 text-sm">浏览各项目联赛的参赛队伍与赛季战绩</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="mb-2 block text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">Search team</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入队伍名称"
            className="field w-full border-white/20 bg-white/95"
          />
        </label>
      </div>
      {data.leagues.map((item) => {
        const teams = item.teams.filter((team) => !q || team.name.includes(q) || team.short.includes(q));
        if (teams.length === 0) return null;
        const meta = SPORT_MAP[item.league.sport];
        return (
          <section key={item.league.id} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-navy-950">{meta.name} · {item.league.name}</h2>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">{teams.length} 支</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => {
                const entries = teamEntries(data, team.id);
                const won = entries.reduce((sum, entry) => sum + entry.won, 0);
                const lost = entries.reduce((sum, entry) => sum + entry.lost, 0);
                return (
                  <Link
                    key={team.id}
                    to={`/teams/${team.id}`}
                    className="surface-interactive group flex items-center gap-4 overflow-hidden p-4"
                  >
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-sm font-bold text-white shadow-sm ring-1 ring-black/5"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.short.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-navy-950 transition group-hover:text-gdut-700">{team.name}</span>
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
        <div className="empty-state">没有找到队伍</div>
      )}
    </div>
  );
}
