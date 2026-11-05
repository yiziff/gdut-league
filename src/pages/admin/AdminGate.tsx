import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from './api';

export default function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/me')
      .then(() => setState('in'))
      .catch(() => setState('out'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      setState('in');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败');
    }
  }

  if (state === 'loading') return <p className="py-20 text-center text-slate-400">正在确认登录…</p>;
  if (state === 'in') return children;

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto mt-10 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">管理端登录</h1>
      <p className="mt-1 text-sm text-slate-500">密码在服务器的 .env 文件里，变量名 ADMIN_PASSWORD。没改过的话是 admin。</p>
      <label className="mt-4 block text-sm text-slate-600">
        密码
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          autoFocus
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="submit" className="mt-4 w-full rounded-lg bg-gdut-700 py-2 text-sm font-semibold text-white">
        登录
      </button>
    </form>
  );
}
