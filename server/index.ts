import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Division, League, Match, MatchStatus, PlayerLine, Score, Side, Sport, Stage, Team } from '../src/types.ts';
import { planFormat, type FormatPreset } from '../src/lib/formats.ts';
import { parsePlayerList, parseRoster, shortName } from '../src/lib/roster.ts';
import { addDays, roundRobinPairings } from '../src/lib/roundRobin.ts';
import { clearSessionCookie, createSession, destroySession, passwordOk, readCookie, sessionValid, setSessionCookie } from './auth.ts';
import {
  allMatches,
  allTeams,
  deleteLeague,
  deleteMatch,
  deleteMatches,
  removeMatch,
  deletePlayer,
  deleteTeam,
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
  updateTeam,
} from './db.ts';
import { seedIfEmpty } from './seed.ts';

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
    return {
      playerId,
      points: statNum(raw.points, '得分'),
      rebounds: statNum(raw.rebounds, '篮板'),
      assists: statNum(raw.assists, '助攻'),
    };
  });
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
  if (status !== 'scheduled' && !score) throw new ApiError(400, '进行中或已结束的比赛需要填写比分');
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
app.use(express.json());

app.get('/api/leagues', (req, res) => {
  const sport = typeof req.query.sport === 'string' ? req.query.sport : undefined;
  if (sport && !SPORTS.includes(sport as Sport)) throw new ApiError(400, '项目不正确');
  res.json(listLeagues(sport));
});

app.get('/api/leagues/:id', (req, res) => {
  const league = requireLeague(req.params.id);
  res.json({ league, teams: teamsOf(league.id), matches: matchesOf(league.id) });
});

app.get('/api/snapshot', (_req, res) => {
  res.json({ leagues: listLeagues().map(({ teamCount: _t, matchCount: _m, finishedCount: _f, ...league }) => league), teams: allTeams(), matches: allMatches() });
});

app.post('/api/admin/login', (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!passwordOk(password)) throw new ApiError(401, '密码不对');
  setSessionCookie(res, createSession());
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  destroySession(readCookie(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.use('/api/admin', (req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') return next();
  if (!sessionValid(req)) return next(new ApiError(401, '请先登录'));
  next();
});

app.get('/api/admin/me', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/admin/leagues', (req, res) => {
  const sport = oneOf(req.body?.sport, SPORTS, '项目');
  const league: League = {
    id: randomUUID(),
    sport,
    name: text(req.body?.name, '联赛名称'),
    season: optionalText(req.body?.season) ?? '',
  };
  insertLeague(league);
  res.status(201).json(league);
});

app.patch('/api/admin/leagues/:id', (req, res) => {
  const league = requireLeague(req.params.id);
  const name = text(req.body?.name ?? league.name, '联赛名称');
  const season = optionalText(req.body?.season ?? league.season) ?? '';
  updateLeague(league.id, name, season);
  res.json({ ...league, name, season });
});

app.delete('/api/admin/leagues/:id', (req, res) => {
  requireLeague(req.params.id);
  deleteLeague(req.params.id);
  res.json({ ok: true });
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

app.post('/api/admin/leagues/:id/matches', (req, res) => {
  const league = requireLeague(req.params.id);
  const match = parseMatch(req.body, league, randomUUID());
  insertMatch(match);
  res.status(201).json(match);
});

app.patch('/api/admin/matches/:id', (req, res) => {
  const existing = getMatch(req.params.id);
  if (!existing?.leagueId) throw new ApiError(404, '比赛不存在');
  const league = requireLeague(existing.leagueId);
  const match = parseMatch({ ...existing, ...req.body }, league, existing.id);
  updateMatch(match);
  res.json(match);
});

app.delete('/api/admin/matches/:id', (req, res) => {
  if (!getMatch(req.params.id)) throw new ApiError(404, '比赛不存在');
  deleteMatch(req.params.id);
  res.json({ ok: true });
});

const PRESETS: FormatPreset[] = ['round_robin', 'double_round_robin', 'groups_knockout', 'single_elim'];
const TEAM_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#059669', '#4f46e5', '#e11d48'];

function todayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

app.post('/api/admin/leagues/:id/roster', (req, res) => {
  const league = requireLeague(req.params.id);
  const lines = parseRoster(typeof req.body?.text === 'string' ? req.body.text : '');
  if (lines.length === 0) throw new ApiError(400, '没有读到队伍，每行写一支');
  const existing = teamsOf(league.id);
  const byName = new Map(existing.map((team) => [team.name, team]));
  let createdTeams = 0;
  let addedPlayers = 0;
  transaction(() => {
    for (const line of lines) {
      let team = byName.get(line.name);
      if (!team) {
        team = {
          id: randomUUID(),
          leagueId: league.id,
          name: line.name,
          short: shortName(line.name),
          color: TEAM_COLORS[(existing.length + createdTeams) % TEAM_COLORS.length],
          players: [],
        };
        insertTeam(team);
        byName.set(team.name, team);
        createdTeams += 1;
      }
      const known = new Set((team.players ?? []).map((player) => player.name));
      for (const name of line.players) {
        if (known.has(name)) continue;
        insertPlayer({ id: randomUUID(), teamId: team.id, name });
        known.add(name);
        team.players = [...(team.players ?? []), { id: '', teamId: team.id, name }];
        addedPlayers += 1;
      }
    }
  });
  res.status(201).json({ createdTeams, addedPlayers });
});

app.post('/api/admin/teams/:id/players', (req, res) => {
  const team = getTeam(req.params.id);
  if (!team) throw new ApiError(404, '队伍不存在');
  const names = parsePlayerList(typeof req.body?.text === 'string' ? req.body.text : '');
  if (names.length === 0) throw new ApiError(400, '请填写队员姓名');
  const known = new Set((teamsOf(team.leagueId).find((item) => item.id === team.id)?.players ?? []).map((player) => player.name));
  const created = transaction(() =>
    names
      .filter((name) => !known.has(name))
      .map((name) => {
        const player = { id: randomUUID(), teamId: team.id, name };
        insertPlayer(player);
        known.add(name);
        return player;
      }),
  );
  res.status(201).json({ created });
});

app.delete('/api/admin/players/:id', (req, res) => {
  if (!deletePlayer(req.params.id)) throw new ApiError(404, '队员不存在');
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
