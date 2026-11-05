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
    <form onSubmit={(event) => void submit(event)} className="surface mx-auto mt-10 max-w-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="eyebrow">Operations</p>
        <h1 className="mt-1 text-xl font-bold text-navy-950">管理员登录</h1>
      </div>
      <div className="p-6">
        <p className="text-sm text-slate-500">密码在服务器的 .env 文件里，变量名 ADMIN_PASSWORD。没改过的话是 admin。</p>
        <label className="mt-5 block text-sm font-medium text-slate-700">
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1.5 w-full"
            autoFocus
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary mt-5 w-full justify-center">
          登录
        </button>
      </div>
    </form>
  );
}
