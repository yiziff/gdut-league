import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Sport } from '../../types';
import { SPORT_MAP } from '../../sports';
import { api, ApiError } from '../admin/api';
import { usePlayerSession, type PlayerProfile } from './session';

interface Choice {
  playerId: string;
  teamName: string;
  leagueName: string;
  sport: Sport;
}

export default function PlayerLogin() {
  const navigate = useNavigate();
  const { setProfile } = usePlayerSession();
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [pending, setPending] = useState(false);

  async function login(playerId?: string) {
    setError('');
    setPending(true);
    try {
      const result = await api<{ status: 'ok'; player: PlayerProfile['player']; team: PlayerProfile['team']; league: PlayerProfile['league'] } | { status: 'choose'; choices: Choice[] }>(
        '/api/player/login',
        { method: 'POST', body: JSON.stringify({ name, number, playerId }) },
      );
      if (result.status === 'choose') {
        setChoices(result.choices);
        return;
      }
      setProfile({ player: result.player, team: result.team, league: result.league });
      navigate('/player');
    } catch (err) {
      setChoices([]);
      setError(err instanceof ApiError ? err.message : '登录失败');
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void login();
  }

  return (
    <form onSubmit={submit} className="surface mx-auto max-w-md overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-player-600 uppercase">Player center</p>
        <h1 className="mt-1 text-xl font-bold text-navy-950">球员登录</h1>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-500">用报名时的姓名和号码登录。还没有名单的话，先去报名。</p>
        <label className="block text-sm font-medium text-slate-700">
          姓名
          <input value={name} onChange={(event) => setName(event.target.value)} className="field mt-1.5 w-full" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          号码
          <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" className="field mt-1.5 w-full" required />
        </label>
        {error && (
          <p className="text-sm text-red-600">
            {error}
            {error.includes('报名') && (
              <>
                {' '}
                <Link to="/player/join" className="font-medium text-gdut-700 underline">
                  去报名
                </Link>
              </>
            )}
          </p>
        )}
        {choices.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">有多名队员使用这个姓名和号码，请选择一支队伍。</p>
            {choices.map((choice) => (
              <button
                key={choice.playerId}
                type="button"
                disabled={pending}
                onClick={() => void login(choice.playerId)}
                className="surface-interactive block w-full px-3 py-2.5 text-left text-sm"
              >
                <span className="font-medium">{choice.teamName}</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {SPORT_MAP[choice.sport].name} · {choice.leagueName}
                </span>
              </button>
            ))}
          </div>
        )}
        <button type="submit" disabled={pending} className="btn-primary w-full justify-center disabled:opacity-60">
          {pending ? '登录中…' : '登录'}
        </button>
        <Link to="/player/join" className="block text-center text-sm font-medium text-gdut-700">
          我还没报名
        </Link>
      </div>
    </form>
  );
}
