import type { Sport } from '../types';
import type { GroupTable } from '../lib/bracket';
import { ratio, type StandingRow } from '../lib/standings';
import { formatRatio } from '../lib/format';
import TeamName from './TeamName';

interface Column {
  label: string;
  value: (r: StandingRow) => string | number;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

const COLUMNS: Record<Sport, Column[]> = {
  basketball: [
    { label: '胜', value: (r) => r.won },
    { label: '负', value: (r) => r.lost },
    { label: '得/失', value: (r) => `${r.for}/${r.against}` },
    { label: '净胜', value: (r) => signed(r.diff) },
  ],
  football: [
    { label: '胜', value: (r) => r.won },
    { label: '平', value: (r) => r.drawn },
    { label: '负', value: (r) => r.lost },
    { label: '进/失', value: (r) => `${r.for}/${r.against}` },
    { label: '净胜', value: (r) => signed(r.diff) },
  ],
  volleyball: [
    { label: '胜', value: (r) => r.won },
    { label: '负', value: (r) => r.lost },
    { label: '局比', value: (r) => formatRatio(ratio(r.for, r.against)) },
    { label: '分比', value: (r) => formatRatio(ratio(r.pointsFor, r.pointsAgainst)) },
  ],
  badminton: [
    { label: '胜', value: (r) => r.won },
    { label: '负', value: (r) => r.lost },
    { label: '小场', value: (r) => `${r.for}:${r.against}` },
  ],
  tabletennis: [
    { label: '胜', value: (r) => r.won },
    { label: '负', value: (r) => r.lost },
    { label: '小场', value: (r) => `${r.for}:${r.against}` },
  ],
};

interface Props {
  sport: Sport;
  table: GroupTable;
  qualifiers: number;
}

export default function StandingsTable({ sport, table, qualifiers }: Props) {
  const columns = COLUMNS[sport];
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="font-semibold text-navy-950">{table.group} 组</h3>
        <span className={`text-xs font-medium ${table.complete ? 'text-gdut-700' : 'text-amber-700'}`}>
          {table.complete ? '小组赛已结束' : '小组赛进行中'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-xs text-slate-500">
            <tr>
              <th className="w-10 py-2.5 pl-4 text-left font-medium">#</th>
              <th className="py-2.5 text-left font-medium">队伍</th>
              <th className="px-2 py-2.5 font-medium">场</th>
              {columns.map((c, index) => (
                <th
                  key={c.label}
                  className={`px-2 py-2.5 font-medium whitespace-nowrap ${index >= 2 ? 'hidden sm:table-cell' : ''}`}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-2.5 font-medium">积分</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => {
              const qualified = i < qualifiers;
              return (
                <tr key={r.teamId} className={`border-t border-slate-100 transition hover:bg-slate-50 ${qualified ? 'bg-gdut-50/35' : ''}`}>
                  <td className={`py-3 pl-4 font-semibold tabular-nums ${qualified ? 'border-l-2 border-gdut-600 text-gdut-700' : 'text-slate-400'}`}>
                    {i + 1}
                  </td>
                  <td className="max-w-40 py-3">
                    <TeamName teamId={r.teamId} />
                    {r.forfeits > 0 && <span className="ml-1 text-xs text-red-500">弃权 {r.forfeits}</span>}
                  </td>
                  <td className="px-2 py-3 text-center tabular-nums">{r.played}</td>
                  {columns.map((c, index) => (
                    <td
                      key={c.label}
                      className={`px-2 py-3 text-center tabular-nums whitespace-nowrap ${index >= 2 ? 'hidden sm:table-cell' : ''}`}
                    >
                      {c.value(r)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-bold tabular-nums text-navy-950">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
