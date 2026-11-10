import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { League, Player } from '../../types';
import { api } from '../admin/api';

/** 一个名单条目：某支队伍里的这名球员。 */
export interface PlayerProfile {
  player: Player;
  team: { id: string; name: string; short: string; leagueId: string; color: string };
  league: League;
}

export interface PlayerUser {
  id: string;
  /** 已打码；微信登录还没绑手机号时为空 */
  phone: string;
  name: string;
  hasPassword: boolean;
}

export interface MePayload {
  user: PlayerUser;
  accounts: PlayerProfile[];
}

interface SessionValue {
  user: PlayerUser | null;
  /** 本人名下所有名单条目 */
  accounts: PlayerProfile[];
  /** 当前查看的名单条目；登录了但还没认领时为 null */
  profile: PlayerProfile | null;
  ready: boolean;
  refresh: () => Promise<void>;
  setMe: (me: MePayload | null) => void;
  select: (playerId: string) => void;
}

const CURRENT_KEY = 'gdut_player_current';
const SessionContext = createContext<SessionValue | null>(null);

export function PlayerSessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MePayload | null>(null);
  const [current, setCurrent] = useState(() => localStorage.getItem(CURRENT_KEY) ?? '');
  const [ready, setReady] = useState(false);

  async function refresh() {
    try {
      setMe(await api<MePayload>('/api/player/me'));
    } catch {
      setMe(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function select(playerId: string) {
    localStorage.setItem(CURRENT_KEY, playerId);
    setCurrent(playerId);
  }

  const accounts = me?.accounts ?? [];
  const profile = accounts.find((account) => account.player.id === current) ?? accounts[0] ?? null;

  return (
    <SessionContext.Provider value={{ user: me?.user ?? null, accounts, profile, ready, refresh, setMe, select }}>
      {children}
    </SessionContext.Provider>
  );
}

export function usePlayerSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('球员登录状态缺失');
  return value;
}
