import type { Division, Match, Sport, Stage } from '../types';
import type { AppData } from '../data/prepare';
import { winnerSide } from './bracket';

export interface TeamSportEntry {
  sport: Sport;
  leagueId: string;
  leagueName: string;
  division: Division;
  group?: string;
  rank?: number;
  groupSize?: number;
  won: number;
  drawn: number;
  lost: number;
  furthest: Stage;
  matches: Match[];
}

const STAGE_DEPTH: Record<Stage, number> = { group: 0, R16: 1, QF: 2, SF: 3, '3rd': 3, F: 4 };

export function teamMatches(data: AppData, teamId: string): Match[] {
  return data.allMatches.filter((match) => match.home === teamId || match.away === teamId);
}

export function teamEntries(data: AppData, teamId: string): TeamSportEntry[] {
  const entries: TeamSportEntry[] = [];
  for (const league of data.leagues) {
    for (const division of league.divisions) {
      const own = league.matches.filter(
        (match) => match.division === division && (match.home === teamId || match.away === teamId),
      );
      if (own.length === 0) continue;
      const table = league.tables.find((item) => item.division === division && item.rows.some((row) => row.teamId === teamId));
      const entry: TeamSportEntry = {
        sport: league.league.sport,
        leagueId: league.league.id,
        leagueName: league.league.name,
        division,
        group: table?.group,
        rank: table ? table.rows.findIndex((row) => row.teamId === teamId) + 1 : undefined,
        groupSize: table?.rows.length,
        won: 0,
        drawn: 0,
        lost: 0,
        furthest: 'group',
        matches: own,
      };
      for (const match of own) {
        if (STAGE_DEPTH[match.stage] > STAGE_DEPTH[entry.furthest]) entry.furthest = match.stage;
        const winner = winnerSide(match);
        if (match.status !== 'finished') continue;
        if (!winner) entry.drawn++;
        else if (match[winner] === teamId) entry.won++;
        else entry.lost++;
      }
      entries.push(entry);
    }
  }
  return entries;
}

/** 该队在此项目中的最终/当前名次描述 */
export function placement(data: AppData, entry: TeamSportEntry, teamId: string): string {
  const final = entry.matches.find((match) => match.stage === 'F' || match.stage === '3rd');
  if (final?.status === 'finished') {
    const won = final[winnerSide(final) ?? 'home'] === teamId;
    if (final.stage === 'F') return won ? '冠军' : '亚军';
    return won ? '季军' : '第四名';
  }
  const last = entry.matches[entry.matches.length - 1];
  if (last.status === 'finished' && last.stage !== 'group' && winnerSide(last) && last[winnerSide(last)!] !== teamId) {
    return `止步${({ R16: '16强', QF: '8强', SF: '4强' } as Record<string, string>)[last.stage] ?? ''}`;
  }
  const table = data.leagues
    .find((league) => league.league.id === entry.leagueId)
    ?.tables.find((item) => item.division === entry.division && item.group === entry.group);
  if (entry.furthest === 'group' && table?.complete) return '小组未出线';
  return '比赛中';
}
