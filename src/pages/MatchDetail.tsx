import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useLeague } from '../components/LeagueLayout';
import { useDataState } from '../data/store';
import StatusBadge from '../components/StatusBadge';
import NotFound from './NotFound';
import { DIVISION_LABEL, STAGE_LABEL } from '../sports';
import { statFieldsForTemplate } from '../lib/statSheetTemplate';
import { clockOf, dateOf, formatDate, slotLabel } from '../lib/format';
import type { Match, Player, PlayerLine, PlayerStatKey, Side, Team } from '../types';
import { api, ApiError } from './admin/api';
import StatSheetScanner from './admin/StatSheetScanner';

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

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="data-label mb-1">Box score</p>
            <h2 className="section-title">技术统计</h2>
          </div>
          {match.statSheet?.imageUrl ? (
            <a href={match.statSheet.imageUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-gdut-700 hover:text-gdut-900">
              查看原始技术统计表
            </a>
          ) : (
            home.recorded.length === 0 &&
            away.recorded.length === 0 && <span className="text-xs text-slate-400">还没有录入数据，先列出双方名单</span>
          )}
        </div>
        <div className={`grid gap-4 ${fields.length > 3 ? '' : 'lg:grid-cols-2'}`}>
          <StatTable title={home.label} players={home.players} lines={lines} fields={fields} />
          <StatTable title={away.label} players={away.players} lines={lines} fields={fields} />
        </div>
      </section>

      <OrganizerStatUpload match={match} createdBy={league.createdBy} />
    </div>
  );
}

function OrganizerStatUpload({ match, createdBy }: { match: Match; createdBy: string }) {
  const { reload } = useDataState();
  const [gate, setGate] = useState<'loading' | 'guest' | 'need-name' | 'ready' | 'forbidden'>('loading');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ name: string }>('/api/admin/me')
      .then((me) => {
        const trimmed = me.name.trim();
        if (!trimmed) {
          setGate('need-name');
          return;
        }
        setName(trimmed);
        setGate(!createdBy || createdBy === trimmed ? 'ready' : 'forbidden');
      })
      .catch(() => setGate('guest'));
  }, [createdBy]);

  function applyActor(actor: string) {
    const trimmed = actor.trim();
    if (!trimmed) {
      setGate('need-name');
      return;
    }
    setName(trimmed);
    setGate(!createdBy || createdBy === trimmed ? 'ready' : 'forbidden');
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ name, password }) });
      applyActor(name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败');
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const me = await api<{ name: string }>('/api/admin/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      applyActor(me.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '没有记下名字');
    }
  }

  if (gate === 'loading' || gate === 'forbidden') return null;

  return (
    <section className="mt-10">
      <div className="mb-4">
        <p className="data-label mb-1">Finish match</p>
        <h2 className="section-title">结束这场比赛</h2>
      </div>
      {gate === 'ready' ? (
        <StatSheetScanner
          matchId={match.id}
          template={match.statSheetTemplate}
          statSheet={match.statSheet}
          score={match.score}
          hasExistingStats={(match.lines ?? []).length > 0}
          onResult={() => void reload()}
        />
      ) : (
        <form onSubmit={(event) => void (gate === 'need-name' ? saveName(event) : login(event))} className="surface p-4 sm:p-5">
          <p className="text-sm font-semibold text-navy-950">上传技术统计</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {gate === 'need-name'
              ? '先写下你的名字。上传成功后，这场比赛会自动记为已结束。'
              : '用管理员姓名和密码登录后，就可以在这里上传。上传成功后，这场比赛会自动记为已结束。'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              姓名
              <input value={name} onChange={(event) => setName(event.target.value)} className="field mt-1.5 w-full" required />
            </label>
            {gate === 'guest' && (
              <label className="text-sm font-medium text-slate-700">
                密码
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-1.5 w-full" />
              </label>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary mt-4">
            {gate === 'need-name' ? '继续' : '登录后上传'}
          </button>
        </form>
      )}
    </section>
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
  const recorded = players.filter((player) => lines.has(player.id));
  const rows = [...recorded, ...players.filter((player) => !lines.has(player.id))];
  return (
    <section className="surface overflow-hidden">
      <h3 className="border-b border-slate-100 px-4 py-3 font-semibold text-navy-950">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400">队员名单还没公布</p>
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
                const line = lines.get(player.id);
                return (
                  <tr key={player.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2.5 font-medium text-navy-950">
                      <span className="mr-2 tabular-nums text-slate-400">#{player.number || '—'}</span>
                      {player.name}
                    </td>
                    {fields.map((field) => (
                      <td key={field.key} className={`px-3 py-2 text-right tabular-nums ${line ? '' : 'text-slate-300'}`}>
                        {line?.[field.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            {recorded.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-navy-950">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5">合计</td>
                  {fields.map((field) => {
                    const values = recorded.map((player) => lines.get(player.id)?.[field.key]).filter((value): value is number => value !== undefined);
                    return (
                      <td key={field.key} className="px-3 py-2 text-right tabular-nums">
                        {values.length ? values.reduce((sum, value) => sum + value, 0) : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
