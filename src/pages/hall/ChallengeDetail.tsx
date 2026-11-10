import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useDataState } from '../../data/store';
import type { Challenge, ChallengeResponse, Club, ClubManager, Match, Team } from '../../types';
import { api } from '../admin/api';
import { usePlayerSession } from '../player/session';
import { ClubBadge, formatLabel, levelLabel, RESPONSE_LABEL, STATUS_LABEL, whenLabel } from './shared';

interface Detail {
  challenge: Challenge;
  isPoster: boolean;
  isParty: boolean;
  respondClubs: Club[];
  responses: ChallengeResponse[];
  contacts: { club: string; managers: ClubManager[] }[];
  match: Match | null;
  teams: Team[];
  canScore: boolean;
}

export default function ChallengeDetail() {
  const { id = '' } = useParams();
  const { user } = usePlayerSession();
  const { reload: reloadData } = useDataState();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    () =>
      api<Detail>(`/api/challenges/${id}`)
        .then(setDetail)
        .catch((err) => setError(err instanceof Error ? err.message : '加载失败')),
    [id],
  );

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  const act = async (path: string, init: RequestInit, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError('');
    try {
      await api(path, init);
      await refresh();
      void reloadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return error ? <div className="empty-state">{error}</div> : null;
  const { challenge, isPoster, isParty, responses, match, teams } = detail;
  const open = challenge.status === 'open';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/hall" className="text-sm text-slate-500 hover:text-gdut-700">
        ← 约球大厅
      </Link>

      <section className="league-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ClubBadge club={challenge.club} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{STATUS_LABEL[challenge.status]}</span>
        </div>
        <p className="mt-5 text-2xl font-bold text-navy-950">{whenLabel(challenge.time)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {challenge.venue} · {formatLabel(challenge.format)} · {levelLabel(challenge.level)}
        </p>
        {challenge.note && <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{challenge.note}</p>}
        {challenge.opponent && (
          <div className="mt-5 flex items-center gap-3 border-t border-neutral-200 pt-4 text-sm">
            <span className="text-slate-500">对手</span>
            <ClubBadge club={challenge.opponent} />
          </div>
        )}
        {(isPoster || isParty) && (open || challenge.status === 'matched') && match?.status !== 'finished' && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(`/api/challenges/${id}/cancel`, { method: 'POST' }, challenge.status === 'matched' ? '取消后生成的比赛也会删除，确定吗？' : '确定取消这个约球帖吗？')
            }
            className="btn-danger mt-5 self-start"
          >
            {challenge.status === 'matched' ? '取消约战' : '取消约球帖'}
          </button>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {challenge.status === 'matched' && match && (
        <MatchPanel detail={detail} match={match} teams={teams} onChange={() => void refresh().then(reloadData)} />
      )}

      {isPoster ? (
        <section className="space-y-3">
          <h2 className="section-title">迎战的球队</h2>
          {responses.length === 0 && <div className="empty-state">还没有球队迎战</div>}
          {responses.map((response) => (
            <div key={response.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <ClubBadge club={response.club} />
                {response.message && <p className="mt-2 text-sm text-slate-600">{response.message}</p>}
              </div>
              {open && response.status === 'pending' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      `/api/challenges/${id}/responses/${response.id}/accept`,
                      { method: 'POST' },
                      `确认和「${response.club.name}」打这场吗？确认后会生成一场友谊赛，其他迎战自动谢绝。`,
                    )
                  }
                  className="btn-primary"
                >
                  确认对手
                </button>
              ) : (
                <span className="text-xs text-slate-500">{RESPONSE_LABEL[response.status]}</span>
              )}
            </div>
          ))}
        </section>
      ) : (
        <RespondPanel detail={detail} busy={busy} act={act} loggedIn={Boolean(user)} />
      )}
    </div>
  );
}

function RespondPanel({
  detail,
  busy,
  act,
  loggedIn,
}: {
  detail: Detail;
  busy: boolean;
  act: (path: string, init: RequestInit, confirmText?: string) => Promise<void>;
  loggedIn: boolean;
}) {
  const { challenge, respondClubs, responses } = detail;
  const responded = new Set(responses.filter((item) => item.status !== 'withdrawn').map((item) => item.club.id));
  const available = respondClubs.filter((club) => !responded.has(club.id));
  const [clubId, setClubId] = useState('');
  const [message, setMessage] = useState('');
  const chosen = available.some((club) => club.id === clubId) ? clubId : (available[0]?.id ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void act(`/api/challenges/${challenge.id}/responses`, { method: 'POST', body: JSON.stringify({ clubId: chosen, message }) }).then(() =>
      setMessage(''),
    );
  };

  return (
    <section className="space-y-3">
      {responses.map((response) => (
        <div key={response.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <span>
            你以「{response.club.name}」迎战 · <span className="text-slate-500">{RESPONSE_LABEL[response.status]}</span>
          </span>
          {response.status === 'pending' && challenge.status === 'open' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(`/api/challenges/${challenge.id}/responses/${response.id}`, { method: 'DELETE' }, '撤回这次迎战？')}
              className="btn-secondary"
            >
              撤回
            </button>
          )}
        </div>
      ))}

      {challenge.status === 'open' &&
        (!loggedIn ? (
          <div className="empty-state">
            <Link to="/player/login" className="font-semibold text-gdut-700">
              登录
            </Link>
            后，以你负责的球队迎战
          </div>
        ) : respondClubs.length === 0 ? (
          <div className="empty-state">
            只有球队负责人可以迎战。
            <Link to="/player/clubs" className="ml-1 font-semibold text-gdut-700">
              创建或加入球队 →
            </Link>
          </div>
        ) : available.length > 0 ? (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="section-title">迎战</h2>
            <select value={chosen} onChange={(event) => setClubId(event.target.value)} className="field w-full">
              {available.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={100}
              placeholder="给对方留句话（可选）：我们 8 个人，水平中等"
              className="field w-full"
            />
            <button type="submit" disabled={busy || !chosen} className="btn-primary">
              迎战
            </button>
          </form>
        ) : null)}
    </section>
  );
}

function MatchPanel({ detail, match, teams, onChange }: { detail: Detail; match: Match; teams: Team[]; onChange: () => void }) {
  const home = teams.find((team) => team.id === match.home);
  const away = teams.find((team) => team.id === match.away);
  const finished = match.status === 'finished' && match.score;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">比赛</h2>
        <Link to={`/basketball/${match.leagueId}/matches/${match.id}`} className="text-sm font-semibold text-gdut-700">
          查看比赛页 →
        </Link>
      </div>
      <p className="text-lg font-bold text-navy-950">
        {home?.name} {finished ? `${match.score!.home} : ${match.score!.away}` : 'vs'} {away?.name}
      </p>

      {detail.contacts.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-700">对方联系方式</p>
          {detail.contacts.map((contact) => (
            <div key={contact.club} className="mt-2">
              <span className="text-slate-500">{contact.club}：</span>
              {contact.managers.map((manager) => (
                <a key={manager.userId} href={`tel:${manager.phone}`} className="mr-3 text-gdut-700">
                  {manager.name} {manager.phone}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}

      {detail.canScore ? (
        <ScoreForm match={match} homeName={home?.name ?? '主队'} awayName={away?.name ?? '客队'} onSaved={onChange} />
      ) : (
        detail.isParty && !finished && <p className="text-xs text-slate-400">比分由两边队长填写，填上之后这场约球就记为结束。</p>
      )}
    </section>
  );
}

function ScoreForm({ match, homeName, awayName, onSaved }: { match: Match; homeName: string; awayName: string; onSaved: () => void }) {
  const [home, setHome] = useState(match.score ? String(match.score.home) : '');
  const [away, setAway] = useState(match.score ? String(match.score.away) : '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setHome(match.score ? String(match.score.home) : '');
    setAway(match.score ? String(match.score.away) : '');
  }, [match.score]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await api(`/api/clubs/matches/${match.id}/score`, { method: 'POST', body: JSON.stringify({ home: Number(home), away: Number(away) }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <h3 className="text-sm font-medium text-navy-950">最终比分</h3>
      <p className="text-xs text-slate-400">两边队长都可以填。填上之后这场约球就记为结束，另一边队长也可以改。</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-slate-600">{homeName}</span>
          <input value={home} onChange={(event) => setHome(event.target.value)} inputMode="numeric" required className="field mt-1 w-24" />
        </label>
        <span className="pb-2 text-slate-400">:</span>
        <label className="text-sm">
          <span className="text-slate-600">{awayName}</span>
          <input value={away} onChange={(event) => setAway(event.target.value)} inputMode="numeric" required className="field mt-1 w-24" />
        </label>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? '保存中…' : match.status === 'finished' ? '更新比分' : '记为结束'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
