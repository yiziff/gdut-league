import { MATCH_STAT_FIELDS, PLAYER_STAT_KEYS, type StatField } from './playerStats';
import type {
  MatchStatSheetTemplate,
  PlayerStatKey,
  Sport,
  StatSheetTemplateFieldKey,
} from '../types';

const playerStatKeySet = new Set<string>(PLAYER_STAT_KEYS);

export function isPlayerStatKey(value: unknown): value is PlayerStatKey {
  return typeof value === 'string' && playerStatKeySet.has(value);
}

export const STAT_SHEET_TEMPLATE_FIELD_KEYS = [
  'teamName',
  'playerNumber',
  'playerName',
  'runningScore',
  'finalScore',
  'periodScore',
  'teamFouls',
  ...PLAYER_STAT_KEYS,
] as const satisfies readonly StatSheetTemplateFieldKey[];

export const STAT_SHEET_TEMPLATE_FIELD_LABELS: Record<StatSheetTemplateFieldKey, string> = {
  teamName: '球队名称',
  playerNumber: '球员号码',
  playerName: '球员姓名',
  runningScore: '累积分 / 跑分栏',
  finalScore: '最终比分',
  periodScore: '分节比分',
  teamFouls: '全队犯规',
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
  fouls: '个人犯规',
};

/** 有模板字段时以模板为准；尚未上传模板的旧比赛继续显示项目默认字段。 */
export function statFieldsForTemplate(
  sport: Sport,
  template?: MatchStatSheetTemplate,
): StatField[] {
  const detected = template?.fields.flatMap((field): StatField[] =>
    isPlayerStatKey(field.key)
      ? [{ key: field.key, label: field.label || STAT_SHEET_TEMPLATE_FIELD_LABELS[field.key] }]
      : [],
  );
  if (!detected?.length) return MATCH_STAT_FIELDS[sport];
  const seen = new Set<PlayerStatKey>();
  return detected.filter((field) => {
    if (seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
}
