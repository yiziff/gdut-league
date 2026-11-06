import type { PlayerStatKey, Sport } from '../types';

type CareerStatKey = 'points' | 'rebounds' | 'assists';

export interface StatField<Key extends PlayerStatKey = PlayerStatKey> {
  key: Key;
  label: string;
}

/** 生涯页使用的精简指标。 */
export const STAT_FIELDS: Record<Sport, StatField<CareerStatKey>[]> = {
  basketball: [
    { key: 'points', label: '得分' },
    { key: 'rebounds', label: '篮板' },
    { key: 'assists', label: '助攻' },
  ],
  football: [
    { key: 'points', label: '进球' },
    { key: 'assists', label: '助攻' },
  ],
  volleyball: [{ key: 'points', label: '得分' }],
  badminton: [{ key: 'points', label: '胜场' }],
  tabletennis: [{ key: 'points', label: '胜场' }],
};

/** 单场电子技术统计使用的完整指标。 */
export const MATCH_STAT_FIELDS: Record<Sport, StatField[]> = {
  ...STAT_FIELDS,
  basketball: [
    { key: 'points', label: '得分' },
    { key: 'twoPointsMade', label: '2分中' },
    { key: 'twoPointsAttempted', label: '2分投' },
    { key: 'threePointsMade', label: '3分中' },
    { key: 'threePointsAttempted', label: '3分投' },
    { key: 'freeThrowsMade', label: '罚中' },
    { key: 'freeThrowsAttempted', label: '罚投' },
    { key: 'offensiveRebounds', label: '前板' },
    { key: 'defensiveRebounds', label: '后板' },
    { key: 'rebounds', label: '篮板' },
    { key: 'assists', label: '助攻' },
    { key: 'steals', label: '抢断' },
    { key: 'blocks', label: '盖帽' },
    { key: 'turnovers', label: '失误' },
    { key: 'fouls', label: '犯规' },
  ],
};

export const PLAYER_STAT_KEYS = [
  'points',
  'rebounds',
  'assists',
  'twoPointsMade',
  'twoPointsAttempted',
  'threePointsMade',
  'threePointsAttempted',
  'freeThrowsMade',
  'freeThrowsAttempted',
  'offensiveRebounds',
  'defensiveRebounds',
  'steals',
  'turnovers',
  'blocks',
  'fouls',
] as const satisfies readonly PlayerStatKey[];
