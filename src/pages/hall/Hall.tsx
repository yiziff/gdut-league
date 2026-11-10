import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CHALLENGE_LEVELS, type Challenge, type ChallengeLevel } from '../../types';
import { api } from '../admin/api';
import { usePlayerSession } from '../player/session';
import { ClubBadge, formatLabel, levelLabel, whenLabel } from './shared';

export default function Hall() {
  const { user } = usePlayerSession();
  const [list, setList] = useState<Challenge[] | null>(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [level, setLevel] = useState<ChallengeLevel | ''>('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (level) params.set('level', level);
    api<Challenge[]>(`/api/challenges?${params}`)
      .then(setList)
      .catch(() => setError('约球帖加载失败'));
  }, [date, level]);

  return (
    <div>
      <div className="sport-masthead hall-masthead mb-8" data-watermark="约球">
        <div className="hall-masthead-figure" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}hall/pickup.png?v=2`} alt="" />
        </div>
        <p className="eyebrow mb-3">Pickup games</p>
        <h1 className="sport-poster">
          <span className="sport-poster-name">约球</span>
          <span className="sport-poster-mark">大厅</span>
        </h1>
        <p className="masthead-copy mt-4 max-w-xl text-sm">球队负责人发约球帖，别的球队来迎战。确认后生成一场友谊赛，赛后两边队长填上最终比分，这场就记为结束。</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={user ? '/hall/new' : '/player/login'} className="btn-primary">
            {user ? '发约球帖' : '登录后发帖'}
          </Link>
          <Link to="/player/clubs" className="btn-secondary">
            我的球队
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="level-filter" role="tablist" aria-label="水平">
          {[{ id: '' as const, label: '全部' }, ...CHALLENGE_LEVELS].map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={level === tab.id} onClick={() => setLevel(tab.id)} className={level === tab.id ? 'is-active' : ''}>
              {tab.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          日期
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field" />
          {date && (
            <button type="button" onClick={() => setDate('')} className="text-xs text-gdut-600">
              清除
            </button>
          )}
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {list && list.length === 0 && <div className="empty-state">现在没有等待迎战的约球帖。{user ? '发一个试试？' : ''}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list?.map((item) => (
          <Link key={item.id} to={`/hall/${item.id}`} className="league-card block p-5">
            <div className="flex items-center justify-between gap-3">
              <ClubBadge club={item.club} link={false} />
              <span className="league-level-mark league-level-friendly shrink-0">{levelLabel(item.level)}</span>
            </div>
            <p className="mt-4 text-lg font-bold text-navy-950">{whenLabel(item.time)}</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              {item.venue} · {formatLabel(item.format)}
            </p>
            {item.note && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.note}</p>}
            <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
              <span className="text-slate-500">{item.responseCount > 0 ? `${item.responseCount} 支球队迎战` : '还没有球队迎战'}</span>
              <span className="font-semibold text-gdut-700">去迎战 →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
