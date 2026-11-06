import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useData } from '../data/store';
import { SPORTS, SPORT_MAP } from '../sports';
import { clockOf, dateOf, formatDate, todayString } from '../lib/format';
import MatchCard from '../components/MatchCard';
import type { Match } from '../types';

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

function FocusMatch({ match, label }: { match: Match; label: string }) {
  const { leagues, teamMap } = useData();
  const league = leagues.find((item) => item.league.id === match.leagueId)?.league;
  const meta = SPORT_MAP[match.sport];
  const hasScore = match.status !== 'scheduled' && match.score;
  const path = match.leagueId ? `/${match.sport}/${match.leagueId}/matches/${match.id}` : '/events';

  return (
    <Link
      to={path}
      className="w-[17rem] shrink-0 rounded-lg border border-white/15 bg-white p-4 text-ink shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-blue-200 sm:w-[19rem] lg:min-w-[17rem] lg:flex-1"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium text-slate-500">
          <span className="mr-1.5" aria-hidden="true">{meta.icon}</span>
          {league?.name ?? meta.name}
        </span>
        <span className={`shrink-0 font-semibold ${match.status === 'live' ? 'text-red-600' : match.status === 'finished' ? 'text-slate-500' : 'text-gdut-700'}`}>
          {label}
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {(['home', 'away'] as const).map((side) => {
          const team = match[side] ? teamMap[match[side]!] : undefined;
          return (
            <div key={side} className="flex min-h-7 items-center justify-between gap-4">
              <span className={`flex min-w-0 items-center gap-2 ${!team ? 'text-slate-400 italic' : 'font-semibold text-navy-950'}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: team?.color ?? '#cbd5e1' }} />
                <span className="truncate">{team?.short ?? '待定'}</span>
              </span>
              <span className={`text-2xl font-bold tabular-nums ${match.status === 'live' ? 'text-red-600' : 'text-navy-950'}`}>
                {hasScore ? match.score![side] : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="shrink-0">{formatDate(dateOf(match.time))} {clockOf(match.time)}</span>
        <span className="truncate text-right">{match.venue || '场地待定'}</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { leagues, allMatches } = useData();
  const today = todayString();
  const todays = allMatches.filter((match) => dateOf(match.time) === today);
  const upcoming = allMatches.filter((match) => match.status === 'scheduled' && dateOf(match.time) > today).slice(0, 6);
  const results = allMatches.filter((match) => match.status === 'finished' && dateOf(match.time) < today).slice(-6).reverse();
  const liveMatches = allMatches.filter((match) => match.status === 'live');
  const latestResult = [...allMatches]
    .filter((match) => match.status === 'finished')
    .sort((a, b) => b.time.localeCompare(a.time))[0];
  const nextFixture = [...allMatches]
    .filter((match) => match.status === 'scheduled')
    .sort((a, b) => a.time.localeCompare(b.time))[0];
  const focusMatches = liveMatches.length > 0
    ? liveMatches
    : [latestResult, nextFixture].filter((match): match is Match => Boolean(match));

  return (
    <div>
      <section className="hero-panel mb-10">
        <span className={`absolute top-0 left-0 h-1 w-32 ${liveMatches.length > 0 ? 'bg-red-500' : 'bg-gdut-500'}`} aria-hidden="true" />
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
              {liveMatches.length > 0 && <span className="h-2 w-2 rounded-full bg-red-500 ring-4 ring-red-500/15" />}
              Game center
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.025em] text-white">
              {liveMatches.length > 0 ? '正在进行' : '比赛焦点'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">
              {liveMatches.length > 0 ? `${liveMatches.length} 场比赛进行中` : '最近赛果与下一场比赛'}
            </span>
            <Link to="/events" className="text-xs font-semibold text-blue-200 hover:text-white">
              全部赛事 →
            </Link>
          </div>
        </header>
        <div className="flex gap-3 overflow-x-auto p-3 sm:p-4 [scrollbar-width:none]">
          {focusMatches.map((match) => (
            <FocusMatch
              key={match.id}
              match={match}
              label={match.status === 'live' ? '进行中' : match.status === 'finished' ? '最近赛果' : '下一场'}
            />
          ))}
          {focusMatches.length === 0 && (
            <div className="w-full px-5 py-8 text-center text-sm text-slate-400">暂无比赛安排</div>
          )}
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
