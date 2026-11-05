import type { PlayerLine, Sport } from '../types';

export interface StatField {
  key: keyof Omit<PlayerLine, 'playerId'>;
  label: string;
}

export const STAT_FIELDS: Record<Sport, StatField[]> = {
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
