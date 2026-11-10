import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { readAvatarFile } from '../../lib/logoFile';
import { api, ApiError } from '../admin/api';
import { AccountSwitcher, NeedProfile } from './AccountSwitcher';
import { usePlayerSession, type MePayload } from './session';

const fieldClass = 'field mt-1.5 w-full';

export default function PlayerMe() {
  const navigate = useNavigate();
  const { user, profile, ready, setMe } = usePlayerSession();
  const [school, setSchool] = useState('');
  const [college, setCollege] = useState('');
  const [className, setClassName] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [gender, setGender] = useState<'' | 'male' | 'female'>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSchool(profile.player.school);
    setCollege(profile.player.college);
    setClassName(profile.player.className);
    setName(profile.player.name);
    setNumber(profile.player.number);
    setPosition(profile.player.position);
    setGender(profile.player.gender);
    setHeight(profile.player.height);
    setWeight(profile.player.weight);
    setAvatar(profile.player.avatar ?? '');
  }, [profile]);

  if (!ready) return <p className="py-10 text-center text-sm text-slate-400">加载中…</p>;
  if (!user) {
    return (
      <div className="surface mx-auto max-w-lg px-4 py-8 text-center">
        <p className="text-sm text-slate-500">登录后可以改自己的资料。</p>
        <Link to="/player/login" className="btn-primary mt-4 inline-flex">
          球员登录
        </Link>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <NeedProfile action="可以改自己的资料" />
        <button type="button" onClick={() => void logout()} className="w-full py-1 text-sm font-medium text-slate-400 hover:text-red-600">
          退出登录{user.phone ? `（${user.phone}）` : ''}
        </button>
      </div>
    );
  }
  const current = profile;

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setPending(true);
    try {
      const next = await api<MePayload>('/api/player/me', {
        method: 'PATCH',
        body: JSON.stringify({ playerId: current.player.id, school, college, className, name, number, position, gender, height, weight, avatar }),
      });
      setMe(next);
      setNotice('已保存。姓名、学校和身体数据会同步到你名下所有队伍。');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败');
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await api('/api/player/logout', { method: 'POST' });
    setMe(null);
    navigate('/player/login');
  }

  async function unclaim() {
    if (!window.confirm(`解绑「${current.team.name}」的 ${current.player.number} 号？解绑后这个名单可以被别人认领。`)) return;
    setError('');
    setNotice('');
    try {
      setMe(await api<MePayload>(`/api/player/claim/${current.player.id}`, { method: 'DELETE' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '解绑失败');
    }
  }

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      setAvatar(await readAvatarFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像无法读取');
    }
  }

  const place = [school, college].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-2xl">
    <AccountSwitcher />
    <form onSubmit={(event) => void save(event)} className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[#f3d7c2] bg-white shadow-[0_22px_44px_-30px_rgb(196_92_36_/_50%)]">
      <div className="bg-[linear-gradient(145deg,#fff8f2_0%,#ffe7d0_100%)] px-6 pt-7 pb-16 sm:px-8">
        <p className="text-[11px] font-bold tracking-[0.18em] text-[#c45c22] uppercase">Player profile</p>
        <p className="mt-2 text-sm text-[#9a3e14]">{profile.league.name} · {profile.team.name}</p>
      </div>

      <div className="px-6 sm:px-8">
        <div className="-mt-12 flex items-end gap-5">
          <label className="relative shrink-0 cursor-pointer">
            {avatar ? (
              <img src={avatar} alt="" className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md" />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-[#e07c40] text-3xl font-bold text-white shadow-md">
                {name.slice(0, 1) || '球'}
              </span>
            )}
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#c45c22] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">更换</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => void pickAvatar(event.target.files?.[0])}
            />
          </label>
          <div className="min-w-0 pb-3">
            <h1 className="truncate text-2xl font-bold tracking-tight text-navy-950">{name || '未填写姓名'}</h1>
            <p className="mt-0.5 truncate text-sm text-slate-500">{place || '填写学校和学院'}</p>
          </div>
        </div>
        {avatar ? (
          <button type="button" onClick={() => setAvatar('')} className="mt-2 text-xs font-medium text-slate-400 hover:text-[#c45c22]">
            移除头像
          </button>
        ) : null}
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <section>
          <h2 className="text-sm font-semibold text-navy-950">就读</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              学校
              <input value={school} onChange={(event) => setSchool(event.target.value)} placeholder="例如 广东工业大学" className={fieldClass} required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              学院
              <input value={college} onChange={(event) => setCollege(event.target.value)} placeholder="例如 建筑与城市规划学院" className={fieldClass} required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              班级
              <input value={className} onChange={(event) => setClassName(event.target.value)} className={fieldClass} required />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-navy-950">场上</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              姓名
              <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              号码
              <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" className={fieldClass} required />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              位置
              <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="例如 控球后卫" className={fieldClass} />
            </label>
          </div>
          <fieldset className="mt-3 text-sm font-medium text-slate-700">
            <legend>性别</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(['male', 'female'] as const).map((value) => (
                <label key={value} className={`rounded-xl border px-3 py-2.5 text-center ${gender === value ? 'border-[#c45c22] bg-[#c45c22] text-white' : 'border-[#f0d2b8] bg-[#fff8f2] text-[#9a3e14]'}`}>
                  <input type="radio" name="gender" className="mr-1.5 accent-white" checked={gender === value} onChange={() => setGender(value)} />
                  {value === 'male' ? '男' : '女'}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-navy-950">身体数据</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-slate-700">
              身高 cm
              <input value={height} onChange={(event) => setHeight(event.target.value)} inputMode="decimal" className={fieldClass} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              体重 kg
              <input value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="decimal" className={fieldClass} />
            </label>
          </div>
        </section>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full justify-center disabled:opacity-60">
          {pending ? '保存中…' : '保存资料'}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-400">账号 {user.phone || '微信登录'}</span>
          <div className="flex gap-4">
            <Link to="/player/claim" className="font-medium text-gdut-700">
              认领更多名单
            </Link>
            <button type="button" onClick={() => void unclaim()} className="font-medium text-slate-400 hover:text-red-600">
              解绑这个名单
            </button>
            <button type="button" onClick={() => void logout()} className="font-medium text-slate-400 hover:text-red-600">
              退出登录
            </button>
          </div>
        </div>
      </div>
    </form>
    <PasswordCard hasPassword={user.hasPassword} />
    </div>
  );
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setPending(true);
    try {
      await api('/api/player/password', { method: 'POST', body: JSON.stringify({ oldPassword, password, confirm }) });
      setOldPassword('');
      setPassword('');
      setConfirm('');
      setNotice('密码已更新');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto mt-4 max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-navy-950">{hasPassword ? '修改密码' : '设置密码'}</h2>
      {hasPassword && (
        <input value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="原密码" className={fieldClass} required />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="新密码，至少 6 位" className={fieldClass} required />
        <input value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" autoComplete="new-password" placeholder="再输入一次" className={fieldClass} required />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? '保存中…' : '保存密码'}
      </button>
    </form>
  );
}
