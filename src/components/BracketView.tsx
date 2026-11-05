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
      className={`w-56 overflow-hidden rounded-lg border bg-white text-sm shadow-panel transition hover:border-slate-400 ${
        m.status === 'live' ? 'border-l-2 border-l-red-500' : 'border-slate-200'
      }`}
    >
      {row('home')}
      <div className="border-t border-slate-100" />
      {row('away')}
      <div className="flex justify-between border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-500">
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
  if (rounds.length === 0) return <div className="empty-state">暂无淘汰赛安排</div>;
  const height = rounds[0].matches.length * 128;
  const championTeam = champion ? teamMap[champion] : undefined;

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400 sm:hidden">左右滑动查看完整对阵</p>
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
              <h3 className="mb-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">{STAGE_LABEL[round.stage]}</h3>
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
          <h3 className="mb-3 text-center text-xs font-semibold tracking-wide text-amber-700 uppercase">冠军</h3>
          <div className="flex items-center" style={{ height }}>
            <div
              className={`w-48 rounded-xl border p-5 text-center shadow-panel ${
                championTeam ? 'border-amber-300 bg-white' : 'border-dashed border-slate-300 bg-white/60'
              }`}
            >
              <p className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${championTeam ? 'text-amber-600' : 'text-slate-400'}`}>
                Champion
              </p>
              <div className={`mt-3 text-sm font-bold ${championTeam ? 'text-navy-950' : 'text-slate-400'}`}>
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
    </div>
  );
}
