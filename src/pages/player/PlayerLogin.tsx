import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../admin/api';
import { usePlayerSession, type MePayload } from './session';

export default function PlayerLogin() {
  const navigate = useNavigate();
  const { setMe } = usePlayerSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const registering = mode === 'register';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await api<MePayload & { created: boolean }> (registering ? '/api/player/register' : '/api/player/login', {
        method: 'POST',
        body: JSON.stringify(registering ? { phone, password, confirm } : { phone, password }),
      });
      setMe(result);
      navigate(result.accounts.length === 0 ? '/player/claim' : '/player');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : registering ? '注册失败' : '登录失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="surface mx-auto max-w-md overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-player-600 uppercase">Player center</p>
        <h1 className="mt-1 text-xl font-bold text-navy-950">{registering ? '设置密码' : '球员登录'}</h1>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-500">
          {registering
            ? '第一次使用就设一个密码，以后用手机号和密码登录。名单里登记了这个手机号的话，会自动绑定到你的账号。'
            : '用注册时的手机号和密码登录。还没有密码的话，先设置一个。'}
        </p>
        <label className="block text-sm font-medium text-slate-700">
          手机号
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="11 位手机号"
            className="field mt-1.5 w-full"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          密码
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            placeholder="至少 6 位"
            className="field mt-1.5 w-full"
            required
          />
        </label>
        {registering && (
          <label className="block text-sm font-medium text-slate-700">
            再输入一次
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              type="password"
              autoComplete="new-password"
              className="field mt-1.5 w-full"
              required
            />
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full justify-center disabled:opacity-60">
          {pending ? '提交中…' : registering ? '注册并登录' : '登录'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(registering ? 'login' : 'register');
            setError('');
            setConfirm('');
          }}
          className="w-full text-sm font-medium text-gdut-700"
        >
          {registering ? '已有密码，去登录' : '第一次使用，设置密码'}
        </button>
      </div>
    </form>
  );
}
