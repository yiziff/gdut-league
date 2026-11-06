export type SheetSide = 'A' | 'B';

/** 累积分区里写了球衣号的一格。jersey 为空表示这格没有写号码。 */
export interface ScoreMark {
  side: SheetSide;
  total: number;
  jersey: string;
}

export interface FibaTally {
  /** key 为 `${side}:${jersey}` */
  points: Record<string, number>;
  /** 每队最后一个写了号码的累计分 */
  totals: Record<SheetSide, number>;
  warnings: string[];
}

const SIDE_LABEL: Record<SheetSide, string> = { A: 'A 队', B: 'B 队' };

export function normalizeJersey(value: string): string {
  const text = value.normalize('NFKC').trim();
  if (!/^\d{1,3}$/.test(text)) return text;
  return String(Number(text));
}

export function pointsKey(side: SheetSide, jersey: string): string {
  return `${side}:${normalizeJersey(jersey)}`;
}

/** 按 FIBA 累积分计算个人得分：本次得分 = 本格累计分 - 本队上一个写了号码的格子的累计分。 */
export function tallyMarks(marks: ScoreMark[], rosters: Record<SheetSide, string[]>): FibaTally {
  const points: Record<string, number> = {};
  const totals: Record<SheetSide, number> = { A: 0, B: 0 };
  const warnings: string[] = [];
  const written = marks.filter((mark) => normalizeJersey(mark.jersey) !== '');

  for (const side of ['A', 'B'] as const) {
    const roster = new Set(rosters[side].map(normalizeJersey));
    const own = written.filter((mark) => mark.side === side).sort((a, b) => a.total - b.total);
    const unknown = new Map<string, number>();
    let previous = 0;
    for (const mark of own) {
      if (mark.total === previous) {
        warnings.push(`${SIDE_LABEL[side]}累计分 ${mark.total} 写了两次号码`);
        continue;
      }
      const gained = mark.total - previous;
      if (gained > 3) warnings.push(`${SIDE_LABEL[side]} ${previous} 到 ${mark.total} 之间跨了 ${gained} 分，可能漏记`);
      const jersey = normalizeJersey(mark.jersey);
      if (roster.has(jersey)) {
        const key = pointsKey(side, jersey);
        points[key] = (points[key] ?? 0) + gained;
      } else {
        unknown.set(jersey, (unknown.get(jersey) ?? 0) + gained);
      }
      previous = mark.total;
    }
    totals[side] = previous;
    for (const [jersey, gained] of unknown) {
      warnings.push(`${SIDE_LABEL[side]} ${jersey} 号不在名单里，这 ${gained} 分没有计入个人得分`);
    }
  }

  return { points, totals, warnings: [...new Set(warnings)] };
}
