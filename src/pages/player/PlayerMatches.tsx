import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../data/store';
import { clockOf, dateOf, formatDate, todayString } from '../../lib/format';
import { STAGE_LABEL } from '../../sports';
import type { Match } from '../../types';
import { usePlayerSession } from './session';

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00`);
  value.setDate(value.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function weekOf(date: string): string[] {
  const value = new Date(`${date}T00:00`);
  const weekday = value.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = shiftDate(date, mondayOffset);
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

export default function PlayerMatches() {
  const { leagues, teamMap, allMatches } = useData();
  const { profile } = usePlayerSession();
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [day, setDay] = useState(todayString());
  const days = useMemo(() => weekOf(day), [day]);
  const teamName = (id: string | null) => (id && teamMap[id]?.name) || '待定';

  const visible = allMatches.filter((match) => {
    if (dateOf(match.time) !== day) return false;
    if (scope === 'mine' && profile) return match.home === profile.team.id || match.away === profile.team.id;
    return true;
  });

  return (
    <div>
      <div className="mb-3 flex max-w-md rounded-full bg-white p-1 text-sm">
        <button type="button" onClick={() => setScope('all')} className={`flex-1 rounded-full py-1.5 ${scope === 'all' ? 'bg-player-600 font-semibold text-white' : 'text-slate-500'}`}>
          全部
        </button>
        <button type="button" onClick={() => setScope('mine')} className={`flex-1 rounded-full py-1.5 ${scope === 'mine' ? 'bg-player-600 font-semibold text-white' : 'text-slate-500'}`}>
          我的
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm">
        <button type="button" onClick={() => setDay(shiftDate(day, -7))} className="text-player-700">
          上一周
        </button>
        <button type="button" onClick={() => setDay(todayString())} className="font-medium">
          {day.slice(0, 7).replace('-', '年')}月
        </button>
        <button type="button" onClick={() => setDay(shiftDate(day, 7))} className="text-player-700">
          下一周
        </button>
      </div>
      <div className="mb-4 grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((date, index) => (
          <button key={date} type="button" onClick={() => setDay(date)} className={`rounded-xl py-2 ${date === day ? 'bg-player-600 text-white' : 'bg-white text-slate-500'}`}>
            <span className="block text-base font-semibold">{Number(date.slice(8))}</span>
            <span>{date === todayString() ? '今天' : WEEK[index]}</span>
          </button>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold">{formatDate(day)}</h2>
      {scope === 'mine' && !profile && (
        <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-500">
          登录后才能看自己队伍的比赛。{' '}
          <Link to="/player/login" className="font-medium text-player-700">
            去登录
          </Link>
        </p>
      )}
      {(scope === 'all' || profile) && visible.length === 0 && <p className="py-8 text-center text-sm text-slate-400">这天没有比赛。</p>}
      <div className="grid gap-2 lg:grid-cols-2">
        {(scope === 'all' || profile) &&
          visible.map((match) => (
            <MatchRow key={match.id} match={match} leagueName={leagues.find((item) => item.league.id === match.leagueId)?.league.name ?? ''} teamName={teamName} />
          ))}
      </div>
    </div>
  );
}

function MatchRow({ match, leagueName, teamName }: { match: Match; leagueName: string; teamName: (id: string | null) => string }) {
  const league = match.leagueId;
  const started = match.status !== 'scheduled' && match.score;
  return (
    <Link to={league ? `/${match.sport}/${league}/matches/${match.id}` : '/player/matches'} className="block rounded-xl border border-player-100 bg-white px-4 py-3">
      {leagueName && <p className="mb-1 text-xs text-slate-400">{leagueName}</p>}
      <div className="flex items-center gap-3">
        <div className="w-12 shrink-0 text-sm">
          <p className="font-semibold">{clockOf(match.time)}</p>
          <p className="text-xs text-slate-400">{STAGE_LABEL[match.stage]}</p>
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium">{teamName(match.home)}</p>
          <p className="truncate font-medium">{teamName(match.away)}</p>
        </div>
        <div className="text-right text-sm">
          {started ? (
            <>
              <p className="font-semibold tabular-nums">{match.score?.home}</p>
              <p className="font-semibold tabular-nums">{match.score?.away}</p>
            </>
          ) : (
            <span className="text-xs text-slate-400">比赛前瞻</span>
          )}
        </div>
      </div>
    </Link>
  );
}
