import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  Division,
  League,
  LeagueLevel,
  Match,
  MatchStatSheet,
  MatchStatSheetTemplate,
  MatchStatus,
  Player,
  PlayerLine,
  PlayerStatKey,
  Score,
  Side,
  Sport,
  Stage,
  Team,
} from '../src/types.ts';
import { LEAGUE_LEVELS } from '../src/types.ts';
import { summarizeCareer } from '../src/lib/career.ts';
import { pointsKey, tallyMarks, type ScoreMark, type SheetSide } from '../src/lib/fibaScore.ts';
import { docxToText } from '../src/lib/docxRoster.ts';
import { planFormat, type FormatPreset } from '../src/lib/formats.ts';
import { PLAYER_STAT_KEYS } from '../src/lib/playerStats.ts';
import { STAT_SHEET_TEMPLATE_FIELD_KEYS } from '../src/lib/statSheetTemplate.ts';
import { parseRoster } from '../src/lib/rosterImport.ts';
import { addDays, roundRobinPairings } from '../src/lib/roundRobin.ts';
import {
  clearPlayerCookie,
  clearSessionCookie,
  createPlayerSession,
  createSession,
  destroyPlayerSession,
  destroySession,
  passwordOk,
  playerIdFromRequest,
  readPlayerToken,
  readCookie,
  renameSession,
  sessionName,
  sessionValid,
  setPlayerCookie,
  setSessionCookie,
} from './auth.ts';
import {
  allMatches,
  allTeams,
  deleteLeague,
  deleteMatch,
  deleteMatches,
  removeMatch,
  deletePlayer,
  deleteTeam,
  findPlayerAccounts,
  getPlayerAccount,
  getLeague,
  getMatch,
  getTeam,
  insertLeague,
  insertMatch,
  insertPlayer,
  insertTeam,
  playerIdsOf,
  listLeagues,
  matchesOf,
  teamsOf,
  transaction,
  updateLeague,
  updateMatch,
  updatePlayer,
  updateTeam,
} from './db.ts';
import { extractFibaSheet, FibaSheetError, saveDigitSamples } from './fibaSheet.ts';
import { clearLeagueLogo, clearPlayerAvatar, saveLeagueLogo, savePlayerAvatar } from './logo.ts';
import { seedIfEmpty } from './seed.ts';
import {
  analyzeStatSheetTemplateImage,
  recognizeFilledStatSheet,
  saveStatSheetImage,
  saveStatSheetTemplateImage,
} from './statSheet.ts';

function loadEnv(): void {
  const file = resolve('.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}

loadEnv();

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SPORTS: Sport[] = ['basketball', 'football', 'badminton', 'volleyball', 'tabletennis'];
const LEVELS: LeagueLevel[] = LEAGUE_LEVELS.map((item) => item.id);
const DIVISIONS: Division[] = ['men', 'women', 'mixed'];
const STAGES: Stage[] = ['group', 'R16', 'QF', 'SF', 'F', '3rd'];
const STATUSES: MatchStatus[] = ['scheduled', 'live', 'finished'];
const SIDES: Side[] = ['home', 'away'];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ApiError(400, `${label}不正确`);
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `请填写${label}`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.trim();
}

function numberOrNull(value: unknown, label: string): number | null {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ApiError(400, `${label}必须是非负数字`);
  return n;
}

function scoreOf(value: unknown, label: string): Score | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object') throw new ApiError(400, `${label}格式不对`);
  const raw = value as { home?: unknown; away?: unknown };
  const home = numberOrNull(raw.home, label);
  const away = numberOrNull(raw.away, label);
  if (home == null && away == null) return undefined;
  if (home == null || away == null) throw new ApiError(400, `请把${label}填完整`);
  return { home, away };
}

function setsOf(value: unknown): [number, number][] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new ApiError(400, '小分格式不对');
  if (value.length === 0) return undefined;
  return value.map((pair, index) => {
    if (!Array.isArray(pair) || pair.length !== 2) throw new ApiError(400, `第 ${index + 1} 局小分格式不对`);
    const home = numberOrNull(pair[0], '小分');
    const away = numberOrNull(pair[1], '小分');
    if (home == null || away == null) throw new ApiError(400, `第 ${index + 1} 局小分格式不对`);
    return [home, away];
  });
}

function statNum(value: unknown, label: string): number {
  if (value === '' || value == null) return 0;
  const n = numberOrNull(value, label);
  if (n == null) throw new ApiError(400, `${label}必须是非负数字`);
  return n;
}

function linesOf(value: unknown, home: string | null, away: string | null): PlayerLine[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new ApiError(400, '球员数据格式不对');
  const allowed = new Set([...(home ? playerIdsOf(home) : []), ...(away ? playerIdsOf(away) : [])]);
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new ApiError(400, '球员数据格式不对');
    const raw = item as Record<string, unknown>;
    const playerId = typeof raw.playerId === 'string' ? raw.playerId : '';
    if (!playerId || !allowed.has(playerId)) throw new ApiError(400, '球员不属于这场比赛的队伍');
    if (seen.has(playerId)) throw new ApiError(400, '球员数据重复了');
    seen.add(playerId);
    const line: PlayerLine = { playerId, points: statNum(raw.points, '得分') };
    const labels: Record<PlayerStatKey, string> = {
      points: '得分',
      rebounds: '篮板',
      assists: '助攻',
      twoPointsMade: '2 分命中',
      twoPointsAttempted: '2 分出手',
      threePointsMade: '3 分命中',
      threePointsAttempted: '3 分出手',
      freeThrowsMade: '罚球命中',
      freeThrowsAttempted: '罚球出手',
      offensiveRebounds: '前场篮板',
      defensiveRebounds: '后场篮板',
      steals: '抢断',
      turnovers: '失误',
      blocks: '盖帽',
      fouls: '犯规',
    };
    for (const key of PLAYER_STAT_KEYS) {
      if (key === 'points') continue;
      if (raw[key] === '' || raw[key] == null) continue;
      line[key] = statNum(raw[key], labels[key]);
    }
    const attempts: Array<[PlayerStatKey, PlayerStatKey, string]> = [
      ['twoPointsMade', 'twoPointsAttempted', '2 分球'],
      ['threePointsMade', 'threePointsAttempted', '3 分球'],
      ['freeThrowsMade', 'freeThrowsAttempted', '罚球'],
    ];
    for (const [made, attempted, label] of attempts) {
      if (line[made] !== undefined && line[attempted] !== undefined && line[made]! > line[attempted]!) {
        throw new ApiError(400, `${label}命中数不能大于出手数`);
      }
    }
    return line;
  });
}

function statSheetOf(value: unknown, matchId: string): MatchStatSheet | undefined {
  if (value == null) return undefined;
  if (!value || typeof value !== 'object') throw new ApiError(400, '技术统计表信息格式不对');
  const raw = value as Record<string, unknown>;
  const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '';
  const uploadedAt = typeof raw.uploadedAt === 'string' ? raw.uploadedAt.trim() : '';
  const expected = `/uploads/matches/${matchId}-stats.jpg`;
  if (!imageUrl.startsWith(expected)) throw new ApiError(400, '技术统计表图片地址不正确');
  if (!uploadedAt || Number.isNaN(Date.parse(uploadedAt))) throw new ApiError(400, '技术统计表上传时间不正确');
  const recognizedAt =
    typeof raw.recognizedAt === 'string' && !Number.isNaN(Date.parse(raw.recognizedAt))
      ? raw.recognizedAt
      : undefined;
  const ocrEngine = optionalText(raw.ocrEngine)?.slice(0, 80);
  return { imageUrl, uploadedAt, recognizedAt, ocrEngine };
}

function statSheetTemplateOf(value: unknown, matchId: string): MatchStatSheetTemplate | undefined {
  if (value == null) return undefined;
  if (!value || typeof value !== 'object') throw new ApiError(400, '技术统计表模板格式不对');
  const raw = value as Record<string, unknown>;
  const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '';
  const uploadedAt = typeof raw.uploadedAt === 'string' ? raw.uploadedAt.trim() : '';
  const expected = `/uploads/matches/${matchId}-template.jpg`;
  if (!imageUrl.startsWith(expected)) throw new ApiError(400, '技术统计表模板图片地址不正确');
  if (!uploadedAt || Number.isNaN(Date.parse(uploadedAt))) throw new ApiError(400, '技术统计表模板上传时间不正确');
  const analyzedAt =
    typeof raw.analyzedAt === 'string' && !Number.isNaN(Date.parse(raw.analyzedAt))
      ? raw.analyzedAt
      : undefined;
  const kind =
    raw.kind === 'box-score' || raw.kind === 'fiba-scoresheet' || raw.kind === 'generic'
      ? raw.kind
      : 'generic';
  const allowed = new Set<string>(STAT_SHEET_TEMPLATE_FIELD_KEYS);
  const seen = new Set<string>();
  const fields = Array.isArray(raw.fields)
    ? raw.fields.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const field = item as Record<string, unknown>;
        const key = typeof field.key === 'string' && allowed.has(field.key) ? field.key : '';
        if (!key || seen.has(key)) return [];
        seen.add(key);
        return [
          {
            key: key as MatchStatSheetTemplate['fields'][number]['key'],
            label: optionalText(field.label)?.slice(0, 40) ?? key,
            sourceLabel: optionalText(field.sourceLabel)?.slice(0, 80),
          },
        ];
      })
    : [];
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim().slice(0, 200)).slice(0, 20)
    : [];
  return {
    imageUrl,
    uploadedAt,
    analyzedAt,
    ocrEngine: optionalText(raw.ocrEngine)?.slice(0, 80),
    kind,
    fields,
    warnings,
  };
}

function sideOf(value: unknown, label: string): Side | undefined {
  if (value == null || value === '') return undefined;
  return oneOf(value, SIDES, label);
}

function parseMatch(body: unknown, league: League, id: string): Match {
  const raw = (body ?? {}) as Record<string, unknown>;
  const home = optionalText(raw.home) ?? null;
  const away = optionalText(raw.away) ?? null;
  if (home && away && home === away) throw new ApiError(400, '主队和客队不能是同一支队伍');
  for (const teamId of [home, away]) {
    if (teamId && getTeam(teamId)?.leagueId !== league.id) throw new ApiError(400, '队伍不属于这个联赛');
  }
  const status = oneOf(raw.status, STATUSES, '比赛状态');
  const score = scoreOf(raw.score, '比分');
    if (status === 'live' && !score) throw new ApiError(400, '进行中的比赛需要填写比分');
  const time = text(raw.time, '比赛时间');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time)) throw new ApiError(400, '比赛时间格式应为 2026-11-03T14:00');

  const nextMatchId = optionalText(raw.nextMatchId);
  const loserNextMatchId = optionalText(raw.loserNextMatchId);
  for (const target of [nextMatchId, loserNextMatchId]) {
    if (!target) continue;
    const match = getMatch(target);
    if (!match || match.leagueId !== league.id) throw new ApiError(400, '晋级目标比赛不属于这个联赛');
    if (target === id) throw new ApiError(400, '比赛不能晋级到自己');
  }

  return {
    id,
    leagueId: league.id,
    sport: league.sport,
    division: oneOf(raw.division, DIVISIONS, '组别'),
    stage: oneOf(raw.stage, STAGES, '阶段'),
    group: optionalText(raw.group),
    home,
    away,
    homeSeed: optionalText(raw.homeSeed),
    awaySeed: optionalText(raw.awaySeed),
    time,
    venue: text(raw.venue, '场地'),
    status,
    score,
    sets: setsOf(raw.sets),
    penalties: scoreOf(raw.penalties, '点球'),
    forfeit: sideOf(raw.forfeit, '弃权方'),
    nextMatchId,
    nextSlot: sideOf(raw.nextSlot, '晋级位置'),
    loserNextMatchId,
    loserNextSlot: sideOf(raw.loserNextSlot, '负者落位'),
    lines: status === 'finished' ? linesOf(raw.lines, home, away) : undefined,
    statSheet: statSheetOf(raw.statSheet, id),
    statSheetTemplate: statSheetTemplateOf(raw.statSheetTemplate, id),
  };
}

function requireLeague(id: string): League {
  const league = getLeague(id);
  if (!league) throw new ApiError(404, '联赛不存在');
  return league;
}

const app = express();
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(resolve('data/uploads'), { maxAge: '1h' }));

app.get('/api/leagues', (req, res) => {
  const sport = typeof req.query.sport === 'string' ? req.query.sport : undefined;
  if (sport && !SPORTS.includes(sport as Sport)) throw new ApiError(400, '项目不正确');
  res.json(listLeagues(sport, true));
});

app.get('/api/leagues/:id', (req, res) => {
  const league = requireLeague(req.params.id);
  if (!league.published && !sessionValid(req)) throw new ApiError(404, '联赛不存在');
  res.json({ league, teams: teamsOf(league.id), matches: matchesOf(league.id) });
});

app.get('/api/snapshot', (_req, res) => {
  const leagues = listLeagues(undefined, true);
  const visible = new Set(leagues.map((league) => league.id));
  res.json({
    leagues: leagues.map(({ teamCount: _t, matchCount: _m, finishedCount: _f, ...league }) => league),
    teams: allTeams().filter((team) => visible.has(team.leagueId)),
    matches: allMatches().filter((match) => match.leagueId && visible.has(match.leagueId)),
  });
});

function organizerName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new ApiError(400, '请填写你的名字');
  if (name.length > 20) throw new ApiError(400, '名字太长了');
  return name;
}

app.post('/api/admin/login', (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!passwordOk(password)) throw new ApiError(401, '密码不对');
  setSessionCookie(res, createSession(organizerName(req.body?.name)));
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  destroySession(readCookie(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

function requirePlayerAccount(req: Request) {
  const id = playerIdFromRequest(req);
  const account = id ? getPlayerAccount(id) : undefined;
  if (!account) throw new ApiError(401, '请先登录');
  return account;
}

function playerBody(body: unknown) {
  const source = (body ?? {}) as Record<string, unknown>;
  const genderRaw = source.gender;
  if (genderRaw !== undefined && genderRaw !== '' && genderRaw !== 'male' && genderRaw !== 'female') {
    throw new ApiError(400, '性别不正确');
  }
  const gender: '' | 'male' | 'female' = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : '';
  const measure = (value: unknown, label: string) => {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (!/^\d{2,3}(\.\d)?$/.test(value.trim())) throw new ApiError(400, `${label}请填数字`);
    return value.trim();
  };
  const position = optionalText(source.position) ?? '';
  if (position.length > 20) throw new ApiError(400, '位置太长了');
  const place = (value: unknown, label: string) => {
    const textValue = optionalText(value) ?? '';
    if (textValue.length > 40) throw new ApiError(400, `${label}太长了`);
    return textValue;
  };
  return {
    school: place(source.school, '学校'),
    college: place(source.college, '学院'),
    className: text(source.className, '班级'),
    name: text(source.name, '姓名'),
    number: text(source.number, '号码'),
    position,
    gender,
    height: measure(source.height, '身高'),
    weight: measure(source.weight, '体重'),
  };
}

function avatarFromBody(id: string, value: unknown, current = ''): string {
  if (value === undefined) return current;
  if (value === null || value === '') {
    clearPlayerAvatar(id);
    return '';
  }
  if (typeof value !== 'string') throw new ApiError(400, '头像格式不对');
  if (value.startsWith('/uploads/players/')) return current;
  try {
    return savePlayerAvatar(id, value);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : '头像无法保存');
  }
}

function writePlayer(player: Player, mode: 'insert' | 'update'): void {
  try {
    if (mode === 'insert') insertPlayer(player);
    else updatePlayer(player);
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate player number')) {
      throw new ApiError(409, `号码 ${player.number} 已被使用`);
    }
    throw error;
  }
}

app.post('/api/player/login', (req, res) => {
  const name = text(req.body?.name, '姓名');
  const number = text(req.body?.number, '号码');
  const matches = findPlayerAccounts(name, number);
  const requested = optionalText(req.body?.playerId);
  const chosen = requested ? matches.filter((account) => account.player.id === requested) : matches;
  if (chosen.length === 0) throw new ApiError(404, '没有这名队员，可以先报名');
  if (chosen.length > 1) {
    res.json({
      status: 'choose',
      choices: chosen.map((account) => ({
        playerId: account.player.id,
        teamName: account.team.name,
        leagueName: account.league.name,
        sport: account.league.sport,
      })),
    });
    return;
  }
  setPlayerCookie(res, createPlayerSession(chosen[0].player.id));
  res.json({ status: 'ok', ...chosen[0] });
});

app.post('/api/player/logout', (req, res) => {
  destroyPlayerSession(readPlayerToken(req));
  clearPlayerCookie(res);
  res.json({ ok: true });
});

app.post('/api/player/join', (req, res) => {
  const team = getTeam(text(req.body?.teamId, '队伍'));
  if (!team) throw new ApiError(404, '队伍不存在');
  const fields = playerBody(req.body);
  const player: Player = { id: randomUUID(), teamId: team.id, ...fields };
  writePlayer(player, 'insert');
  const account = getPlayerAccount(player.id);
  if (!account) throw new ApiError(500, '报名没有保存');
  setPlayerCookie(res, createPlayerSession(player.id));
  res.status(201).json({ status: 'ok', ...account });
});

app.get('/api/player/me', (req, res) => {
  res.json(requirePlayerAccount(req));
});

app.patch('/api/player/me', (req, res) => {
  const account = requirePlayerAccount(req);
  const fields = playerBody(req.body);
  const avatar = avatarFromBody(account.player.id, req.body?.avatar, account.player.avatar ?? '');
  const player: Player = { ...account.player, ...fields, avatar };
  writePlayer(player, 'update');
  res.json(getPlayerAccount(player.id));
});

app.get('/api/player/career', (req, res) => {
  const account = requirePlayerAccount(req);
  const summary = summarizeCareer(account.team.id, account.player.id, matchesOf(account.league.id));
  res.json({ sport: account.league.sport, ...summary });
});

app.use('/api/admin', (req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') return next();
  if (!sessionValid(req)) return next(new ApiError(401, '请先登录'));
  next();
});

app.get('/api/admin/me', (req, res) => {
  res.json({ ok: true, name: sessionName(req) });
});

app.patch('/api/admin/me', (req, res) => {
  const name = organizerName(req.body?.name);
  if (!renameSession(req, name)) throw new ApiError(401, '请先登录');
  res.json({ ok: true, name });
});

app.get('/api/admin/leagues', (_req, res) => {
  res.json(listLeagues());
});

function canEditLeague(league: League, actor: string): boolean {
  return !league.createdBy || league.createdBy === actor;
}

function logoFromBody(id: string, value: unknown, current = ''): string {
  if (value === undefined) return current;
  if (value === null || value === '') {
    clearLeagueLogo(id);
    return '';
  }
  if (typeof value !== 'string') throw new ApiError(400, 'Logo 格式不对');
  if (value.startsWith('/uploads/leagues/')) return current;
  try {
    return saveLeagueLogo(id, value);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : 'Logo 无法保存');
  }
}

app.post('/api/admin/leagues', (req, res) => {
  const actor = sessionName(req);
  if (!actor) throw new ApiError(400, '请先填写你的名字');
  const sport = oneOf(req.body?.sport, SPORTS, '项目');
  const league: League = {
    id: randomUUID(),
    sport,
    name: text(req.body?.name, '联赛名称'),
    season: optionalText(req.body?.season) ?? '',
    level: oneOf(req.body?.level, LEVELS, '级别'),
    logo: '',
    createdBy: actor,
    published: false,
  };
  league.logo = logoFromBody(league.id, req.body?.logo, '');
  insertLeague(league);
  res.status(201).json(league);
});

app.patch('/api/admin/leagues/:id', (req, res) => {
  const league = requireLeague(req.params.id);
  const actor = sessionName(req);
  if (!canEditLeague(league, actor)) throw new ApiError(403, `这个联赛由 ${league.createdBy} 创建，上线之后只有创建者可以改资料`);
  const name = text(req.body?.name ?? league.name, '联赛名称');
  const season = optionalText(req.body?.season ?? league.season) ?? '';
  const level = oneOf(req.body?.level ?? league.level, LEVELS, '级别');
  const logo = logoFromBody(league.id, req.body?.logo, league.logo ?? '');
  const createdBy = !league.createdBy && req.body?.claim === true ? actor : league.createdBy;
  const published = typeof req.body?.published === 'boolean' ? req.body.published : league.published;
  updateLeague(league.id, name, season, level, logo, createdBy, published);
  res.json({ ...league, name, season, level, logo, createdBy, published });
});

app.delete('/api/admin/leagues/:id', (req, res) => {
  const league = requireLeague(req.params.id);
  if (!canEditLeague(league, sessionName(req))) throw new ApiError(403, `这个联赛由 ${league.createdBy} 创建，只有创建者可以删除`);
  deleteLeague(req.params.id);
  clearLeagueLogo(req.params.id);
  res.json({ ok: true });
});

const TEAM_COLORS = ['#1d63c4', '#0f766e', '#b45309', '#be123c', '#6d28d9', '#0369a1', '#15803d', '#c2410c'];

app.post('/api/admin/leagues/:id/roster', (req, res) => {
  const league = requireLeague(req.params.id);
  let raw = '';
  if (typeof req.body?.docxBase64 === 'string' && req.body.docxBase64.trim()) {
    let file: Buffer;
    try {
      file = Buffer.from(req.body.docxBase64, 'base64');
    } catch {
      throw new ApiError(400, 'Word 文件读不出来');
    }
    if (file.length < 4 || file.readUInt32LE(0) !== 0x04034b50) {
      throw new ApiError(400, '请上传 .docx，或把表格复制后粘贴');
    }
    try {
      raw = docxToText(file);
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : 'Word 文件读不出来');
    }
  } else if (typeof req.body?.text === 'string') {
    raw = req.body.text;
  } else {
    throw new ApiError(400, '请粘贴名单或选择文件');
  }

  let imported;
  try {
    imported = parseRoster(raw);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : '名单格式不对');
  }

  const existing = teamsOf(league.id);
  const result = transaction(() => {
    let teamsCreated = 0;
    let playersCreated = 0;
    let colorIndex = existing.length;
    const byName = new Map<string, Team>(existing.map((team) => [team.name, { ...team, players: [...(team.players ?? [])] }]));
    for (const incoming of imported) {
      let team = byName.get(incoming.name);
      if (!team) {
        const created: Team = {
          id: randomUUID(),
          leagueId: league.id,
          name: incoming.name,
          short: incoming.short || incoming.name.slice(0, 4),
          color: TEAM_COLORS[colorIndex % TEAM_COLORS.length],
          players: [],
        };
        colorIndex += 1;
        insertTeam(created);
        byName.set(created.name, created);
        team = created;
        teamsCreated += 1;
      }
      const used = new Set((team.players ?? []).map((player) => player.number).filter(Boolean));
      for (const player of incoming.players) {
        if (used.has(player.number)) throw new ApiError(409, `「${team.name}」的号码 ${player.number} 已被使用`);
        const created = {
          id: randomUUID(),
          teamId: team.id,
          className: player.className,
          name: player.name,
          number: player.number,
          position: '',
          school: '',
          college: '',
          gender: '' as const,
          height: '',
          weight: '',
          avatar: '',
        };
        try {
          insertPlayer(created);
        } catch (error) {
          if (error instanceof Error && error.message.includes('duplicate player number')) {
            throw new ApiError(409, `「${team.name}」的号码 ${player.number} 已被使用`);
          }
          throw error;
        }
        used.add(player.number);
        playersCreated += 1;
      }
    }
    return { teamsCreated, playersCreated, teamsTouched: imported.length };
  });
  res.status(201).json(result);
});

app.post('/api/admin/leagues/:id/teams', (req, res) => {
  const league = requireLeague(req.params.id);
  const team: Team = {
    id: randomUUID(),
    leagueId: league.id,
    name: text(req.body?.name, '队伍名称'),
    short: optionalText(req.body?.short) ?? text(req.body?.name, '队伍名称').slice(0, 4),
    color: optionalText(req.body?.color) ?? '#1d63c4',
  };
  insertTeam(team);
  res.status(201).json(team);
});

app.patch('/api/admin/teams/:id', (req, res) => {
  const team = getTeam(req.params.id);
  if (!team) throw new ApiError(404, '队伍不存在');
  const name = text(req.body?.name ?? team.name, '队伍名称');
  const short = optionalText(req.body?.short ?? team.short) ?? name.slice(0, 4);
  const color = optionalText(req.body?.color ?? team.color) ?? team.color;
  updateTeam(team.id, name, short, color);
  res.json({ ...team, name, short, color });
});

app.delete('/api/admin/teams/:id', (req, res) => {
  const team = getTeam(req.params.id);
  if (!team) throw new ApiError(404, '队伍不存在');
  deleteTeam(team.id);
  res.json({ ok: true });
});

async function applyStatSheetTemplateImage(match: Match, value: unknown): Promise<void> {
  if (value == null || value === '') return;
  if (typeof value !== 'string') throw new ApiError(400, '技术统计表模板图片格式不对');
  let saved: MatchStatSheetTemplate;
  try {
    saved = saveStatSheetTemplateImage(match.id, value);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : '技术统计表模板无法保存');
  }
  const analysis = await analyzeStatSheetTemplateImage(value, match.sport);
  match.statSheetTemplate = {
    ...saved,
    kind: analysis.kind,
    fields: analysis.fields,
    warnings: analysis.warnings,
    analyzedAt: analysis.engine ? new Date().toISOString() : undefined,
    ocrEngine: analysis.engine,
  };
}

app.post('/api/admin/leagues/:id/matches', (req, res, next) => {
  void (async () => {
    const league = requireLeague(req.params.id);
    const match = parseMatch(req.body, league, randomUUID());
    await applyStatSheetTemplateImage(match, req.body?.statSheetTemplateImage);
    insertMatch(match);
    res.status(201).json(match);
  })().catch(next);
});

app.patch('/api/admin/matches/:id', (req, res, next) => {
  void (async () => {
    const existing = getMatch(req.params.id);
    if (!existing?.leagueId) throw new ApiError(404, '比赛不存在');
    const league = requireLeague(existing.leagueId);
    const match = parseMatch({ ...existing, ...req.body }, league, existing.id);
    const scoresheet = existing.statSheet?.scoresheet;
    if (match.statSheet && scoresheet && match.statSheet.imageUrl === existing.statSheet?.imageUrl) {
      match.statSheet.scoresheet = scoresheet;
    }
    await applyStatSheetTemplateImage(match, req.body?.statSheetTemplateImage);
    updateMatch(match);
    res.json(match);
  })().catch(next);
});

function finishMatchWithSheet(
  match: Match,
  statSheet: MatchStatSheet,
  parsed?: { rows: { playerId: string; stats: Partial<Record<PlayerStatKey, number>> }[]; score?: Score },
): void {
  match.status = 'finished';
  match.statSheet = statSheet;
  if (parsed?.score) match.score = parsed.score;
  if (parsed && parsed.rows.length > 0) {
    match.lines = parsed.rows.map((row) => ({
      playerId: row.playerId,
      points: row.stats.points ?? 0,
      ...row.stats,
    }));
  }
  updateMatch(match);
}

app.post('/api/admin/matches/:id/stat-sheet/recognize', (req, res, next) => {
  void (async () => {
    const match = getMatch(req.params.id);
    if (!match?.leagueId) throw new ApiError(404, '比赛不存在');
    const league = requireLeague(match.leagueId);
    if (!canEditLeague(league, sessionName(req))) {
      throw new ApiError(403, `这个联赛由 ${league.createdBy} 创建，只有创建者可以上传技术统计`);
    }
    const image = typeof req.body?.image === 'string' ? req.body.image : '';
    if (!image) throw new ApiError(400, '请选择技术统计表照片');
    const comparisonScore = scoreOf(req.body?.score, '比分') ?? match.score;

    let statSheet: MatchStatSheet;
    try {
      statSheet = saveStatSheetImage(match.id, image);
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : '技术统计表无法保存');
    }

    if (match.sport === 'basketball') {
      try {
        statSheet.scoresheet = await extractFibaSheet(match.id, statSheetPath(match.id));
        finishMatchWithSheet(match, statSheet);
        res.json({ recognized: false, statSheet, rows: [], unmatchedRows: [], warnings: [] });
      } catch (error) {
        finishMatchWithSheet(match, statSheet);
        res.json({
          recognized: false,
          statSheet,
          rows: [],
          unmatchedRows: [],
          warnings: [],
          alignError: error instanceof Error ? error.message : '表格没对齐',
        });
      }
      return;
    }

    const template = match.statSheetTemplate;
    const canRecognize = Boolean(template && match.home && match.away);
    if (!canRecognize) {
      finishMatchWithSheet(match, statSheet);
      const warnings = [
        template ? '主客队还没定，照片已留档。' : '还没有空白模板，照片已留档，没有自动识别。',
        '比赛已记为结束。',
      ];
      res.json({ recognized: false, statSheet, rows: [], unmatchedRows: [], warnings });
      return;
    }

    try {
      const all = teamsOf(match.leagueId);
      const teams = [all.find((team) => team.id === match.home), all.find((team) => team.id === match.away)].filter(
        (team): team is Team => Boolean(team),
      );
      if (teams.length !== 2) throw new Error('本场球队或名单不存在');
      const parsed = await recognizeFilledStatSheet(match.id, image, template!, match.sport, teams, comparisonScore);
      statSheet = {
        ...statSheet,
        recognizedAt: parsed.engine ? new Date().toISOString() : undefined,
        ocrEngine: parsed.engine,
      };
      finishMatchWithSheet(match, statSheet, parsed);
      res.json({
        recognized: parsed.rows.length > 0,
        statSheet,
        ...parsed,
      });
    } catch (error) {
      finishMatchWithSheet(match, statSheet);
      res.json({
        recognized: false,
        statSheet,
        rows: [],
        unmatchedRows: [],
        warnings: [`照片已留档，比赛已记为结束。识别失败：${error instanceof Error ? error.message : '未知错误'}`],
      });
    }
  })().catch(next);
});

function statSheetPath(matchId: string): string {
  return resolve('data/uploads/matches', `${matchId}-stats.jpg`);
}

function editableMatch(req: Request<{ id: string }>): Match {
  const match = getMatch(req.params.id);
  if (!match?.leagueId) throw new ApiError(404, '比赛不存在');
  const league = requireLeague(match.leagueId);
  if (!canEditLeague(league, sessionName(req))) {
    throw new ApiError(403, `这个联赛由 ${league.createdBy} 创建，只有创建者可以修改技术统计`);
  }
  return match;
}

/** 重新切格。corners 是原图像素坐标（顺序不限），不传就自动找外框。 */
app.post('/api/admin/matches/:id/stat-sheet/align', (req, res, next) => {
  void (async () => {
    const match = editableMatch(req);
    if (!match.statSheet) throw new ApiError(400, '请先上传技术统计表');
    let corners: number[] | undefined;
    if (req.body?.corners != null) {
      corners = Array.isArray(req.body.corners) ? req.body.corners.map(Number) : [];
      if (corners!.length !== 8 || corners!.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new ApiError(400, '请在照片上点四个角');
      }
    }
    try {
      match.statSheet = { ...match.statSheet, scoresheet: await extractFibaSheet(match.id, statSheetPath(match.id), corners) };
    } catch (error) {
      if (error instanceof FibaSheetError) throw new ApiError(400, error.message);
      throw error;
    }
    updateMatch(match);
    res.json({ statSheet: match.statSheet });
  })().catch(next);
});

/** 保存逐格确认的球衣号，按累积分重算个人得分并写入比赛。 */
app.put('/api/admin/matches/:id/stat-sheet/review', (req, res) => {
  const match = editableMatch(req);
  const sheet = match.statSheet?.scoresheet;
  if (!match.statSheet || !sheet) throw new ApiError(400, '这场比赛还没有切好格的记录表');
  if (!match.home || !match.away) throw new ApiError(400, '主客队还没定，不能写入得分');
  const homeSide = req.body?.homeSide;
  if (homeSide !== 'A' && homeSide !== 'B') throw new ApiError(400, '请先选择主队是 A 队还是 B 队');
  const rawJerseys = req.body?.jerseys;
  if (!rawJerseys || typeof rawJerseys !== 'object' || Array.isArray(rawJerseys)) {
    throw new ApiError(400, '号码格式不对');
  }
  const validKeys = new Set(sheet.cells.map((cell) => `${cell.side}:${cell.total}`));
  const jerseys: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawJerseys as Record<string, unknown>)) {
    if (!validKeys.has(key)) continue;
    const text = typeof value === 'string' ? value.trim() : '';
    if (text && !/^\d{1,3}$/.test(text)) throw new ApiError(400, `累计分 ${key.split(':')[1]} 的号码只能是数字`);
    jerseys[key] = text;
  }

  const all = teamsOf(match.leagueId!);
  const teamOf = (side: SheetSide) => all.find((team) => team.id === (side === homeSide ? match.home : match.away));
  const sides = { A: teamOf('A'), B: teamOf('B') };
  if (!sides.A || !sides.B) throw new ApiError(400, '本场球队不存在');
  const marks: ScoreMark[] = Object.entries(jerseys).map(([key, jersey]) => {
    const [side, total] = key.split(':');
    return { side: side as SheetSide, total: Number(total), jersey };
  });
  const rosterOf = (side: SheetSide) => (sides[side]!.players ?? []).map((player) => player.number);
  const tally = tallyMarks(marks, { A: rosterOf('A'), B: rosterOf('B') });

  const previous = new Map((match.lines ?? []).map((line) => [line.playerId, line]));
  const lines = new Map(previous);
  for (const side of ['A', 'B'] as const) {
    for (const player of sides[side]!.players ?? []) {
      const points = tally.points[pointsKey(side, player.number)];
      const line = previous.get(player.id);
      if (points === undefined && !line) continue;
      lines.set(player.id, { ...(line ?? { playerId: player.id }), points: points ?? 0 });
    }
  }
  match.lines = [...lines.values()];
  match.score = homeSide === 'A' ? { home: tally.totals.A, away: tally.totals.B } : { home: tally.totals.B, away: tally.totals.A };
  match.status = 'finished';
  match.statSheet = {
    ...match.statSheet,
    scoresheet: { ...sheet, homeSide, jerseys, reviewedAt: new Date().toISOString() },
  };
  updateMatch(match);
  const samples = saveDigitSamples(match.id, match.statSheet.scoresheet!);
  res.json({ match, warnings: tally.warnings, samples });
});

app.delete('/api/admin/matches/:id', (req, res) => {
  if (!getMatch(req.params.id)) throw new ApiError(404, '比赛不存在');
  deleteMatch(req.params.id);
  res.json({ ok: true });
});

const PRESETS: FormatPreset[] = ['round_robin', 'double_round_robin', 'groups_knockout', 'single_elim'];

function todayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

app.post('/api/admin/teams/:id/players', (req, res) => {
  const team = getTeam(req.params.id);
  if (!team) throw new ApiError(404, '队伍不存在');
  const number = text(req.body?.number, '号码');
  const conflict = teamsOf(team.leagueId)
    .find((item) => item.id === team.id)
    ?.players?.find((player) => player.number === number);
  if (conflict) throw new ApiError(409, `号码 ${number} 已被 ${conflict.name} 使用`);
  const player = {
    id: randomUUID(),
    teamId: team.id,
    className: text(req.body?.className, '班级'),
    name: text(req.body?.name, '姓名'),
    number,
    position: '',
    school: '',
    college: '',
    gender: '' as const,
    height: '',
    weight: '',
    avatar: '',
  };
  try {
    insertPlayer(player);
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate player number')) {
      throw new ApiError(409, `号码 ${number} 已被使用`);
    }
    throw error;
  }
  res.status(201).json(player);
});

app.delete('/api/admin/players/:id', (req, res) => {
  if (!deletePlayer(req.params.id)) throw new ApiError(404, '队员不存在');
  clearPlayerAvatar(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/leagues/:id/matches/bulk-delete', (req, res) => {
  const league = requireLeague(req.params.id);
  const rawIds: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (ids.length === 0) throw new ApiError(400, '没有选择比赛');
  for (const id of ids) {
    const match = getMatch(id);
    if (!match || match.leagueId !== league.id) throw new ApiError(400, '比赛不属于这个联赛');
  }
  deleteMatches(ids);
  res.json({ deleted: ids.length });
});

app.post('/api/admin/leagues/:id/format', (req, res) => {
  const league = requireLeague(req.params.id);
  const teamIds = Array.isArray(req.body?.teamIds) ? req.body.teamIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  if (new Set(teamIds).size !== teamIds.length) throw new ApiError(400, '队伍重复了');
  for (const id of teamIds) {
    if (getTeam(id)?.leagueId !== league.id) throw new ApiError(400, '队伍不属于这个联赛');
  }
  const division = oneOf(req.body?.division ?? 'men', DIVISIONS, '组别');
  const startDate = optionalText(req.body?.startDate) ?? '';
  let planned;
  try {
    planned = planFormat(
      {
        preset: oneOf(req.body?.preset, PRESETS, '赛制'),
        division,
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : todayString(),
        venue: typeof req.body?.venue === 'string' ? req.body.venue : '',
        teamIds,
        groupCount: Number(req.body?.groupCount ?? 4),
        qualifiers: Number(req.body?.qualifiers ?? 2),
        bracketSize: Number(req.body?.bracketSize ?? 8),
        thirdPlace: req.body?.thirdPlace !== false,
      },
      () => randomUUID(),
    );
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : '赛制参数不对');
  }
  const existing = matchesOf(league.id).filter((match) => match.division === division);
  if (existing.length > 0 && req.body?.replace !== true) throw new ApiError(409, '这个组别已经有比赛，再生成会先清掉旧对阵');
  const created = transaction(() => {
    if (req.body?.replace === true) {
      for (const match of existing) removeMatch(match.id);
    }
    return planned.map((item) => {
      const match: Match = { ...item, leagueId: league.id, sport: league.sport, status: 'scheduled' };
      insertMatch(match);
      return match;
    });
  });
  res.status(201).json({ created: created.length });
});

app.post('/api/admin/leagues/:id/round-robin', (req, res) => {
  const league = requireLeague(req.params.id);
  const teamIds = Array.isArray(req.body?.teamIds) ? req.body.teamIds.filter((id: unknown) => typeof id === 'string') : [];
  if (teamIds.length < 2) throw new ApiError(400, '至少选择两支队伍');
  if (new Set(teamIds).size !== teamIds.length) throw new ApiError(400, '队伍重复了');
  for (const id of teamIds) {
    if (getTeam(id)?.leagueId !== league.id) throw new ApiError(400, '队伍不属于这个联赛');
  }
  const division = oneOf(req.body?.division, DIVISIONS, '组别');
  const group = text(req.body?.group, '小组名');
  const startDate = text(req.body?.startDate, '开始日期');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new ApiError(400, '开始日期格式应为 2026-11-03');
  const venue = text(req.body?.venue, '场地');
  const pairings = roundRobinPairings(teamIds);
  const slotInRound = new Map<number, number>();
  const created = transaction(() =>
    pairings.map((pairing) => {
      const slot = slotInRound.get(pairing.round) ?? 0;
      slotInRound.set(pairing.round, slot + 1);
      const match: Match = {
        id: randomUUID(),
        leagueId: league.id,
        sport: league.sport,
        division,
        stage: 'group',
        group,
        home: pairing.home,
        away: pairing.away,
        time: `${addDays(startDate, pairing.round * 7)}T${String(14 + (slot % 4) * 2).padStart(2, '0')}:00`,
        venue,
        status: 'scheduled',
      };
      insertMatch(match);
      return match;
    }),
  );
  res.status(201).json({ created: created.length, matches: created });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('dist')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: '服务器错误' });
});

seedIfEmpty();

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`API http://127.0.0.1:${port}`);
  if (!process.env.ADMIN_PASSWORD) console.log('未设置 ADMIN_PASSWORD，管理端默认密码是 admin');
});
