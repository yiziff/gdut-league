import type { Division, Sport, Stage } from './types';

export interface SportMeta {
  id: Sport;
  name: string;
  icon: string;
  /** 比分单位，用于界面展示 */
  scoreUnit: string;
  /** 每组前几名出线 */
  qualifiers: number;
  ruleText: string;
}

export const SPORTS: SportMeta[] = [
  {
    id: 'basketball',
    name: '篮球',
    icon: '🏀',
    scoreUnit: '分',
    qualifiers: 2,
    ruleText: '胜 2 分，负 1 分，弃权 0 分；积分相同依次比较相互间胜负、净胜分、总得分。',
  },
  {
    id: 'football',
    name: '足球',
    icon: '⚽',
    scoreUnit: '球',
    qualifiers: 2,
    ruleText: '胜 3 分，平 1 分，负 0 分；积分相同依次比较净胜球、进球数、相互间成绩。',
  },
  {
    id: 'volleyball',
    name: '排球',
    icon: '🏐',
    scoreUnit: '局',
    qualifiers: 2,
    ruleText: '3:0 或 3:1 胜方得 3 分；3:2 胜方得 2 分、负方得 1 分；积分相同依次比较胜局比、得分比。',
  },
  {
    id: 'badminton',
    name: '羽毛球',
    icon: '🏸',
    scoreUnit: '场',
    qualifiers: 2,
    ruleText: '团体赛五场三胜。胜 2 分，负 1 分，弃权 0 分；积分相同依次比较小场胜负比、相互间胜负。',
  },
  {
    id: 'tabletennis',
    name: '乒乓球',
    icon: '🏓',
    scoreUnit: '场',
    qualifiers: 2,
    ruleText: '团体赛五场三胜。胜 2 分，负 1 分，弃权 0 分；积分相同依次比较小场胜负比、相互间胜负。',
  },
];

export const SPORT_MAP = Object.fromEntries(SPORTS.map((s) => [s.id, s])) as Record<Sport, SportMeta>;

export function isSport(value: string | undefined): value is Sport {
  return !!value && value in SPORT_MAP;
}

export const DIVISION_LABEL: Record<Division, string> = {
  men: '男子组',
  women: '女子组',
  mixed: '混合团体',
};

export const DIVISION_ORDER: Division[] = ['men', 'women', 'mixed'];

export const STAGE_LABEL: Record<Stage, string> = {
  group: '小组赛',
  R16: '1/8 决赛',
  QF: '1/4 决赛',
  SF: '半决赛',
  F: '决赛',
  '3rd': '三四名决赛',
};

export const KNOCKOUT_ORDER: Stage[] = ['R16', 'QF', 'SF', 'F'];
