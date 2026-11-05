import { describe, expect, it } from 'vitest';
import { addDays, roundRobinPairings } from './roundRobin';

const pairKey = (home: string, away: string) => [home, away].sort().join('-');

describe('roundRobinPairings', () => {
  it('gives every pair exactly one match when the count is even', () => {
    const matches = roundRobinPairings(['a', 'b', 'c', 'd']);
    expect(matches).toHaveLength(6);
    expect(new Set(matches.map((m) => pairKey(m.home, m.away))).size).toBe(6);
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(matches.filter((m) => m.home === id || m.away === id)).toHaveLength(3);
    }
  });

  it('byes the extra team when the count is odd', () => {
    const matches = roundRobinPairings(['a', 'b', 'c']);
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.home && m.away)).toBe(true);
  });

  it('returns nothing for a single team', () => {
    expect(roundRobinPairings(['a'])).toEqual([]);
  });
});

describe('addDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-10-30', 7)).toBe('2026-11-06');
  });
});
