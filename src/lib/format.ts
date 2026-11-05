import type { Match, Side } from '../types';
import { STAGE_LABEL } from '../sports';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const dateOf = (time: string) => time.slice(0, 10);
export const clockOf = (time: string) => time.slice(11, 16);

export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`;
}

export function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatRatio(value: number): string {
  if (value === Infinity) return 'MAX';
  return value.toFixed(3);
}

/** 对阵未确定时的占位文字，例如 "A组第1"、"半决赛胜者" */
export function slotLabel(m: Match, side: Side, all: Match[]): string {
  const seed = side === 'home' ? m.homeSeed : m.awaySeed;
  const parsed = seed?.match(/^([A-Z])(\d+)$/);
  if (parsed) return `${parsed[1]}组第${parsed[2]}`;
  const winnerFeeder = all.find((f) => f.nextMatchId === m.id && f.nextSlot === side);
  if (winnerFeeder) return `${STAGE_LABEL[winnerFeeder.stage]}胜者`;
  const loserFeeder = all.find((f) => f.loserNextMatchId === m.id && f.loserNextSlot === side);
  if (loserFeeder) return `${STAGE_LABEL[loserFeeder.stage]}负者`;
  return '待定';
}
