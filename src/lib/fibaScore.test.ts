import { describe, expect, it } from 'vitest';
import { tallyMarks, type ScoreMark } from './fibaScore';

/** 沙步社区（A 队）54 : 41 中央公园（B 队）那张记录表，按原图逐格整理。 */
const sampleA: [number, string][] = [
  [1, '10'], [2, '10'], [4, '53'], [6, '99'], [8, '10'], [9, '53'], [10, '53'], [11, '66'], [12, '66'],
  [14, '53'], [15, '53'], [17, '53'], [20, '66'], [23, '4'], [26, '66'], [27, '99'], [29, '53'], [31, '66'],
  [33, '8'], [34, '10'], [37, '24'], [39, '4'], [41, '8'], [43, '53'], [45, '24'], [47, '10'], [49, '4'],
  [51, '10'], [54, '24'],
];
const sampleB: [number, string][] = [
  [3, '3'], [6, '3'], [9, '3'], [12, '3'], [13, '13'], [14, '7'], [15, '7'], [17, '7'], [20, '11'], [23, '3'],
  [24, '3'], [25, '7'], [28, '11'], [31, '11'], [33, '7'], [35, '11'], [38, '11'], [41, '11'],
];
const marks: ScoreMark[] = [
  ...sampleA.map(([total, jersey]) => ({ side: 'A' as const, total, jersey })),
  ...sampleB.map(([total, jersey]) => ({ side: 'B' as const, total, jersey })),
];
const rosters = {
  A: ['6', '7', '8', '10', '20', '24', '53', '66', '99'],
  B: ['0', '1', '3', '7', '10', '11', '13', '19', '34'],
};

describe('tallyMarks', () => {
  it('scores the sample sheet from running-score differences', () => {
    const tally = tallyMarks(marks, rosters);
    expect(tally.totals).toEqual({ A: 54, B: 41 });
    expect(tally.points).toEqual({
      'A:10': 9,
      'A:53': 13,
      'A:99': 3,
      'A:66': 10,
      'A:8': 4,
      'A:24': 8,
      'B:3': 16,
      'B:13': 1,
      'B:7': 7,
      'B:11': 17,
    });
    expect(tally.warnings).toEqual(['A 队 4 号不在名单里，这 7 分没有计入个人得分']);
  });

  it('with the full roster the players add up to the final score', () => {
    const tally = tallyMarks(marks, { ...rosters, A: [...rosters.A, '4'] });
    const sum = (side: 'A' | 'B') =>
      Object.entries(tally.points)
        .filter(([key]) => key.startsWith(`${side}:`))
        .reduce((total, [, value]) => total + value, 0);
    expect(sum('A')).toBe(54);
    expect(sum('B')).toBe(41);
    expect(tally.warnings).toEqual([]);
  });

  it('ignores empty cells and normalizes jersey text', () => {
    const tally = tallyMarks(
      [
        { side: 'A', total: 2, jersey: '07' },
        { side: 'A', total: 3, jersey: '' },
        { side: 'A', total: 5, jersey: '７' },
      ],
      { A: ['7'], B: [] },
    );
    expect(tally.points).toEqual({ 'A:7': 5 });
    expect(tally.totals.A).toBe(5);
  });

  it('warns about gaps and duplicates', () => {
    const tally = tallyMarks(
      [
        { side: 'A', total: 2, jersey: '7' },
        { side: 'A', total: 2, jersey: '8' },
        { side: 'A', total: 7, jersey: '7' },
        { side: 'B', total: 7, jersey: '5' },
      ],
      { A: ['7', '8'], B: ['5'] },
    );
    expect(tally.warnings).toEqual([
      'A 队累计分 2 写了两次号码',
      'A 队 2 到 7 之间跨了 5 分，可能漏记',
      'B 队 0 到 7 之间跨了 7 分，可能漏记',
    ]);
  });
});
