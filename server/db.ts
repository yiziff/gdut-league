import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  League,
  LeagueLevel,
  Match,
  MatchStatSheet,
  MatchStatSheetTemplate,
  Player,
  PlayerLine,
  Score,
  Side,
  Sport,
  Team,
} from '../src/types.ts';
import { isLeagueLevel } from '../src/types.ts';

const file = resolve('data/league.db');
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS leagues (
    id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    name TEXT NOT NULL,
    season TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short TEXT NOT NULL,
    color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    sport TEXT NOT NULL,
    division TEXT NOT NULL,
    stage TEXT NOT NULL,
    group_name TEXT,
    home TEXT,
    away TEXT,
    home_seed TEXT,
    away_seed TEXT,
    time TEXT NOT NULL,
    venue TEXT NOT NULL,
    status TEXT NOT NULL,
    score TEXT,
    sets TEXT,
    penalties TEXT,
    forfeit TEXT,
    next_match_id TEXT,
    next_slot TEXT,
    loser_next_match_id TEXT,
    loser_next_slot TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS player_sessions (
    token TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    name TEXT NOT NULL,
    number TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    height TEXT NOT NULL DEFAULT '',
    weight TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league_id);
  CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
  CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
  CREATE TABLE IF NOT EXISTS digit_samples (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    label TEXT NOT NULL,
    image_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_digit_samples_match ON digit_samples(match_id);
`);

const matchColumns = db.prepare('PRAGMA table_info(matches)').all() as { name: string }[];
if (!matchColumns.some((column) => column.name === 'lines')) {
  db.exec('ALTER TABLE matches ADD COLUMN lines TEXT');
}
if (!matchColumns.some((column) => column.name === 'stat_sheet')) {
  db.exec('ALTER TABLE matches ADD COLUMN stat_sheet TEXT');
}
if (!matchColumns.some((column) => column.name === 'stat_sheet_template')) {
  db.exec('ALTER TABLE matches ADD COLUMN stat_sheet_template TEXT');
}

const playerColumns = db.prepare('PRAGMA table_info(players)').all() as { name: string }[];
if (!playerColumns.some((column) => column.name === 'class_name')) {
  db.exec("ALTER TABLE players ADD COLUMN class_name TEXT NOT NULL DEFAULT ''");
}
if (!playerColumns.some((column) => column.name === 'number')) {
  db.exec("ALTER TABLE players ADD COLUMN number TEXT NOT NULL DEFAULT ''");
}
for (const column of ['position', 'gender', 'height', 'weight', 'school', 'college', 'avatar']) {
  if (!playerColumns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE players ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
}

db.exec(`
  CREATE TRIGGER IF NOT EXISTS players_unique_number_insert
  BEFORE INSERT ON players
  WHEN NEW.number <> '' AND EXISTS (
    SELECT 1 FROM players WHERE team_id = NEW.team_id AND number = NEW.number
  )
  BEGIN
    SELECT RAISE(ABORT, 'duplicate player number');
  END;

  CREATE TRIGGER IF NOT EXISTS players_unique_number_update
  BEFORE UPDATE OF team_id, number ON players
  WHEN NEW.number <> '' AND EXISTS (
    SELECT 1 FROM players WHERE team_id = NEW.team_id AND number = NEW.number AND id <> NEW.id
  )
  BEGIN
    SELECT RAISE(ABORT, 'duplicate player number');
  END;
`);

const leagueColumns = db.prepare('PRAGMA table_info(leagues)').all() as { name: string }[];
if (!leagueColumns.some((column) => column.name === 'logo')) {
  db.exec("ALTER TABLE leagues ADD COLUMN logo TEXT NOT NULL DEFAULT ''");
}
if (!leagueColumns.some((column) => column.name === 'level')) {
  db.exec("ALTER TABLE leagues ADD COLUMN level TEXT NOT NULL DEFAULT 'friendly'");
  db.exec("UPDATE leagues SET level = 'school' WHERE name LIKE '%校级%'");
  db.exec("UPDATE leagues SET level = 'college' WHERE name LIKE '%院级%'");
}
if (!leagueColumns.some((column) => column.name === 'created_by')) {
  db.exec("ALTER TABLE leagues ADD COLUMN created_by TEXT NOT NULL DEFAULT ''");
}
if (!leagueColumns.some((column) => column.name === 'published')) {
  db.exec('ALTER TABLE leagues ADD COLUMN published INTEGER NOT NULL DEFAULT 1');
}

const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[];
if (!sessionColumns.some((column) => column.name === 'name')) {
  db.exec("ALTER TABLE sessions ADD COLUMN name TEXT NOT NULL DEFAULT ''");
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

interface LeagueRow {
  id: string;
  sport: string;
  name: string;
  season: string;
  logo: string;
  level: string;
  created_by: string;
  published: number;
  created_at: string;
}

interface TeamRow {
  id: string;
  league_id: string;
  name: string;
  short: string;
  color: string;
}

interface MatchRow {
  id: string;
  league_id: string;
  sport: string;
  division: Match['division'];
  stage: Match['stage'];
  group_name: string | null;
  home: string | null;
  away: string | null;
  home_seed: string | null;
  away_seed: string | null;
  time: string;
  venue: string;
  status: Match['status'];
  score: string | null;
  sets: string | null;
  penalties: string | null;
  forfeit: string | null;
  next_match_id: string | null;
  next_slot: string | null;
  loser_next_match_id: string | null;
  loser_next_slot: string | null;
  lines: string | null;
  stat_sheet: string | null;
  stat_sheet_template: string | null;
}

const json = (value: unknown) => (value == null ? null : JSON.stringify(value));
const parse = <T>(value: string | null): T | undefined => (value ? (JSON.parse(value) as T) : undefined);

function toLeague(row: LeagueRow): League {
  const level: LeagueLevel = isLeagueLevel(row.level) ? row.level : 'friendly';
  return {
    id: row.id,
    sport: row.sport as Sport,
    name: row.name,
    season: row.season,
    level,
    logo: row.logo ?? '',
    createdBy: row.created_by ?? '',
    published: row.published !== 0,
  };
}

function toTeam(row: TeamRow): Team {
  return { id: row.id, leagueId: row.league_id, name: row.name, short: row.short, color: row.color };
}

function toMatch(row: MatchRow): Match {
  return {
    id: row.id,
    leagueId: row.league_id,
    sport: row.sport as Sport,
    division: row.division,
    stage: row.stage,
    group: row.group_name ?? undefined,
    home: row.home,
    away: row.away,
    homeSeed: row.home_seed ?? undefined,
    awaySeed: row.away_seed ?? undefined,
    time: row.time,
    venue: row.venue,
    status: row.status,
    score: parse<Score>(row.score),
    sets: parse<[number, number][]>(row.sets),
    penalties: parse<Score>(row.penalties),
    forfeit: (row.forfeit as Side | null) ?? undefined,
    nextMatchId: row.next_match_id ?? undefined,
    nextSlot: (row.next_slot as Side | null) ?? undefined,
    loserNextMatchId: row.loser_next_match_id ?? undefined,
    loserNextSlot: (row.loser_next_slot as Side | null) ?? undefined,
    lines: parse<PlayerLine[]>(row.lines),
    statSheet: parse<MatchStatSheet>(row.stat_sheet),
    statSheetTemplate: parse<MatchStatSheetTemplate>(row.stat_sheet_template),
  };
}

export interface LeagueSummary extends League {
  teamCount: number;
  matchCount: number;
  finishedCount: number;
}

function count(sql: string, arg?: string): number {
  const row = (arg === undefined ? db.prepare(sql).get() : db.prepare(sql).get(arg)) as { n: number | bigint };
  return Number(row.n);
}

export function listLeagues(sport?: string, publishedOnly = false): LeagueSummary[] {
  const rows = db.prepare('SELECT * FROM leagues ORDER BY created_at, id').all() as unknown as LeagueRow[];
  return rows
    .filter((row) => !publishedOnly || row.published !== 0)
    .filter((row) => !sport || row.sport === sport)
    .map((row) => ({
      ...toLeague(row),
      teamCount: count('SELECT COUNT(*) AS n FROM teams WHERE league_id = ?', row.id),
      matchCount: count('SELECT COUNT(*) AS n FROM matches WHERE league_id = ?', row.id),
      finishedCount: count("SELECT COUNT(*) AS n FROM matches WHERE league_id = ? AND status = 'finished'", row.id),
    }));
}

export function getLeague(id: string): League | undefined {
  const row = db.prepare('SELECT * FROM leagues WHERE id = ?').get(id) as LeagueRow | undefined;
  return row && toLeague(row);
}

export function teamsOf(leagueId: string): Team[] {
  return withPlayers(
    (db.prepare('SELECT * FROM teams WHERE league_id = ? ORDER BY name').all(leagueId) as unknown as TeamRow[]).map(toTeam),
  );
}

interface PlayerRow {
  id: string;
  team_id: string;
  class_name: string;
  name: string;
  number: string;
  position?: string | null;
  gender?: string | null;
  height?: string | null;
  weight?: string | null;
  school?: string | null;
  college?: string | null;
  avatar?: string | null;
}

function toPlayer(row: PlayerRow): Player {
  const gender = row.gender === 'male' || row.gender === 'female' ? row.gender : '';
  return {
    id: row.id,
    teamId: row.team_id,
    school: row.school ?? '',
    college: row.college ?? '',
    className: row.class_name,
    name: row.name,
    number: row.number,
    position: row.position ?? '',
    gender,
    height: row.height ?? '',
    weight: row.weight ?? '',
    avatar: row.avatar ?? '',
  };
}

export function withPlayers(teams: Team[]): Team[] {
  const rows = db.prepare('SELECT * FROM players ORDER BY rowid').all() as unknown as PlayerRow[];
  const byTeam = new Map<string, Player[]>();
  for (const row of rows) {
    const players = byTeam.get(row.team_id) ?? [];
    players.push(toPlayer(row));
    byTeam.set(row.team_id, players);
  }
  return teams.map((team) => ({ ...team, players: byTeam.get(team.id) ?? [] }));
}

export function insertPlayer(player: Player): void {
  db.prepare(
    'INSERT INTO players (id, team_id, school, college, class_name, name, number, position, gender, height, weight, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    player.id,
    player.teamId,
    player.school || '',
    player.college || '',
    player.className,
    player.name,
    player.number,
    player.position || '',
    player.gender || '',
    player.height || '',
    player.weight || '',
    player.avatar || '',
  );
}

export function updatePlayer(player: Player): void {
  db.prepare(
    'UPDATE players SET school = ?, college = ?, class_name = ?, name = ?, number = ?, position = ?, gender = ?, height = ?, weight = ?, avatar = ? WHERE id = ?',
  ).run(
    player.school || '',
    player.college || '',
    player.className,
    player.name,
    player.number,
    player.position,
    player.gender,
    player.height,
    player.weight,
    player.avatar || '',
    player.id,
  );
}

export interface PlayerAccount {
  player: Player;
  team: Team;
  league: League;
}

interface AccountRow extends PlayerRow {
  team_name: string;
  team_short: string;
  team_color: string;
  league_id: string;
  league_name: string;
  league_sport: string;
  league_season: string;
  league_level: string;
}

function toAccount(row: AccountRow): PlayerAccount {
  return {
    player: toPlayer(row),
    team: {
      id: row.team_id,
      leagueId: row.league_id,
      name: row.team_name,
      short: row.team_short,
      color: row.team_color,
    },
    league: {
      id: row.league_id,
      sport: row.league_sport as Sport,
      name: row.league_name,
      season: row.league_season,
      level: isLeagueLevel(row.league_level) ? row.league_level : 'friendly',
      createdBy: '',
      published: true,
    },
  };
}

const accountSql = `
  SELECT players.*, teams.name AS team_name, teams.short AS team_short, teams.color AS team_color,
         teams.league_id AS league_id, leagues.name AS league_name, leagues.sport AS league_sport, leagues.season AS league_season, leagues.level AS league_level
  FROM players
  JOIN teams ON teams.id = players.team_id
  JOIN leagues ON leagues.id = teams.league_id
`;

export function findPlayerAccounts(name: string, number: string): PlayerAccount[] {
  return (db.prepare(`${accountSql} WHERE players.name = ? AND players.number = ? ORDER BY leagues.name, teams.name`).all(name, number) as unknown as AccountRow[]).map(toAccount);
}

export function getPlayerAccount(id: string): PlayerAccount | undefined {
  const row = db.prepare(`${accountSql} WHERE players.id = ?`).get(id) as unknown as AccountRow | undefined;
  return row && toAccount(row);
}

export function deletePlayer(id: string): boolean {
  return db.prepare('DELETE FROM players WHERE id = ?').run(id).changes > 0;
}

export function matchesOf(leagueId: string): Match[] {
  return (
    db.prepare('SELECT * FROM matches WHERE league_id = ? ORDER BY time, id').all(leagueId) as unknown as MatchRow[]
  ).map(toMatch);
}

export function allTeams(): Team[] {
  return withPlayers((db.prepare('SELECT * FROM teams ORDER BY name').all() as unknown as TeamRow[]).map(toTeam));
}

export function allMatches(): Match[] {
  return (db.prepare('SELECT * FROM matches ORDER BY time, id').all() as unknown as MatchRow[]).map(toMatch);
}

export function leagueCount(): number {
  return count('SELECT COUNT(*) AS n FROM leagues');
}

export function insertLeague(league: League): void {
  db.prepare(
    'INSERT INTO leagues (id, sport, name, season, level, logo, created_by, published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    league.id,
    league.sport,
    league.name,
    league.season,
    league.level,
    league.logo ?? '',
    league.createdBy,
    league.published ? 1 : 0,
    new Date().toISOString(),
  );
}

export function updateLeague(id: string, name: string, season: string, level: LeagueLevel, logo: string, createdBy: string, published: boolean): void {
  db.prepare('UPDATE leagues SET name = ?, season = ?, level = ?, logo = ?, created_by = ?, published = ? WHERE id = ?').run(
    name,
    season,
    level,
    logo,
    createdBy,
    published ? 1 : 0,
    id,
  );
}

export function deleteLeague(id: string): void {
  db.prepare('DELETE FROM leagues WHERE id = ?').run(id);
}

export function insertTeam(team: Team): void {
  db.prepare('INSERT INTO teams (id, league_id, name, short, color) VALUES (?, ?, ?, ?, ?)').run(
    team.id,
    team.leagueId,
    team.name,
    team.short,
    team.color,
  );
}

export function updateTeam(id: string, name: string, short: string, color: string): void {
  db.prepare('UPDATE teams SET name = ?, short = ?, color = ? WHERE id = ?').run(name, short, color, id);
}

export function deleteTeam(id: string): void {
  transaction(() => {
    db.prepare('UPDATE matches SET home = NULL WHERE home = ?').run(id);
    db.prepare('UPDATE matches SET away = NULL WHERE away = ?').run(id);
    db.prepare('DELETE FROM teams WHERE id = ?').run(id);
  });
}

export function getTeam(id: string): Team | undefined {
  const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as TeamRow | undefined;
  return row && toTeam(row);
}

export function playerIdsOf(teamId: string): string[] {
  return (db.prepare('SELECT id FROM players WHERE team_id = ? ORDER BY rowid').all(teamId) as { id: string }[]).map((row) => row.id);
}

function writeMatch(match: Match, mode: 'insert' | 'update'): void {
  const params: (string | number | null)[] = [
    match.leagueId ?? null,
    match.sport,
    match.division,
    match.stage,
    match.group ?? null,
    match.home,
    match.away,
    match.homeSeed ?? null,
    match.awaySeed ?? null,
    match.time,
    match.venue,
    match.status,
    json(match.score),
    json(match.sets),
    json(match.penalties),
    match.forfeit ?? null,
    match.nextMatchId ?? null,
    match.nextSlot ?? null,
    match.loserNextMatchId ?? null,
    match.loserNextSlot ?? null,
    json(match.lines),
    json(match.statSheet),
    json(match.statSheetTemplate),
    match.id,
  ];
  if (mode === 'insert') {
    db.prepare(
      `INSERT INTO matches (
        league_id, sport, division, stage, group_name, home, away, home_seed, away_seed,
        time, venue, status, score, sets, penalties, forfeit,
        next_match_id, next_slot, loser_next_match_id, loser_next_slot, lines, stat_sheet,
        stat_sheet_template, id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(...params);
    return;
  }
  const updateParams = [...params.slice(0, -1), match.id];
  db.prepare(
    `UPDATE matches SET
      league_id = ?, sport = ?, division = ?, stage = ?, group_name = ?, home = ?, away = ?,
      home_seed = ?, away_seed = ?, time = ?, venue = ?, status = ?, score = ?, sets = ?,
      penalties = ?, forfeit = ?, next_match_id = ?, next_slot = ?, loser_next_match_id = ?,
      loser_next_slot = ?, lines = ?, stat_sheet = ?, stat_sheet_template = ? WHERE id = ?`,
  ).run(...updateParams);
}

export function insertMatch(match: Match): void {
  writeMatch(match, 'insert');
}

export function updateMatch(match: Match): void {
  writeMatch(match, 'update');
}

export function getMatch(id: string): Match | undefined {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as MatchRow | undefined;
  return row && toMatch(row);
}

export function removeMatch(id: string): void {
  db.prepare('UPDATE matches SET next_match_id = NULL, next_slot = NULL WHERE next_match_id = ?').run(id);
  db.prepare('UPDATE matches SET loser_next_match_id = NULL, loser_next_slot = NULL WHERE loser_next_match_id = ?').run(id);
  db.prepare('DELETE FROM matches WHERE id = ?').run(id);
}

export interface DigitSample {
  id: string;
  label: string;
  imagePath: string;
}

/** 替换一场比赛的手写号码样本，返回被替换掉的旧图片路径。 */
export function replaceDigitSamples(matchId: string, samples: DigitSample[]): string[] {
  return transaction(() => {
    const old = db.prepare('SELECT image_path FROM digit_samples WHERE match_id = ?').all(matchId) as {
      image_path: string;
    }[];
    db.prepare('DELETE FROM digit_samples WHERE match_id = ?').run(matchId);
    const insert = db.prepare(
      'INSERT INTO digit_samples (id, match_id, label, image_path, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    const now = new Date().toISOString();
    for (const sample of samples) insert.run(sample.id, matchId, sample.label, sample.imagePath, now);
    return old.map((row) => row.image_path);
  });
}

export function deleteMatch(id: string): void {
  transaction(() => removeMatch(id));
}

export function deleteMatches(ids: string[]): void {
  transaction(() => {
    for (const id of ids) removeMatch(id);
  });
}
