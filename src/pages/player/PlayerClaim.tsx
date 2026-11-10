import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { formatDate } from '../../lib/format';
import { SPORT_MAP } from '../../sports';
import type { Sport } from '../../types';
import { api, ApiError } from '../admin/api';
import { usePlayerSession, type MePayload } from './session';

interface Candidate {
  playerId: string;
  name: string;
  number: string;
  className: string;
  college: string;
  teamName: string;
  leagueName: string;
  sport: Sport;
  season: string;
  lastMatch: { time: string; venue: string } | null;
  status: 'available' | 'mine' | 'taken' | 'phone';
  phoneHint: string;
}

export default function PlayerClaim() {
  const { user, accounts, ready, setMe, select } = usePlayerSession();
  const [name, setName] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState('');

  useEffect(() => {
    if (user?.name) setName((current) => current || user.name);
  }, [user?.name]);

  if (!ready) return <p className="py-10 text-center text-sm text-slate-400">加载中…</p>;
  if (!user) {
    return (
      <div className="empty-state mx-auto max-w-lg">
        先用手机号登录，再认领名单。{' '}
        <Link to="/player/login" className="font-medium text-gdut-700">
          去登录
        </Link>
      </div>
    );
  }

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setError('');
    setNotice('');
    setPending('search');
    try {
      const result = await api<{ results: Candidate[] }>(`/api/player/claim/search?name=${encodeURIComponent(name.trim())}`);
      setResults(result.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '搜索失败');
    } finally {
      setPending('');
    }
  }

  async function claim(candidate: Candidate) {
    setError('');
    setNotice('');
    setPending(candidate.playerId);
    try {
      setMe(await api<MePayload>('/api/player/claim', { method: 'POST', body: JSON.stringify({ playerId: candidate.playerId }) }));
      select(candidate.playerId);
      setResults((current) => current?.map((item) => (item.playerId === candidate.playerId ? { ...item, status: 'mine' } : item)) ?? null);
      setNotice(`已认领「${candidate.teamName}」的 ${candidate.number} 号。`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '认领失败');
    } finally {
      setPending('');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form onSubmit={(event) => void search(event)} className="surface overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-player-600 uppercase">Claim roster</p>
          <h1 className="mt-1 text-xl font-bold text-navy-950">认领我的名单</h1>
          <p className="mt-2 text-sm text-slate-500">
            当前账号 {user.phone}
            {accounts.length > 0 ? `，已绑定 ${accounts.length} 个名单` : ''}。输入报名时用的姓名，找到自己所在的队伍后点「这是我」。在几支队伍打球的，可以都认领上。
          </p>
        </div>
        <div className="flex gap-2 p-5">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="姓名" className="field min-w-0 flex-1" required />
          <button type="submit" disabled={pending === 'search' || !name.trim()} className="btn-primary shrink-0 disabled:opacity-60">
            {pending === 'search' ? '搜索中…' : '搜索'}
          </button>
        </div>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}{' '}
          <Link to="/player" className="font-medium underline">
            去球员中心
          </Link>
        </p>
      )}

      {results && results.length === 0 && <div className="empty-state">名单里没有叫「{name.trim()}」的球员。</div>}
      {results?.map((item) => (
        <article key={item.playerId} className="surface flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gdut-600">
              {SPORT_MAP[item.sport].name} · {item.leagueName}
              {item.season ? ` · ${item.season}` : ''}
            </p>
            <p className="mt-1 font-semibold text-navy-950">
              {item.teamName} · {item.number} 号 {item.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {[item.college, item.className].filter(Boolean).join(' · ') || '没填班级'}
              {item.lastMatch ? ` · 最近一场 ${formatDate(item.lastMatch.time.slice(0, 10))}${item.lastMatch.venue ? ` · ${item.lastMatch.venue}` : ''}` : ''}
            </p>
          </div>
          {item.status === 'available' && (
            <button type="button" disabled={Boolean(pending)} onClick={() => void claim(item)} className="btn-primary shrink-0 disabled:opacity-60">
              {pending === item.playerId ? '认领中…' : '这是我'}
            </button>
          )}
          {item.status === 'mine' && <span className="shrink-0 text-sm font-medium text-emerald-700">已是你的</span>}
          {item.status === 'taken' && <span className="shrink-0 text-xs text-slate-400">已被其他账号认领，如果是你请联系组织者</span>}
          {item.status === 'phone' && <span className="shrink-0 text-xs text-slate-400">名单登记的手机号是 {item.phoneHint}，请用它登录</span>}
        </article>
      ))}

      <p className="text-center text-sm text-slate-500">
        名单里找不到自己？{' '}
        <Link to="/player/join" className="font-medium text-gdut-700">
          报名加入队伍
        </Link>
      </p>
    </div>
  );
}
