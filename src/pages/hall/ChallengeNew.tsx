import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { CHALLENGE_FORMATS, CHALLENGE_LEVELS, type Challenge, type ChallengeFormat, type ChallengeLevel, type Club } from '../../types';
import { api } from '../admin/api';
import { usePlayerSession } from '../player/session';

const pad = (value: number) => String(value).padStart(2, '0');

function tomorrowEvening(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T19:00`;
}

export default function ChallengeNew() {
  const { user, ready } = usePlayerSession();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [clubId, setClubId] = useState('');
  const [time, setTime] = useState(tomorrowEvening);
  const [venue, setVenue] = useState('');
  const [format, setFormat] = useState<ChallengeFormat>('full');
  const [level, setLevel] = useState<ChallengeLevel>('medium');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ clubs: Club[] }>('/api/player/clubs').then(({ clubs }) => {
      setClubs(clubs);
      if (clubs[0]) {
        setClubId(clubs[0].id);
        setVenue((current) => current || clubs[0].homeVenue);
      }
    });
  }, [user]);

  if (ready && !user) return <Navigate to="/player/login" replace />;
  if (!clubs) return null;

  if (clubs.length === 0) {
    return (
      <div className="mx-auto max-w-lg empty-state">
        你还不是任何球队的负责人。
        <Link to="/player/clubs" className="mt-3 block font-semibold text-gdut-700">
          先去创建球队 →
        </Link>
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const created = await api<Challenge>('/api/challenges', {
        method: 'POST',
        body: JSON.stringify({ clubId, time, venue, format, level, note }),
      });
      navigate(`/hall/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '发帖失败');
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="section-title">发约球帖</h1>
      <label className="block text-sm">
        <span className="text-slate-600">以哪支球队名义</span>
        <select value={clubId} onChange={(event) => setClubId(event.target.value)} className="field mt-1 w-full">
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">时间</span>
        <input type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} className="field mt-1 w-full" required />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">球场</span>
        <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="例如：东区篮球场 3 号场" maxLength={40} className="field mt-1 w-full" required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-slate-600">赛制</span>
          <select value={format} onChange={(event) => setFormat(event.target.value as ChallengeFormat)} className="field mt-1 w-full">
            {CHALLENGE_FORMATS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">水平</span>
          <select value={level} onChange={(event) => setLevel(event.target.value as ChallengeLevel)} className="field mt-1 w-full">
            {CHALLENGE_LEVELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-slate-600">备注（可选）</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={200}
          placeholder="场地费 AA、自带裁判、穿深色球衣……"
          className="field mt-1 w-full"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? '发布中…' : '发布'}
        </button>
        <Link to="/hall" className="btn-secondary">
          返回大厅
        </Link>
      </div>
    </form>
  );
}
