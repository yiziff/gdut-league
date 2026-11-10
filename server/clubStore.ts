import type {
  Challenge,
  ChallengeFormat,
  ChallengeLevel,
  ChallengeResponse,
  ChallengeStatus,
  Club,
  ClubBrief,
  ClubRole,
  ResponseStatus,
  Sport,
} from '../src/types.ts';
import { db } from './db.ts';

db.exec(`
  CREATE TABLE IF NOT EXISTS clubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short TEXT NOT NULL,
    color TEXT NOT NULL,
    logo TEXT NOT NULL DEFAULT '',
    sport TEXT NOT NULL,
    intro TEXT NOT NULL DEFAULT '',
    home_venue TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_name ON clubs(sport, name);
  CREATE TABLE IF NOT EXISTS club_managers (
    club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (club_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_club_managers_user ON club_managers(user_id);
  CREATE TABLE IF NOT EXISTS club_players (
    id TEXT PRIMARY KEY,
    club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    number TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_club_players_club ON club_players(club_id);
  CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    poster_user_id TEXT NOT NULL,
    time TEXT NOT NULL,
    venue TEXT NOT NULL,
    format TEXT NOT NULL,
    level TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    response_id TEXT NOT NULL DEFAULT '',
    league_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status, time);
  CREATE TABLE IF NOT EXISTS challenge_responses (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (challenge_id, club_id)
  );
`);

const clubColumns = db.prepare('PRAGMA table_info(clubs)').all() as { name: string }[];
if (clubColumns.length > 0 && !clubColumns.some((column) => column.name === 'logo')) {
  db.exec("ALTER TABLE clubs ADD COLUMN logo TEXT NOT NULL DEFAULT ''");
}

interface ClubRow {
  id: string;
  name: string;
  short: string;
  color: string;
  logo: string;
  sport: string;
  intro: string;
  home_venue: string;
  created_at: string;
}

function toClub(row: ClubRow): Club {
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    color: row.color,
    logo: row.logo ?? '',
    sport: row.sport as Sport,
    intro: row.intro,
    homeVenue: row.home_venue,
    createdAt: row.created_at,
  };
}

const brief = (club: Club): ClubBrief => ({ id: club.id, name: club.name, short: club.short, color: club.color, logo: club.logo });

export function getClub(id: string): Club | undefined {
  const row = db.prepare('SELECT * FROM clubs WHERE id = ?').get(id) as ClubRow | undefined;
  return row && toClub(row);
}

export function clubNameTaken(sport: Sport, name: string, exceptId = ''): boolean {
  return Boolean(db.prepare('SELECT 1 FROM clubs WHERE sport = ? AND name = ? AND id <> ?').get(sport, name, exceptId));
}

export function insertClub(club: Club, ownerId: string): void {
  db.prepare(
    'INSERT INTO clubs (id, name, short, color, logo, sport, intro, home_venue, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(club.id, club.name, club.short, club.color, club.logo, club.sport, club.intro, club.homeVenue, club.createdAt);
  addManager(club.id, ownerId, 'owner');
}

export function updateClub(club: Club): void {
  db.prepare('UPDATE clubs SET name = ?, short = ?, color = ?, logo = ?, intro = ?, home_venue = ? WHERE id = ?').run(
    club.name,
    club.short,
    club.color,
    club.logo,
    club.intro,
    club.homeVenue,
    club.id,
  );
}

export interface ManagerRow {
  userId: string;
  name: string;
  phone: string;
  role: ClubRole;
}

export function managersOf(clubId: string): ManagerRow[] {
  return db
    .prepare(
      `SELECT club_managers.user_id AS userId, users.name AS name, users.phone AS phone, club_managers.role AS role
       FROM club_managers JOIN users ON users.id = club_managers.user_id
       WHERE club_id = ? ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, added_at`,
    )
    .all(clubId) as unknown as ManagerRow[];
}

export function roleIn(clubId: string, userId: string): ClubRole | undefined {
  const row = db.prepare('SELECT role FROM club_managers WHERE club_id = ? AND user_id = ?').get(clubId, userId) as
    | { role: ClubRole }
    | undefined;
  return row?.role;
}

export function addManager(clubId: string, userId: string, role: ClubRole): void {
  db.prepare('INSERT INTO club_managers (club_id, user_id, role, added_at) VALUES (?, ?, ?, ?)').run(
    clubId,
    userId,
    role,
    new Date().toISOString(),
  );
}

export function removeManager(clubId: string, userId: string): void {
  db.prepare('DELETE FROM club_managers WHERE club_id = ? AND user_id = ?').run(clubId, userId);
}

export function setRole(clubId: string, userId: string, role: ClubRole): void {
  db.prepare('UPDATE club_managers SET role = ? WHERE club_id = ? AND user_id = ?').run(role, clubId, userId);
}

export function clubsManagedBy(userId: string): (Club & { role: ClubRole })[] {
  const rows = db
    .prepare(
      `SELECT clubs.*, club_managers.role AS role FROM clubs JOIN club_managers ON club_managers.club_id = clubs.id
       WHERE club_managers.user_id = ? ORDER BY clubs.created_at`,
    )
    .all(userId) as unknown as (ClubRow & { role: ClubRole })[];
  return rows.map((row) => ({ ...toClub(row), role: row.role }));
}

export interface ClubPlayerRow {
  id: string;
  name: string;
  number: string;
  phone: string;
}

export function clubPlayers(clubId: string): ClubPlayerRow[] {
  return db.prepare('SELECT id, name, number, phone FROM club_players WHERE club_id = ? ORDER BY sort').all(clubId) as unknown as ClubPlayerRow[];
}

export function replaceClubPlayers(clubId: string, players: ClubPlayerRow[]): void {
  db.prepare('DELETE FROM club_players WHERE club_id = ?').run(clubId);
  const insert = db.prepare('INSERT INTO club_players (id, club_id, name, number, phone, sort) VALUES (?, ?, ?, ?, ?, ?)');
  players.forEach((player, index) => insert.run(player.id, clubId, player.name, player.number, player.phone, index));
}

interface ChallengeRow {
  id: string;
  club_id: string;
  poster_user_id: string;
  time: string;
  venue: string;
  format: string;
  level: string;
  note: string;
  status: string;
  response_id: string;
  league_id: string;
  created_at: string;
}

export interface ChallengeRecord extends Challenge {
  posterUserId: string;
  responseId: string;
}

/** 本地时间，和比赛时间一样是 2026-11-09T14:00 格式，可以直接按字符串比较。 */
export function nowLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function toChallenge(row: ChallengeRow): ChallengeRecord {
  const club = getClub(row.club_id)!;
  const responseCount = Number(
    (
      db.prepare("SELECT COUNT(*) AS n FROM challenge_responses WHERE challenge_id = ? AND status IN ('pending', 'accepted')").get(row.id) as {
        n: number | bigint;
      }
    ).n,
  );
  let status = row.status as ChallengeStatus;
  if (status === 'open' && row.time < nowLocal()) status = 'expired';
  const accepted = row.response_id ? getResponse(row.response_id) : undefined;
  return {
    id: row.id,
    club: brief(club),
    time: row.time,
    venue: row.venue,
    format: row.format as ChallengeFormat,
    level: row.level as ChallengeLevel,
    note: row.note,
    status,
    responseCount,
    createdAt: row.created_at,
    ...(accepted ? { opponent: accepted.club } : {}),
    ...(row.league_id ? { leagueId: row.league_id } : {}),
    posterUserId: row.poster_user_id,
    responseId: row.response_id,
  };
}

export function getChallenge(id: string): ChallengeRecord | undefined {
  const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id) as ChallengeRow | undefined;
  return row && toChallenge(row);
}

export function openChallenges(): ChallengeRecord[] {
  return (
    db.prepare("SELECT * FROM challenges WHERE status = 'open' AND time >= ? ORDER BY time").all(nowLocal()) as unknown as ChallengeRow[]
  ).map(toChallenge);
}

export function challengesOfClubs(clubIds: string[]): ChallengeRecord[] {
  if (clubIds.length === 0) return [];
  const marks = clubIds.map(() => '?').join(', ');
  return (
    db
      .prepare(
        `SELECT * FROM challenges WHERE club_id IN (${marks})
           OR id IN (SELECT challenge_id FROM challenge_responses WHERE club_id IN (${marks}))
         ORDER BY time DESC LIMIT 60`,
      )
      .all(...clubIds, ...clubIds) as unknown as ChallengeRow[]
  ).map(toChallenge);
}

export function openCountOf(clubId: string): number {
  return Number(
    (
      db.prepare("SELECT COUNT(*) AS n FROM challenges WHERE club_id = ? AND status = 'open' AND time >= ?").get(clubId, nowLocal()) as {
        n: number | bigint;
      }
    ).n,
  );
}

export function insertChallenge(
  challenge: Pick<ChallengeRecord, 'id' | 'posterUserId' | 'time' | 'venue' | 'format' | 'level' | 'note' | 'createdAt'> & { clubId: string },
): void {
  db.prepare(
    `INSERT INTO challenges (id, club_id, poster_user_id, time, venue, format, level, note, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
  ).run(
    challenge.id,
    challenge.clubId,
    challenge.posterUserId,
    challenge.time,
    challenge.venue,
    challenge.format,
    challenge.level,
    challenge.note,
    challenge.createdAt,
  );
}

export function setChallengeStatus(id: string, status: 'open' | 'matched' | 'cancelled', responseId = '', leagueId = ''): void {
  db.prepare('UPDATE challenges SET status = ?, response_id = ?, league_id = ? WHERE id = ?').run(status, responseId, leagueId, id);
}

interface ResponseRow {
  id: string;
  challenge_id: string;
  club_id: string;
  user_id: string;
  message: string;
  status: string;
  created_at: string;
}

export interface ResponseRecord extends ChallengeResponse {
  challengeId: string;
  userId: string;
}

function toResponse(row: ResponseRow): ResponseRecord {
  return {
    id: row.id,
    club: brief(getClub(row.club_id)!),
    message: row.message,
    status: row.status as ResponseStatus,
    createdAt: row.created_at,
    challengeId: row.challenge_id,
    userId: row.user_id,
  };
}

export function getResponse(id: string): ResponseRecord | undefined {
  const row = db.prepare('SELECT * FROM challenge_responses WHERE id = ?').get(id) as ResponseRow | undefined;
  return row && toResponse(row);
}

export function responsesOf(challengeId: string): ResponseRecord[] {
  return (
    db.prepare('SELECT * FROM challenge_responses WHERE challenge_id = ? ORDER BY created_at').all(challengeId) as unknown as ResponseRow[]
  ).map(toResponse);
}

export function responseOfClub(challengeId: string, clubId: string): ResponseRecord | undefined {
  const row = db.prepare('SELECT * FROM challenge_responses WHERE challenge_id = ? AND club_id = ?').get(challengeId, clubId) as
    | ResponseRow
    | undefined;
  return row && toResponse(row);
}

export function insertResponse(response: { id: string; challengeId: string; clubId: string; userId: string; message: string }): void {
  db.prepare(
    `INSERT INTO challenge_responses (id, challenge_id, club_id, user_id, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(response.id, response.challengeId, response.clubId, response.userId, response.message, new Date().toISOString());
}

export function reopenResponse(id: string, userId: string, message: string): void {
  db.prepare("UPDATE challenge_responses SET status = 'pending', user_id = ?, message = ?, created_at = ? WHERE id = ?").run(
    userId,
    message,
    new Date().toISOString(),
    id,
  );
}

export function setResponseStatus(id: string, status: ResponseStatus): void {
  db.prepare('UPDATE challenge_responses SET status = ? WHERE id = ?').run(status, id);
}

export function declineOthers(challengeId: string, keepId: string): void {
  db.prepare("UPDATE challenge_responses SET status = 'declined' WHERE challenge_id = ? AND id <> ? AND status = 'pending'").run(
    challengeId,
    keepId,
  );
}

export function pendingResponsesFor(clubIds: string[]): number {
  if (clubIds.length === 0) return 0;
  const marks = clubIds.map(() => '?').join(', ');
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM challenge_responses JOIN challenges ON challenges.id = challenge_responses.challenge_id
       WHERE challenges.club_id IN (${marks}) AND challenges.status = 'open' AND challenges.time >= ? AND challenge_responses.status = 'pending'`,
    )
    .get(...clubIds, nowLocal()) as { n: number | bigint };
  return Number(row.n);
}

/** 约战生成的比赛对应的两支球队。 */
export function clubIdsOfLeague(leagueId: string): string[] {
  return (db.prepare("SELECT club_id FROM teams WHERE league_id = ? AND club_id <> ''").all(leagueId) as { club_id: string }[]).map(
    (row) => row.club_id,
  );
}

export function finishedClubMatches(clubId: string): { leagueId: string; matchId: string }[] {
  return db
    .prepare(
      `SELECT matches.league_id AS leagueId, matches.id AS matchId FROM matches JOIN teams ON teams.id IN (matches.home, matches.away)
       WHERE teams.club_id = ? ORDER BY matches.time DESC LIMIT 30`,
    )
    .all(clubId) as unknown as { leagueId: string; matchId: string }[];
}
