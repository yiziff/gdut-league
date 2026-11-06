import type { MatchStatus } from '../types';

const STYLE: Record<MatchStatus, string> = {
  scheduled: 'border-slate-200 bg-white text-slate-500',
  live: 'border-red-200 bg-red-50 text-red-700',
  finished: 'border-gdut-100 bg-gdut-50 text-gdut-800',
};

const LABEL: Record<MatchStatus, string> = {
  scheduled: '未开始',
  live: '进行中',
  finished: '已结束',
};

export default function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold ${STYLE[status]}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
      {LABEL[status]}
    </span>
  );
}
