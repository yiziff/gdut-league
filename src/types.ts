export type Sport = 'basketball' | 'football' | 'badminton' | 'volleyball' | 'tabletennis';
export type LeagueLevel = 'school' | 'college' | 'friendly';

export const LEAGUE_LEVELS: { id: LeagueLevel; label: string }[] = [
  { id: 'school', label: '校级' },
  { id: 'college', label: '院级' },
  { id: 'friendly', label: '友谊赛' },
];

export function isLeagueLevel(value: string): value is LeagueLevel {
  return LEAGUE_LEVELS.some((item) => item.id === value);
}
export type Division = 'men' | 'women' | 'mixed';
export type Stage = 'group' | 'R16' | 'QF' | 'SF' | 'F' | '3rd';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Side = 'home' | 'away';

export interface League {
  id: string;
  sport: Sport;
  name: string;
  season: string;
  level: LeagueLevel;
  /** 创建时上传的标志，站内路径。没有则为空字符串 */
  logo?: string;
  /** 登录管理后台时填写的名字。旧数据可能为空 */
  createdBy: string;
  /** 上线后出现在前台。创建者上线后仍可改联赛资料 */
  published: boolean;
}

export interface Player {
  id: string;
  teamId: string;
  school: string;
  college: string;
  className: string;
  name: string;
  number: string;
  position: string;
  gender: '' | 'male' | 'female';
  height: string;
  weight: string;
  /** 头像路径。没有则为空字符串 */
  avatar?: string;
}

/** 一场比赛里某名球员的数据；项目只使用模板中实际存在的字段。 */
export interface PlayerLine {
  playerId: string;
  points: number;
  rebounds?: number;
  assists?: number;
  twoPointsMade?: number;
  twoPointsAttempted?: number;
  threePointsMade?: number;
  threePointsAttempted?: number;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
  steals?: number;
  turnovers?: number;
  blocks?: number;
  fouls?: number;
}

export type PlayerStatKey = Exclude<keyof PlayerLine, 'playerId'>;

export type StatSheetTemplateFieldKey =
  | PlayerStatKey
  | 'teamName'
  | 'playerNumber'
  | 'playerName'
  | 'runningScore'
  | 'finalScore'
  | 'periodScore'
  | 'teamFouls';

export interface StatSheetTemplateField {
  key: StatSheetTemplateFieldKey;
  label: string;
  sourceLabel?: string;
}

/** 管理员上传的空白表格，以及后台从中识别出的字段语义。 */
export interface MatchStatSheetTemplate {
  imageUrl: string;
  uploadedAt: string;
  analyzedAt?: string;
  ocrEngine?: string;
  kind: 'box-score' | 'fiba-scoresheet' | 'generic';
  fields: StatSheetTemplateField[];
  warnings: string[];
}

/** FIBA 记录表累积分区里写了字的一格。side 为表上的 A/B 队，不是主客队。 */
export interface FibaScoreCell {
  side: 'A' | 'B';
  total: number;
  imageUrl: string;
}

/** FIBA 记录表切格结果，以及管理员逐格确认的球衣号。 */
export interface FibaScoresheet {
  alignedUrl: string;
  finalUrl: string;
  cells: FibaScoreCell[];
  /** 主队在表上是 A 队还是 B 队 */
  homeSide?: 'A' | 'B';
  /** key 为 `${side}:${total}`，值为球衣号；空字符串表示这格没写号码 */
  jerseys?: Record<string, string>;
  reviewedAt?: string;
}

/** 纸质技术统计表的留档信息；OCR 结果仍需管理员确认后才写入 lines。 */
export interface MatchStatSheet {
  imageUrl: string;
  uploadedAt: string;
  recognizedAt?: string;
  ocrEngine?: string;
  scoresheet?: FibaScoresheet;
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
  /** 创建比赛时上传并分析的空白技术统计表模板 */
  statSheetTemplate?: MatchStatSheetTemplate;
  /** 比赛结束后拍摄并留档的原始技术统计表 */
  statSheet?: MatchStatSheet;
  nextMatchId?: string;
  nextSlot?: Side;
  loserNextMatchId?: string;
  loserNextSlot?: Side;
}

export interface SportFile {
  sport: Sport;
  matches: Match[];
}
