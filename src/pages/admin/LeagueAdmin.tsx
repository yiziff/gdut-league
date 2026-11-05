import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { planFormat, type FormatPreset } from '../../lib/formats';
import { DIVISION_LABEL, DIVISION_ORDER, SPORT_MAP, STAGE_LABEL } from '../../sports';
import { useDataState } from '../../data/store';
import type { Division, League, Match, MatchStatus, Player, Side, Stage, Team } from '../../types';
import { STAT_FIELDS } from '../../lib/playerStats';
import { clockOf, dateOf, formatDate } from '../../lib/format';
import AdminGate from './AdminGate';
import { api, ApiError } from './api';

interface Detail {
  league: League;
  teams: Team[];
  matches: Match[];
}

interface MatchForm {
  id?: string;
  division: Division;
  stage: Stage;
  group: string;
  home: string;
  away: string;
  homeSeed: string;
  awaySeed: string;
  time: string;
  venue: string;
  status: MatchStatus;
  scoreHome: string;
  scoreAway: string;
  sets: string;
  penHome: string;
  penAway: string;
  forfeit: '' | Side;
  nextMatchId: string;
  nextSlot: '' | Side;
  loserNextMatchId: string;
  loserNextSlot: '' | Side;
  lines: Record<string, { points: string; rebounds: string; assists: string }>;
}

function todayAt(hour: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${hour}`;
}

function blankMatch(): MatchForm {
  return {
    division: 'men',
    stage: 'group',
    group: 'A',
    home: '',
    away: '',
    homeSeed: '',
    awaySeed: '',
    time: todayAt('14:00'),
    venue: '',
    status: 'scheduled',
    scoreHome: '',
    scoreAway: '',
    sets: '',
    penHome: '',
    penAway: '',
    forfeit: '',
    nextMatchId: '',
    nextSlot: '',
    loserNextMatchId: '',
    loserNextSlot: '',
    lines: {},
  };
}

function toForm(match: Match): MatchForm {
  return {
    id: match.id,
    division: match.division,
    stage: match.stage,
    group: match.group ?? '',
    home: match.home ?? '',
    away: match.away ?? '',
    homeSeed: match.homeSeed ?? '',
    awaySeed: match.awaySeed ?? '',
    time: match.time.slice(0, 16),
    venue: match.venue,
    status: match.status,
    scoreHome: match.score ? String(match.score.home) : '',
    scoreAway: match.score ? String(match.score.away) : '',
    sets: match.sets?.map((set) => set.join('-')).join(', ') ?? '',
    penHome: match.penalties ? String(match.penalties.home) : '',
    penAway: match.penalties ? String(match.penalties.away) : '',
    forfeit: match.forfeit ?? '',
    nextMatchId: match.nextMatchId ?? '',
    nextSlot: match.nextSlot ?? '',
    loserNextMatchId: match.loserNextMatchId ?? '',
    loserNextSlot: match.loserNextSlot ?? '',
    lines: Object.fromEntries(
      (match.lines ?? []).map((line) => [line.playerId, { points: String(line.points), rebounds: String(line.rebounds), assists: String(line.assists) }]),
    ),
  };
}

function parseSets(text: string): [number, number][] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.split(/[,，]/).map((part) => {
    const matched = part.trim().match(/^(\d+)\s*[-:：]\s*(\d+)$/);
    if (!matched) throw new Error('每局小分写成 25-18, 25-20');
    return [Number(matched[1]), Number(matched[2])];
  });
}

function pair(home: string, away: string): { home: number; away: number } | null {
  if (home === '' && away === '') return null;
  return { home: Number(home), away: Number(away) };
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm';

function LeagueAdminBody() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const { reload } = useDataState();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamShort, setTeamShort] = useState('');
  const [teamColor, setTeamColor] = useState('#1d63c4');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [preset, setPreset] = useState<FormatPreset>('groups_knockout');
  const [groupCount, setGroupCount] = useState(4);
  const [qualifiers, setQualifiers] = useState(2);
  const [bracketSize, setBracketSize] = useState(8);
  const [thirdPlace, setThirdPlace] = useState(true);
  const [division, setDivision] = useState<Division>('men');
  const [startDate, setStartDate] = useState('');
  const [venue, setVenue] = useState('');
  const [rosterText, setRosterText] = useState('');
  const [playerDraft, setPlayerDraft] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<MatchForm>(blankMatch);
  const [selected, setSelected] = useState<string[]>([]);

  async function refresh() {
    try {
      const next = await api<Detail>(`/api/leagues/${leagueId}`);
      setDetail(next);
      setMissing(false);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setError(err instanceof Error ? err.message : '加载失败');
    }
  }

  useEffect(() => {
    void refresh();
    // 只在联赛切换时重新拉取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  if (missing) return <p className="py-12 text-center text-slate-400">联赛不存在</p>;
  if (!detail) return <p className="py-12 text-center text-slate-400">加载中…</p>;
  const view = detail;
  const league = view.league;

  const meta = SPORT_MAP[league.sport];
  const teamNameOf = (id: string | null) => detail.teams.find((team) => team.id === id)?.short ?? '待定';
  const chosen = selected.filter((id) => detail.matches.some((match) => match.id === id));
  const allSelected = detail.matches.length > 0 && chosen.length === detail.matches.length;
  const started = form.status !== 'scheduled';
  const scoreName =
    league.sport === 'football' ? '进球' : league.sport === 'volleyball' ? '局数' : league.sport === 'basketball' ? '得分' : '胜场';

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function saveLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(() =>
      api(`/api/admin/leagues/${league.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: data.get('name'), season: data.get('season') }),
      }),
    );
  }

  async function saveTeam(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (editingTeam) {
        await api(`/api/admin/teams/${editingTeam}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: teamName, short: teamShort, color: teamColor }),
        });
        setEditingTeam(null);
      } else {
        await api(`/api/admin/leagues/${league.id}/teams`, {
          method: 'POST',
          body: JSON.stringify({ name: teamName, short: teamShort, color: teamColor }),
        });
      }
      setTeamName('');
      setTeamShort('');
    });
  }

  function editTeam(team: Team) {
    setEditingTeam(team.id);
    setTeamName(team.name);
    setTeamShort(team.short);
    setTeamColor(team.color);
  }

  async function saveMatch(event: FormEvent) {
    event.preventDefault();
    const started = form.status !== 'scheduled';
    let sets: [number, number][] | null = null;
    if (started && league.sport === 'volleyball') {
      try {
        sets = parseSets(form.sets);
      } catch (err) {
        setError(err instanceof Error ? err.message : '小分格式不对');
        return;
      }
    }
    const body = {
      division: form.division,
      stage: form.stage,
      group: form.group || null,
      home: form.home || null,
      away: form.away || null,
      homeSeed: form.homeSeed || null,
      awaySeed: form.awaySeed || null,
      time: form.time,
      venue: form.venue,
      status: form.status,
      score: started ? pair(form.scoreHome, form.scoreAway) : null,
      sets,
      penalties: started && league.sport === 'football' ? pair(form.penHome, form.penAway) : null,
      forfeit: form.forfeit || null,
      lines:
        form.status === 'finished'
          ? [form.home, form.away].flatMap((teamId) => {
              const players = view.teams.find((team) => team.id === teamId)?.players ?? [];
              return players.flatMap((player) => {
                const row = form.lines[player.id];
                if (!row || !STAT_FIELDS[league.sport].some((field) => row[field.key].trim() !== '')) return [];
                return [{ playerId: player.id, points: Number(row.points || 0), rebounds: Number(row.rebounds || 0), assists: Number(row.assists || 0) }];
              });
            })
          : null,
      nextMatchId: form.nextMatchId || null,
      nextSlot: form.nextSlot || null,
      loserNextMatchId: form.loserNextMatchId || null,
      loserNextSlot: form.loserNextSlot || null,
    };
    await run(async () => {
      if (form.id) await api(`/api/admin/matches/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api(`/api/admin/leagues/${league.id}/matches`, { method: 'POST', body: JSON.stringify(body) });
      setForm(blankMatch());
    });
  }

  async function importRoster(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    await run(async () => {
      const result = await api<{ createdTeams: number; addedPlayers: number }>(`/api/admin/leagues/${league.id}/roster`, {
        method: 'POST',
        body: JSON.stringify({ text: rosterText }),
      });
      setRosterText('');
      setNotice(`新增 ${result.createdTeams} 支队伍，补录 ${result.addedPlayers} 名队员。已有的队伍不会重复创建。`);
    });
  }

  async function addPlayers(teamId: string) {
    const text = playerDraft[teamId] ?? '';
    setNotice('');
    await run(async () => {
      await api(`/api/admin/teams/${teamId}/players`, { method: 'POST', body: JSON.stringify({ text }) });
      setPlayerDraft((current) => ({ ...current, [teamId]: '' }));
    });
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    setError('');
    const date = startDate || new Date().toISOString().slice(0, 10);
    let count = 0;
    try {
      count = planFormat({ preset, division, startDate: date, venue, teamIds: picked, groupCount, qualifiers, bracketSize, thirdPlace }, () => 'preview').length;
    } catch (err) {
      setError(err instanceof Error ? err.message : '赛制参数不对');
      return;
    }
    const existing = view.matches.filter((match) => match.division === division).length;
    const replaceNote = existing > 0 ? `${DIVISION_LABEL[division]}已有 ${existing} 场，会先删掉再重排。` : '';
    if (!window.confirm(`这次会生成 ${count} 场。${replaceNote}`)) return;
    await run(async () => {
      const result = await api<{ created: number }>(`/api/admin/leagues/${league.id}/format`, {
        method: 'POST',
        body: JSON.stringify({ preset, division, startDate, venue, teamIds: picked, groupCount, qualifiers, bracketSize, thirdPlace, replace: existing > 0 }),
      });
      setSelected([]);
      setNotice(`已生成 ${result.created} 场对阵。没填的队伍、时间和场地都可以以后再改。`);
    });
  }

  async function deleteSelected() {
    const ids = selected.filter((id) => view.matches.some((match) => match.id === id));
    if (ids.length === 0) return;
    if (!window.confirm(`删除选中的 ${ids.length} 场比赛？`)) return;
    await run(async () => {
      await api(`/api/admin/leagues/${league.id}/matches/bulk-delete`, { method: 'POST', body: JSON.stringify({ ids }) });
      setSelected([]);
      if (form.id && ids.includes(form.id)) setForm(blankMatch());
    });
  }

  const set = (patch: Partial<MatchForm>) => setForm((current) => ({ ...current, ...patch }));
  const setLine = (playerId: string, key: 'points' | 'rebounds' | 'assists', value: string) =>
    setForm((current) => ({
      ...current,
      lines: {
        ...current.lines,
        [playerId]: {
          points: current.lines[playerId]?.points ?? '',
          rebounds: current.lines[playerId]?.rebounds ?? '',
          assists: current.lines[playerId]?.assists ?? '',
          [key]: value,
        },
      },
    }));

  return (
    <div>
      <Link to="/admin" className="text-sm text-gdut-600 hover:underline">
        ← 全部联赛
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">
            {meta.icon} {meta.name}
          </p>
          <h1 className="text-2xl font-bold">{detail.league.name}</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <Link to={`/${detail.league.sport}/${detail.league.id}/schedule`} className="text-gdut-600 hover:underline">
            前台查看
          </Link>
          <button
            className="text-red-600 hover:underline"
            onClick={() => {
              if (!window.confirm(`删除「${detail.league.name}」？`)) return;
              void (async () => {
                try {
                  await api(`/api/admin/leagues/${detail.league.id}`, { method: 'DELETE' });
                  await reload();
                  navigate('/admin');
                } catch (err) {
                  setError(err instanceof Error ? err.message : '删除失败');
                }
              })();
            }}
          >
            删除联赛
          </button>
        </div>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-gdut-50 px-3 py-2 text-sm text-gdut-800">{notice}</p>}

      <form onSubmit={(event) => void saveLeague(event)} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm text-slate-600">
          名称
          <input name="name" defaultValue={detail.league.name} key={detail.league.name} className={inputClass} />
        </label>
        <label className="text-sm text-slate-600">
          赛季
          <input name="season" defaultValue={detail.league.season} key={detail.league.season} className={inputClass} />
        </label>
        <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white">保存</button>
      </form>

      <section className="mb-8">
        <h2 className="mb-1 font-semibold">报名</h2>
        <p className="mb-3 text-sm text-slate-500">可以一次贴一批，也可以以后再补队伍或队员。已经报过名的队伍会保留，只追加新队员。</p>
        <form onSubmit={(event) => void importRoster(event)} className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <textarea
            value={rosterText}
            onChange={(event) => setRosterText(event.target.value)}
            rows={5}
            placeholder={'计科2101：张三、李四、王五\n计科2102：赵六\n材料2103'}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button className="mt-3 rounded-lg bg-gdut-700 px-3 py-1.5 text-sm text-white">导入这批报名</button>
        </form>
        <form onSubmit={(event) => void saveTeam(event)} className="mb-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            全称
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} className={inputClass} placeholder="计算机 2101" />
          </label>
          <label className="text-sm text-slate-600">
            简称
            <input value={teamShort} onChange={(event) => setTeamShort(event.target.value)} className={inputClass} placeholder="2101" />
          </label>
          <label className="text-sm text-slate-600">
            颜色
            <input type="color" value={teamColor} onChange={(event) => setTeamColor(event.target.value)} className="mt-1 block h-9 w-14" />
          </label>
          <button className="rounded-lg bg-gdut-700 px-3 py-1.5 text-sm text-white">{editingTeam ? '保存修改' : '添加队伍'}</button>
          {editingTeam && (
            <button
              type="button"
              className="text-sm text-slate-500"
              onClick={() => {
                setEditingTeam(null);
                setTeamName('');
                setTeamShort('');
              }}
            >
              取消
            </button>
          )}
        </form>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {detail.teams.map((team) => (
            <li key={team.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                  {team.name}
                  <span className="text-slate-400">{team.short}</span>
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => editTeam(team)} className="text-gdut-600">
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        if (!window.confirm(`删除「${team.name}」？相关比赛里的位置会变成待定。`)) return;
                        await api(`/api/admin/teams/${team.id}`, { method: 'DELETE' });
                      })
                    }
                    className="text-red-600"
                  >
                    删除
                  </button>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(team.players ?? []).length === 0 && <span className="text-xs text-slate-400">队员未填</span>}
                {(team.players ?? []).map((player) => (
                  <span key={player.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {player.name}
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => void run(() => api(`/api/admin/players/${player.id}`, { method: 'DELETE' }))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={playerDraft[team.id] ?? ''}
                  onChange={(event) => setPlayerDraft((current) => ({ ...current, [team.id]: event.target.value }))}
                  placeholder="补队员，用顿号分开"
                  className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                />
                <button type="button" onClick={() => void addPlayers(team.id)} className="text-xs text-gdut-600">
                  添加
                </button>
              </div>
            </li>
          ))}
          {detail.teams.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">还没有队伍</li>}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-semibold">赛制和对阵</h2>
        <p className="mb-3 text-sm text-slate-500">先选一种赛制生成初始对阵。报名不齐、场地还没定也可以生成，空着的签位和场地以后再填。下面的比赛表仍可逐场增删。</p>
        <form onSubmit={(event) => void generate(event)} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['round_robin', '单循环', '勾选的队伍互相比一场'],
                ['double_round_robin', '双循环', '每对队伍主客场各一场'],
                ['groups_knockout', '小组赛 + 淘汰赛', '分组循环后按名次排淘汰赛签表'],
                ['single_elim', '单败淘汰', '按 4、8 或 16 签排对阵，签位可以先空着'],
              ] as [FormatPreset, string, string][]
            ).map(([value, label, help]) => (
              <label key={value} className={`rounded-lg border px-3 py-2 text-sm ${preset === value ? 'border-gdut-700 bg-gdut-50' : 'border-slate-200'}`}>
                <input type="radio" name="preset" className="mr-2" checked={preset === value} onChange={() => setPreset(value)} />
                <span className="font-medium">{label}</span>
                <span className="mt-0.5 block pl-5 text-xs text-slate-500">{help}</span>
              </label>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {detail.teams.length === 0 && <span className="text-sm text-slate-400">还没有报名队伍。淘汰赛可以先出空签表。</span>}
            {detail.teams.map((team) => (
              <label key={team.id} className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(team.id)}
                  onChange={(event) =>
                    setPicked((current) => (event.target.checked ? [...current, team.id] : current.filter((id) => id !== team.id)))
                  }
                />
                {team.short}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {preset === 'groups_knockout' && (
              <>
                <label className="text-sm text-slate-600">
                  小组数
                  <select value={groupCount} onChange={(event) => setGroupCount(Number(event.target.value))} className={inputClass}>
                    {[2, 4, 8].map((count) => (
                      <option key={count} value={count}>
                        {count} 组
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  每组出线
                  <select value={qualifiers} onChange={(event) => setQualifiers(Number(event.target.value))} className={inputClass}>
                    <option value={1}>前 1 名</option>
                    <option value={2}>前 2 名</option>
                  </select>
                </label>
              </>
            )}
            {preset === 'single_elim' && (
              <label className="text-sm text-slate-600">
                签位
                <select value={bracketSize} onChange={(event) => setBracketSize(Number(event.target.value))} className={inputClass}>
                  {[4, 8, 16].map((count) => (
                    <option key={count} value={count}>
                      {count} 签
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(preset === 'groups_knockout' || preset === 'single_elim') && (
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                <input type="checkbox" checked={thirdPlace} onChange={(event) => setThirdPlace(event.target.checked)} />
                三四名决赛
              </label>
            )}
            <label className="text-sm text-slate-600">
              组别
              <select value={division} onChange={(event) => setDivision(event.target.value as Division)} className={inputClass}>
                {DIVISION_ORDER.map((item) => (
                  <option key={item} value={item}>
                    {DIVISION_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              首轮日期
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
            </label>
            <label className="text-sm text-slate-600">
              默认场地
              <input value={venue} onChange={(event) => setVenue(event.target.value)} className={inputClass} placeholder="可以先空着" />
            </label>
            <button className="rounded-lg bg-gdut-700 px-3 py-1.5 text-sm text-white">生成对阵</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">同一轮的比赛从 14:00 起排，每轮间隔 7 天。勾选顺序会决定种子和分组。这个组别已经有比赛时，再生成会先清掉旧的，不会往后追加。</p>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">逐场调整</h2>
        <form onSubmit={(event) => void saveMatch(event)} className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-600">
              组别
              <select value={form.division} onChange={(event) => set({ division: event.target.value as Division })} className={inputClass}>
                {DIVISION_ORDER.map((item) => (
                  <option key={item} value={item}>
                    {DIVISION_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              阶段
              <select value={form.stage} onChange={(event) => set({ stage: event.target.value as Stage })} className={inputClass}>
                {(Object.keys(STAGE_LABEL) as Stage[]).map((item) => (
                  <option key={item} value={item}>
                    {STAGE_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              小组
              <input value={form.group} onChange={(event) => set({ group: event.target.value })} className={inputClass} placeholder="淘汰赛可留空" />
            </label>
            <label className="text-sm text-slate-600">
              状态
              <select value={form.status} onChange={(event) => set({ status: event.target.value as MatchStatus })} className={inputClass}>
                <option value="scheduled">未开始</option>
                <option value="live">进行中</option>
                <option value="finished">已结束</option>
              </select>
            </label>
            <label className="text-sm text-slate-600">
              主队
              <select value={form.home} onChange={(event) => set({ home: event.target.value })} className={inputClass}>
                <option value="">待定</option>
                {detail.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              客队
              <select value={form.away} onChange={(event) => set({ away: event.target.value })} className={inputClass}>
                <option value="">待定</option>
                {detail.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              时间
              <input type="datetime-local" value={form.time} onChange={(event) => set({ time: event.target.value })} className={inputClass} />
            </label>
            <label className="text-sm text-slate-600">
              场地
              <input value={form.venue} onChange={(event) => set({ venue: event.target.value })} className={inputClass} />
            </label>
            {started && (
              <>
                <label className="text-sm text-slate-600">
                  主队{scoreName}
                  <input value={form.scoreHome} onChange={(event) => set({ scoreHome: event.target.value })} className={inputClass} inputMode="numeric" />
                </label>
                <label className="text-sm text-slate-600">
                  客队{scoreName}
                  <input value={form.scoreAway} onChange={(event) => set({ scoreAway: event.target.value })} className={inputClass} inputMode="numeric" />
                </label>
              </>
            )}
            {started && league.sport === 'volleyball' && (
              <label className="text-sm text-slate-600 sm:col-span-2">
                每局小分
                <input value={form.sets} onChange={(event) => set({ sets: event.target.value })} placeholder="25-18, 25-20, 18-25" className={inputClass} />
              </label>
            )}
          </div>
          {form.status === 'finished' && (
            <div className="mt-4">
              <h3 className="text-sm font-medium">球员数据</h3>
              <p className="mt-1 text-xs text-slate-400">比赛结束后才会在前台显示。留空的球员不会写进数据表。</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {[form.home, form.away].map((teamId, index) => {
                  const team = detail.teams.find((item) => item.id === teamId);
                  return (
                    <LineEditor
                      key={`${teamId || 'empty'}-${index}`}
                      teamName={team?.short ?? '待定'}
                      players={team?.players ?? []}
                      fields={STAT_FIELDS[league.sport]}
                      lines={form.lines}
                      onChange={setLine}
                    />
                  );
                })}
              </div>
            </div>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-500">{league.sport === 'football' ? '晋级、点球、弃权' : '晋级、弃权'}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-600">
                主队种子
                <input value={form.homeSeed} onChange={(event) => set({ homeSeed: event.target.value })} placeholder="A1" className={inputClass} />
              </label>
              <label className="text-sm text-slate-600">
                客队种子
                <input value={form.awaySeed} onChange={(event) => set({ awaySeed: event.target.value })} placeholder="B2" className={inputClass} />
              </label>
              <label className="text-sm text-slate-600">
                弃权方
                <select value={form.forfeit} onChange={(event) => set({ forfeit: event.target.value as MatchForm['forfeit'] })} className={inputClass}>
                  <option value="">无</option>
                  <option value="home">主队</option>
                  <option value="away">客队</option>
                </select>
              </label>
              {started && league.sport === 'football' && (
                <label className="text-sm text-slate-600">
                  点球
                  <span className="mt-1 flex gap-1">
                    <input value={form.penHome} onChange={(event) => set({ penHome: event.target.value })} placeholder="主" className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                    <input value={form.penAway} onChange={(event) => set({ penAway: event.target.value })} placeholder="客" className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  </span>
                </label>
              )}
              <label className="text-sm text-slate-600">
                胜者进入
                <select value={form.nextMatchId} onChange={(event) => set({ nextMatchId: event.target.value })} className={inputClass}>
                  <option value="">无</option>
                  {detail.matches
                    .filter((match) => match.id !== form.id)
                    .map((match) => (
                      <option key={match.id} value={match.id}>
                        {formatDate(dateOf(match.time))} {STAGE_LABEL[match.stage]} {clockOf(match.time)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                胜者位置
                <select value={form.nextSlot} onChange={(event) => set({ nextSlot: event.target.value as MatchForm['nextSlot'] })} className={inputClass}>
                  <option value="">无</option>
                  <option value="home">主队</option>
                  <option value="away">客队</option>
                </select>
              </label>
              <label className="text-sm text-slate-600">
                负者进入
                <select value={form.loserNextMatchId} onChange={(event) => set({ loserNextMatchId: event.target.value })} className={inputClass}>
                  <option value="">无</option>
                  {detail.matches
                    .filter((match) => match.id !== form.id)
                    .map((match) => (
                      <option key={match.id} value={match.id}>
                        {formatDate(dateOf(match.time))} {STAGE_LABEL[match.stage]} {clockOf(match.time)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                负者位置
                <select value={form.loserNextSlot} onChange={(event) => set({ loserNextSlot: event.target.value as MatchForm['loserNextSlot'] })} className={inputClass}>
                  <option value="">无</option>
                  <option value="home">主队</option>
                  <option value="away">客队</option>
                </select>
              </label>
            </div>
          </details>
          <div className="mt-4 flex gap-3">
            <button className="rounded-lg bg-gdut-700 px-4 py-1.5 text-sm font-semibold text-white">{form.id ? '保存修改' : '添加比赛'}</button>
            {form.id && (
              <button type="button" className="text-sm text-slate-500" onClick={() => setForm(blankMatch())}>
                取消编辑
              </button>
            )}
          </div>
        </form>

        {detail.matches.length > 0 && (
          <div className="mb-2 flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? [] : detail.matches.map((match) => match.id))}
              />
              全选
            </label>
            <button type="button" disabled={chosen.length === 0} onClick={() => void deleteSelected()} className="text-red-600 disabled:text-slate-300">
              删除所选{chosen.length > 0 ? `（${chosen.length}）` : ''}
            </button>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {detail.matches.map((match) => (
                <tr key={match.id} className="border-t border-slate-100">
                  <td className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={chosen.includes(match.id)}
                      onChange={(event) =>
                        setSelected((current) => (event.target.checked ? [...current, match.id] : current.filter((id) => id !== match.id)))
                      }
                      aria-label={`选择 ${teamNameOf(match.home)} 对 ${teamNameOf(match.away)}`}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {formatDate(dateOf(match.time))} {clockOf(match.time)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {DIVISION_LABEL[match.division]} · {match.stage === 'group' ? `${match.group ?? ''}组` : STAGE_LABEL[match.stage]}
                  </td>
                  <td className="px-3 py-2">
                    {teamNameOf(match.home)} {match.score ? `${match.score.home}:${match.score.away}` : 'vs'} {teamNameOf(match.away)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setForm(toForm(match))} className="mr-3 text-gdut-600">
                      编辑
                    </button>
                    <button
                      onClick={() =>
                        void run(async () => {
                          if (!window.confirm('删除这场比赛？')) return;
                          await api(`/api/admin/matches/${match.id}`, { method: 'DELETE' });
                          setSelected((current) => current.filter((id) => id !== match.id));
                          if (form.id === match.id) setForm(blankMatch());
                        })
                      }
                      className="text-red-600"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {detail.matches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">还没有比赛</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LineEditor({
  teamName,
  players,
  fields,
  lines,
  onChange,
}: {
  teamName: string;
  players: Player[];
  fields: { key: 'points' | 'rebounds' | 'assists'; label: string }[];
  lines: MatchForm['lines'];
  onChange: (playerId: string, key: 'points' | 'rebounds' | 'assists', value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-sm font-medium">{teamName}</p>
      {players.length === 0 ? (
        <p className="text-xs text-slate-400">还没有队员。先到上面的报名里加上。</p>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <div key={player.id} className="flex flex-wrap items-end gap-2">
              <span className="w-20 shrink-0 truncate pb-1 text-sm">{player.name}</span>
              {fields.map((field) => (
                <label key={field.key} className="text-xs text-slate-500">
                  {field.label}
                  <input
                    value={lines[player.id]?.[field.key] ?? ''}
                    onChange={(event) => onChange(player.id, field.key, event.target.value)}
                    inputMode="numeric"
                    className="mt-0.5 block w-16 rounded border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeagueAdmin() {
  return (
    <AdminGate>
      <LeagueAdminBody />
    </AdminGate>
  );
}
