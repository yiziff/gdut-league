import { type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { clockOf, dateOf, formatDate } from '../../lib/format';
import { readAvatarFile } from '../../lib/logoFile';
import {
  CHALLENGE_FORMATS,
  CHALLENGE_LEVELS,
  type ChallengeFormat,
  type ChallengeLevel,
  type ChallengeStatus,
  type ClubBrief,
  type ResponseStatus,
} from '../../types';

export const formatLabel = (format: ChallengeFormat) => CHALLENGE_FORMATS.find((item) => item.id === format)?.label ?? format;
export const levelLabel = (level: ChallengeLevel) => CHALLENGE_LEVELS.find((item) => item.id === level)?.label ?? level;
export const whenLabel = (time: string) => `${formatDate(dateOf(time))} ${clockOf(time)}`;

export const STATUS_LABEL: Record<ChallengeStatus, string> = {
  open: '等待迎战',
  matched: '已成交',
  cancelled: '已取消',
  expired: '已过期',
};

export const RESPONSE_LABEL: Record<ResponseStatus, string> = {
  pending: '等待确认',
  accepted: '已确认',
  declined: '未选中',
  withdrawn: '已撤回',
};

export function ClubMark({ club, size = 'sm' }: { club: Pick<ClubBrief, 'short' | 'color' | 'logo'>; size?: 'sm' | 'lg' }) {
  const frame = size === 'lg' ? 'h-16 w-16 rounded-xl text-xl' : 'h-8 w-8 rounded-lg text-xs';
  if (club.logo) return <img src={club.logo} alt="" className={`${frame} shrink-0 object-cover`} />;
  return (
    <span className={`grid ${frame} shrink-0 place-items-center font-bold text-white`} style={{ backgroundColor: club.color }}>
      {club.short.slice(0, 2)}
    </span>
  );
}

export function ClubLogoPicker({
  value,
  color,
  short,
  onChange,
  onError,
}: {
  value: string;
  color: string;
  short: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      onChange(await readAvatarFile(file));
    } catch (err) {
      onError(err instanceof Error ? err.message : '头像无法读取');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ClubMark club={{ logo: value, color, short: short || '队' }} size="lg" />
      <label className="btn-secondary cursor-pointer">
        {value ? '更换头像' : '上传头像'}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void pick(event)} />
      </label>
      {value ? (
        <button type="button" onClick={() => onChange('')} className="text-xs text-slate-400 hover:text-red-600">
          移除
        </button>
      ) : (
        <span className="text-xs text-slate-400">不上传就用队色和简称。图片会裁成正方形。</span>
      )}
    </div>
  );
}

export function ClubBadge({ club, link = true }: { club: ClubBrief; link?: boolean }) {
  const body = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <ClubMark club={club} />
      <span className="truncate font-semibold text-navy-950">{club.name}</span>
    </span>
  );
  return link ? (
    <Link to={`/clubs/${club.id}`} className="min-w-0 hover:underline">
      {body}
    </Link>
  ) : (
    body
  );
}
