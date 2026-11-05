import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { CareerSummary } from '../../lib/career';
import { STAT_FIELDS } from '../../lib/playerStats';
import type { Sport } from '../../types';
import { api } from '../admin/api';
import { usePlayerSession } from './session';

type CareerResponse = CareerSummary & { sport: Sport };

function dash(value: string | number) {
  return <span className="text-2xl font-bold tabular-nums">{value}</span>;
}

export default function PlayerCareer() {
  const { profile, ready } = usePlayerSession();
  const [career, setCareer] = useState<CareerResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    api<CareerResponse>('/api/player/career')
      .then(setCareer)
      .catch(() => setError('生涯数据加载失败'));
  }, [profile]);

  if (!ready) return <p className="py-10 text-center text-sm text-slate-400">加载中…</p>;
  if (!profile) {
    return (
      <p className="mx-auto max-w-lg rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500">
        登录后查看生涯数据。{' '}
        <Link to="/player/login" className="font-medium text-player-700">
          去登录
        </Link>
      </p>
    );
  }

  const rate = career?.winRate == null ? '—' : `${Math.round(career.winRate * 100)}%`;
  const fields = STAT_FIELDS[profile.league.sport];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="rounded-2xl bg-white p-4">
        <p className="text-sm text-slate-400">
          {profile.team.name} · #{profile.player.number || '—'}
        </p>
        <h1 className="text-xl font-bold">{profile.player.name}</h1>
        <p className="text-sm text-slate-500">
          {[profile.player.position, profile.player.height && `${profile.player.height}cm`, profile.player.weight && `${profile.player.weight}kg`].filter(Boolean).join(' · ') || '资料还没填完'}
        </p>
      </section>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <section className="grid grid-cols-4 gap-2 rounded-2xl bg-white p-3 text-center">
        <div>
          {dash(career?.played ?? '—')}
          <p className="text-xs text-slate-400">出场</p>
        </div>
        <div>
          {dash(career?.won ?? '—')}
          <p className="text-xs text-slate-400">胜场</p>
        </div>
        <div>
          {dash(rate)}
          <p className="text-xs text-slate-400">胜率</p>
        </div>
        <div>
          {dash(career?.streak ?? '—')}
          <p className="text-xs text-slate-400">连胜</p>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">生涯数据</h2>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((field) => (
            <div key={field.key} className="rounded-xl bg-white px-4 py-3">
              <p className="text-xs text-slate-400">{field.label}</p>
              <p className="text-xl font-bold tabular-nums">{career?.recorded ? career[field.key] : '—'}</p>
            </div>
          ))}
        </div>
        {career && !career.recorded && <p className="mt-2 text-xs text-slate-400">还没有录入个人数据。出场和胜负按本队已结束的比赛计算。</p>}
      </section>
    </div>
  );
}
