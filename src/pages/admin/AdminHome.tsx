import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { SPORTS } from '../../sports';
import { useData, useDataState } from '../../data/store';
import type { League, Sport } from '../../types';
import AdminGate from './AdminGate';
import { api, ApiError } from './api';

function AdminHomeBody() {
  const { leagues } = useData();
  const { reload } = useDataState();
  const navigate = useNavigate();
  const [sport, setSport] = useState<Sport>('basketball');
  const [name, setName] = useState('');
  const [season, setSeason] = useState('2026 秋季');
  const [error, setError] = useState('');

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const created = await api<League>('/api/admin/leagues', {
        method: 'POST',
        body: JSON.stringify({ sport, name, season }),
      });
      await reload();
      navigate(`/admin/leagues/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败');
    }
  }

  async function remove(id: string, leagueName: string) {
    if (!window.confirm(`删除「${leagueName}」？队伍和比赛会一起删除。`)) return;
    await api(`/api/admin/leagues/${id}`, { method: 'DELETE' });
    await reload();
  }

  async function logout() {
    await api('/api/admin/logout', { method: 'POST' });
    window.location.hash = '#/admin';
    window.location.reload();
  }

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-2">Operations</p>
          <h1 className="page-title">赛事管理</h1>
          <p className="mt-2 text-sm text-slate-500">创建联赛并维护报名、赛制与比赛数据</p>
        </div>
        <button onClick={() => void logout()} className="btn-secondary">
          退出登录
        </button>
      </div>

      <form onSubmit={(event) => void create(event)} className="surface mb-10 grid gap-4 p-5 sm:grid-cols-4">
        <div className="sm:col-span-4">
          <h2 className="section-title">创建联赛</h2>
        </div>
        <label className="text-sm font-medium text-slate-700">
          项目
          <select value={sport} onChange={(event) => setSport(event.target.value as Sport)} className="field mt-1.5 w-full">
            {SPORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          联赛名称
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 计算机院内班BA" className="field mt-1.5 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          赛季
          <input value={season} onChange={(event) => setSeason(event.target.value)} className="field mt-1.5 w-full" />
        </label>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        <button type="submit" className="btn-primary sm:col-span-4 sm:w-fit">
          创建联赛
        </button>
      </form>

      {SPORTS.map((item) => {
        const own = leagues.filter((league) => league.league.sport === item.id);
        return (
          <section key={item.id} className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="section-title">{item.name}</h2>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">{own.length} 个联赛</span>
            </div>
            {own.length === 0 && <p className="text-sm text-slate-400">还没有联赛</p>}
            <div className="space-y-3">
              {own.map((league) => (
                <div key={league.league.id} className="surface flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <div>
                    <Link to={`/admin/leagues/${league.league.id}`} className="font-semibold text-navy-950 hover:text-gdut-600">
                      {league.league.name}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {league.league.season} · {league.teams.length} 支队伍 · {league.matches.length} 场
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <Link to={`/${item.id}/${league.league.id}/schedule`} className="text-gdut-600 hover:underline">
                      前台
                    </Link>
                    <button onClick={() => void remove(league.league.id, league.league.name)} className="text-red-600 hover:underline">
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function AdminHome() {
  return (
    <AdminGate>
      <AdminHomeBody />
    </AdminGate>
  );
}
