export type Sport = 'basketball' | 'football' | 'badminton' | 'volleyball' | 'tabletennis';
export type Division = 'men' | 'women' | 'mixed';
export type Stage = 'group' | 'R16' | 'QF' | 'SF' | 'F' | '3rd';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Side = 'home' | 'away';

export interface League {
  id: string;
  sport: Sport;
  name: string;
  season: string;
}

export interface Player {
  id: string;
  teamId: string;
  className: string;
  name: string;
  number: string;
  position: string;
  gender: '' | 'male' | 'female';
  height: string;
  weight: string;
}

/** 一场比赛里某名球员的数据。篮球用得分、篮板、助攻；其他项目只用其中对应的项。 */
export interface PlayerLine {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
}

export interface Team {
  id: string;
  leagueId: string;
  name: string;
  short: string;
  color: string;
  players?: Player[];
}

export interface Score {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  leagueId?: string;
  sport: Sport;
  division: Division;
  stage: Stage;
  group?: string;
  /** 淘汰赛对阵未确定时为 null，由 homeSeed 或上一轮晋级自动填入 */
  home: string | null;
  away: string | null;
  /** 如 "A1" 表示 A 组第 1 名，小组赛全部结束后自动解析 */
  homeSeed?: string;
  awaySeed?: string;
  time: string;
  venue: string;
  status: MatchStatus;
  /** 篮球/足球为比分；排球为局分；羽毛球/乒乓球为团体赛大比分 */
  score?: Score;
  /** 排球每局小分 */
  sets?: [number, number][];
  /** 足球淘汰赛点球大战 */
  penalties?: Score;
  /** 弃权方 */
  forfeit?: Side;
  /** 比赛结束后的球员数据 */
  lines?: PlayerLine[];
  nextMatchId?: string;
  nextSlot?: Side;
  loserNextMatchId?: string;
  loserNextSlot?: Side;
}

export interface SportFile {
  sport: Sport;
  matches: Match[];
}
