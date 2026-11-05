import { useSearchParams } from 'react-router';
import { useLeague } from '../components/LeagueLayout';
import DivisionTabs from '../components/DivisionTabs';
import StandingsTable from '../components/StandingsTable';
import { SPORT_MAP } from '../sports';
import type { Division } from '../types';

export default function Standings() {
  const { league, tables, divisions } = useLeague();
  const meta = SPORT_MAP[league.sport];
  const [params, setParams] = useSearchParams();
  const requested = params.get('division') as Division | null;
  const division = requested && divisions.includes(requested) ? requested : divisions[0];
  if (!division) return <p className="py-12 text-center text-slate-400">还没有小组赛</p>;
  const visible = tables.filter((t) => t.division === division);

  return (
    <div>
      <DivisionTabs divisions={divisions} value={division} onChange={(d) => setParams({ division: d }, { replace: true })} />
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((t) => (
          <StandingsTable key={t.group} sport={league.sport} table={t} qualifiers={meta.qualifiers} />
        ))}
      </div>
      <div className="mt-6 rounded-xl bg-gdut-50 p-4 text-sm text-gdut-900">
        <p className="mb-1 font-semibold">积分规则</p>
        <p>{meta.ruleText}</p>
        <p className="mt-1 text-gdut-700">每组前 {meta.qualifiers} 名（深色序号）晋级淘汰赛。</p>
      </div>
    </div>
  );
}
