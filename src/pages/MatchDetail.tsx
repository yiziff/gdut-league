import { Link, useParams } from 'react-router';
import { useLeague } from '../components/LeagueLayout';
import StatusBadge from '../components/StatusBadge';
import NotFound from './NotFound';
import { DIVISION_LABEL, STAGE_LABEL } from '../sports';
import { STAT_FIELDS } from '../lib/playerStats';
import { clockOf, dateOf, formatDate, slotLabel } from '../lib/format';
import type { Player, PlayerLine, Side, Team } from '../types';

function teamOf(teams: Team[], id: string | null): Team | undefined {
  return id ? teams.find((team) => team.id === id) : undefined;
}

export default function MatchDetail() {
  const { matchId } = useParams();
  const { league, teams, matches } = useLeague();
  const match = matches.find((item) => item.id === matchId);
  if (!match) return <NotFound />;

  const fields = STAT_FIELDS[match.sport];
  const stage = match.stage === 'group' ? `${match.group ?? ''}组` : STAGE_LABEL[match.stage];
  const started = match.status !== 'scheduled' && match.score;
  const lines = new Map((match.lines ?? []).map((line) => [line.playerId, line]));

  const side = (which: Side) => {
    const team = teamOf(teams, match[which]);
    const players = team?.players ?? [];
    const recorded = players.filter((player) => lines.has(player.id));
    return { team, players, recorded, label: team ? team.name : slotLabel(match, which, matches) };
  };
  const home = side('home');
  const away = side('away');

  return (
    <div>
      <Link to={`/${league.sport}/${league.id}/schedule`} className="text-sm text-gdut-600 hover:underline">
        ← 赛程
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {DIVISION_LABEL[match.division]} · {stage}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {formatDate(dateOf(match.time))} {clockOf(match.time)} · {match.venue || '场地待定'}
          </p>
        </div>
        <StatusBadge status={match.status} />
      </div>

      <div className="mb-6 grid items-center gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto_1fr]">
        <TeamHeading team={home.team} name={home.label} align="left" />
        <div className="text-center text-3xl font-bold tabular-nums">
          {started ? (
            <span>
              {match.score!.home}
              <span className="mx-2 text-slate-300">:</span>
              {match.score!.away}
            </span>
          ) : (
            <span className="text-lg font-medium text-slate-400">未开始</span>
          )}
        </div>
        <TeamHeading team={away.team} name={away.label} align="right" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Roster title={home.label} players={home.players} />
        <Roster title={away.label} players={away.players} />
      </div>

      {match.status === 'finished' && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">球员数据</h2>
          {home.recorded.length === 0 && away.recorded.length === 0 ? (
            <p className="text-sm text-slate-400">这场还没有录入球员数据。</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <StatTable title={home.label} players={home.players} lines={lines} fields={fields} />
              <StatTable title={away.label} players={away.players} lines={lines} fields={fields} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TeamHeading({ team, name, align }: { team?: Team; name: string; align: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-2 ${align === 'right' ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: team?.color ?? '#cbd5e1' }} />
      {team ? (
        <Link to={`/teams/${team.id}`} className="text-lg font-bold hover:text-gdut-600">
          {name}
        </Link>
      ) : (
        <span className="text-lg font-bold text-slate-400">{name}</span>
      )}
    </div>
  );
}

function Roster({ title, players }: { title: string; players: Player[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 font-semibold">{title} · 队员</h2>
      {players.length === 0 ? (
        <p className="text-sm text-slate-400">队员名单还没公布</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {players.map((player) => (
            <li key={player.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
              {player.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatTable({
  title,
  players,
  lines,
  fields,
}: {
  title: string;
  players: Player[];
  lines: Map<string, PlayerLine>;
  fields: { key: keyof Omit<PlayerLine, 'playerId'>; label: string }[];
}) {
  const rows = players.filter((player) => lines.has(player.id));
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h3 className="border-b border-slate-100 px-4 py-3 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400">没有录入</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="px-4 py-2 font-medium">球员</th>
              {fields.map((field) => (
                <th key={field.key} className="px-3 py-2 text-right font-medium">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => {
              const line = lines.get(player.id)!;
              return (
                <tr key={player.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{player.name}</td>
                  {fields.map((field) => (
                    <td key={field.key} className="px-3 py-2 text-right tabular-nums">
                      {line[field.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
