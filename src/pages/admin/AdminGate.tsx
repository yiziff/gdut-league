import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from './api';

const AdminActor = createContext('');

export function useAdminActor(): string {
  return useContext(AdminActor);
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out' | 'need-name'>('loading');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ name: string }>('/api/admin/me')
      .then((me) => {
        setName(me.name);
        setState(me.name ? 'in' : 'need-name');
      })
      .catch(() => setState('out'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ name, password }) });
      setState('in');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败');
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const me = await api<{ name: string }>('/api/admin/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      setName(me.name);
      setState('in');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '没有记下名字');
    }
  }

  if (state === 'loading') return <p className="py-20 text-center text-slate-400">正在确认登录…</p>;
  if (state === 'in') return <AdminActor.Provider value={name}>{children}</AdminActor.Provider>;

  const naming = state === 'need-name';
  return (
    <form onSubmit={(event) => void (naming ? saveName(event) : submit(event))} className="surface mx-auto mt-10 max-w-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="eyebrow">Operations</p>
        <h1 className="mt-1 text-xl font-bold text-navy-950">{naming ? '写下你的名字' : '管理员登录'}</h1>
      </div>
      <div className="p-6">
        <p className="text-sm text-slate-500">
          {naming
            ? '这个名字会记在你创建的联赛上。联赛上线之后，仍然由你修改联赛资料。'
            : '密码在服务器的 .env 文件里，变量名 ADMIN_PASSWORD。没改过的话是 admin。'}
        </p>
        <label className="mt-5 block text-sm font-medium text-slate-700">
          姓名
          <input value={name} onChange={(event) => setName(event.target.value)} className="field mt-1.5 w-full" autoFocus required />
        </label>
        {!naming && (
          <label className="mt-4 block text-sm font-medium text-slate-700">
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-1.5 w-full" />
          </label>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary mt-5 w-full justify-center">
          {naming ? '继续' : '登录'}
        </button>
      </div>
    </form>
  );
}
