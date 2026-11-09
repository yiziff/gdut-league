import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { fitBracketSize, planFormat, type FormatPreset } from '../../lib/formats';
import { readLogoFile } from '../../lib/logoFile';
import { DIVISION_LABEL, DIVISION_ORDER, SPORT_MAP, STAGE_LABEL } from '../../sports';
import { useDataState } from '../../data/store';
import { statFieldsForTemplate } from '../../lib/statSheetTemplate';
import {
  LEAGUE_LEVELS,
  type Division,
  type League,
  type Match,
  type MatchStatSheet,
  type MatchStatSheetTemplate,
  type MatchStatus,
  type Player,
  type PlayerLine,
  type PlayerStatKey,
  type Side,
  type Stage,
  type Team,
} from '../../types';
import { clockOf, dateOf, formatDate } from '../../lib/format';
import AdminGate, { useAdminActor } from './AdminGate';
import { api, ApiError } from './api';
import FibaReview from './FibaReview';
import StatSheetScanner, { type StatSheetRecognition } from './StatSheetScanner';
import StatSheetTemplateUploader from './StatSheetTemplateUploader';

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
  lines: Record<string, Partial<Record<PlayerStatKey, string>>>;
  statSheet?: MatchStatSheet;
  statSheetTemplate?: MatchStatSheetTemplate;
  statSheetTemplateImage: string;
}

interface PlayerDraft {
  className: string;
  name: string;
  number: string;
}

function blankPlayerDraft(): PlayerDraft {
  return { className: '', name: '', number: '' };
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
    statSheetTemplateImage: '',
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
      (match.lines ?? []).map((line) => [
        line.playerId,
        Object.fromEntries(
          statFieldsForTemplate(match.sport, match.statSheetTemplate).flatMap((field) =>
            line[field.key] === undefined ? [] : [[field.key, String(line[field.key])]],
          ),
        ),
      ]),
    ),
    statSheet: match.statSheet,
    statSheetTemplate: match.statSheetTemplate,
    statSheetTemplateImage: '',
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

const inputClass = 'field mt-1.5 w-full';

const ROSTER_PLACEHOLDER = `计算机学院,计算机
软件工程1班,张三,10
软件工程1班,李四,11

或四列：队伍,班级,姓名,号码`;

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

function downloadRosterTemplate(): void {
  const csv = '\uFEFF队伍,班级,姓名,号码\n计算机学院,软件工程1班,张三,10\n计算机学院,软件工程1班,李四,11\n机电工程学院,机械1班,王五,7\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '报名名单.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function LeagueAdminBody() {
  const actor = useAdminActor();
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const createdByFlash = (location.state as { createdBy?: string } | null)?.createdBy;
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
  const [bracketSize, setBracketSize] = useState(4);
  const [thirdPlace, setThirdPlace] = useState(true);
  const [division, setDivision] = useState<Division>('men');
  const [startDate, setStartDate] = useState('');
  const [venue, setVenue] = useState('');
  const [addingPlayerTo, setAddingPlayerTo] = useState<string | null>(null);
  const [playerDrafts, setPlayerDrafts] = useState<Record<string, PlayerDraft>>({});
  const [playerErrors, setPlayerErrors] = useState<Record<string, string>>({});
  const [savingPlayerFor, setSavingPlayerFor] = useState<string | null>(null);
  const [notice, setNotice] = useState(createdByFlash ? `已创建，创建者是 ${createdByFlash}。` : '');
  const [savingMatch, setSavingMatch] = useState(false);
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [rosterText, setRosterText] = useState('');
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<MatchForm>(blankMatch);
  const [selected, setSelected] = useState<string[]>([]);
  const fittedSlots = fitBracketSize(picked.length);

  useEffect(() => {
    setBracketSize(fittedSlots);
  }, [fittedSlots]);

  async function refresh() {
    try {
      const next = await api<Detail>(`/api/leagues/${leagueId}`);
      setDetail(next);
      setMissing(false);
      const only = next.league.kind === 'single' ? next.matches[0] : undefined;
      if (only) setForm((current) => (current.id ? current : toForm(only)));
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
  const matchFields = statFieldsForTemplate(league.sport, form.statSheetTemplate);

  const meta = SPORT_MAP[league.sport];
  const teamNameOf = (id: string | null) => detail.teams.find((team) => team.id === id)?.short ?? '待定';
  const chosen = selected.filter((id) => detail.matches.some((match) => match.id === id));
  const allSelected = detail.matches.length > 0 && chosen.length === detail.matches.length;
  const started = form.status !== 'scheduled';
  const scoreName =
    league.sport === 'football' ? '进球' : league.sport === 'volleyball' ? '局数' : league.sport === 'basketball' ? '得分' : '胜场';
  const ownsLeague = !league.createdBy || league.createdBy === actor;
  const single = league.kind === 'single';

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
    const body: { name: FormDataEntryValue | null; season: FormDataEntryValue | null; level: FormDataEntryValue | null; logo?: string } = {
      name: data.get('name'),
      season: data.get('season'),
      level: data.get('level'),
    };
    if (logoDraft !== null) body.logo = logoDraft;
    const uploadedLogo = logoDraft !== null && logoDraft !== '';
    await run(async () => {
      await api(`/api/admin/leagues/${league.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setLogoDraft(null);
      setNotice(uploadedLogo ? '联赛资料已保存，图标已上传。' : '联赛资料已保存。');
    });
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

  async function submitRoster(body: { text?: string; docxBase64?: string }) {
    setNotice('');
    setError('');
    setImporting(true);
    try {
      const result = await api<{ teamsCreated: number; playersCreated: number }>(`/api/admin/leagues/${league.id}/roster`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await refresh();
      setRosterText('');
      setNotice(`已导入 ${result.playersCreated} 名队员，新建 ${result.teamsCreated} 支队伍。同名队伍会把新队员加进原队伍。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  async function onRosterFile(file: File | undefined, input: HTMLInputElement) {
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.docx')) {
        await submitRoster({ docxBase64: bytesToBase64(await file.arrayBuffer()) });
      } else if (name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.tsv') || file.type.startsWith('text/')) {
        setRosterText(await file.text());
        setNotice('文件已放进文本框，确认后点「导入名单」。');
        setError('');
      } else {
        setError('请上传 .docx、.csv 或 .txt。旧版 .doc 请另存为 docx，或把表格复制后粘贴。');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件读不出来');
    } finally {
      input.value = '';
    }
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
                if (!row || !matchFields.some((field) => row[field.key]?.trim())) return [];
                const line: PlayerLine = { playerId: player.id, points: Number(row.points || 0) };
                for (const field of matchFields) {
                  const value = row[field.key]?.trim();
                  if (value !== undefined && value !== '') line[field.key] = Number(value);
                }
                return [line];
              });
            })
          : null,
      statSheet: form.statSheet ?? null,
      statSheetTemplate: form.statSheetTemplate ?? null,
      statSheetTemplateImage: form.statSheetTemplateImage || undefined,
      nextMatchId: form.nextMatchId || null,
      nextSlot: form.nextSlot || null,
      loserNextMatchId: form.loserNextMatchId || null,
      loserNextSlot: form.loserNextSlot || null,
    };
    const uploadingTemplate = Boolean(form.statSheetTemplateImage);
    const editing = Boolean(form.id);
    setSavingMatch(true);
    await run(async () => {
      const saved = editing
        ? await api<Match>(`/api/admin/matches/${form.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await api<Match>(`/api/admin/leagues/${league.id}/matches`, { method: 'POST', body: JSON.stringify(body) });
      setForm(editing ? toForm(saved) : blankMatch());
      setNotice(
        uploadingTemplate
          ? '空白模板已上传到这场比赛。'
          : editing
            ? '这场比赛已保存。'
            : '比赛已添加。',
      );
    });
    setSavingMatch(false);
  }

  async function addPlayer(event: FormEvent, team: Team) {
    event.preventDefault();
    const draft = playerDrafts[team.id] ?? blankPlayerDraft();
    setError('');
    setNotice('');
    setPlayerErrors((current) => ({ ...current, [team.id]: '' }));
    const conflict = (team.players ?? []).find((player) => player.number === draft.number.trim());
    if (conflict) {
      setPlayerErrors((current) => ({
        ...current,
        [team.id]: `号码 ${draft.number.trim()} 已被 ${conflict.name} 使用`,
      }));
      return;
    }
    setSavingPlayerFor(team.id);
    try {
      await api(`/api/admin/teams/${team.id}/players`, {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      await refresh();
      setPlayerDrafts((current) => ({ ...current, [team.id]: blankPlayerDraft() }));
      setNotice(`已为「${team.name}」添加 ${draft.name}。`);
    } catch (err) {
      setPlayerErrors((current) => ({
        ...current,
        [team.id]: err instanceof Error ? err.message : '保存成员失败',
      }));
    } finally {
      setSavingPlayerFor(null);
    }
  }

  function setPlayerDraft(teamId: string, field: keyof PlayerDraft, value: string) {
    setPlayerDrafts((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] ?? blankPlayerDraft()),
        [field]: value,
      },
    }));
  }

  function closePlayerForm(teamId: string) {
    setAddingPlayerTo(null);
    setPlayerErrors((current) => ({ ...current, [teamId]: '' }));
    setPlayerDrafts((current) => {
      const next = { ...current };
      delete next[teamId];
      return next;
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
  const setLine = (playerId: string, key: PlayerStatKey, value: string) =>
    setForm((current) => ({
      ...current,
      lines: {
        ...current.lines,
        [playerId]: {
          ...(current.lines[playerId] ?? {}),
          [key]: value,
        },
      },
    }));

  const applyRecognition = (result: StatSheetRecognition) => {
    setForm((current) => {
      const lines = { ...current.lines };
      for (const row of result.rows) {
        const next = { ...(lines[row.playerId] ?? {}) };
        for (const [key, value] of Object.entries(row.stats) as [PlayerStatKey, number][]) {
          next[key] = String(value);
        }
        lines[row.playerId] = next;
      }
      return {
        ...current,
        status: 'finished',
        statSheet: result.statSheet,
        lines,
        scoreHome: result.score ? String(result.score.home) : current.scoreHome,
        scoreAway: result.score ? String(result.score.away) : current.scoreAway,
      };
    });
    void refresh();
  };

  return (
    <div>
      <Link to="/admin" className="text-xs font-medium text-slate-500 hover:text-gdut-700">
        赛事管理 / 返回列表
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{meta.name} · {detail.league.season || '当前赛季'}</p>
          <h1 className="page-title mt-1">{detail.league.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {detail.league.createdBy ? `创建者 ${detail.league.createdBy}` : '创建者未记录'}
            {' · '}
            {detail.league.published ? '已上线' : '未上线，前台还看不到'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.league.published ? (
            <Link to={`/${detail.league.sport}/${detail.league.id}/schedule`} className="btn-secondary">
              前台查看
            </Link>
          ) : null}
          {ownsLeague && (
            <button
              className="btn-secondary"
              onClick={() =>
                void run(() =>
                  api(`/api/admin/leagues/${detail.league.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      name: detail.league.name,
                      season: detail.league.season,
                      level: detail.league.level,
                      published: !detail.league.published,
                    }),
                  }),
                )
              }
            >
              {detail.league.published ? '下线' : '上线'}
            </button>
          )}
          {ownsLeague && !detail.league.createdBy && (
            <button
              className="btn-secondary"
              onClick={() =>
                void run(() =>
                  api(`/api/admin/leagues/${detail.league.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      name: detail.league.name,
                      season: detail.league.season,
                      level: detail.league.level,
                      claim: true,
                    }),
                  }),
                )
              }
            >
              记到我名下
            </button>
          )}
          {ownsLeague && (
            <button
              className="btn-danger"
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
          )}
        </div>
      </div>
      {error && <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <form onSubmit={(event) => void saveLeague(event)} className="surface mb-10 flex flex-wrap items-end gap-4 p-4">
        <p className="w-full text-sm text-slate-500">
          {ownsLeague
            ? '上线之后，名称、赛季、级别和图标仍然由创建者修改。'
            : `这个联赛由 ${detail.league.createdBy} 创建。上线之后只有创建者可以改这些资料。`}
        </p>
        <label className="text-sm font-medium text-slate-700">
          名称
          <input name="name" defaultValue={detail.league.name} key={detail.league.name} className={inputClass} disabled={!ownsLeague} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          赛季
          <input name="season" defaultValue={detail.league.season} key={detail.league.season} className={inputClass} disabled={!ownsLeague} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          级别
          <select name="level" defaultValue={detail.league.level} key={detail.league.level} className={inputClass} disabled={!ownsLeague}>
            {LEAGUE_LEVELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          联赛图标
          <span className="mt-1.5 flex items-center gap-3">
            {(logoDraft ?? league.logo) ? (
              <img src={logoDraft ?? league.logo} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : null}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm text-slate-600"
              disabled={!ownsLeague}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void readLogoFile(file)
                  .then(setLogoDraft)
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Logo 无法读取'));
              }}
            />
            {(logoDraft ?? league.logo) ? (
              <button type="button" className="text-xs font-semibold text-slate-500 hover:text-navy-900" onClick={() => setLogoDraft('')}>
                移除
              </button>
            ) : null}
          </span>
          {logoDraft ? (
            <span className="mt-2 block text-xs text-amber-800">图标已选好，还没上传。点右边的「保存」才会记到这个联赛上。</span>
          ) : league.logo ? (
            <span className="mt-2 block text-xs text-emerald-700">图标已保存在这个联赛上。</span>
          ) : (
            <span className="mt-2 block text-xs text-slate-400">还没有图标。</span>
          )}
        </label>
        {ownsLeague && <button className="btn-primary">保存</button>}
      </form>

      <section className="mb-10">
        <p className="data-label mb-1">Registration</p>
        <h2 className="section-title">报名管理</h2>
        <p className="mt-2 mb-4 text-sm text-slate-500">可以一次导入整份名单，也可以先创建队伍再逐个添加。每位成员都需要班级、姓名和号码。</p>

        <div className="surface mb-4 p-4">
          <h3 className="mb-1 text-sm font-semibold text-navy-950">一次导入</h3>
          <p className="mb-3 text-sm text-slate-500">
            从 Word 或 Excel 复制表格后粘贴。四列依次是队伍、班级、姓名、号码。也可以先写一行队伍名，下面每行写班级、姓名、号码。上传 .docx 会直接导入，.csv 会先放进文本框。
          </p>
          <textarea
            value={rosterText}
            onChange={(event) => setRosterText(event.target.value)}
            rows={6}
            placeholder={ROSTER_PLACEHOLDER}
            className="field w-full font-mono"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={importing || !rosterText.trim()}
              onClick={() => void submitRoster({ text: rosterText })}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? '导入中…' : '导入名单'}
            </button>
            <label className="btn-secondary cursor-pointer">
              选择 Word 或表格
              <input
                type="file"
                accept=".docx,.csv,.txt,.tsv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(event) => void onRosterFile(event.target.files?.[0], event.target)}
              />
            </label>
            <button type="button" onClick={downloadRosterTemplate} className="text-sm text-gdut-600">
              下载示例表格
            </button>
          </div>
        </div>

        <div className="surface mb-4 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy-950">{editingTeam ? '编辑队伍' : '创建队伍'}</h3>
          <form onSubmit={(event) => void saveTeam(event)} className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-600">
              全称
              <input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                className={inputClass}
                placeholder="计算机学院"
                required
              />
            </label>
            <label className="text-sm text-slate-600">
              简称
              <input value={teamShort} onChange={(event) => setTeamShort(event.target.value)} className={inputClass} placeholder="计算机" />
            </label>
            <label className="text-sm text-slate-600">
              颜色
              <input type="color" value={teamColor} onChange={(event) => setTeamColor(event.target.value)} className="mt-1 block h-9 w-14" />
            </label>
            <button className="btn-primary">{editingTeam ? '保存修改' : '创建队伍'}</button>
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
        </div>

        <div className="space-y-3">
          {detail.teams.map((team) => {
            const players = team.players ?? [];
            const draft = playerDrafts[team.id] ?? blankPlayerDraft();
            const adding = addingPlayerTo === team.id;
            const savingPlayer = savingPlayerFor === team.id;
            const numberCounts = players.reduce<Record<string, number>>((counts, player) => {
              if (player.number) counts[player.number] = (counts[player.number] ?? 0) + 1;
              return counts;
            }, {});
            const duplicateNumbers = Object.keys(numberCounts).filter((number) => numberCounts[number] > 1);
            return (
              <article key={team.id} className="surface overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="h-4 w-1 rounded-sm" style={{ backgroundColor: team.color }} />
                      {team.name}
                      <span className="text-sm font-normal text-slate-400">{team.short}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{players.length} 名成员</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      className="font-medium text-gdut-600"
                      aria-expanded={adding}
                      onClick={() => {
                        if (adding) closePlayerForm(team.id);
                        else setAddingPlayerTo(team.id);
                      }}
                    >
                      {adding ? '取消添加' : '+ 添加成员'}
                    </button>
                    <button type="button" onClick={() => editTeam(team)} className="text-slate-600">
                      编辑队伍
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          if (!window.confirm(`删除「${team.name}」？相关比赛里的位置会变成待定。`)) return;
                          await api(`/api/admin/teams/${team.id}`, { method: 'DELETE' });
                          if (addingPlayerTo === team.id) setAddingPlayerTo(null);
                        })
                      }
                      className="text-red-600"
                    >
                      删除队伍
                    </button>
                  </div>
                </header>

                {players.length === 0 ? (
                  <p className="border-t border-slate-100 px-4 py-5 text-center text-sm text-slate-400">还没有成员，点击“添加成员”开始录入</p>
                ) : (
                  <div className="overflow-x-auto border-t border-slate-100">
                    {duplicateNumbers.length > 0 && (
                      <p className="bg-red-50 px-4 py-2 text-sm text-red-700">
                        号码 {duplicateNumbers.join('、')} 重复，请删除冲突成员；之后同队号码将不能重复。
                      </p>
                    )}
                    <table className="w-full min-w-lg text-sm">
                      <thead className="bg-slate-50 text-left text-xs text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-medium">班级</th>
                          <th className="px-4 py-2 font-medium">姓名</th>
                          <th className="px-4 py-2 font-medium">号码</th>
                          <th className="px-4 py-2 text-right font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((player) => (
                          <tr
                            key={player.id}
                            className={`border-t border-slate-100 ${numberCounts[player.number] > 1 ? 'bg-red-50/50' : ''}`}
                          >
                            <td className="px-4 py-2">{player.className || '—'}</td>
                            <td className="px-4 py-2 font-medium">{player.name}</td>
                            <td className={`px-4 py-2 tabular-nums ${numberCounts[player.number] > 1 ? 'font-semibold text-red-700' : ''}`}>
                              {player.number || '—'}
                              {numberCounts[player.number] > 1 && <span className="ml-2 text-xs font-normal">重复</span>}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                className="text-red-600"
                                onClick={() => {
                                  if (!window.confirm(`删除成员「${player.name}」？`)) return;
                                  void run(() => api(`/api/admin/players/${player.id}`, { method: 'DELETE' }));
                                }}
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {adding && (
                  <form onSubmit={(event) => void addPlayer(event, team)} className="border-t border-slate-100 bg-slate-50/80 p-4">
                    <p className="mb-3 text-sm font-semibold text-navy-950">添加一名成员</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-sm text-slate-600">
                        班级
                        <input
                          value={draft.className}
                          onChange={(event) => setPlayerDraft(team.id, 'className', event.target.value)}
                          className={inputClass}
                          placeholder="软件工程 1 班"
                          autoFocus
                          required
                        />
                      </label>
                      <label className="text-sm text-slate-600">
                        姓名
                        <input
                          value={draft.name}
                          onChange={(event) => setPlayerDraft(team.id, 'name', event.target.value)}
                          className={inputClass}
                          placeholder="张三"
                          required
                        />
                      </label>
                      <label className="text-sm text-slate-600">
                        号码
                        <input
                          value={draft.number}
                          onChange={(event) => setPlayerDraft(team.id, 'number', event.target.value)}
                          className={inputClass}
                          placeholder="10"
                          inputMode="numeric"
                          required
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={savingPlayer}
                        className="btn-primary disabled:cursor-wait disabled:opacity-60"
                      >
                        {savingPlayer ? '保存中…' : '保存成员'}
                      </button>
                      <button type="button" onClick={() => closePlayerForm(team.id)} className="text-sm text-slate-500">
                        取消
                      </button>
                      {playerErrors[team.id] && (
                        <p role="alert" className="text-sm text-red-600">
                          {playerErrors[team.id]}
                        </p>
                      )}
                    </div>
                  </form>
                )}
              </article>
            );
          })}
          {detail.teams.length === 0 && (
            <div className="empty-state">
              还没有队伍，请先创建队伍
            </div>
          )}
        </div>
      </section>

      {!single && (
      <section className="mb-10">
        <p className="data-label mb-1">Competition format</p>
        <h2 className="section-title">赛制和对阵</h2>
        <p className="mt-2 mb-4 text-sm text-slate-500">先选一种赛制生成初始对阵。报名不齐、场地还没定也可以生成，空着的签位和场地以后再填。下面的比赛表仍可逐场增删。</p>
        <form onSubmit={(event) => void generate(event)} className="surface p-4">
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['round_robin', '单循环', '勾选的队伍互相比一场'],
                ['double_round_robin', '双循环', '每对队伍主客场各一场'],
                ['groups_knockout', '小组赛 + 淘汰赛', '分组循环后按名次排淘汰赛签表'],
                ['single_elim', '单败淘汰', '按勾选的队伍排签。4 队就是 4 签，报名没齐再加大'],
              ] as [FormatPreset, string, string][]
            ).map(([value, label, help]) => (
              <label key={value} className={`rounded-lg border px-3 py-2 text-sm ${preset === value ? 'border-gdut-800 bg-gdut-800 text-white' : 'border-slate-200'}`}>
                <input type="radio" name="preset" className="mr-2" checked={preset === value} onChange={() => setPreset(value)} />
                <span className="font-medium">{label}</span>
                <span className={`mt-0.5 block pl-5 text-xs ${preset === value ? 'text-slate-300' : 'text-slate-500'}`}>{help}</span>
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
                  {[4, 8, 16]
                    .filter((count) => count >= fittedSlots)
                    .map((count) => (
                      <option key={count} value={count}>
                        {count === fittedSlots ? `${count} 签` : `${count} 签，空 ${count - picked.length} 位`}
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
            <button className="btn-primary">生成对阵</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">同一轮的比赛从 14:00 起排，每轮间隔 7 天。勾选顺序会决定种子和分组。这个组别已经有比赛时，再生成会先清掉旧的，不会往后追加。</p>
        </form>
      </section>
      )}

      <section>
        <p className="data-label mb-1">Match operations</p>
        <h2 className="section-title mb-4">{single ? '比赛信息' : '逐场调整'}</h2>
        <form onSubmit={(event) => void saveMatch(event)} className="surface mb-4 p-4">
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
            {!single && (
              <>
                <label className="text-sm text-slate-600">
                  阶段
                  <select value={form.stage} onChange={(event) => set({ stage: event.target.value as Stage })} className={inputClass}>
                    {(Object.keys(STAGE_LABEL) as Stage[])
                      .filter((item) => item !== 'single')
                      .map((item) => (
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
              </>
            )}
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
          <StatSheetTemplateUploader
            template={form.statSheetTemplate}
            draftImage={form.statSheetTemplateImage}
            saving={savingMatch}
            saveError={form.statSheetTemplateImage ? error : ''}
            onImage={(image) => set({ statSheetTemplateImage: image })}
            onRemove={() => set({ statSheetTemplate: undefined, statSheetTemplateImage: '', statSheet: undefined })}
            onTemplateChange={(template) => set({ statSheetTemplate: template })}
          />
          <div className="mt-4">
            <h3 className="text-sm font-medium">技术统计</h3>
            <p className="mt-1 text-xs text-slate-400">上传技术统计表后，这场比赛会自动记为已结束。留空的球员不会写入。</p>
            <StatSheetScanner
              matchId={form.id}
              template={form.statSheetTemplateImage ? undefined : form.statSheetTemplate}
              statSheet={form.statSheet}
              score={
                form.scoreHome !== '' && form.scoreAway !== ''
                  ? { home: Number(form.scoreHome), away: Number(form.scoreAway) }
                  : undefined
              }
              hasExistingStats={Object.values(form.lines).some((line) => Object.values(line).some((value) => value?.trim()))}
              fiba={league.sport === 'basketball'}
              onResult={applyRecognition}
            />
            {league.sport === 'basketball' && form.id && form.statSheet && (
              <FibaReview
                matchId={form.id}
                statSheet={form.statSheet}
                home={detail.teams.find((team) => team.id === form.home)}
                away={detail.teams.find((team) => team.id === form.away)}
                onSheet={(statSheet) => set({ statSheet })}
                onSaved={(match) =>
                  applyRecognition({
                    statSheet: match.statSheet!,
                    score: match.score,
                    rows: (match.lines ?? []).map((line) => ({
                      playerId: line.playerId,
                      teamId: '',
                      number: '',
                      name: '',
                      stats: { points: line.points },
                    })),
                  })
                }
              />
            )}
            {form.status === 'finished' && (
              <div className={`mt-3 grid gap-4 ${matchFields.length > 3 ? '' : 'lg:grid-cols-2'}`}>
                {[form.home, form.away].map((teamId, index) => {
                  const team = detail.teams.find((item) => item.id === teamId);
                  return (
                    <LineEditor
                      key={`${teamId || 'empty'}-${index}`}
                      teamName={team?.short ?? '待定'}
                      players={team?.players ?? []}
                      fields={matchFields}
                      lines={form.lines}
                      onChange={setLine}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-500">
              {[!single && '晋级', league.sport === 'football' && '点球', '弃权'].filter(Boolean).join('、')}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {!single && (
                <>
                  <label className="text-sm text-slate-600">
                    主队种子
                    <input value={form.homeSeed} onChange={(event) => set({ homeSeed: event.target.value })} placeholder="A1" className={inputClass} />
                  </label>
                  <label className="text-sm text-slate-600">
                    客队种子
                    <input value={form.awaySeed} onChange={(event) => set({ awaySeed: event.target.value })} placeholder="B2" className={inputClass} />
                  </label>
                </>
              )}
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
              {!single && (
              <>
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
              </>
              )}
            </div>
          </details>
          <div className="mt-4 flex gap-3">
            <button className="btn-primary" disabled={savingMatch}>
              {savingMatch ? '正在保存…' : form.statSheetTemplateImage ? '上传模板并保存比赛' : form.id ? '保存修改' : '添加比赛'}
            </button>
            {form.id && !single && (
              <button type="button" className="text-sm text-slate-500" onClick={() => setForm(blankMatch())}>
                取消编辑
              </button>
            )}
          </div>
        </form>

        {!single && detail.matches.length > 0 && (
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
        {!single && (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {detail.matches.map((match) => (
                <tr key={match.id} className="border-t border-slate-100 hover:bg-slate-50">
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
        )}
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
  fields: { key: PlayerStatKey; label: string }[];
  lines: MatchForm['lines'];
  onChange: (playerId: string, key: PlayerStatKey, value: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
      <p className="px-3 pt-3 pb-2 text-sm font-semibold text-navy-950">{teamName}</p>
      {players.length === 0 ? (
        <p className="px-3 pb-3 text-xs text-slate-400">还没有队员。先到上面的报名里加上。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-max border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="sticky left-0 z-10 border-y border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium">球员</th>
                {fields.map((field) => (
                  <th key={field.key} className="border-y border-l border-slate-200 bg-slate-100 px-2 py-2 text-center font-medium">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <th className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-navy-950">
                    <span className="mr-1 text-slate-400">#{player.number || '—'}</span>
                    {player.name}
                  </th>
                  {fields.map((field) => (
                    <td key={field.key} className="border-b border-l border-slate-200 bg-white p-1">
                      <input
                        aria-label={`${player.name}${field.label}`}
                        value={lines[player.id]?.[field.key] ?? ''}
                        onChange={(event) => onChange(player.id, field.key, event.target.value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="block w-14 rounded border border-slate-200 px-1.5 py-1 text-right text-sm tabular-nums"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
