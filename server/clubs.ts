import { randomUUID } from 'node:crypto';
import type { Express, Request } from 'express';
import { parseClubRoster } from '../src/lib/clubRoster.ts';
import { maskPhone, normalizePhone } from '../src/lib/phone.ts';
import {
  CHALLENGE_FORMATS,
  CHALLENGE_LEVELS,
  type Club,
  type ClubManager,
  type League,
  type Match,
  type Player,
  type Team,
} from '../src/types.ts';
import { requireUser, userIdFromRequest } from './auth.ts';
import {
  addManager,
  challengesOfClubs,
  clubIdsOfLeague,
  clubNameTaken,
  clubPlayers,
  clubsManagedBy,
  declineOthers,
  finishedClubMatches,
  getChallenge,
  getClub,
  getResponse,
  insertChallenge,
  insertClub,
  insertResponse,
  managersOf,
  nowLocal,
  openChallenges,
  openCountOf,
  pendingResponsesFor,
  removeManager,
  reopenResponse,
  replaceClubPlayers,
  responseOfClub,
  responsesOf,
  roleIn,
  setChallengeStatus,
  setResponseStatus,
  setRole,
  updateClub,
  type ChallengeRecord,
  type ManagerRow,
} from './clubStore.ts';
import {
  deleteLeague,
  findUserByPhone,
  getMatch,
  getUser,
  insertLeague,
  insertMatch,
  insertPlayer,
  insertTeam,
  matchesOf,
  renameUser,
  updateMatch,
  setOwner,
  teamsOf,
  transaction,
  type User,
} from './db.ts';
import { ApiError, oneOf, optionalText, text } from './http.ts';
import { clearClubLogo, saveClubLogo } from './logo.ts';
import { backfillChallengeNotices, forgetChallengeResponse, markNoticesSeen, remindChallengeResponse, unseenChallengeNotices } from './notify.ts';

const MAX_MANAGERS = 3;
const MAX_CLUBS_PER_USER = 5;
const MAX_OPEN_CHALLENGES = 3;
const CLUB_COLORS = ['#c2410c', '#1d63c4', '#0f766e', '#be123c', '#6d28d9', '#15803d', '#b45309', '#0369a1'];
const FORMAT_IDS = CHALLENGE_FORMATS.map((item) => item.id);
const LEVEL_IDS = CHALLENGE_LEVELS.map((item) => item.id);

function limited(value: unknown, label: string, max: number): string {
  const result = optionalText(value) ?? '';
  if (result.length > max) throw new ApiError(400, `${label}最多 ${max} 个字`);
  return result;
}

function requireClub(id: string): Club {
  const club = getClub(id);
  if (!club) throw new ApiError(404, '球队不存在');
  return club;
}

function requireManager(clubId: string, user: User) {
  const role = roleIn(clubId, user.id);
  if (!role) throw new ApiError(403, '只有球队负责人可以操作');
  return role;
}

function viewerOf(req: Request): User | undefined {
  const id = userIdFromRequest(req);
  return id ? getUser(id) : undefined;
}

const managerView = (row: ManagerRow, fullPhone = false): ClubManager => ({
  userId: row.userId,
  name: row.name || '未填姓名',
  phone: fullPhone ? row.phone : maskPhone(row.phone),
  role: row.role,
});

/** 用户是否是这场比赛里某一队（约战生成的）的负责人。 */
export function clubManagesMatch(userId: string, matchId: string): boolean {
  const match = getMatch(matchId);
  if (!match?.leagueId) return false;
  return clubIdsOfLeague(match.leagueId).some((clubId) => roleIn(clubId, userId));
}

function clubRecord(club: Club) {
  return finishedClubMatches(club.id).flatMap(({ leagueId, matchId }) => {
    const match = getMatch(matchId);
    const teams = teamsOf(leagueId);
    const mine = teams.find((team) => team.clubId === club.id);
    if (!match || !mine) return [];
    const opponent = teams.find((team) => team.id !== mine.id);
    const side = match.home === mine.id ? 'home' : 'away';
    const score = match.status === 'finished' ? match.score : undefined;
    const result = score
      ? score[side] > score[side === 'home' ? 'away' : 'home']
        ? 'W'
        : score[side] < score[side === 'home' ? 'away' : 'home']
          ? 'L'
          : 'D'
      : null;
    return [
      {
        leagueId,
        matchId,
        time: match.time,
        venue: match.venue,
        opponent: opponent ? { name: opponent.name, clubId: opponent.clubId ?? '' } : null,
        score: score ? { mine: score[side], theirs: score[side === 'home' ? 'away' : 'home'] } : null,
        result,
      },
    ];
  });
}

function clubView(club: Club, viewer?: User) {
  const role = viewer ? roleIn(club.id, viewer.id) : undefined;
  return {
    club,
    managers: managersOf(club.id).map((row) => managerView(row)),
    // 负责人要整份重贴名单，所以能看到完整手机号；其他人只知道有没有填
    players: clubPlayers(club.id).map((player) => ({
      id: player.id,
      name: player.name,
      number: player.number,
      hasPhone: Boolean(player.phone),
      ...(role ? { phone: player.phone } : {}),
    })),
    record: clubRecord(club),
    role: role ?? null,
  };
}

function publicChallenge({ posterUserId: _poster, responseId: _response, ...challenge }: ChallengeRecord) {
  return challenge;
}

function clubFields(body: Record<string, unknown>, current?: Club) {
  const name = text(body.name ?? current?.name, '球队名称');
  if (name.length > 20) throw new ApiError(400, '球队名称最多 20 个字');
  const short = limited(body.short ?? current?.short, '简称', 6) || name.slice(0, 4);
  const colorRaw = optionalText(body.color) ?? current?.color ?? CLUB_COLORS[Math.floor(Math.random() * CLUB_COLORS.length)];
  if (!/^#[0-9a-fA-F]{6}$/.test(colorRaw)) throw new ApiError(400, '颜色格式不对');
  return {
    name,
    short,
    color: colorRaw,
    intro: limited(body.intro ?? current?.intro, '简介', 200),
    homeVenue: limited(body.homeVenue ?? current?.homeVenue, '常驻球场', 40),
  };
}

function logoFromBody(id: string, value: unknown, current = ''): string {
  if (value === undefined) return current;
  if (value === null || value === '') {
    clearClubLogo(id);
    return '';
  }
  if (typeof value !== 'string') throw new ApiError(400, '头像格式不对');
  if (value.startsWith('/uploads/clubs/')) return current;
  try {
    return saveClubLogo(id, value);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : '头像无法保存');
  }
}

/** 确认迎战：建一场单场友谊赛，两队带上球队 id，常备名单复制成比赛名单，手机号能对上账号的直接绑定。 */
function createFriendly(challenge: ChallengeRecord, responseId: string, poster: User): League {
  const response = getResponse(responseId)!;
  const home = getClub(challenge.club.id)!;
  const away = getClub(response.club.id)!;
  const league: League = {
    id: randomUUID(),
    sport: home.sport,
    name: `${home.name}对${away.name}`,
    season: '约球',
    level: 'friendly',
    kind: 'single',
    logo: '',
    createdBy: poster.name || '约球大厅',
    published: true,
  };
  const awayColor = away.color === home.color ? CLUB_COLORS.find((color) => color !== home.color)! : away.color;
  const teams: Team[] = [
    { id: randomUUID(), leagueId: league.id, name: home.name, short: home.short, color: home.color, clubId: home.id },
    { id: randomUUID(), leagueId: league.id, name: away.name, short: away.short, color: awayColor, clubId: away.id },
  ];
  const match: Match = {
    id: randomUUID(),
    leagueId: league.id,
    sport: league.sport,
    division: 'men',
    stage: 'single',
    home: teams[0].id,
    away: teams[1].id,
    time: challenge.time,
    venue: challenge.venue,
    status: 'scheduled',
  };
  transaction(() => {
    insertLeague(league);
    teams.forEach(insertTeam);
    insertMatch(match);
    [home, away].forEach((club, index) => {
      for (const entry of clubPlayers(club.id)) {
        const player: Player = {
          id: randomUUID(),
          teamId: teams[index].id,
          school: '',
          college: '',
          className: '',
          name: entry.name,
          number: entry.number,
          position: '',
          gender: '',
          height: '',
          weight: '',
          avatar: '',
        };
        insertPlayer(player);
        if (entry.phone) setOwner(player.id, { phone: entry.phone, userId: findUserByPhone(entry.phone)?.id ?? '', via: 'phone' });
      }
    });
    setResponseStatus(response.id, 'accepted');
    declineOthers(challenge.id, response.id);
    setChallengeStatus(challenge.id, 'matched', response.id, league.id);
  });
  return league;
}

export function registerClubRoutes(app: Express): void {
  backfillChallengeNotices();
  app.get('/api/player/notices', (req, res) => {
    const user = requireUser(req);
    res.json(unseenChallengeNotices(user.id));
  });
  app.post('/api/player/notices/seen', (req, res) => {
    const user = requireUser(req);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
    markNoticesSeen(user.id, ids);
    res.json({ ok: true });
  });

  app.post('/api/clubs/matches/:id/score', (req, res) => {
    const user = requireUser(req);
    const match = getMatch(req.params.id);
    if (!match?.leagueId) throw new ApiError(404, '比赛不存在');
    const sides = clubIdsOfLeague(match.leagueId);
    if (sides.length === 0) throw new ApiError(400, '这不是约战比赛');
    if (!sides.some((clubId) => roleIn(clubId, user.id) === 'owner')) throw new ApiError(403, '只有两边的队长可以填写比分');
    const read = (value: unknown, label: string) => {
      const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (!Number.isInteger(raw) || raw < 0 || raw > 250) throw new ApiError(400, `${label}要填 0 到 250 的整数`);
      return raw;
    };
    match.score = { home: read(req.body?.home, '主队比分'), away: read(req.body?.away, '客队比分') };
    match.status = 'finished';
    updateMatch(match);
    res.json({ ok: true, match });
  });

  app.post('/api/clubs', (req, res) => {
    const user = requireUser(req);
    if (clubsManagedBy(user.id).length >= MAX_CLUBS_PER_USER) {
      throw new ApiError(429, `一个账号最多负责 ${MAX_CLUBS_PER_USER} 支球队`);
    }
    const fields = clubFields(req.body ?? {});
    if (clubNameTaken('basketball', fields.name)) throw new ApiError(409, `已经有一支叫「${fields.name}」的球队了`);
    if (!user.name) renameUser(user.id, text(req.body?.myName, '你的名字').slice(0, 20));
    const id = randomUUID();
    const club: Club = {
      id,
      sport: 'basketball',
      createdAt: new Date().toISOString(),
      logo: logoFromBody(id, req.body?.logo, ''),
      ...fields,
    };
    insertClub(club, user.id);
    res.status(201).json(clubView(club, user));
  });

  app.get('/api/clubs/:id', (req, res) => {
    res.json(clubView(requireClub(req.params.id), viewerOf(req)));
  });

  app.patch('/api/clubs/:id', (req, res) => {
    const user = requireUser(req);
    const club = requireClub(req.params.id);
    requireManager(club.id, user);
    const next = { ...club, ...clubFields(req.body ?? {}, club), logo: logoFromBody(club.id, req.body?.logo, club.logo) };
    if (clubNameTaken(club.sport, next.name, club.id)) throw new ApiError(409, `已经有一支叫「${next.name}」的球队了`);
    updateClub(next);
    res.json(clubView(next, user));
  });

  app.post('/api/clubs/:id/managers', (req, res) => {
    const user = requireUser(req);
    const club = requireClub(req.params.id);
    if (requireManager(club.id, user) !== 'owner') throw new ApiError(403, '只有队长（创建者）可以添加负责人');
    if (managersOf(club.id).length >= MAX_MANAGERS) throw new ApiError(400, `每支球队最多 ${MAX_MANAGERS} 名负责人`);
    const phone = normalizePhone(text(req.body?.phone, '手机号'));
    if (!phone) throw new ApiError(400, '手机号不对');
    const target = findUserByPhone(phone);
    if (!target) throw new ApiError(404, '这个手机号还没注册，请对方先在球员中心登录一次');
    if (roleIn(club.id, target.id)) throw new ApiError(409, '他已经是负责人了');
    addManager(club.id, target.id, 'manager');
    res.json(clubView(club, user));
  });

  app.delete('/api/clubs/:id/managers/:userId', (req, res) => {
    const user = requireUser(req);
    const club = requireClub(req.params.id);
    const role = requireManager(club.id, user);
    const targetRole = roleIn(club.id, req.params.userId);
    if (!targetRole) throw new ApiError(404, '他不是这支球队的负责人');
    if (targetRole === 'owner') throw new ApiError(400, '队长不能被移除，请先把队长转给别人');
    if (role !== 'owner' && req.params.userId !== user.id) throw new ApiError(403, '只有队长可以移除其他负责人');
    removeManager(club.id, req.params.userId);
    res.json(clubView(club, user));
  });

  app.post('/api/clubs/:id/owner', (req, res) => {
    const user = requireUser(req);
    const club = requireClub(req.params.id);
    if (requireManager(club.id, user) !== 'owner') throw new ApiError(403, '只有队长可以转让');
    const targetId = text(req.body?.userId, '新队长');
    if (!roleIn(club.id, targetId)) throw new ApiError(400, '只能转给这支球队的负责人');
    transaction(() => {
      setRole(club.id, targetId, 'owner');
      setRole(club.id, user.id, 'manager');
    });
    res.json(clubView(club, user));
  });

  app.put('/api/clubs/:id/players', (req, res) => {
    const user = requireUser(req);
    const club = requireClub(req.params.id);
    requireManager(club.id, user);
    const raw = typeof req.body?.text === 'string' ? req.body.text : '';
    let entries: ReturnType<typeof parseClubRoster> = [];
    if (raw.trim()) {
      try {
        entries = parseClubRoster(raw);
      } catch (error) {
        throw new ApiError(400, error instanceof Error ? error.message : '名单格式不对');
      }
    }
    replaceClubPlayers(
      club.id,
      entries.map((entry) => ({ id: randomUUID(), ...entry })),
    );
    res.json(clubView(club, user));
  });

  app.get('/api/player/clubs', (req, res) => {
    const user = requireUser(req);
    const clubs = clubsManagedBy(user.id);
    const ids = clubs.map((club) => club.id);
    const mine = new Set(ids);
    const challenges = challengesOfClubs(ids).map((challenge) => {
      const posted = mine.has(challenge.club.id);
      const responses = posted ? [] : responsesOf(challenge.id).filter((item) => mine.has(item.club.id));
      return {
        ...publicChallenge(challenge),
        mine: posted ? 'poster' : 'responder',
        pending: posted ? responsesOf(challenge.id).filter((item) => item.status === 'pending').length : 0,
        myResponse: responses[0] ? { status: responses[0].status, club: responses[0].club } : null,
      };
    });
    res.json({ clubs, pending: pendingResponsesFor(ids), challenges });
  });

  app.get('/api/challenges', (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const level = typeof req.query.level === 'string' ? req.query.level : '';
    const list = openChallenges().filter((item) => (!date || item.time.startsWith(date)) && (!level || item.level === level));
    res.json(list.map(publicChallenge));
  });

  app.post('/api/challenges', (req, res) => {
    const user = requireUser(req);
    const club = requireClub(text(req.body?.clubId, '球队'));
    requireManager(club.id, user);
    const time = text(req.body?.time, '时间');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) throw new ApiError(400, '时间格式应为 2026-11-09T19:00');
    if (time < nowLocal()) throw new ApiError(400, '约球时间不能早于现在');
    if (openCountOf(club.id) >= MAX_OPEN_CHALLENGES) {
      throw new ApiError(429, `每支球队同时最多挂 ${MAX_OPEN_CHALLENGES} 个约球帖，先等已有的成交或取消`);
    }
    const id = randomUUID();
    insertChallenge({
      id,
      clubId: club.id,
      posterUserId: user.id,
      time,
      venue: (() => {
        const venue = text(req.body?.venue, '球场');
        if (venue.length > 40) throw new ApiError(400, '球场最多 40 个字');
        return venue;
      })(),
      format: oneOf(req.body?.format ?? 'full', FORMAT_IDS, '赛制'),
      level: oneOf(req.body?.level ?? 'medium', LEVEL_IDS, '水平'),
      note: limited(req.body?.note, '备注', 200),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(publicChallenge(getChallenge(id)!));
  });

  app.get('/api/challenges/:id', (req, res) => {
    const challenge = getChallenge(req.params.id);
    if (!challenge) throw new ApiError(404, '约球帖不存在');
    const viewer = viewerOf(req);
    const myClubs = viewer ? clubsManagedBy(viewer.id) : [];
    const mine = new Set(myClubs.map((club) => club.id));
    const isPoster = mine.has(challenge.club.id);
    const responses = responsesOf(challenge.id).filter((item) =>
      isPoster ? item.status !== 'withdrawn' : mine.has(item.club.id),
    );
    const sides = [challenge.club.id, challenge.opponent?.id].filter(Boolean) as string[];
    const isParty = challenge.status === 'matched' && sides.some((id) => mine.has(id));
    const match = challenge.leagueId ? matchesOf(challenge.leagueId)[0] : undefined;
    res.json({
      challenge: publicChallenge(challenge),
      isPoster,
      isParty,
      respondClubs: myClubs.filter((club) => club.id !== challenge.club.id),
      responses: responses.map(({ challengeId: _c, userId: _u, ...item }) => item),
      contacts: isParty
        ? sides
            .filter((id) => !mine.has(id) || sides.every((side) => mine.has(side)))
            .map((id) => ({ club: getClub(id)!.name, managers: managersOf(id).map((row) => managerView(row, true)) }))
        : [],
      match: match ?? null,
      teams: challenge.leagueId ? teamsOf(challenge.leagueId) : [],
      canScore: Boolean(viewer && match?.leagueId && clubIdsOfLeague(match.leagueId).some((clubId) => roleIn(clubId, viewer.id) === 'owner')),
    });
  });

  app.post('/api/challenges/:id/responses', (req, res) => {
    const user = requireUser(req);
    const challenge = getChallenge(req.params.id);
    if (!challenge) throw new ApiError(404, '约球帖不存在');
    if (challenge.status !== 'open') throw new ApiError(400, challenge.status === 'expired' ? '这个约球帖已过期' : '这个约球帖已经不接受迎战了');
    const club = requireClub(text(req.body?.clubId, '迎战的球队'));
    requireManager(club.id, user);
    if (club.id === challenge.club.id) throw new ApiError(400, '不能迎战自己球队的帖子');
    const message = limited(req.body?.message, '留言', 100);
    const existing = responseOfClub(challenge.id, club.id);
    if (existing && existing.status !== 'withdrawn') throw new ApiError(409, `「${club.name}」已经迎战过这个帖子了`);
    const responseId = existing?.id ?? randomUUID();
    if (existing) reopenResponse(existing.id, user.id, message);
    else insertResponse({ id: responseId, challengeId: challenge.id, clubId: club.id, userId: user.id, message });
    remindChallengeResponse({
      responseId,
      challengeId: challenge.id,
      posterClubId: challenge.club.id,
      challengerName: club.name,
      time: challenge.time,
      venue: challenge.venue,
    });
    res.status(201).json({ ok: true });
  });

  app.delete('/api/challenges/:id/responses/:rid', (req, res) => {
    const user = requireUser(req);
    const response = getResponse(req.params.rid);
    if (!response || response.challengeId !== req.params.id) throw new ApiError(404, '迎战不存在');
    requireManager(response.club.id, user);
    if (response.status !== 'pending') throw new ApiError(400, '只有还没被确认的迎战可以撤回');
    setResponseStatus(response.id, 'withdrawn');
    forgetChallengeResponse(response.id);
    res.json({ ok: true });
  });

  app.post('/api/challenges/:id/responses/:rid/accept', (req, res) => {
    const user = requireUser(req);
    const challenge = getChallenge(req.params.id);
    if (!challenge) throw new ApiError(404, '约球帖不存在');
    requireManager(challenge.club.id, user);
    if (challenge.status !== 'open') throw new ApiError(400, challenge.status === 'expired' ? '这个约球帖已过期' : '这个约球帖已经成交或取消了');
    const response = getResponse(req.params.rid);
    if (!response || response.challengeId !== challenge.id || response.status !== 'pending') {
      throw new ApiError(400, '这条迎战已撤回或不存在');
    }
    const league = createFriendly(challenge, response.id, user);
    res.json({ ok: true, leagueId: league.id });
  });

  app.post('/api/challenges/:id/cancel', (req, res) => {
    const user = requireUser(req);
    const challenge = getChallenge(req.params.id);
    if (!challenge) throw new ApiError(404, '约球帖不存在');
    const sides = challenge.status === 'matched' ? [challenge.club.id, challenge.opponent?.id ?? ''] : [challenge.club.id];
    if (!sides.some((id) => id && roleIn(id, user.id))) throw new ApiError(403, '只有约战双方的负责人可以取消');
    if (challenge.status === 'cancelled') throw new ApiError(400, '已经取消了');
    if (challenge.status === 'matched') {
      const match = challenge.leagueId ? matchesOf(challenge.leagueId)[0] : undefined;
      if (match?.status === 'finished') throw new ApiError(400, '比赛已经结束，不能取消');
      if (challenge.time < nowLocal()) throw new ApiError(400, '已经过了约定时间，不能取消');
    }
    transaction(() => {
      if (challenge.leagueId) deleteLeague(challenge.leagueId);
      declineOthers(challenge.id, '');
      setChallengeStatus(challenge.id, 'cancelled', challenge.responseId);
    });
    res.json({ ok: true });
  });
}
