import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useData } from '../../data/store';
import { SPORT_MAP } from '../../sports';
import { api, ApiError } from '../admin/api';
import { usePlayerSession, type PlayerProfile } from './session';

const fieldClass = 'mt-1 w-full rounded-lg border border-player-100 px-3 py-2 outline-none focus:border-player-500';

export default function PlayerJoin() {
  const { leagues, teamMap } = useData();
  const navigate = useNavigate();
  const { setProfile } = usePlayerSession();
  const [leagueId, setLeagueId] = useState(leagues[0]?.league.id ?? '');
  const [teamId, setTeamId] = useState('');
  const [className, setClassName] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [gender, setGender] = useState<'' | 'male' | 'female'>('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const leagueTeams = Object.values(teamMap).filter((team) => team.leagueId === leagueId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await api<PlayerProfile & { status: 'ok' }>('/api/player/join', {
        method: 'POST',
        body: JSON.stringify({ teamId, className, name, number, position, gender, height, weight }),
      });
      setProfile({ player: result.player, team: result.team, league: result.league });
      navigate('/player');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '报名失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto max-w-lg space-y-3 rounded-2xl border border-player-100 bg-white p-5">
      <div>
        <h1 className="text-lg font-bold">报名</h1>
        <p className="mt-1 text-sm text-slate-500">选择联赛和队伍，填写班级、姓名和号码。提交后会直接登录。</p>
      </div>
      <label className="block text-sm text-slate-600">
        联赛
        <select value={leagueId} onChange={(event) => { setLeagueId(event.target.value); setTeamId(''); }} className={fieldClass}>
          {leagues.map(({ league }) => (
            <option key={league.id} value={league.id}>
              {SPORT_MAP[league.sport].name} · {league.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-600">
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
      <button type="submit" disabled={pending || !teamId} className="w-full rounded-lg bg-player-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? '提交中…' : '报名并登录'}
      </button>
      <Link to="/player/login" className="block text-center text-sm text-player-700">
        已有名单，去登录
      </Link>
    </form>
  );
}
