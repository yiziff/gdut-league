import { Link, useParams } from 'react-router';
import { useLeague } from '../components/LeagueLayout';
import StatusBadge from '../components/StatusBadge';
import NotFound from './NotFound';
import { DIVISION_LABEL, STAGE_LABEL } from '../sports';
import { statFieldsForTemplate } from '../lib/statSheetTemplate';
import { clockOf, dateOf, formatDate, slotLabel } from '../lib/format';
import type { Player, PlayerLine, PlayerStatKey, Side, Team } from '../types';

function teamOf(teams: Team[], id: string | null): Team | undefined {
  return id ? teams.find((team) => team.id === id) : undefined;
}

export default function MatchDetail() {
  const { matchId } = useParams();
  const { league, teams, matches } = useLeague();
  const match = matches.find((item) => item.id === matchId);
  if (!match) return <NotFound />;

  const fields = statFieldsForTemplate(match.sport, match.statSheetTemplate);
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
      <Link to={`/${league.sport}/${league.id}/schedule`} className="text-xs font-medium text-slate-500 hover:text-gdut-700">
        赛程 / 返回列表
      </Link>
      <div className="mt-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">
            {DIVISION_LABEL[match.division]} · {stage}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {formatDate(dateOf(match.time))} {clockOf(match.time)} · {match.venue || '场地待定'}
          </p>
        </div>
        <StatusBadge status={match.status} />
      </div>

      <div className="hero-panel mb-8 grid items-center gap-5 p-6 sm:grid-cols-[1fr_auto_1fr] sm:p-9">
        <TeamHeading team={home.team} name={home.label} align="left" />
        <div className="text-center text-3xl font-bold tracking-tight tabular-nums text-white sm:text-5xl">
          {started ? (
            <span>
              {match.score!.home}
              <span className="mx-2 text-slate-300">:</span>
              {match.score!.away}
            </span>
          ) : (
            <span className="text-sm font-semibold tracking-[0.18em] text-slate-300">未开始</span>
          )}
        </div>
        <TeamHeading team={away.team} name={away.label} align="right" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Roster title={home.label} players={home.players} />
        <Roster title={away.label} players={away.players} />
      </div>

      {match.status === 'finished' && (
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="data-label mb-1">Box score</p>
              <h2 className="section-title">技术统计</h2>
            </div>
            {match.statSheet?.imageUrl && (
              <a href={match.statSheet.imageUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-gdut-700 hover:text-gdut-900">
                查看原始技术统计表
              </a>
            )}
          </div>
          {home.recorded.length === 0 && away.recorded.length === 0 ? (
            <div className="empty-state">这场还没有录入球员数据。</div>
          ) : (
            <div className={`grid gap-4 ${fields.length > 3 ? '' : 'lg:grid-cols-2'}`}>
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
      <span className="h-4 w-1 shrink-0 rounded-sm" style={{ backgroundColor: team?.color ?? '#cbd5e1' }} />
      {team ? (
        <Link to={`/teams/${team.id}`} className="text-lg font-bold text-white hover:text-orange-100 sm:text-xl">
          {name}
        </Link>
      ) : (
        <span className="text-lg font-bold text-slate-300">{name}</span>
      )}
    </div>
  );
}

function Roster({ title, players }: { title: string; players: Player[] }) {
  return (
    <section className="surface p-4 sm:p-5">
      <h2 className="mb-3 font-semibold text-navy-950">{title} · 队员</h2>
      {players.length === 0 ? (
        <p className="text-sm text-slate-400">队员名单还没公布</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {players.map((player) => (
            <li key={player.id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 py-2.5">
              <span className="tabular-nums text-slate-400">#{player.number || '—'}</span>
              <span className="font-medium text-navy-950">{player.name}</span>
              <span className="text-xs text-slate-400">{player.className || '班级未填'}</span>
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
  fields: { key: PlayerStatKey; label: string }[];
}) {
  const rows = players.filter((player) => lines.has(player.id));
  return (
    <section className="surface overflow-hidden">
      <h3 className="border-b border-slate-100 px-4 py-3 font-semibold text-navy-950">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400">没有录入</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-left text-xs text-slate-500">
                <th className="sticky left-0 z-10 whitespace-nowrap bg-slate-50 px-4 py-2 font-medium">球员</th>
                {fields.map((field) => (
                  <th key={field.key} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((player) => {
                const line = lines.get(player.id)!;
                return (
                  <tr key={player.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2.5 font-medium text-navy-950">
                      <span className="mr-2 tabular-nums text-slate-400">#{player.number || '—'}</span>
                      {player.name}
                    </td>
                    {fields.map((field) => (
                      <td key={field.key} className="px-3 py-2 text-right tabular-nums">
                        {line[field.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-navy-950">
                <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5">合计</td>
                {fields.map((field) => {
                  const values = rows.map((player) => lines.get(player.id)?.[field.key]).filter((value): value is number => value !== undefined);
                  return (
                    <td key={field.key} className="px-3 py-2 text-right tabular-nums">
                      {values.length ? values.reduce((sum, value) => sum + value, 0) : '—'}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
