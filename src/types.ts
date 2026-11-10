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
export type Stage = 'group' | 'R16' | 'QF' | 'SF' | 'F' | '3rd' | 'single';
/** league：多队联赛；single：单场比赛，只有两支队伍和一场比赛 */
export type LeagueKind = 'league' | 'single';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Side = 'home' | 'away';

export interface League {
  id: string;
  sport: Sport;
  name: string;
  season: string;
  level: LeagueLevel;
  kind: LeagueKind;
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
  /** OCR 对这格号码的几次识别：文字和置信度 */
  reads?: [string, number][];
}

/** FIBA 记录表切格结果，以及自动识别或管理员改过的球衣号。 */
export interface FibaScoresheet {
  alignedUrl: string;
  finalUrl: string;
  cells: FibaScoreCell[];
  /** 主队在表上是 A 队还是 B 队 */
  homeSide?: 'A' | 'B';
  /** key 为 `${side}:${total}`，值为球衣号；空字符串表示这格没写号码，? 表示没认出 */
  jerseys?: Record<string, string>;
  /** 号码是机器自动认的时间；管理员手动改过后清空 */
  autoReadAt?: string;
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
  /** 约战生成的比赛里，指回发起或迎战的球队 */
  clubId?: string;
  players?: Player[];
}

/** 不依附联赛、长期存在的球队，用来约战。 */
export interface Club {
  id: string;
  name: string;
  short: string;
  color: string;
  /** 队伍头像，空字符串表示还没上传 */
  logo: string;
  sport: Sport;
  intro: string;
  homeVenue: string;
  createdAt: string;
}

export type ClubBrief = Pick<Club, 'id' | 'name' | 'short' | 'color' | 'logo'>;

export type ClubRole = 'owner' | 'manager';

export interface ClubManager {
  userId: string;
  name: string;
  /** 打码；约战成交后对方负责人能看到完整号码 */
  phone: string;
  role: ClubRole;
}

export interface ClubPlayer {
  id: string;
  name: string;
  number: string;
  hasPhone: boolean;
  /** 只有本队负责人能拿到 */
  phone?: string;
}

export type ChallengeFormat = 'full' | 'half';
export type ChallengeLevel = 'casual' | 'medium' | 'strong';
export type ChallengeStatus = 'open' | 'matched' | 'cancelled' | 'expired';
export type ResponseStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export const CHALLENGE_FORMATS: { id: ChallengeFormat; label: string }[] = [
  { id: 'full', label: '全场 5v5' },
  { id: 'half', label: '半场 3v3' },
];

export const CHALLENGE_LEVELS: { id: ChallengeLevel; label: string }[] = [
  { id: 'casual', label: '休闲' },
  { id: 'medium', label: '中等' },
  { id: 'strong', label: '强' },
];

export interface Challenge {
  id: string;
  club: ClubBrief;
  time: string;
  venue: string;
  format: ChallengeFormat;
  level: ChallengeLevel;
  note: string;
  status: ChallengeStatus;
  responseCount: number;
  createdAt: string;
  opponent?: ClubBrief;
  leagueId?: string;
}

export interface ChallengeResponse {
  id: string;
  club: ClubBrief;
  message: string;
  status: ResponseStatus;
  createdAt: string;
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
