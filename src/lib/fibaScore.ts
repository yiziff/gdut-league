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

/** OCR 对一格的一次识别：文字和置信度。 */
export type JerseyRead = [text: string, confidence: number];

/** 没认出号码、但格子里确实写了数字时的占位号。 */
export const UNREAD_JERSEY = '?';

const LOOKALIKE: Record<string, string> = {
  S: '5', s: '5', $: '5', Z: '2', z: '2', B: '8', X: '8', x: '8', O: '0', o: '0', D: '0',
  I: '1', l: '1', '|': '1', ']': '1', '[': '1', '丨': '1', g: '9', q: '9',
};

/** 只留数字，手写常被认成的字母换回数字。 */
export function readDigits(text: string): string {
  return [...text.normalize('NFKC')].map((char) => (/\d/.test(char) ? char : LOOKALIKE[char] ?? '')).join('');
}

/** 名单里每个号码和这几次识别的吻合程度，越大越像。 */
export function jerseyScores(reads: JerseyRead[], roster: string[]): Map<string, number> {
  const numbers = [...new Set(roster.map(normalizeJersey))];
  const scores = new Map(numbers.map((number) => [number, 0]));
  for (const [text, confidence] of reads) {
    const digits = readDigits(text);
    if (!digits) continue;
    const plain = normalizeJersey(digits);
    const partial = numbers.filter((number) => number.includes(digits)).length;
    for (const number of numbers) {
      let weight = 0;
      if (plain === number) weight = 1;
      else if (digits.includes(number)) weight = 0.6;
      else if (number.includes(digits)) weight = 0.5 / partial;
      else if (digits.length === number.length && [...digits].filter((char, i) => char !== number[i]).length === 1) {
        weight = 0.25;
      }
      scores.set(number, scores.get(number)! + weight * confidence);
    }
  }
  return scores;
}

/**
 * 猜一格的球衣号。完全没认出数字算没写号码（返回空字符串）；认出了数字但对不上名单返回 UNREAD_JERSEY。
 * score 是最佳号码的吻合度，用来比较 A/B 两队对应哪份名单。
 */
export function guessJersey(reads: JerseyRead[], roster: string[]): { jersey: string; score: number } {
  const digitConfidence = Math.max(0, ...reads.filter(([text]) => readDigits(text)).map(([, confidence]) => confidence));
  if (digitConfidence < 0.3) return { jersey: '', score: 0 };
  let best = { jersey: UNREAD_JERSEY, score: 0 };
  for (const [number, score] of jerseyScores(reads, roster)) {
    if (score > best.score) best = { jersey: number, score };
  }
  return best.score >= 0.15 ? best : { jersey: UNREAD_JERSEY, score: 0 };
}

/** 对着两队名单自动认整张表的号码，并按吻合度判断表上 A 队是主队还是客队。 */
export function autoReadJerseys(
  cells: { side: SheetSide; total: number; reads?: JerseyRead[] }[],
  home: string[],
  away: string[],
): { homeSide: SheetSide; jerseys: Record<string, string> } {
  const assign = (homeSide: SheetSide) => {
    let score = 0;
    const jerseys: Record<string, string> = {};
    for (const cell of cells) {
      const roster = cell.side === homeSide ? home : away;
      const guess = guessJersey(cell.reads ?? [], roster);
      jerseys[`${cell.side}:${cell.total}`] = guess.jersey;
      score += guess.score;
    }
    return { homeSide, jerseys, score };
  };
  const asA = assign('A');
  const asB = assign('B');
  const best = asB.score > asA.score ? asB : asA;
  return { homeSide: best.homeSide, jerseys: best.jerseys };
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
      warnings.push(
        jersey === UNREAD_JERSEY
          ? `${SIDE_LABEL[side]}有 ${gained} 分没认出号码，没有计入个人得分`
          : `${SIDE_LABEL[side]} ${jersey} 号不在名单里，这 ${gained} 分没有计入个人得分`,
      );
    }
  }

  return { points, totals, warnings: [...new Set(warnings)] };
}
