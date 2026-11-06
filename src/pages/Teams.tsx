import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useData } from '../data/store';
import type { LeagueData } from '../data/prepare';
import { SPORT_MAP } from '../sports';
import type { League, Sport, Team } from '../types';

type Participation = {
  team: Team;
  league: League;
  sport: Sport;
  showShort: boolean;
};

type College = {
  name: string;
  participations: Participation[];
};

function heat(item: LeagueData) {
  return item.matches.length * 100 + item.teams.length;
}

function matchesQuery(team: Team, query: string) {
  return team.name.includes(query) || team.short.includes(query);
}

function groupColleges(entries: { team: Team; league: League }[]): College[] {
  const buckets = new Map<string, { team: Team; league: League }[]>();
  for (const entry of entries) {
    const key = entry.team.name.trim() || entry.team.short;
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .map(([name, participations]) => {
      const perLeague = new Map<string, number>();
      for (const item of participations) perLeague.set(item.league.id, (perLeague.get(item.league.id) ?? 0) + 1);
      return {
        name,
        participations: participations
          .map((item) => ({
            ...item,
            sport: item.league.sport,
            showShort: (perLeague.get(item.league.id) ?? 0) > 1,
          }))
          .sort((a, b) => a.league.sport.localeCompare(b.league.sport) || a.league.name.localeCompare(b.league.name, 'zh')),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

function tagLabel(item: Participation) {
  const sport = SPORT_MAP[item.sport].name;
  const short = item.showShort ? ` · ${item.team.short}` : '';
  return `${sport} · ${item.league.name}${short}`;
}

export default function Teams() {
  const data = useData();
  const [query, setQuery] = useState('');
  const q = query.trim();
  const hot = [...data.leagues].sort((a, b) => heat(b) - heat(a) || a.league.name.localeCompare(b.league.name, 'zh')).slice(0, 3);
  const hotIds = new Set(hot.map((item) => item.league.id));

  const searched = q
    ? groupColleges(
        data.leagues.flatMap((item) =>
          item.teams.filter((team) => matchesQuery(team, q)).map((team) => ({ team, league: item.league })),
        ),
      )
    : [];

  return (
    <div>
      <div className="page-masthead mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">Teams directory</p>
          <h1 className="page-title">参赛队伍</h1>
          <p className="masthead-copy mt-3 text-sm">默认展示三场最热门联赛。搜索学院名称，可以看它参加的全部比赛。</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="mb-2 block text-[10px] font-bold tracking-[0.14em] uppercase">Search team</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入学院或队伍名称"
            className="field w-full border-white/20 bg-white/95"
          />
        </label>
      </div>

      {q ? (
        searched.length === 0 ? (
          <div className="empty-state">没有找到队伍</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {searched.map((college) => (
              <article key={college.name} className="surface p-5">
                <h2 className="text-base font-semibold text-navy-950">{college.name}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {college.participations.map((item) => (
                    <Link key={item.team.id} to={`/teams/${item.team.id}`} data-sport={item.sport} className="team-tag">
                      {tagLabel(item)}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-8">
          {hot.map((item) => {
            const meta = SPORT_MAP[item.league.sport];
            const teams = [...item.teams].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
            return (
              <section key={item.league.id}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-navy-950">
                    {meta.name} · {item.league.name}
                  </h2>
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs text-slate-400">{teams.length} 支</span>
                </div>
                {teams.length === 0 ? (
                  <p className="text-sm text-slate-400">还没有报名队伍</p>
                ) : (
                  <OneRow>
                    {teams.map((team) => (
                      <Link key={team.id} to={`/teams/${team.id}`} data-sport={item.league.sport} className="team-tag">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </Link>
                    ))}
                  </OneRow>
                )}
              </section>
            );
          })}
          {data.leagues.some((item) => !hotIds.has(item.league.id) && item.teams.length > 0) && (
            <p className="text-sm text-slate-400">其他联赛的队伍请用上方搜索。</p>
          )}
        </div>
      )}
    </div>
  );
}

function OneRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, children]);

  return (
    <div>
      <div ref={ref} className={open ? 'flex flex-wrap gap-2' : 'team-row flex flex-nowrap gap-2 overflow-hidden'}>
        {children}
      </div>
      {(overflows || open) && (
        <button type="button" onClick={() => setOpen((value) => !value)} className="mt-3 text-xs font-semibold text-[#c45c22] hover:text-[#9a3e14]">
          {open ? '收起' : '展开全部'}
        </button>
      )}
    </div>
  );
}
