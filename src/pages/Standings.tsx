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
  if (!division) return <div className="empty-state">还没有小组赛</div>;
  const visible = tables.filter((t) => t.division === division);

  return (
    <div>
      <DivisionTabs divisions={divisions} value={division} onChange={(d) => setParams({ division: d }, { replace: true })} />
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((t) => (
          <StandingsTable key={t.group} sport={league.sport} table={t} qualifiers={meta.qualifiers} />
        ))}
      </div>
      <div className="surface mt-6 border-l-2 border-l-gdut-600 p-5 text-sm text-slate-600">
        <p className="mb-2 font-semibold text-navy-950">积分规则</p>
        <p className="leading-6">{meta.ruleText}</p>
        <p className="mt-2 text-gdut-700">每组前 {meta.qualifiers} 名晋级淘汰赛，表格中以强调色标记。</p>
      </div>
    </div>
  );
}
