import type { Division, League, Match, Team } from '../types';
import { DIVISION_ORDER } from '../sports';
import { computeGroupTables, resolveKnockout, type GroupTable } from '../lib/bracket';

export interface LeagueData {
  league: League;
  teams: Team[];
  matches: Match[];
  tables: GroupTable[];
  divisions: Division[];
}

export interface AppData {
  leagues: LeagueData[];
  teamMap: Record<string, Team>;
  allMatches: Match[];
}

export function prepareSnapshot(leagues: League[], teams: Team[], matches: Match[]): AppData {
  const buckets = new Map<string, { teams: Team[]; matches: Match[] }>();
  for (const league of leagues) buckets.set(league.id, { teams: [], matches: [] });
  for (const team of teams) buckets.get(team.leagueId)?.teams.push(team);
  for (const match of matches) {
    if (match.leagueId) buckets.get(match.leagueId)?.matches.push(match);
  }

  const prepared = leagues.map((league) => {
    const bucket = buckets.get(league.id) ?? { teams: [], matches: [] };
    const tables = computeGroupTables(bucket.matches, league.sport);
    const resolved = resolveKnockout(bucket.matches, tables).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
    return {
      league,
      teams: bucket.teams,
      matches: resolved,
      tables,
      divisions: DIVISION_ORDER.filter((division) => resolved.some((match) => match.division === division)),
    };
  });

  return {
    leagues: prepared,
    teamMap: Object.fromEntries(teams.map((team) => [team.id, team])),
    allMatches: prepared.flatMap((league) => league.matches).sort((a, b) => a.time.localeCompare(b.time)),
  };
}
