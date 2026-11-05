import { readFileSync } from 'node:fs';
import type { Match, Sport, Team } from '../src/types.ts';
import { insertLeague, insertMatch, insertTeam, leagueCount, transaction } from './db.ts';

const SPORTS: Sport[] = ['basketball', 'football', 'volleyball', 'badminton', 'tabletennis'];

interface RawTeam {
  id: string;
  name: string;
  short: string;
  color: string;
}

/** 数据库为空时，把现有 JSON 各导入为一个「2026 校级联赛」。同一学院在不同项目里是不同的队伍。 */
export function seedIfEmpty(): void {
  if (leagueCount() > 0) return;
  const colleges = JSON.parse(readFileSync('src/data/teams.json', 'utf8')) as RawTeam[];
  const byId = new Map(colleges.map((team) => [team.id, team]));

  transaction(() => {
    for (const sport of SPORTS) {
      const file = JSON.parse(readFileSync(`src/data/${sport}.json`, 'utf8')) as { matches: Match[] };
      const leagueId = `seed-${sport}`;
      insertLeague({ id: leagueId, sport, name: '2026 校级联赛', season: '2026 秋季' });

      const used = new Set<string>();
      for (const match of file.matches) {
        if (match.home) used.add(match.home);
        if (match.away) used.add(match.away);
      }
      for (const collegeId of used) {
        const college = byId.get(collegeId);
        const team: Team = {
          id: `${leagueId}-${collegeId}`,
          leagueId,
          name: college?.name ?? collegeId,
          short: college?.short ?? collegeId,
          color: college?.color ?? '#64748b',
        };
        insertTeam(team);
      }
      for (const match of file.matches) {
        insertMatch({
          ...match,
          leagueId,
          sport,
          home: match.home ? `${leagueId}-${match.home}` : null,
          away: match.away ? `${leagueId}-${match.away}` : null,
        });
      }
    }
  });
  console.log('已导入示例数据：每个项目一个「2026 校级联赛」');
}
