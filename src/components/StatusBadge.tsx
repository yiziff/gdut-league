import type { MatchStatus } from '../types';

const STYLE: Record<MatchStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-500',
  live: 'bg-red-50 text-red-600',
  finished: 'bg-gdut-50 text-gdut-700',
};

const LABEL: Record<MatchStatus, string> = {
  scheduled: '未开始',
  live: '进行中',
  finished: '已结束',
};

export default function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
      {LABEL[status]}
    </span>
  );
}
