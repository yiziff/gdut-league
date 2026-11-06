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

function FocusMatch({ match, label, tone }: { match: Match; label: string; tone: 'hot' | 'next' }) {
  const { leagues, teamMap } = useData();
  const league = leagues.find((item) => item.league.id === match.leagueId)?.league;
  const meta = SPORT_MAP[match.sport];
  const hasScore = match.status !== 'scheduled' && match.score;
  const path = match.leagueId ? `/${match.sport}/${match.leagueId}/matches/${match.id}` : '/events';

  return (
    <Link
      to={path}
      className="rounded-lg border border-white/80 bg-white p-3.5 text-ink shadow-md shadow-orange-950/10 transition hover:-translate-y-0.5 hover:border-orange-200"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium text-slate-500">
          <span className="mr-1.5" aria-hidden="true">{meta.icon}</span>
          {league?.name ?? meta.name}
        </span>
        <span className={`shrink-0 font-semibold ${tone === 'hot' ? 'text-[#c45c22]' : 'text-[#9a3e14]'}`}>
          {label}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {(['home', 'away'] as const).map((side) => {
          const team = match[side] ? teamMap[match[side]!] : undefined;
          return (
            <div key={side} className="flex min-h-6 items-center justify-between gap-4">
              <span className={`flex min-w-0 items-center gap-2 ${!team ? 'text-slate-400 italic' : 'font-semibold text-navy-950'}`}>
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: team?.color ?? '#cbd5e1' }} />
                <span className="truncate">{team?.short ?? '待定'}</span>
              </span>
              <span className="text-xl font-bold tabular-nums text-navy-950">
                {hasScore ? match.score![side] : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
        <span className="shrink-0">{formatDate(dateOf(match.time))} {clockOf(match.time)}</span>
        <span className="truncate text-right">{match.venue || '场地待定'}</span>
      </div>
    </Link>
  );
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Home() {
  const { leagues, allMatches } = useData();
  const today = todayString();
  const todays = allMatches.filter((match) => dateOf(match.time) === today);
  const upcoming = allMatches.filter((match) => match.status === 'scheduled' && dateOf(match.time) > today).slice(0, 6);
  const results = allMatches.filter((match) => match.status === 'finished' && dateOf(match.time) < today).slice(-6).reverse();
  const now = nowStamp();
  const hotMatch = [...allMatches]
    .filter((match) => match.status !== 'scheduled' && match.score)
    .sort((a, b) => b.time.localeCompare(a.time))[0];
  const nextMatch = [...allMatches]
    .filter((match) => match.status === 'scheduled' && match.time.replace('T', ' ') >= now && match.id !== hotMatch?.id)
    .sort((a, b) => a.time.localeCompare(b.time))[0];
  const focusMatches = [
    hotMatch ? { match: hotMatch, label: '热门比赛', tone: 'hot' as const } : null,
    nextMatch ? { match: nextMatch, label: '即将开始', tone: 'next' as const } : null,
  ].filter((item): item is { match: Match; label: string; tone: 'hot' | 'next' } => Boolean(item));

  return (
    <div>
      <section className="hero-panel hero-live mb-8">
        <span className="absolute top-0 left-0 h-1 w-24 bg-white/55" aria-hidden="true" />
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-white/75 uppercase">Game center</p>
            <h1 className="mt-0.5 text-lg font-bold tracking-[-0.025em] text-white">焦点比赛</h1>
          </div>
          <Link to="/events" className="text-xs font-semibold text-orange-50 hover:text-white">
            全部赛事 →
          </Link>
        </header>
        <div className={`grid gap-3 p-3 sm:p-3.5 ${focusMatches.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {focusMatches.map((item) => (
            <FocusMatch key={item.match.id} match={item.match} label={item.label} tone={item.tone} />
          ))}
          {focusMatches.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-white/80">暂无比赛安排</div>
          )}
        </div>
      </section>

      <Section
        eyebrow="Competitions"
        title="赛事项目"
        action={
          <Link to="/events" className="text-sm font-semibold text-[#c45c22] hover:text-[#9a3e14]">
            全部赛事
          </Link>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SPORTS.map((sport) => {
            const own = leagues.filter((item) => item.league.sport === sport.id);
            const done = own.reduce((sum, item) => sum + item.matches.filter((match) => match.status === 'finished').length, 0);
            const total = own.reduce((sum, item) => sum + item.matches.length, 0);
            return (
              <Link key={sport.id} to={`/${sport.id}`} data-sport={sport.id} data-watermark={sport.name} className="league-card league-card-compact">
                <div className="flex items-center gap-3">
                  <span className="sport-chip sport-chip-sm" aria-hidden="true">
                    {sport.avatar ? <img src={sport.avatar} alt="" loading="lazy" /> : sport.icon}
                  </span>
                  <p className="sport-name">{sport.name}</p>
                </div>
                <p className="sport-en mt-2">{sport.en}</p>
                <p className="tone-muted mt-1 text-xs">{own.length} 个联赛</p>
                <div className="tone-muted mt-6 flex items-end justify-between text-xs">
                  <span>完成场次</span>
                  <span className="tone-value text-sm font-semibold tabular-nums">
                    {done}/{total}
                  </span>
                </div>
                <div className="tone-track mt-2 h-1">
                  <div className="tone-fill" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
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
