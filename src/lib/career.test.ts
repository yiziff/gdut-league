import { describe, expect, it } from 'vitest';
import type { Match } from '../types';
import { summarizeCareer } from './career';

function match(partial: Partial<Match> & Pick<Match, 'id' | 'time' | 'status'>): Match {
  return {
    sport: 'basketball',
    division: 'men',
    stage: 'group',
    home: 'home',
    away: 'away',
    venue: '',
    ...partial,
  };
}

describe('summarizeCareer', () => {
  it('counts finished games and the current win streak', () => {
    const summary = summarizeCareer('home', 'p1', [
      match({ id: 'a', time: '2026-11-01T14:00', status: 'finished', score: { home: 60, away: 50 }, lines: [{ playerId: 'p1', points: 12, rebounds: 3, assists: 2 }] }),
      match({ id: 'b', time: '2026-11-02T14:00', status: 'finished', score: { home: 40, away: 70 } }),
      match({ id: 'c', time: '2026-11-03T14:00', status: 'finished', score: { home: 80, away: 70 }, lines: [{ playerId: 'p1', points: 8, rebounds: 1, assists: 4 }] }),
      match({ id: 'd', time: '2026-11-04T14:00', status: 'scheduled', score: { home: 1, away: 0 } }),
    ]);
    expect(summary.played).toBe(3);
    expect(summary.won).toBe(2);
    expect(summary.lost).toBe(1);
    expect(summary.streak).toBe(1);
    expect(summary.points).toBe(20);
    expect(summary.recorded).toBe(true);
    expect(summary.winRate).toBeCloseTo(2 / 3);
  });

  it('leaves player totals empty when no lines were entered', () => {
    const summary = summarizeCareer('away', 'p1', [
      match({ id: 'a', time: '2026-11-01T14:00', status: 'finished', home: 'other', away: 'away', score: { home: 1, away: 2 } }),
    ]);
    expect(summary.played).toBe(1);
    expect(summary.won).toBe(1);
    expect(summary.recorded).toBe(false);
    expect(summary.points).toBe(0);
  });
});