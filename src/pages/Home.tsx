import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useData } from '../data/store';
import { SPORTS } from '../sports';
import { clockOf, dateOf, formatDate, todayString } from '../lib/format';
import MatchCard from '../components/MatchCard';

function Section({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">{eyebrow}</p>
          <h2 className="section-title">{title}</h2>
        </div>
        {action}
      </div>
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
  const featured = allMatches.find((match) => match.status === 'live') ?? todays.find((match) => match.status === 'scheduled') ?? upcoming[0];
  const featuredLeague = leagues.find((item) => item.league.id === featured?.leagueId);
  const teamLabel = (id: string | null) => (id ? teamMap[id]?.short ?? teamMap[id]?.name ?? '待定' : '待定');

  return (
    <div>
      <section className="hero-panel mb-12">
        <span className="absolute top-0 left-0 h-1 w-32 bg-gdut-500" aria-hidden="true" />
        <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6 sm:p-9 lg:p-12">
            <p className="text-[11px] font-bold tracking-[0.22em] text-blue-200 uppercase">GDUT Official Competition Center</p>
            <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-bold tracking-[-0.045em] sm:text-5xl lg:text-[3.5rem]">
              2026 秋季
              <span className="block text-slate-300">校园球类联赛</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              集中查看校内五大球类项目的赛程、实时赛果、积分排名与淘汰赛进程。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/events" className="inline-flex items-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-navy-950 shadow-lg shadow-black/10 transition hover:-translate-y-px hover:bg-blue-50">
                查看全部赛事 <span className="ml-2 text-gdut-600">→</span>
              </Link>
              <Link to="/teams" className="inline-flex items-center rounded-md border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10">
                浏览参赛队伍
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-2 border-t border-white/15 pt-6 sm:grid-cols-4">
              {[
                ['项目', SPORTS.length],
                ['联赛', leagues.length],
                ['队伍', Object.keys(teamMap).length],
                ['比赛', allMatches.length],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-white/10 px-4 first:border-l-0 first:pl-0 sm:first:pl-0">
                  <dt className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">{label}</dt>
                  <dd className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-white/10 bg-navy-900/55 p-6 sm:p-9 lg:border-t-0 lg:border-l lg:p-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
                {featured?.status === 'live' ? 'Live now' : 'Next fixture'}
              </p>
              {live > 0 && <span className="text-xs font-semibold text-red-300">{live} 场进行中</span>}
            </div>
            {featured ? (
              <Link
                to={`/${featured.sport}/${featured.leagueId}/matches/${featured.id}`}
                className="mt-5 block rounded-[10px] border border-white/15 bg-white p-5 text-ink shadow-2xl shadow-black/15 transition hover:-translate-y-0.5 hover:border-blue-200"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="truncate">{featuredLeague?.league.name ?? SPORTS.find((item) => item.id === featured.sport)?.name}</span>
                  <span>{featured.status === 'live' ? '进行中' : formatDate(dateOf(featured.time))}</span>
                </div>
                <div className="mt-6 space-y-4">
                  {(['home', 'away'] as const).map((side) => (
                    <div key={side} className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-navy-950">{teamLabel(featured[side])}</span>
                      <span className="text-2xl font-bold tabular-nums text-navy-950">
                        {featured.score ? featured.score[side] : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <span>{clockOf(featured.time)}</span>
                  <span className="truncate">{featured.venue}</span>
                </div>
              </Link>
            ) : (
              <div className="mt-5 rounded-xl border border-white/15 px-5 py-12 text-center text-sm text-slate-400">暂无待进行比赛</div>
            )}
          </div>
        </div>
      </section>

      <Section
        eyebrow="Competitions"
        title="赛事项目"
        action={
          <Link to="/events" className="text-sm font-semibold text-gdut-700 hover:text-gdut-800">
            全部赛事
          </Link>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SPORTS.map((sport, index) => {
            const own = leagues.filter((item) => item.league.sport === sport.id);
            const done = own.reduce((sum, item) => sum + item.matches.filter((match) => match.status === 'finished').length, 0);
            const total = own.reduce((sum, item) => sum + item.matches.length, 0);
            return (
              <Link key={sport.id} to={`/${sport.id}`} className="surface-interactive group relative overflow-hidden p-5">
                <span className="absolute top-0 left-0 h-0.5 w-full origin-left scale-x-0 bg-gdut-600 transition group-hover:scale-x-100" />
                <div className="flex items-start justify-between">
                  <p className="text-sm font-bold text-navy-950">{sport.name}</p>
                  <span className="text-[10px] font-bold tracking-[0.14em] text-slate-300">0{index + 1}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{own.length} 个联赛</p>
                <div className="mt-6 flex items-end justify-between">
                  <span className="text-xs text-slate-400">完成场次</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">
                    {done}/{total}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden bg-slate-100">
                  <div className="h-full bg-gdut-600" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section eyebrow="Game center" title="今日赛事">
        {todays.length === 0 ? (
          <div className="empty-state">今天没有安排比赛</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((match) => (
              <MatchCard key={match.id} match={match} showSport />
            ))}
          </div>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section eyebrow="Schedule" title="近期赛程">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </Section>
      )}

      {results.length > 0 && (
        <Section eyebrow="Results" title="最新赛果">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((match) => (
              <MatchCard key={match.id} match={match} showSport showDate />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
