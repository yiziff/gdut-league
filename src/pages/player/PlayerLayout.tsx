import { Outlet } from 'react-router';
import { PlayerSessionProvider } from './session';

export default function PlayerLayout() {
  return (
    <PlayerSessionProvider>
      <Outlet />
    </PlayerSessionProvider>
  );
}
