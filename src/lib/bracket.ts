import type { Division, Match, Side, Sport, Stage } from '../types';
import { computeStandings, type StandingRow } from './standings';

const STAGE_RANK: Record<Stage, number> = { group: 0, single: 0, R16: 1, QF: 2, SF: 3, '3rd': 4, F: 4 };

export function winnerSide(m: Match): Side | null {
  if (m.status !== 'finished') return null;
  if (m.forfeit) return m.forfeit === 'home' ? 'away' : 'home';
  if (!m.score) return null;
  if (m.score.home !== m.score.away) return m.score.home > m.score.away ? 'home' : 'away';
  if (m.penalties && m.penalties.home !== m.penalties.away) {
    return m.penalties.home > m.penalties.away ? 'home' : 'away';
  }
  return null;
}

export function winnerOf(m: Match): string | null {
  const side = winnerSide(m);
  return side ? m[side] : null;
}

export function loserOf(m: Match): string | null {
  const side = winnerSide(m);
  return side ? m[side === 'home' ? 'away' : 'home'] : null;
}

export interface GroupTable {
  division: Division;
  group: string;
  rows: StandingRow[];
  /** 小组赛是否全部完赛（完赛后才会解析 A1、B2 这类种子） */
  complete: boolean;
}

export function computeGroupTables(matches: Match[], sport: Sport): GroupTable[] {
  const byKey = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.stage !== 'group' || !m.group) continue;
    const key = `${m.division}|${m.group}`;
    byKey.set(key, [...(byKey.get(key) ?? []), m]);
  }
  return [...byKey.entries()]
    .map(([key, list]) => {
      const [division, group] = key.split('|') as [Division, string];
      const teamIds = [...new Set(list.flatMap((m) => [m.home, m.away]).filter((t): t is string => !!t))];
      return {
        division,
        group,
        rows: computeStandings(list, sport, teamIds),
        complete: list.every((m) => m.status === 'finished'),
      };
    })
    .sort((a, b) => a.division.localeCompare(b.division) || a.group.localeCompare(b.group));
}

function resolveSeed(seed: string | undefined, division: Division, tables: GroupTable[]): string | null {
  const parsed = seed?.match(/^([A-Z])(\d+)$/);
  if (!parsed) return null;
  const table = tables.find((t) => t.division === division && t.group === parsed[1]);
  if (!table?.complete) return null;
  return table.rows[Number(parsed[2]) - 1]?.teamId ?? null;
}

/**
 * 填充淘汰赛中尚未确定的队伍：先按小组排名解析种子，再按轮次把胜者/负者送入下一场。
 * JSON 中已经手动填写的队伍不会被覆盖。
 */
export function resolveKnockout(matches: Match[], tables: GroupTable[]): Match[] {
  const resolved = matches.map((m) => ({ ...m }));
  const byId = new Map(resolved.map((m) => [m.id, m]));

  for (const m of resolved) {
    if (m.stage === 'group') continue;
    m.home ??= resolveSeed(m.homeSeed, m.division, tables);
    m.away ??= resolveSeed(m.awaySeed, m.division, tables);
  }

  const ordered = resolved.filter((m) => m.stage !== 'group').sort((a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage]);
  for (const m of ordered) {
    const advance = (targetId: string | undefined, slot: Side | undefined, team: string | null) => {
      const target = targetId ? byId.get(targetId) : undefined;
      if (target && slot && team && !target[slot]) target[slot] = team;
    };
    advance(m.nextMatchId, m.nextSlot, winnerOf(m));
    advance(m.loserNextMatchId, m.loserNextSlot, loserOf(m));
  }
  return resolved;
}

export interface BracketRound {
  stage: Stage;
  matches: Match[];
}

export interface Bracket {
  rounds: BracketRound[];
  thirdPlace?: Match;
  champion: string | null;
}

/** 从决赛往回追溯，得到按轮次排列、上下位置对应的对阵树。 */
export function buildBracket(matches: Match[]): Bracket {
  const knockout = matches.filter((m) => m.stage !== 'group');
  const final = knockout.find((m) => m.stage === 'F');
  const thirdPlace = knockout.find((m) => m.stage === '3rd');
  if (!final) return { rounds: [], thirdPlace, champion: null };

  const feeders = (m: Match) =>
    knockout
      .filter((f) => f.nextMatchId === m.id)
      .sort((a, b) => (a.nextSlot === 'home' ? -1 : 1) - (b.nextSlot === 'home' ? -1 : 1));

  const levels: Match[][] = [[final]];
  for (;;) {
    const next = levels[levels.length - 1].flatMap(feeders);
    if (next.length === 0) break;
    levels.push(next);
  }

  return {
    rounds: levels.reverse().map((list) => ({ stage: list[0].stage, matches: list })),
    thirdPlace,
    champion: winnerOf(final),
  };
}
