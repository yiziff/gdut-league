import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { League, Match, Team } from '../types';
import { prepareSnapshot, type AppData } from './prepare';

interface DataContextValue {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

async function fetchData(): Promise<AppData> {
  const res = await fetch('/api/snapshot');
  if (!res.ok) throw new Error('加载失败');
  const snap = (await res.json()) as { leagues: League[]; teams: Team[]; matches: Match[] };
  return prepareSnapshot(snap.leagues, snap.teams, snap.matches);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setData(await fetchData());
      setError(null);
    } catch {
      setError('连不上数据服务，请确认已运行 npm run dev');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return <DataContext.Provider value={{ data, loading, error, reload }}>{children}</DataContext.Provider>;
}

export function useDataState(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('DataProvider 缺失');
  return value;
}

export function useData(): AppData {
  const { data } = useDataState();
  if (!data) throw new Error('数据还没加载');
  return data;
}

export function DataGate({ children }: { children: ReactNode }) {
  const { data, loading, error, reload } = useDataState();
  if (!data && loading) return <p className="py-20 text-center text-slate-400">加载中…</p>;
  if (!data) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">{error}</p>
        <button onClick={() => void reload()} className="mt-3 text-sm text-gdut-600 hover:underline">
          重试
        </button>
      </div>
    );
  }
  return children;
}
