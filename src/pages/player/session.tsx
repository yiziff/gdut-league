import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { League, Player } from '../../types';
import { api } from '../admin/api';

export interface PlayerProfile {
  player: Player;
  team: { id: string; name: string; short: string; leagueId: string; color: string };
  league: League;
}

interface SessionValue {
  profile: PlayerProfile | null;
  ready: boolean;
  refresh: () => Promise<void>;
  setProfile: (profile: PlayerProfile | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function PlayerSessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    try {
      setProfile(await api<PlayerProfile>('/api/player/me'));
    } catch {
      setProfile(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return <SessionContext.Provider value={{ profile, ready, refresh, setProfile }}>{children}</SessionContext.Provider>;
}

export function usePlayerSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('球员登录状态缺失');
  return value;
}
