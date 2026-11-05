import { Link } from 'react-router';
import type { Match, Side } from '../types';
import { DIVISION_LABEL, SPORT_MAP, STAGE_LABEL } from '../sports';
import { useData } from '../data/store';
import { winnerSide } from '../lib/bracket';
import { clockOf, dateOf, formatDate, slotLabel } from '../lib/format';
import StatusBadge from './StatusBadge';
import TeamName from './TeamName';

interface Props {
  match: Match;
  showSport?: boolean;
  showDate?: boolean;
}

export default function MatchCard({ match: m, showSport = false, showDate = false }: Props) {
  const meta = SPORT_MAP[m.sport];
  const winner = winnerSide(m);
  const { leagues } = useData();
  const all = leagues.find((league) => league.league.id === m.leagueId)?.matches ?? [];
  const hasScore = m.status !== 'scheduled' && m.score;
  const stage = m.stage === 'group' ? `${m.group}组` : STAGE_LABEL[m.stage];

  const row = (side: Side) => (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <TeamName teamId={m[side]} placeholder={slotLabel(m, side, all)} bold={winner === side} plain />
      <span className="flex items-center gap-1.5">
        {m.forfeit === side && <span className="text-xs text-red-500">弃权</span>}
        {m.penalties && <span className="text-xs text-slate-400">({m.penalties[side]})</span>}
        <span
          className={`w-9 text-right text-xl tabular-nums ${
            m.status === 'live' ? 'font-bold text-red-600' : winner === side ? 'font-bold text-navy-950' : 'font-medium text-slate-500'
          }`}
        >
          {hasScore ? m.score![side] : '—'}
        </span>
      </span>
    </div>
  );

  const card = (
    <div
      className={`surface-interactive group overflow-hidden ${
        m.status === 'live' ? 'border-l-2 border-l-red-500' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span className="truncate font-medium">
          {showSport && `${meta.name} · `}
          {DIVISION_LABEL[m.division]} · {stage}
        </span>
        <StatusBadge status={m.status} />
      </div>
      <div className="px-4 py-4">
        <div className="space-y-2">
          {row('home')}
          {row('away')}
        </div>
        {m.sets && m.sets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 text-xs tabular-nums text-slate-500">
            {m.sets.map(([h, a], i) => (
              <span key={i} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                {h}-{a}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500">
        <span className="font-medium tabular-nums">
          {showDate && `${formatDate(dateOf(m.time))} `}
          {clockOf(m.time)}
        </span>
        <span className="truncate text-right">{m.venue}</span>
      </div>
    </div>
  );

  if (!m.leagueId) return card;
  return (
    <Link to={`/${m.sport}/${m.leagueId}/matches/${m.id}`} className="block">
      {card}
    </Link>
  );
}
