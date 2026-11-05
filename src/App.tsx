import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import LeagueLayout from './components/LeagueLayout';
import Home from './pages/Home';
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
import PlayerHome from './pages/player/PlayerHome';
import PlayerJoin from './pages/player/PlayerJoin';
import PlayerLayout from './pages/player/PlayerLayout';
import PlayerLogin from './pages/player/PlayerLogin';
import PlayerMatches from './pages/player/PlayerMatches';
import PlayerMe from './pages/player/PlayerMe';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="player" element={<PlayerLayout />}>
        <Route index element={<PlayerHome />} />
        <Route path="login" element={<PlayerLogin />} />
        <Route path="join" element={<PlayerJoin />} />
        <Route path="matches" element={<PlayerMatches />} />
        <Route path="career" element={<PlayerCareer />} />
        <Route path="me" element={<PlayerMe />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamDetail />} />
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
