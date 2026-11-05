import type { Match, Side, Sport } from '../types';

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  forfeits: number;
  /** 进球/得分/胜局/胜场 */
  for: number;
  against: number;
  diff: number;
  /** 排球每局小分合计 */
  pointsFor: number;
  pointsAgainst: number;
  points: number;
}

export type Tiebreaker = 'h2h' | 'diff' | 'for' | 'ratio' | 'pointRatio';
type Result = 'W' | 'D' | 'L';

export interface StandingRule {
  award(result: Result, own: number, opp: number, forfeited: boolean): number;
  tiebreakers: Tiebreaker[];
}

const winLoss = (win: number, loss: number) => (result: Result, _own: number, _opp: number, forfeited: boolean) =>
  forfeited ? 0 : result === 'W' ? win : loss;

export const RULES: Record<Sport, StandingRule> = {
  basketball: { award: winLoss(2, 1), tiebreakers: ['h2h', 'diff', 'for'] },
  football: {
    award: (result, _own, _opp, forfeited) => (forfeited ? 0 : result === 'W' ? 3 : result === 'D' ? 1 : 0),
    tiebreakers: ['diff', 'for', 'h2h'],
  },
  volleyball: {
    award: (result, own, opp, forfeited) => {
      if (forfeited) return 0;
      if (result === 'W') return opp >= 2 ? 2 : 3;
      return own >= 2 ? 1 : 0;
    },
    tiebreakers: ['ratio', 'pointRatio'],
  },
  badminton: { award: winLoss(2, 1), tiebreakers: ['ratio', 'h2h'] },
  tabletennis: { award: winLoss(2, 1), tiebreakers: ['ratio', 'h2h'] },
};

function emptyRow(teamId: string): StandingRow {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    forfeits: 0,
    for: 0,
    against: 0,
    diff: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    points: 0,
  };
}

function resultFor(m: Match, side: Side): Result {
  if (m.forfeit) return m.forfeit === side ? 'L' : 'W';
  const own = m.score![side];
  const opp = m.score![side === 'home' ? 'away' : 'home'];
  return own > opp ? 'W' : own < opp ? 'L' : 'D';
}

function tally(matches: Match[], rule: StandingRule, teamIds: string[]): Map<string, StandingRow> {
  const rows = new Map(teamIds.map((id) => [id, emptyRow(id)]));
  for (const m of matches) {
    if (m.status !== 'finished' || !m.score || !m.home || !m.away) continue;
    for (const side of ['home', 'away'] as const) {
      const teamId = m[side]!;
      const row = rows.get(teamId) ?? emptyRow(teamId);
      rows.set(teamId, row);
      const opp = side === 'home' ? 'away' : 'home';
      const result = resultFor(m, side);
      const forfeited = m.forfeit === side;
      row.played++;
      if (result === 'W') row.won++;
      else if (result === 'D') row.drawn++;
      else row.lost++;
      if (forfeited) row.forfeits++;
      row.for += m.score[side];
      row.against += m.score[opp];
      for (const set of m.sets ?? []) {
        row.pointsFor += side === 'home' ? set[0] : set[1];
        row.pointsAgainst += side === 'home' ? set[1] : set[0];
      }
      row.points += rule.award(result, m.score[side], m.score[opp], forfeited);
    }
  }
  for (const row of rows.values()) row.diff = row.for - row.against;
  return rows;
}

export function ratio(a: number, b: number): number {
  if (b === 0) return a > 0 ? Infinity : 0;
  return a / b;
}

function tiebreakValue(tb: Tiebreaker, row: StandingRow, h2h: Map<string, StandingRow>): number {
  switch (tb) {
    case 'h2h':
      return h2h.get(row.teamId)?.points ?? 0;
    case 'diff':
      return row.diff;
    case 'for':
      return row.for;
    case 'ratio':
      return ratio(row.for, row.against);
    case 'pointRatio':
      return ratio(row.pointsFor, row.pointsAgainst);
  }
}

/** 计算一组比赛的积分榜。teamIds 用于让未出赛的队伍也出现在榜上。 */
export function computeStandings(matches: Match[], sport: Sport, teamIds: string[] = []): StandingRow[] {
  const rule = RULES[sport];
  const rows = [...tally(matches, rule, teamIds).values()];
  rows.sort((a, b) => b.points - a.points);

  const ranked: StandingRow[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i;
    while (j < rows.length && rows[j].points === rows[i].points) j++;
    const block = rows.slice(i, j);
    if (block.length > 1) {
      const ids = new Set(block.map((r) => r.teamId));
      const h2hMatches = matches.filter((m) => m.home && m.away && ids.has(m.home) && ids.has(m.away));
      const h2h = tally(h2hMatches, rule, [...ids]);
      block.sort((a, b) => {
        for (const tb of rule.tiebreakers) {
          const d = tiebreakValue(tb, b, h2h) - tiebreakValue(tb, a, h2h);
          if (d !== 0 && !Number.isNaN(d)) return d;
        }
        return a.teamId.localeCompare(b.teamId);
      });
    }
    ranked.push(...block);
    i = j;
  }
  return ranked;
}
