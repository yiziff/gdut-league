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
    <form onSubmit={submit} className="mx-auto max-w-md overflow-hidden rounded-2xl border border-player-100 bg-white shadow-sm">
      <div className="bg-player-600 px-5 py-5 text-white">
        <p className="text-xs text-player-100">球员端</p>
        <h1 className="text-xl font-bold">球员登录</h1>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm text-slate-500">用报名时的姓名和号码登录。还没有名单的话，先去报名。</p>
        <label className="block text-sm text-slate-600">
          姓名
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-player-100 px-3 py-2 outline-none focus:border-player-500" required />
        </label>
        <label className="block text-sm text-slate-600">
          号码
          <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-player-100 px-3 py-2 outline-none focus:border-player-500" required />
        </label>
        {error && (
          <p className="text-sm text-red-600">
            {error}
            {error.includes('报名') && (
              <>
                {' '}
                <Link to="/player/join" className="font-medium text-player-700 underline">
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
                className="block w-full rounded-lg border border-player-100 px-3 py-2 text-left text-sm"
              >
                <span className="font-medium">{choice.teamName}</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {SPORT_MAP[choice.sport].name} · {choice.leagueName}
                </span>
              </button>
            ))}
          </div>
        )}
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-player-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? '登录中…' : '登录'}
        </button>
        <Link to="/player/join" className="block text-center text-sm text-player-700">
          我还没报名
        </Link>
      </div>
    </form>
  );
}
