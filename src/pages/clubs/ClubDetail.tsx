import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { formatDate, dateOf } from '../../lib/format';
import type { Club, ClubManager, ClubPlayer, ClubRole } from '../../types';
import { api } from '../admin/api';
import { ClubLogoPicker, ClubMark } from '../hall/shared';
import { usePlayerSession } from '../player/session';

interface RecordRow {
  leagueId: string;
  matchId: string;
  time: string;
  venue: string;
  opponent: { name: string; clubId: string } | null;
  score: { mine: number; theirs: number } | null;
  result: 'W' | 'L' | 'D' | null;
}

interface ClubView {
  club: Club;
  managers: ClubManager[];
  players: ClubPlayer[];
  record: RecordRow[];
  role: ClubRole | null;
}

const RESULT_LABEL = { W: '胜', L: '负', D: '平' } as const;

export default function ClubDetail() {
  const { id = '' } = useParams();
  const { user } = usePlayerSession();
  const [view, setView] = useState<ClubView | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      api<ClubView>(`/api/clubs/${id}`)
        .then(setView)
        .catch((err) => setError(err instanceof Error ? err.message : '加载失败')),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load, user?.id]);

  const act = async (path: string, init: RequestInit, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return false;
    setError('');
    try {
      setView(await api<ClubView>(path, init));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      return false;
    }
  };

  if (!view) return error ? <div className="empty-state">{error}</div> : null;
  const { club, managers, players, record, role } = view;
  const wins = record.filter((row) => row.result === 'W').length;
  const losses = record.filter((row) => row.result === 'L').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="league-card p-6">
        <div className="flex flex-wrap items-center gap-5">
        <ClubMark club={club} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{club.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {club.homeVenue ? `常驻 ${club.homeVenue} · ` : ''}约战 {record.length} 场 · {wins} 胜 {losses} 负
          </p>
          {club.intro && <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{club.intro}</p>}
        </div>
        {role && (
          <Link to="/hall/new" className="btn-primary">
            发约球帖
          </Link>
        )}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {role && <EditClub club={club} onSave={(body) => act(`/api/clubs/${club.id}`, { method: 'PATCH', body: JSON.stringify(body) })} />}

      <section className="space-y-3">
        <h2 className="section-title">负责人</h2>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {managers.map((manager) => (
            <div key={manager.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-semibold text-navy-950">{manager.name}</span>
                <span className="ml-2 text-slate-400">{manager.phone}</span>
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{manager.role === 'owner' ? '队长' : '负责人'}</span>
              </span>
              {role && manager.role !== 'owner' && (
                <span className="flex gap-3 text-xs">
                  {role === 'owner' && (
                    <button
                      type="button"
                      onClick={() =>
                        void act(`/api/clubs/${club.id}/owner`, { method: 'POST', body: JSON.stringify({ userId: manager.userId }) }, `把队长转给 ${manager.name}？`)
                      }
                      className="text-gdut-700"
                    >
                      转为队长
                    </button>
                  )}
                  {(role === 'owner' || manager.userId === user?.id) && (
                    <button
                      type="button"
                      onClick={() =>
                        void act(
                          `/api/clubs/${club.id}/managers/${manager.userId}`,
                          { method: 'DELETE' },
                          manager.userId === user?.id ? '确定退出负责人？' : `移除 ${manager.name}？`,
                        ).then((ok) => {
                          if (ok && manager.userId === user?.id) void load();
                        })
                      }
                      className="text-red-600"
                    >
                      {manager.userId === user?.id ? '退出' : '移除'}
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
        {role === 'owner' && managers.length < 3 && (
          <AddManager onAdd={(phone) => act(`/api/clubs/${club.id}/managers`, { method: 'POST', body: JSON.stringify({ phone }) })} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">常备名单</h2>
        {role ? (
          <RosterEditor players={players} onSave={(text) => act(`/api/clubs/${club.id}/players`, { method: 'PUT', body: JSON.stringify({ text }) })} />
        ) : players.length === 0 ? (
          <div className="empty-state">还没有名单</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {players.map((player) => (
              <div key={player.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="mr-2 font-bold text-slate-400 tabular-nums">#{player.number}</span>
                {player.name}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">约战战绩</h2>
        {record.length === 0 ? (
          <div className="empty-state">还没有打完的约战</div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {record.map((row) => (
              <Link
                key={row.matchId}
                to={`/basketball/${row.leagueId}/matches/${row.matchId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span>
                  <span className="text-slate-400">{formatDate(dateOf(row.time))}</span>
                  <span className="ml-3 font-semibold text-navy-950">对 {row.opponent?.name ?? '—'}</span>
                </span>
                <span className="tabular-nums">
                  {row.score ? `${row.score.mine} : ${row.score.theirs}` : '—'}
                  {row.result && (
                    <span className={`ml-2 font-bold ${row.result === 'W' ? 'text-green-700' : row.result === 'L' ? 'text-red-600' : 'text-slate-500'}`}>
                      {RESULT_LABEL[row.result]}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EditClub({ club, onSave }: { club: Club; onSave: (body: Partial<Club>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(club);
  const [logoError, setLogoError] = useState('');
  useEffect(() => setForm(club), [club]);
  const set = (patch: Partial<Club>) => setForm((current) => ({ ...current, ...patch }));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        编辑球队信息
      </button>
    );
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const { name, short, color, intro, homeVenue, logo } = form;
    void onSave({ name, short, color, intro, homeVenue, logo }).then((ok) => ok && setOpen(false));
  };
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <span className="text-sm text-slate-600">队伍头像</span>
        <div className="mt-2">
          <ClubLogoPicker
            value={form.logo}
            color={form.color}
            short={form.short || form.name}
            onChange={(logo) => {
              setLogoError('');
              set({ logo });
            }}
            onError={setLogoError}
          />
        </div>
        {logoError && <p className="mt-2 text-sm text-red-600">{logoError}</p>}
      </div>
      <label className="block text-sm">
        <span className="text-slate-600">名称</span>
        <input value={form.name} onChange={(event) => set({ name: event.target.value })} maxLength={20} required className="field mt-1 w-full" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">简称</span>
        <input value={form.short} onChange={(event) => set({ short: event.target.value })} maxLength={6} className="field mt-1 w-full" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">常驻球场</span>
        <input value={form.homeVenue} onChange={(event) => set({ homeVenue: event.target.value })} maxLength={40} className="field mt-1 w-full" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">队色</span>
        <input type="color" value={form.color} onChange={(event) => set({ color: event.target.value })} className="mt-1 block h-9 w-16 rounded border border-slate-300" />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="text-slate-600">简介</span>
        <textarea value={form.intro} onChange={(event) => set({ intro: event.target.value })} rows={2} maxLength={200} className="field mt-1 w-full" />
      </label>
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary">
          保存
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          取消
        </button>
      </div>
    </form>
  );
}

function AddManager({ onAdd }: { onAdd: (phone: string) => Promise<boolean> }) {
  const [phone, setPhone] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onAdd(phone).then((ok) => ok && setPhone(''));
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="对方注册用的手机号" inputMode="numeric" className="field w-56" required />
      <button type="submit" className="btn-secondary">
        添加负责人
      </button>
      <span className="text-xs text-slate-400">最多 3 名负责人，对方需要先在球员中心登录过一次</span>
    </form>
  );
}

const rosterText = (players: ClubPlayer[]) => players.map((player) => [player.name, player.number, player.phone].filter(Boolean).join(' ')).join('\n');

function RosterEditor({ players, onSave }: { players: ClubPlayer[]; onSave: (text: string) => Promise<boolean> }) {
  const [value, setValue] = useState(() => rosterText(players));
  const [saved, setSaved] = useState(false);
  useEffect(() => setValue(rosterText(players)), [players]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    void onSave(value).then(setSaved);
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved(false);
        }}
        rows={Math.max(6, players.length + 2)}
        placeholder={'一行一个：姓名 号码 手机号（手机号可选）\n张三 7 13800001111\n李四 23'}
        className="field w-full font-mono"
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary">
          保存名单
        </button>
        <span className="text-xs text-slate-400">
          {saved ? `已保存 ${players.length} 人。` : ''}每次确认约战时，这份名单会复制成比赛名单；填了手机号的球员登录后自动绑定。
        </span>
      </div>
    </form>
  );
}
