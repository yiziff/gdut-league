import { useSearchParams } from 'react-router';
import { useLeague } from '../components/LeagueLayout';
import FilterBar, { type Filter } from '../components/FilterBar';
import MatchCard from '../components/MatchCard';
import { DIVISION_LABEL, STAGE_LABEL } from '../sports';
import { dateOf, formatDate, todayString } from '../lib/format';
import type { Match } from '../types';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: '未开始' },
  { value: 'live', label: '进行中' },
  { value: 'finished', label: '已结束' },
];

export default function Schedule() {
  const { matches, divisions } = useLeague();
  const [params, setParams] = useSearchParams();
  const today = todayString();

  const filterDefs: { key: string; label: string; get: (m: Match) => string; format: (v: string) => string }[] = [
    { key: 'division', label: '组别', get: (m) => m.division, format: (v) => DIVISION_LABEL[v as Match['division']] },
    { key: 'stage', label: '阶段', get: (m) => m.stage, format: (v) => STAGE_LABEL[v as Match['stage']] },
    { key: 'date', label: '日期', get: (m) => dateOf(m.time), format: formatDate },
    { key: 'venue', label: '场地', get: (m) => m.venue, format: (v) => v },
  ];

  const filters: Filter[] = [
    ...filterDefs
      .filter((d) => d.key !== 'division' || divisions.length > 1)
      .map((d) => ({
        key: d.key,
        label: d.label,
        value: params.get(d.key) ?? '',
        options: [...new Set(matches.map(d.get))].map((v) => ({ value: v, label: d.format(v) })),
        onChange: (v: string) => update(d.key, v),
      })),
    {
      key: 'status',
      label: '状态',
      value: params.get('status') ?? '',
      options: STATUS_OPTIONS,
      onChange: (v: string) => update('status', v),
    },
  ];

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const active = [...filterDefs, { key: 'status', get: (m: Match) => m.status }];
  const visible = matches.filter((m) => active.every((d) => !params.get(d.key) || d.get(m) === params.get(d.key)));
  const byDate = new Map<string, Match[]>();
  for (const m of visible) byDate.set(dateOf(m.time), [...(byDate.get(dateOf(m.time)) ?? []), m]);
  const grouped = [...byDate.entries()];

  return (
    <div>
      <FilterBar filters={filters} />
      {grouped.length === 0 && <p className="py-12 text-center text-slate-400">没有符合条件的比赛</p>}
      <div className="space-y-8">
        {grouped.map(([date, list]) => (
          <section key={date} id={`d-${date}`}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
              {formatDate(date)}
              {date === today && <span className="rounded bg-gdut-700 px-1.5 py-0.5 text-xs text-white">今天</span>}
              <span className="font-normal text-slate-400">{list.length} 场</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
