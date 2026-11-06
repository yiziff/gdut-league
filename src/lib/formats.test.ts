import { describe, expect, it } from 'vitest';
import { fitBracketSize, planFormat, seedOrder } from './formats';

const ids = () => {
  let n = 0;
  return () => `m${++n}`;
};

const base = {
  division: 'men' as const,
  startDate: '2026-11-03',
  venue: '体育馆',
  teamIds: [] as string[],
  groupCount: 4,
  qualifiers: 2,
  bracketSize: 8,
  thirdPlace: true,
};

describe('fitBracketSize', () => {
  it('uses the smallest draw that holds the selected teams', () => {
    expect(fitBracketSize(0)).toBe(4);
    expect(fitBracketSize(4)).toBe(4);
    expect(fitBracketSize(5)).toBe(8);
    expect(fitBracketSize(8)).toBe(8);
    expect(fitBracketSize(9)).toBe(16);
  });
});

describe('seedOrder', () => {
  it('pairs the top seed with the bottom seed', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('planFormat', () => {
  it('builds a single round robin and refuses a single team', () => {
    const matches = planFormat({ ...base, preset: 'round_robin', teamIds: ['a', 'b', 'c'] }, ids());
    expect(matches).toHaveLength(3);
    expect(matches.every((match) => match.stage === 'group' && match.venue === '体育馆')).toBe(true);
    expect(() => planFormat({ ...base, preset: 'round_robin', teamIds: ['a'] }, ids())).toThrow(/至少需要两支/);
  });

  it('plays each pair twice in a double round robin', () => {
    const matches = planFormat({ ...base, preset: 'double_round_robin', teamIds: ['a', 'b', 'c', 'd'] }, ids());
    expect(matches).toHaveLength(12);
  });

  it('leaves knockout slots empty until groups finish, and still draws the bracket with no teams', () => {
    const matches = planFormat(
      { ...base, preset: 'groups_knockout', groupCount: 2, qualifiers: 2, teamIds: ['a', 'b', 'c'] },
      ids(),
    );
    const groups = matches.filter((match) => match.stage === 'group');
    expect(groups.map((match) => match.group)).toEqual(['A']);
    const semis = matches.filter((match) => match.stage === 'SF');
    expect(semis.map((match) => [match.homeSeed, match.awaySeed])).toEqual([
      ['A1', 'B2'],
      ['B1', 'A2'],
    ]);
    expect(semis.every((match) => match.home === null && match.away === null)).toBe(true);
    expect(matches.some((match) => match.stage === '3rd')).toBe(true);

    const empty = planFormat({ ...base, preset: 'groups_knockout', groupCount: 4, qualifiers: 2, teamIds: [] }, ids());
    expect(empty.filter((match) => match.stage === 'group')).toHaveLength(0);
    expect(empty.filter((match) => match.stage === 'QF')).toHaveLength(4);
  });

  it('fills a single-elimination bracket in seed order and leaves extra slots open', () => {
    const matches = planFormat(
      { ...base, preset: 'single_elim', bracketSize: 4, teamIds: ['a', 'b'], thirdPlace: false },
      ids(),
    );
    const semis = matches.filter((match) => match.stage === 'SF');
    expect(semis.map((match) => [match.home, match.away])).toEqual([
      ['a', null],
      ['b', null],
    ]);
    expect(matches.find((match) => match.stage === 'F')?.home).toBeNull();
    expect(matches.some((match) => match.stage === '3rd')).toBe(false);
  });

  it('uses 待定 when the venue is still unknown', () => {
    const matches = planFormat({ ...base, preset: 'single_elim', bracketSize: 4, venue: '  ' }, ids());
    expect(matches[0].venue).toBe('待定');
  });
});
