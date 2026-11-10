import { useMemo, useState } from 'react';
import MatchCard from '../../components/MatchCard';
import { NeedProfile } from './AccountSwitcher';
import { useData } from '../../data/store';
import { dateOf, formatDate, todayString } from '../../lib/format';
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
  const { allMatches } = useData();
  const { accounts, profile } = usePlayerSession();
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [day, setDay] = useState(todayString());
  const days = useMemo(() => weekOf(day), [day]);
  const myTeams = new Set(accounts.map((account) => account.team.id));

  const visible = allMatches.filter((match) => {
    if (dateOf(match.time) !== day) return false;
    if (scope === 'mine' && profile) return myTeams.has(match.home ?? '') || myTeams.has(match.away ?? '');
    return true;
  });

  return (
    <div>
      <p className="eyebrow mb-2">Fixtures</p>
      <h1 className="page-title mb-6">比赛日程</h1>

      <div className="surface mb-4 flex max-w-sm p-1 text-sm">
        <button type="button" onClick={() => setScope('all')} className={`flex-1 rounded-md py-2 ${scope === 'all' ? 'bg-gdut-700 font-semibold text-white' : 'text-slate-500 hover:text-gdut-800'}`}>
          全部
        </button>
        <button type="button" onClick={() => setScope('mine')} className={`flex-1 rounded-md py-2 ${scope === 'mine' ? 'bg-gdut-700 font-semibold text-white' : 'text-slate-500 hover:text-gdut-800'}`}>
          我的
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm">
        <button type="button" onClick={() => setDay(shiftDate(day, -7))} className="font-medium text-gdut-700">
          上一周
        </button>
        <button type="button" onClick={() => setDay(todayString())} className="font-semibold text-navy-950">
          {day.slice(0, 7).replace('-', '年')}月
        </button>
        <button type="button" onClick={() => setDay(shiftDate(day, 7))} className="font-medium text-gdut-700">
          下一周
        </button>
      </div>
      <div className="surface mb-6 grid grid-cols-7 gap-1 p-2 text-center text-xs">
        {days.map((date, index) => (
          <button key={date} type="button" onClick={() => setDay(date)} className={`rounded-lg py-2 ${date === day ? 'bg-gdut-700 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="block text-base font-semibold">{Number(date.slice(8))}</span>
            <span>{date === todayString() ? '今天' : WEEK[index]}</span>
          </button>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-navy-950">{formatDate(day)}</h2>
      {scope === 'mine' && !profile && <NeedProfile action="才能看自己队伍的比赛" />}
      {(scope === 'all' || profile) && visible.length === 0 && <div className="empty-state">这天没有比赛。</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        {(scope === 'all' || profile) &&
          visible.map((match) => <MatchCard key={match.id} match={match} showSport />)}
      </div>
    </div>
  );
}
