import { describe, expect, it } from 'vitest';
import type { Match } from '../types';
import { buildBracket, computeGroupTables, resolveKnockout, winnerOf } from './bracket';
import { match } from './testUtils';

const ko = (id: string, stage: Match['stage'], extra: Partial<Match>): Match => ({
  id,
  sport: 'football',
  division: 'men',
  stage,
  home: null,
  away: null,
  time: '2026-11-01T14:00',
  venue: '足球场',
  status: 'scheduled',
  ...extra,
});

function groupStage(complete = true): Match[] {
  return [
    match('football', 'a1', 'a2', 2, 0, { group: 'A' }),
    match('football', 'b1', 'b2', 2, 0, { group: 'B' }),
    match('football', 'a1', 'a2', 1, 0, { group: 'A', status: complete ? 'finished' : 'scheduled' }),
  ];
}

const knockout = (): Match[] => [
  ko('sf1', 'SF', {
    homeSeed: 'A1',
    awaySeed: 'B2',
    nextMatchId: 'f',
    nextSlot: 'home',
    loserNextMatchId: '3rd',
    loserNextSlot: 'home',
    status: 'finished',
    score: { home: 1, away: 1 },
    penalties: { home: 3, away: 4 },
  }),
  ko('sf2', 'SF', {
    homeSeed: 'B1',
    awaySeed: 'A2',
    nextMatchId: 'f',
    nextSlot: 'away',
    loserNextMatchId: '3rd',
    loserNextSlot: 'away',
    status: 'finished',
    score: { home: 2, away: 0 },
  }),
  ko('3rd', '3rd', {}),
  ko('f', 'F', {}),
];

describe('winnerOf', () => {
  it('handles forfeits and penalties', () => {
    expect(winnerOf(match('football', 'a', 'b', 0, 3, { forfeit: 'home' }))).toBe('b');
    expect(winnerOf(match('football', 'a', 'b', 1, 1, { stage: 'F', penalties: { home: 5, away: 4 } }))).toBe('a');
    expect(winnerOf(match('football', 'a', 'b', 1, 1))).toBeNull();
  });
});

describe('resolveKnockout', () => {
  it('fills seeds from completed groups and advances winners and losers', () => {
    const all = [...groupStage(), ...knockout()];
    const resolved = resolveKnockout(all, computeGroupTables(all, 'football'));
    const byId = Object.fromEntries(resolved.map((m) => [m.id, m]));
    expect([byId.sf1.home, byId.sf1.away]).toEqual(['a1', 'b2']);
    expect([byId.f.home, byId.f.away]).toEqual(['b2', 'b1']);
    expect([byId['3rd'].home, byId['3rd'].away]).toEqual(['a1', 'a2']);
  });

  it('leaves seeds empty while the group is still in progress', () => {
    const all = [...groupStage(false), ...knockout()];
    const resolved = resolveKnockout(all, computeGroupTables(all, 'football'));
    const sf1 = resolved.find((m) => m.id === 'sf1')!;
    expect(sf1.home).toBeNull();
    expect(sf1.away).toBe('b2');
  });

  it('does not overwrite teams entered manually', () => {
    const all = [...groupStage(), ...knockout()];
    all.find((m) => m.id === 'f')!.home = 'manual';
    const resolved = resolveKnockout(all, computeGroupTables(all, 'football'));
    expect(resolved.find((m) => m.id === 'f')!.home).toBe('manual');
  });
});

describe('buildBracket', () => {
  it('orders rounds from first round to final and finds the champion', () => {
    const matches = knockout();
    const f = matches.find((m) => m.id === 'f')!;
    Object.assign(f, { home: 'x', away: 'y', status: 'finished', score: { home: 0, away: 2 } });
    const bracket = buildBracket(matches);
    expect(bracket.rounds.map((r) => r.matches.map((m) => m.id))).toEqual([['sf1', 'sf2'], ['f']]);
    expect(bracket.thirdPlace?.id).toBe('3rd');
    expect(bracket.champion).toBe('y');
  });
});
