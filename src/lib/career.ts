import type { Match } from '../types';

export interface CareerSummary {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  winRate: number | null;
  streak: number;
  points: number;
  rebounds: number;
  assists: number;
  recorded: boolean;
}

function outcome(match: Match, teamId: string): 'W' | 'D' | 'L' | null {
  const side = match.home === teamId ? 'home' : match.away === teamId ? 'away' : null;
  if (!side || match.status !== 'finished') return null;
  if (match.forfeit) return match.forfeit === side ? 'L' : 'W';
  if (!match.score) return null;
  const own = match.score[side];
  const opp = match.score[side === 'home' ? 'away' : 'home'];
  if (own > opp) return 'W';
  if (own < opp) return 'L';
  return 'D';
}

/** 用本队已结束的比赛算胜负，用有录入的球员行算得分。没有球员数据时 recorded 为 false。 */
export function summarizeCareer(teamId: string, playerId: string, matches: Match[]): CareerSummary {
  const involved = matches
    .filter((match) => outcome(match, teamId))
    .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let points = 0;
  let rebounds = 0;
  let assists = 0;
  let recorded = false;
  for (const match of involved) {
    const result = outcome(match, teamId);
    if (result === 'W') won += 1;
    else if (result === 'D') drawn += 1;
    else lost += 1;
    const line = match.lines?.find((item) => item.playerId === playerId);
    if (!line) continue;
    recorded = true;
    points += line.points;
    rebounds += line.rebounds ?? 0;
    assists += line.assists ?? 0;
  }

  let streak = 0;
  for (let index = involved.length - 1; index >= 0; index -= 1) {
    if (outcome(involved[index], teamId) !== 'W') break;
    streak += 1;
  }

  const played = involved.length;
  return {
    played,
    won,
    drawn,
    lost,
    winRate: played ? won / played : null,
    streak,
    points,
    rebounds,
    assists,
    recorded,
  };
}
