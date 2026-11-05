import { describe, expect, it } from 'vitest';
import { computeStandings } from './standings';
import { match } from './testUtils';

const points = (rows: ReturnType<typeof computeStandings>) => Object.fromEntries(rows.map((r) => [r.teamId, r.points]));

describe('basketball', () => {
  it('awards 2 for a win, 1 for a loss, 0 for a forfeit', () => {
    const rows = computeStandings(
      [match('basketball', 'a', 'b', 80, 70), match('basketball', 'c', 'd', 20, 0, { forfeit: 'away' })],
      'basketball',
    );
    expect(points(rows)).toEqual({ a: 2, b: 1, c: 2, d: 0 });
    expect(rows.find((r) => r.teamId === 'd')!.forfeits).toBe(1);
  });

  it('breaks ties by head-to-head before point difference', () => {
    const rows = computeStandings(
      [
        match('basketball', 'a', 'b', 61, 60),
        match('basketball', 'c', 'a', 61, 60),
        match('basketball', 'a', 'd', 61, 60),
        match('basketball', 'b', 'c', 100, 60),
        match('basketball', 'b', 'd', 100, 60),
        match('basketball', 'd', 'c', 70, 60),
      ],
      'basketball',
    );
    // a、b 同为 2 胜 1 负，b 净胜分更多但输给了 a；c、d 同为 1 胜 2 负，d 赢了 c
    expect(rows.map((r) => r.teamId)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('includes teams that have not played yet', () => {
    const rows = computeStandings([match('basketball', 'a', 'b', 1, 0, { status: 'scheduled' })], 'basketball', ['a', 'b']);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});

describe('football', () => {
  it('uses 3/1/0 and goal difference', () => {
    const rows = computeStandings(
      [match('football', 'a', 'b', 1, 1), match('football', 'a', 'c', 3, 0), match('football', 'b', 'c', 1, 0)],
      'football',
    );
    expect(points(rows)).toEqual({ a: 4, b: 4, c: 0 });
    expect(rows[0].teamId).toBe('a');
  });
});

describe('volleyball', () => {
  it('gives 3 points for 3:0/3:1 and 2:1 split for 3:2', () => {
    const rows = computeStandings(
      [match('volleyball', 'a', 'b', 3, 1), match('volleyball', 'c', 'd', 3, 2)],
      'volleyball',
    );
    expect(points(rows)).toEqual({ a: 3, b: 0, c: 2, d: 1 });
  });

  it('breaks ties by set ratio then point ratio', () => {
    const rows = computeStandings(
      [
        match('volleyball', 'a', 'x', 3, 0, { sets: [[25, 10], [25, 10], [25, 10]] }),
        match('volleyball', 'b', 'y', 3, 0, { sets: [[25, 23], [25, 23], [25, 23]] }),
      ],
      'volleyball',
    );
    expect(rows.slice(0, 2).map((r) => r.teamId)).toEqual(['a', 'b']);
  });
});

describe('team events', () => {
  it('ranks badminton ties by rubber ratio', () => {
    const rows = computeStandings(
      [match('badminton', 'a', 'x', 3, 2), match('badminton', 'b', 'y', 3, 0)],
      'badminton',
    );
    expect(rows.slice(0, 2).map((r) => r.teamId)).toEqual(['b', 'a']);
    expect(points(rows)).toMatchObject({ a: 2, b: 2, x: 1, y: 1 });
  });
});
