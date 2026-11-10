import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { readLogoFile } from '../../lib/logoFile';
import { DIVISION_LABEL, DIVISION_ORDER, SPORTS } from '../../sports';
import { useDataState } from '../../data/store';
import { LEAGUE_LEVELS, type Division, type League, type LeagueKind, type LeagueLevel, type Sport } from '../../types';
import AdminGate, { useAdminActor } from './AdminGate';
import { api, ApiError } from './api';

type LeagueCard = League & { teamCount: number; matchCount: number };

function AdminHomeBody() {
  const actor = useAdminActor();
  const { reload } = useDataState();
  const [catalog, setCatalog] = useState<LeagueCard[]>([]);
  const navigate = useNavigate();
  const [sport, setSport] = useState<Sport>('basketball');
  const [name, setName] = useState('');
  const [season, setSeason] = useState('2026 秋季');
  const [level, setLevel] = useState<LeagueLevel>('school');
  const [logo, setLogo] = useState('');
  const [error, setError] = useState('');
  const [kind, setKind] = useState<LeagueKind>('league');
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [time, setTime] = useState(() => `${new Date().toISOString().slice(0, 10)}T14:00`);
  const [venue, setVenue] = useState('');
  const [division, setDivision] = useState<Division>('men');

  async function loadCatalog() {
    setCatalog(await api<LeagueCard[]>('/api/admin/leagues'));
  }

  useEffect(() => {
    void loadCatalog().catch((err: unknown) => setError(err instanceof Error ? err.message : '联赛列表加载失败'));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const created =
        kind === 'single'
          ? await api<League>('/api/admin/singles', {
              method: 'POST',
              body: JSON.stringify({ sport, home, away, time, venue, division, level, season, logo }),
            })
          : await api<League>('/api/admin/leagues', {
              method: 'POST',
              body: JSON.stringify({ sport, name, season, level, logo }),
            });
      await reload();
      await loadCatalog();
      navigate(`/admin/leagues/${created.id}`, { state: { createdBy: created.createdBy || name.trim() } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败');
    }
  }

  async function remove(id: string, leagueName: string) {
    if (!window.confirm(`删除「${leagueName}」？队伍和比赛会一起删除。`)) return;
    await api(`/api/admin/leagues/${id}`, { method: 'DELETE' });
    await reload();
    await loadCatalog();
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
          <p className="mt-2 text-sm text-slate-500">{actor}，你创建的联赛会记在你的名字下。上线之后，联赛资料仍由你修改。</p>
        </div>
        <button onClick={() => void logout()} className="btn-secondary">
          退出登录
        </button>
      </div>

      <form onSubmit={(event) => void create(event)} className="surface mb-10 grid gap-4 p-5 sm:grid-cols-4">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-4">
          <h2 className="section-title">{kind === 'single' ? '创建单场比赛' : '创建联赛'}</h2>
          <span className="flex rounded-full border border-slate-200 p-1 text-sm">
            {(
              [
                ['league', '联赛'],
                ['single', '单场比赛'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setKind(id);
                  setLevel(id === 'single' ? 'friendly' : 'school');
                  setError('');
                }}
                className={`rounded-full px-3 py-1 ${kind === id ? 'bg-gdut-600 font-semibold text-white' : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        {kind === 'single' && (
          <p className="-mt-2 text-xs text-slate-500 sm:col-span-4">一场定胜负，不排赛制、没有积分榜。创建后直接进入这场比赛，可以导入双方名单、上传技术统计。</p>
        )}
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
        {kind === 'single' ? (
          <>
            <label className="text-sm font-medium text-slate-700">
              主队
              <input value={home} onChange={(event) => setHome(event.target.value)} placeholder="例如 德州十中" className="field mt-1.5 w-full" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              客队
              <input value={away} onChange={(event) => setAway(event.target.value)} placeholder="例如 潍坊新华中学" className="field mt-1.5 w-full" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              组别
              <select value={division} onChange={(event) => setDivision(event.target.value as Division)} className="field mt-1.5 w-full">
                {DIVISION_ORDER.map((item) => (
                  <option key={item} value={item}>
                    {DIVISION_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              比赛时间
              <input type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} className="field mt-1.5 w-full" />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              场地
              <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="可以先空着" className="field mt-1.5 w-full" />
            </label>
          </>
        ) : (
          <>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              联赛名称
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 计算机院内班BA" className="field mt-1.5 w-full" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              赛季
              <input value={season} onChange={(event) => setSeason(event.target.value)} className="field mt-1.5 w-full" />
            </label>
          </>
        )}
        <label className="text-sm font-medium text-slate-700 sm:col-span-4">
          级别
          <span className="mt-1.5 flex flex-wrap gap-2">
            {LEAGUE_LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLevel(item.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${level === item.id ? 'border-gdut-700 bg-gdut-50 font-semibold text-gdut-800' : 'border-slate-200 text-slate-600'}`}
              >
                {item.label}
              </button>
            ))}
          </span>
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-4">
          {kind === 'single' ? '比赛图标' : '联赛图标'}
          <span className="mt-1 block text-xs font-normal text-slate-400">创建时上传。前台会放在名称左边；不上传就用图库里的球员头像。</span>
          <span className="mt-2 flex items-center gap-3">
            {logo ? <img src={logo} alt="" className="h-12 w-12 rounded-lg object-cover" /> : null}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm text-slate-600"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                void readLogoFile(file).then(setLogo).catch((err: unknown) => {
                  setLogo('');
                  setError(err instanceof Error ? err.message : 'Logo 无法读取');
                });
              }}
            />
          </span>
          <span className={`mt-2 block text-xs ${logo ? 'text-amber-800' : 'text-slate-400'}`}>
            {logo ? `图标已选好，还没上传。点下面的「${kind === 'single' ? '创建比赛' : '创建联赛'}」才会保存。` : '可以不上传图标。'}
          </span>
        </label>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            {kind === 'single' ? '创建比赛' : '创建联赛'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {kind === 'single'
              ? '填好两支队伍和时间后点这个按钮。名称默认是「主队对客队」，创建后可以改。'
              : '填好名称后点这个按钮。创建成功会进入该联赛，并记在你的名字下。'}
          </p>
        </div>
      </form>

      <LeagueGroups title="我创建的" leagues={catalog.filter((league) => league.createdBy === actor)} actor={actor} empty="你还没有创建联赛。" onRemove={remove} />
      <LeagueGroups title="其他联赛" leagues={catalog.filter((league) => league.createdBy !== actor)} actor={actor} empty="没有其他人创建的联赛。" onRemove={remove} />
      <ResetPlayerPassword />
    </div>
  );
}

function LeagueGroups({
  title,
  leagues,
  actor,
  empty,
  onRemove,
}: {
  title: string;
  leagues: LeagueCard[];
  actor: string;
  empty: string;
  onRemove: (id: string, name: string) => Promise<void>;
}) {
  return (
    <section className="mb-10">
      <h2 className="section-title">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-slate-500">{leagues.length} 个</p>
      {leagues.length === 0 && <p className="text-sm text-slate-400">{empty}</p>}
      {SPORTS.map((item) => {
        const own = leagues.filter((league) => league.sport === item.id);
        if (own.length === 0) return null;
        return (
          <div key={item.id} className="mb-6">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-sm font-semibold text-navy-950">{item.name}</h3>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="space-y-3">
              {own.map((league) => {
                const editable = !league.createdBy || league.createdBy === actor;
                return (
                  <div key={league.id} className="surface flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div>
                      <Link to={`/admin/leagues/${league.id}`} className="font-semibold text-navy-950 hover:text-gdut-600">
                        {league.name}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {league.createdBy ? `创建者 ${league.createdBy}` : '创建者未记录'}
                        {' · '}
                        {league.published ? '已上线' : '未上线'}
                        {' · '}
                        {league.kind === 'single'
                          ? '单场比赛'
                          : `${league.season} · ${league.teamCount} 支队伍 · ${league.matchCount} 场`}
                      </p>
                    </div>
                    <div className="flex gap-3 text-sm">
                      {league.published ? (
                        <Link to={`/${item.id}/${league.id}/schedule`} className="text-gdut-600 hover:underline">
                          前台
                        </Link>
                      ) : (
                        <span className="text-slate-400">未上线</span>
                      )}
                      {editable && (
                        <button onClick={() => void onRemove(league.id, league.name)} className="text-red-600 hover:underline">
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ResetPlayerPassword() {
  const [phone, setPhone] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(`清空 ${phone} 的密码？对方要用这个手机号重新设置一个。`)) return;
    setError('');
    setNotice('');
    try {
      await api('/api/admin/users/reset-password', { method: 'POST', body: JSON.stringify({ phone }) });
      setNotice('已清空。让对方在登录页选「第一次使用，设置密码」。');
      setPhone('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '清空失败');
    }
  }

  return (
    <section className="mb-10">
      <h2 className="section-title">球员忘记密码</h2>
      <p className="mt-1 mb-4 text-sm text-slate-500">没有短信验证，只能由你清空密码，对方再用原来的手机号设一个新的。</p>
      <form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-center gap-3">
        <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="球员手机号" className="field w-56" required />
        <button type="submit" className="btn-secondary">
          清空密码
        </button>
      </form>
      {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

export default function AdminHome() {
  return (
    <AdminGate>
      <AdminHomeBody />
    </AdminGate>
  );
}
