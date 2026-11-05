import { Link } from 'react-router';
import type { Match, Side } from '../types';
import { STAGE_LABEL } from '../sports';
import { winnerSide, type Bracket } from '../lib/bracket';
import { clockOf, dateOf, formatDate, slotLabel } from '../lib/format';
import { useData } from '../data/store';
import TeamName from './TeamName';

function BracketMatch({ match: m, all }: { match: Match; all: Match[] }) {
  const winner = winnerSide(m);
  const hasScore = m.status !== 'scheduled' && m.score;
  const row = (side: Side) => (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 ${
        winner && winner !== side ? 'opacity-50' : ''
      }`}
    >
      <TeamName teamId={m[side]} placeholder={slotLabel(m, side, all)} bold={winner === side} plain />
      <span className={`tabular-nums ${winner === side ? 'font-bold' : ''} ${m.status === 'live' ? 'text-red-600' : ''}`}>
        {hasScore ? m.score![side] : ''}
        {m.penalties && <span className="ml-0.5 text-xs text-slate-400">({m.penalties[side]})</span>}
      </span>
    </div>
  );
  const box = (
    <div
      className={`w-52 overflow-hidden rounded-lg border bg-white text-sm shadow-sm transition hover:border-gdut-500 ${
        m.status === 'live' ? 'border-red-300' : 'border-slate-200'
      }`}
    >
      {row('home')}
      <div className="border-t border-slate-100" />
      {row('away')}
      <div className="flex justify-between bg-slate-50 px-3 py-1 text-[11px] text-slate-400">
        <span>
          {formatDate(dateOf(m.time))} {clockOf(m.time)}
        </span>
        {m.status === 'live' && <span className="font-medium text-red-500">进行中</span>}
      </div>
    </div>
  );
  if (!m.leagueId) return box;
  return (
    <Link to={`/${m.sport}/${m.leagueId}/matches/${m.id}`} className="block">
      {box}
    </Link>
  );
}

const LINE = 'border-slate-300';

export default function BracketView({ bracket, all }: { bracket: Bracket; all: Match[] }) {
  const { rounds, thirdPlace, champion } = bracket;
  const { teamMap } = useData();
  if (rounds.length === 0) return <p className="py-12 text-center text-slate-400">暂无淘汰赛安排</p>;
  const height = rounds[0].matches.length * 128;
  const championTeam = champion ? teamMap[champion] : undefined;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-8">
        {rounds.map((round, ri) => {
          const isLast = ri === rounds.length - 1;
          const pairs: Match[][] = [];
          for (let i = 0; i < round.matches.length; i += isLast ? 1 : 2) {
            pairs.push(round.matches.slice(i, i + (isLast ? 1 : 2)));
          }
          return (
            <div key={round.stage} className="flex flex-col">
              <h3 className="mb-3 text-center text-sm font-semibold text-slate-500">{STAGE_LABEL[round.stage]}</h3>
              <div className="flex flex-col" style={{ height }}>
                {pairs.map((pair, pi) => (
                  <div key={pi} className="relative flex flex-1 flex-col">
                    {pair.map((m) => (
                      <div key={m.id} className="relative flex flex-1 items-center">
                        {ri > 0 && <span className={`absolute top-1/2 -left-4 w-4 border-t ${LINE}`} />}
                        <BracketMatch match={m} all={all} />
                        {!isLast && <span className={`absolute top-1/2 -right-4 w-4 border-t ${LINE}`} />}
                      </div>
                    ))}
                    {!isLast && pair.length === 2 && (
                      <span className={`absolute top-1/4 bottom-1/4 -right-4 border-r ${LINE}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex flex-col">
          <h3 className="mb-3 text-center text-sm font-semibold text-slate-500">冠军</h3>
          <div className="flex items-center" style={{ height }}>
            <div
              className={`w-44 rounded-xl border-2 p-4 text-center ${
                championTeam ? 'border-amber-300 bg-amber-50' : 'border-dashed border-slate-200'
              }`}
            >
              <div className="text-3xl">🏆</div>
              <div className={`mt-2 text-sm font-bold ${championTeam ? 'text-amber-700' : 'text-slate-400'}`}>
                {championTeam ? championTeam.name : '虚位以待'}
              </div>
            </div>
          </div>
        </div>
      </div>
      {thirdPlace && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-500">{STAGE_LABEL['3rd']}</h3>
          <BracketMatch match={thirdPlace} all={all} />
        </div>
      )}
    </div>
  );
}
