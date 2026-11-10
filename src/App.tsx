import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import LeagueLayout from './components/LeagueLayout';
import Home from './pages/Home';
import Events from './pages/Events';
import SportLeagues from './pages/SportLeagues';
import Schedule from './pages/Schedule';
import MatchDetail from './pages/MatchDetail';
import Standings from './pages/Standings';
import Bracket from './pages/Bracket';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import AdminHome from './pages/admin/AdminHome';
import LeagueAdmin from './pages/admin/LeagueAdmin';
import PlayerCareer from './pages/player/PlayerCareer';
import PlayerClaim from './pages/player/PlayerClaim';
import PlayerHome from './pages/player/PlayerHome';
import PlayerJoin from './pages/player/PlayerJoin';
import PlayerLayout from './pages/player/PlayerLayout';
import PlayerLogin from './pages/player/PlayerLogin';
import PlayerMatches from './pages/player/PlayerMatches';
import PlayerMe from './pages/player/PlayerMe';
import PlayerClubs from './pages/player/PlayerClubs';
import ClubDetail from './pages/clubs/ClubDetail';
import Hall from './pages/hall/Hall';
import ChallengeNew from './pages/hall/ChallengeNew';
import ChallengeDetail from './pages/hall/ChallengeDetail';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="events" element={<Events />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamDetail />} />
        <Route path="player" element={<PlayerLayout />}>
          <Route index element={<PlayerHome />} />
          <Route path="login" element={<PlayerLogin />} />
          <Route path="join" element={<PlayerJoin />} />
          <Route path="claim" element={<PlayerClaim />} />
          <Route path="matches" element={<PlayerMatches />} />
          <Route path="career" element={<PlayerCareer />} />
          <Route path="me" element={<PlayerMe />} />
          <Route path="clubs" element={<PlayerClubs />} />
        </Route>
        <Route element={<PlayerLayout />}>
          <Route path="hall" element={<Hall />} />
          <Route path="hall/new" element={<ChallengeNew />} />
          <Route path="hall/:id" element={<ChallengeDetail />} />
          <Route path="clubs/:id" element={<ClubDetail />} />
        </Route>
        <Route path="admin" element={<AdminHome />} />
        <Route path="admin/leagues/:leagueId" element={<LeagueAdmin />} />
        <Route path=":sport" element={<SportLeagues />} />
        <Route path=":sport/:leagueId" element={<LeagueLayout />}>
          <Route index element={<Navigate to="schedule" replace />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="matches/:matchId" element={<MatchDetail />} />
          <Route path="standings" element={<Standings />} />
          <Route path="bracket" element={<Bracket />} />
          <Route path="bracket/:division" element={<Bracket />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
