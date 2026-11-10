import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useData } from '../../data/store';
import { SPORT_MAP } from '../../sports';
import { api, ApiError } from '../admin/api';
import { usePlayerSession, type MePayload } from './session';

const fieldClass = 'field mt-1.5 w-full';

export default function PlayerJoin() {
  const { leagues, teamMap } = useData();
  const navigate = useNavigate();
  const { user, ready, setMe, select } = usePlayerSession();
  const [leagueId, setLeagueId] = useState(leagues[0]?.league.id ?? '');
  const [teamId, setTeamId] = useState('');
  const [className, setClassName] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [gender, setGender] = useState<'' | 'male' | 'female'>('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const leagueTeams = Object.values(teamMap).filter((team) => team.leagueId === leagueId);

  if (!ready) return <p className="py-10 text-center text-sm text-slate-400">加载中…</p>;
  if (!user) {
    return (
      <div className="empty-state mx-auto max-w-lg">
        先用手机号登录，再报名。{' '}
        <Link to="/player/login" className="font-medium text-gdut-700">
          去登录
        </Link>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await api<MePayload & { playerId: string }>('/api/player/join', {
        method: 'POST',
        body: JSON.stringify({ teamId, className, name, number, position, gender, height, weight }),
      });
      setMe(result);
      select(result.playerId);
      navigate('/player');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '报名失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="surface mx-auto max-w-xl space-y-4 p-5 sm:p-6">
      <div className="border-b border-slate-100 pb-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-player-600 uppercase">Player registration</p>
        <h1 className="page-title mt-1">球员报名</h1>
        <p className="mt-2 text-sm text-slate-500">名单里找不到自己时在这里报名。选择联赛和队伍，填写个人资料，报名后自动绑定到当前账号。</p>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        联赛
        <select value={leagueId} onChange={(event) => { setLeagueId(event.target.value); setTeamId(''); }} className={fieldClass}>
          {leagues.map(({ league }) => (
            <option key={league.id} value={league.id}>
              {SPORT_MAP[league.sport].name} · {league.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        队伍
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className={fieldClass} required>
          <option value="">请选择</option>
          {leagueTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      {leagueTeams.length === 0 && <p className="text-sm text-slate-400">这个联赛还没有队伍。</p>}
      <label className="block text-sm font-medium text-slate-700">
        班级
        <input value={className} onChange={(event) => setClassName(event.target.value)} className={fieldClass} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        姓名
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        号码
        <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" className={fieldClass} required />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        位置
        <input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="例如 控球后卫" className={fieldClass} />
      </label>
      <fieldset className="text-sm font-medium text-slate-700">
        <legend>性别</legend>
        <div className="mt-1 flex gap-2">
          {(['male', 'female'] as const).map((value) => (
            <label key={value} className={`flex-1 rounded-lg border px-3 py-2 text-center ${gender === value ? 'border-gdut-700 bg-gdut-700 text-white' : 'border-slate-200 bg-white'}`}>
              <input type="radio" name="gender" className="mr-1" checked={gender === value} onChange={() => setGender(value)} />
              {value === 'male' ? '男' : '女'}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-slate-700">
          身高 cm
          <input value={height} onChange={(event) => setHeight(event.target.value)} inputMode="decimal" className={fieldClass} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          体重 kg
          <input value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="decimal" className={fieldClass} />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending || !teamId} className="btn-primary w-full justify-center disabled:opacity-60">
        {pending ? '提交中…' : '报名'}
      </button>
      <Link to="/player/claim" className="block text-center text-sm font-medium text-gdut-700">
        名单里已经有我，去认领
      </Link>
    </form>
  );
}
