import type { Match, Sport } from '../types';

let seq = 0;

export function match(sport: Sport, home: string, away: string, h: number, a: number, extra: Partial<Match> = {}): Match {
  return {
    id: `m${++seq}`,
    sport,
    division: 'men',
    stage: 'group',
    group: 'A',
    home,
    away,
    time: '2026-10-10T14:00',
    venue: '体育馆',
    status: 'finished',
    score: { home: h, away: a },
    ...extra,
  };
}
