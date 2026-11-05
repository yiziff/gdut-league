import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../admin/api';
import { usePlayerSession, type PlayerProfile } from './session';

const fieldClass = 'mt-1 w-full rounded-lg border border-player-100 px-3 py-2 outline-none focus:border-player-500';

export default function PlayerMe() {
  const navigate = useNavigate();
  const { profile, ready, setProfile } = usePlayerSession();
  const [className, setClassName] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [gender, setGender] = useState<'' | 'male' | 'female'>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setClassName(profile.player.className);
    setName(profile.player.name);
    setNumber(profile.player.number);
    setPosition(profile.player.position);
    setGender(profile.player.gender);
    setHeight(profile.player.height);
    setWeight(profile.player.weight);
  }, [profile]);

  if (!ready) return <p className="py-10 text-center text-sm text-slate-400">加载中…</p>;
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white px-4 py-8 text-center">
        <p className="text-sm text-slate-500">登录后可以改自己的资料。</p>
        <Link to="/player/login" className="mt-3 inline-block rounded-lg bg-player-600 px-4 py-2 text-sm font-semibold text-white">
          球员登录
        </Link>
      </div>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setPending(true);
    try {
      const next = await api<PlayerProfile>('/api/player/me', {
        method: 'PATCH',
        body: JSON.stringify({ className, name, number, position, gender, height, weight }),
      });
      setProfile(next);
      setNotice('已保存。');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败');
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await api('/api/player/logout', { method: 'POST' });
    setProfile(null);
    navigate('/player/login');
  }

  return (
    <form onSubmit={(event) => void save(event)} className="mx-auto max-w-lg space-y-3 rounded-2xl bg-white p-4">
      <div>
        <h1 className="text-lg font-bold">{profile.player.name}</h1>
        <p className="text-sm text-slate-400">
          {profile.league.name} · {profile.team.name}
        </p>
      </div>
      <label className="block text-sm text-slate-600">
        班级
        <input value={className} onChange={(event) => setClassName(event.target.value)} className={fieldClass} required />
      </label>
      <label className="block text-sm text-slate-600">
        姓名
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} required />
      </label>
      <label className="block text-sm text-slate-600">
        号码
        <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" className={fieldClass} required />
      </label>
      <label className="block text-sm text-slate-600">
        位置
        <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="例如 控球后卫" className={fieldClass} />
      </label>
      <fieldset className="text-sm text-slate-600">
        <legend>性别</legend>
        <div className="mt-1 flex gap-2">
          {(['male', 'female'] as const).map((value) => (
            <label key={value} className={`flex-1 rounded-lg border px-3 py-2 text-center ${gender === value ? 'border-player-600 bg-player-50 text-player-700' : 'border-slate-200'}`}>
              <input type="radio" name="gender" className="mr-1" checked={gender === value} onChange={() => setGender(value)} />
              {value === 'male' ? '男' : '女'}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-slate-600">
          身高 cm
          <input value={height} onChange={(event) => setHeight(event.target.value)} inputMode="decimal" className={fieldClass} />
        </label>
        <label className="text-sm text-slate-600">
          体重 kg
          <input value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="decimal" className={fieldClass} />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-player-700">{notice}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-player-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? '保存中…' : '保存资料'}
      </button>
      <button type="button" onClick={() => void logout()} className="w-full text-sm text-slate-500">
        退出登录
      </button>
    </form>
  );
}
