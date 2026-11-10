import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import type { Challenge, Club, ClubBrief, ClubRole, ResponseStatus } from '../../types';
import { api } from '../admin/api';
import { ClubBadge, ClubLogoPicker, formatLabel, RESPONSE_LABEL, STATUS_LABEL, whenLabel } from '../hall/shared';
import { usePlayerSession } from './session';

type MyChallenge = Challenge & {
  mine: 'poster' | 'responder';
  pending: number;
  myResponse: { status: ResponseStatus; club: ClubBrief } | null;
};

interface ClubsPayload {
  clubs: (Club & { role: ClubRole })[];
  pending: number;
  challenges: MyChallenge[];
}

export default function PlayerClubs() {
  const { user, ready } = usePlayerSession();
  const navigate = useNavigate();
  const [data, setData] = useState<ClubsPayload | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [homeVenue, setHomeVenue] = useState('');
  const [color, setColor] = useState('#c2410c');
  const [intro, setIntro] = useState('');
  const [logo, setLogo] = useState('');
  const [myName, setMyName] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(() => api<ClubsPayload>('/api/player/clubs').then(setData), []);
  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  if (!ready) return <p className="py-10 text-center text-sm text-slate-400">加载中…</p>;
  if (!user) return <Navigate to="/player/login" replace />;
  if (!data) return null;

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const view = await api<{ club: Club }>('/api/clubs', {
        method: 'POST',
        body: JSON.stringify({ name, short, homeVenue, color, intro, logo, myName }),
      });
      navigate(`/clubs/${view.club.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="section-title">我负责的球队</h1>
          <div className="flex gap-2">
            {data.clubs.length > 0 && (
              <Link to="/hall/new" className="btn-primary">
                发约球帖
              </Link>
            )}
            <button type="button" onClick={() => setCreating((value) => !value)} className="btn-secondary">
              {creating ? '收起' : '创建球队'}
            </button>
          </div>
        </div>
        {creating && (
          <form onSubmit={create} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            {!user.name && (
              <label className="block text-sm">
                <span className="text-slate-600">你的名字（对手联系你时看到）</span>
                <input value={myName} onChange={(event) => setMyName(event.target.value)} maxLength={20} required className="field mt-1 w-full sm:w-64" />
              </label>
            )}
            <div>
              <span className="text-sm text-slate-600">队伍头像</span>
              <div className="mt-2">
                <ClubLogoPicker value={logo} color={color} short={short || name} onChange={setLogo} onError={setError} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-600">球队名称</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} required className="field mt-1 w-full" />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">简称</span>
                <input value={short} onChange={(event) => setShort(event.target.value)} maxLength={6} placeholder="不填则取名称前 4 个字" className="field mt-1 w-full" />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">常驻球场（可选）</span>
                <input value={homeVenue} onChange={(event) => setHomeVenue(event.target.value)} maxLength={40} className="field mt-1 w-full" />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">队色</span>
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="mt-1 block h-9 w-16 rounded border border-slate-300" />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-600">简介（可选）</span>
                <textarea value={intro} onChange={(event) => setIntro(event.target.value)} rows={2} maxLength={200} className="field mt-1 w-full" />
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary">
                创建
              </button>
              <p className="text-xs text-slate-400">创建者是队长，可以再加 2 名负责人。三个人都能发约球帖和迎战。比分由两边队长填写。</p>
            </div>
          </form>
        )}
        {data.clubs.length === 0 && !creating && (
          <div className="empty-state">你还没有负责的球队。创建一支，或者让队长用你的手机号把你加为负责人。</div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {data.clubs.map((club) => (
            <Link key={club.id} to={`/clubs/${club.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
              <ClubBadge club={club} link={false} />
              <span className="text-xs text-slate-500">{club.role === 'owner' ? '队长' : '负责人'}</span>
            </Link>
          ))}
        </div>
      </section>

      {data.challenges.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">
            我的约球
            {data.pending > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 align-middle text-xs text-white">{data.pending} 个迎战待确认</span>}
          </h2>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {data.challenges.map((item) => (
              <Link key={item.id} to={`/hall/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="min-w-0 text-sm">
                  <span className="font-semibold text-navy-950">{whenLabel(item.time)}</span>
                  <span className="ml-2 text-slate-500">
                    {item.mine === 'poster' ? item.club.name : `${item.myResponse?.club.name ?? ''} 迎战 ${item.club.name}`} · {item.venue} · {formatLabel(item.format)}
                  </span>
                </span>
                <span className="text-xs">
                  {item.mine === 'poster' && item.status === 'open' && item.pending > 0 ? (
                    <span className="font-semibold text-red-600">{item.pending} 个迎战待确认</span>
                  ) : item.mine === 'responder' && item.status === 'open' && item.myResponse ? (
                    <span className="text-slate-500">{RESPONSE_LABEL[item.myResponse.status]}</span>
                  ) : (
                    <span className="text-slate-500">{STATUS_LABEL[item.status]}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
