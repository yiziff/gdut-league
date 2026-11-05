import { Navigate, useNavigate, useParams } from 'react-router';
import { useLeague } from '../components/LeagueLayout';
import BracketView from '../components/BracketView';
import DivisionTabs from '../components/DivisionTabs';
import { buildBracket } from '../lib/bracket';
import type { Division } from '../types';

export default function Bracket() {
  const { league, matches, divisions } = useLeague();
  const navigate = useNavigate();
  const { division } = useParams();

  if (divisions.length === 0) return <div className="empty-state">还没有比赛</div>;
  if (!division || !divisions.includes(division as Division)) {
    return <Navigate to={`/${league.sport}/${league.id}/bracket/${divisions[0]}`} replace />;
  }

  const inDivision = matches.filter((m) => m.division === division);
  return (
    <div>
      <DivisionTabs
        divisions={divisions}
        value={division as Division}
        onChange={(d) => navigate(`/${league.sport}/${league.id}/bracket/${d}`, { replace: true })}
      />
      <BracketView bracket={buildBracket(inDivision)} all={inDivision} />
    </div>
  );
}
