import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import type { ClubBrief } from '../types';
import { api } from '../pages/admin/api';
import { ClubBadge, whenLabel } from '../pages/hall/shared';

interface ChallengeNotice {
  id: string;
  challengeId: string;
  time: string;
  venue: string;
  club: ClubBrief;
}

export default function ChallengeAlert() {
  const navigate = useNavigate();
  const [notices, setNotices] = useState<ChallengeNotice[]>([]);
  const holding = useRef(false);

  const load = useCallback(() => {
    if (holding.current || document.visibilityState === 'hidden') return;
    api<ChallengeNotice[]>('/api/player/notices')
      .then((list) => {
        if (!holding.current) setNotices(list);
      })
      .catch(() => {
        if (!holding.current) setNotices([]);
      });
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [load]);

  const dismiss = useCallback(
    (to?: string) => {
      const ids = notices.map((item) => item.id);
      holding.current = true;
      setNotices([]);
      void api('/api/player/notices/seen', { method: 'POST', body: JSON.stringify({ ids }) })
        .catch(() => undefined)
        .finally(() => {
          holding.current = false;
        });
      if (to) navigate(to);
    },
    [navigate, notices],
  );

  useEffect(() => {
    if (notices.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss, notices.length]);

  if (notices.length === 0) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/45 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="challenge-alert-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-bold tracking-[0.14em] text-gdut-700 uppercase">约球提醒</p>
        <h2 id="challenge-alert-title" className="mt-1 text-xl font-bold text-navy-950">
          有球队来迎战
        </h2>
        <ul className="mt-4 space-y-2">
          {notices.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => dismiss(`/hall/${item.challengeId}`)}
                className="flex w-full flex-col gap-1 rounded-xl border border-slate-200 px-3 py-3 text-left hover:border-gdut-400 hover:bg-orange-50"
              >
                <ClubBadge club={item.club} link={false} />
                <span className="pl-10 text-sm text-slate-500">
                  {whenLabel(item.time)} · {item.venue}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => dismiss()} className="btn-secondary">
            知道了
          </button>
          <button type="button" onClick={() => dismiss(`/hall/${notices[0].challengeId}`)} className="btn-primary">
            去确认
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
