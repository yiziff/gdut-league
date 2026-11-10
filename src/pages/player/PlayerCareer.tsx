import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useData } from '../../data/store';
import { careerGames, summarizeCareer, type CareerGame } from '../../lib/career';
import { clockOf, dateOf, formatDate } from '../../lib/format';
import { STAT_FIELDS } from '../../lib/playerStats';
import { SPORT_MAP, STAGE_LABEL } from '../../sports';
import { LEAGUE_LEVELS, type Club, type ClubRole } from '../../types';
import { api } from '../admin/api';
import { ClubMark } from '../hall/shared';
import { NeedProfile } from './AccountSwitcher';
import { usePlayerSession } from './session';

type MyClub = Club & { role: ClubRole };

const RECORD = [
  { key: 'played', label: '出场' },
  { key: 'won', label: '胜场' },
  { key: 'lost', label: '负场' },
  { key: 'rate', label: '胜率' },
  { key: 'streak', label: '连胜' },
] as const;

const RESULT_LABEL = { W: '胜', L: '负', D: '平' } as const;
const ROLE_LABEL = { owner: '队长', manager: '负责人' } as const;

function average(total: number, games: number): string {
  if (!games) return '';
  const value = total / games;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function scoreText(game: CareerGame): string {
  if (game.own == null || game.opp == null) return game.forfeit ? '弃权' : '—';
  return `${game.own} - ${game.opp}`;
}

export default function PlayerCareer() {
  const { profile, accounts, select, ready } = usePlayerSession();
  const { teamMap, allMatches } = useData();
  const [clubs, setClubs] = useState<MyClub[]>([]);

  useEffect(() => {
    let current = true;
    api<{ clubs: MyClub[] }>('/api/player/clubs')
      .then((data) => {
        if (current) setClubs(data.clubs);
      })
      .catch(() => {
        if (current) setClubs([]);
      });
    return () => {
      current = false;
    };
  }, []);

  if (!ready) return <p className="py-10 text-center text-sm text-slate-400">加载中…</p>;
  if (!profile) return <NeedProfile action="查看生涯数据" />;

  const { player, team, league } = profile;
  const sport = SPORT_MAP[league.sport].name;
  const number = player.number || '—';
  const games = careerGames(team.id, player.id, allMatches);
  const stats = summarizeCareer(team.id, player.id, allMatches);
  const rateValue = stats.winRate == null ? null : Math.round(stats.winRate * 100);
  const body = [player.position, player.height && `${player.height}cm`, player.weight && `${player.weight}kg`].filter(Boolean).join(' · ');
  const origin = [player.school, player.college, player.className].filter(Boolean).join(' · ');
  const level = LEAGUE_LEVELS.find((item) => item.id === league.level)?.label;
  const logged = games.filter((game) => game.points != null);
  const upcoming = allMatches
    .filter((match) => match.status !== 'finished' && (match.home === team.id || match.away === team.id))
    .slice(0, 3);
  const record: Record<(typeof RECORD)[number]['key'], string | number> = {
    played: stats.played,
    won: stats.won,
    lost: stats.lost,
    rate: rateValue == null ? '—' : `${rateValue}%`,
    streak: stats.streak,
  };
  const fields = STAT_FIELDS[league.sport];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="dossier">
        <div className="dossier-file">
          <span className="dossier-watermark" aria-hidden="true">
            {number}
          </span>
          <div className="dossier-identity">
            {player.avatar ? (
              <img src={player.avatar} alt="" className="dossier-photo" />
            ) : (
              <span className="dossier-badge" aria-hidden="true">
                {player.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="eyebrow">Career profile</p>
              <p className="mt-3 text-sm text-slate-500">
                {team.name} · {sport} · #{number}
              </p>
              <h1 className="dossier-name">{player.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{body || '资料还没填完'}</p>
              {origin && <p className="mt-1 text-sm text-slate-500">{origin}</p>}
              <p className="mt-2 text-xs tracking-wide text-slate-400">
                {league.name}
                {league.season ? ` · ${league.season}` : ''}
                {level ? ` · ${level}` : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="dossier-record">
          {RECORD.map((item, index) => (
            <div key={item.key} className="dossier-record-cell" style={{ animationDelay: `${index * 70}ms` }}>
              <p className="dossier-figure">{record[item.key]}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
              {item.key === 'rate' && <span className="dossier-rate" style={{ width: `${rateValue ?? 0}%` }} />}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-4">所属球队</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => {
            const current = account.player.id === player.id;
            return (
              <button
                key={account.player.id}
                type="button"
                onClick={() => select(account.player.id)}
                className={`dossier-team ${current ? 'is-current' : ''}`}
                aria-current={current ? 'true' : undefined}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: account.team.color || '#a4521c' }}
                >
                  {account.player.number || account.team.short.slice(0, 2) || '队'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-navy-950">{account.team.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {account.league.name} · {SPORT_MAP[account.league.sport].name}
                    {account.player.number ? ` · #${account.player.number}` : ''}
                    {account.player.position ? ` · ${account.player.position}` : ''}
                  </span>
                </span>
                {current && <span className="ml-auto shrink-0 text-xs font-semibold text-[#a4521c]">当前</span>}
              </button>
            );
          })}
          {clubs.map((club) => (
            <Link key={club.id} to={`/clubs/${club.id}`} className="dossier-team">
              <ClubMark club={club} size="lg" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-navy-950">{club.name}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  约球 · {ROLE_LABEL[club.role]}
                  {club.homeVenue ? ` · ${club.homeVenue}` : ''}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="section-title">历史战绩</h2>
          <p className="text-xs text-slate-400">{team.name} · 已结束 {games.length} 场</p>
        </div>
        {games.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1" aria-label="近期走势">
            {[...games].reverse().slice(-10).map((game) => (
              <span key={game.id} className={`dossier-chip is-${game.result.toLowerCase()}`} title={RESULT_LABEL[game.result]}>
                {RESULT_LABEL[game.result]}
              </span>
            ))}
          </div>
        )}
        {games.length === 0 ? (
          <p className="text-sm text-slate-400">这支队伍还没有结束的比赛。</p>
        ) : (
          <div className="dossier-log">
            {games.map((game) => {
              const opponent = game.opponentId ? teamMap[game.opponentId] : undefined;
              const personal = [
                game.points != null && `得分 ${game.points}`,
                game.rebounds != null && `篮板 ${game.rebounds}`,
                game.assists != null && `助攻 ${game.assists}`,
              ].filter(Boolean);
              const row = (
                <>
                  <span className={`dossier-chip is-${game.result.toLowerCase()}`}>{RESULT_LABEL[game.result]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy-950">对 {opponent?.name ?? '待定'}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                      {formatDate(dateOf(game.time))} {clockOf(game.time)} · {STAGE_LABEL[game.stage]}
                      {game.venue ? ` · ${game.venue}` : ''}
                      {personal.length > 0 ? ` · ${personal.join(' · ')}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-lg font-bold tabular-nums text-navy-950">{scoreText(game)}</span>
                </>
              );
              return game.leagueId ? (
                <Link key={game.id} to={`/${game.sport}/${game.leagueId}/matches/${game.id}`}>
                  {row}
                </Link>
              ) : (
                <div key={game.id} className="flex items-center gap-3 px-4 py-3">
                  {row}
                </div>
              );
            })}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400">接下来</p>
            <div className="dossier-log">
              {upcoming.map((match) => {
                const opponentId = match.home === team.id ? match.away : match.home;
                const opponent = opponentId ? teamMap[opponentId] : undefined;
                return (
                  <Link key={match.id} to={match.leagueId ? `/${match.sport}/${match.leagueId}/matches/${match.id}` : '/player/matches'}>
                    <span className="dossier-chip is-d">未</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-navy-950">对 {opponent?.name ?? '待定'}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {formatDate(dateOf(match.time))} {clockOf(match.time)}
                        {match.venue ? ` · ${match.venue}` : ''}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title mb-4">生涯数据</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fields.map((field, index) => (
            <div key={field.key} className="dossier-card" style={{ animationDelay: `${180 + index * 70}ms` }}>
              <p className="data-label">{field.label}</p>
              <p className="dossier-figure mt-2 text-[1.7rem]">{stats?.recorded ? stats[field.key] : '—'}</p>
              {stats?.recorded && logged.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">场均 {average(stats[field.key], logged.length)}</p>
              )}
            </div>
          ))}
        </div>
        {stats && !stats.recorded && <p className="mt-3 text-xs text-slate-400">还没有录入个人数据。出场和胜负按本队已结束的比赛计算。</p>}
      </section>
    </div>
  );
}
