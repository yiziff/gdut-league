import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { normalizeJersey, pointsKey, tallyMarks, UNREAD_JERSEY, type ScoreMark, type SheetSide } from '../../lib/fibaScore';
import type { FibaScoreCell, Match, MatchStatSheet, Team } from '../../types';
import { api } from './api';

const cellKey = (cell: Pick<FibaScoreCell, 'side' | 'total'>) => `${cell.side}:${cell.total}`;

export default function FibaReview({
  matchId,
  statSheet,
  home,
  away,
  onSheet,
  onSaved,
  apiBase = '/api/admin/matches',
}: {
  matchId: string;
  /** 约战比赛的负责人走 /api/clubs/matches */
  apiBase?: string;
  statSheet: MatchStatSheet;
  home?: Team;
  away?: Team;
  onSheet: (statSheet: MatchStatSheet) => void;
  onSaved: (match: Match) => void;
}) {
  const sheet = statSheet.scoresheet;
  const [homeSide, setHomeSide] = useState<SheetSide | undefined>(sheet?.homeSide);
  const [jerseys, setJerseys] = useState<Record<string, string>>(sheet?.jerseys ?? {});
  const [finalA, setFinalA] = useState('');
  const [finalB, setFinalB] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recut, setRecut] = useState(false);
  const [editing, setEditing] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setHomeSide(sheet?.homeSide);
    setJerseys(sheet?.jerseys ?? {});
    setMessage('');
    setError('');
    setRecut(false);
    setEditing(false);
  }, [sheet]);

  const teams = useMemo<Record<SheetSide, Team | undefined>>(
    () => (homeSide === 'B' ? { A: away, B: home } : { A: home, B: away }),
    [homeSide, home, away],
  );
  const cells = useMemo(() => sheet?.cells ?? [], [sheet]);
  const ordered = useMemo(
    () => [...cells.filter((cell) => cell.side === 'A'), ...cells.filter((cell) => cell.side === 'B')],
    [cells],
  );
  const marks = useMemo<ScoreMark[]>(
    () =>
      Object.entries(jerseys).map(([key, jersey]) => {
        const [side, total] = key.split(':');
        return { side: side as SheetSide, total: Number(total), jersey };
      }),
    [jerseys],
  );
  const rosterNumbers = (side: SheetSide) => (teams[side]?.players ?? []).map((player) => player.number);
  const tally = useMemo(() => {
    const numbers = (team?: Team) => (team?.players ?? []).map((player) => player.number);
    return tallyMarks(marks, { A: numbers(teams.A), B: numbers(teams.B) });
  }, [marks, teams]);
  const reviewed = ordered.filter((cell) => cellKey(cell) in jerseys).length;

  if (!sheet || recut) {
    return (
      <CornerPicker
        matchId={matchId}
        apiBase={apiBase}
        statSheet={statSheet}
        onSheet={onSheet}
        onSaved={onSaved}
        onCancel={sheet ? () => setRecut(false) : undefined}
      />
    );
  }

  const links = (
    <div className="flex items-center gap-3 text-xs">
      <a href={sheet.alignedUrl} target="_blank" rel="noreferrer" className="font-medium text-gdut-700 hover:text-gdut-900">
        拉正后的整表
      </a>
      <button type="button" onClick={() => setRecut(true)} className="font-medium text-gdut-700 hover:text-gdut-900">
        格子没对上？重新切格
      </button>
    </div>
  );

  if (sheet.homeSide && sheet.jerseys && !editing) {
    const unread = ordered.filter((cell) => jerseys[cellKey(cell)] === UNREAD_JERSEY).length;
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy-950">{sheet.autoReadAt ? '已自动认出号码并写入得分' : '已写入得分'}</p>
            <p className="mt-1 text-xs text-slate-500">
              表上 A 队是{teams.A?.name ?? '主队'}。共 {ordered.length} 格{unread > 0 ? `，${unread} 格没认出号码` : ''}。
            </p>
          </div>
          {links}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(['A', 'B'] as const).map((side) => (
            <div key={side} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-navy-950">{teams[side]?.name ?? `${side} 队`}</span>
                <span className="text-lg font-bold tabular-nums text-navy-950">{tally.totals[side]}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(teams[side]?.players ?? [])
                  .filter((player) => tally.points[pointsKey(side, player.number)])
                  .map((player) => (
                    <span key={player.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      #{player.number} {player.name} {tally.points[pointsKey(side, player.number)]} 分
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
        {tally.warnings.length > 0 && (
          <ul className="mt-3 list-disc rounded-lg border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-xs leading-5 text-amber-900">
            {tally.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setEditing(true)} className="mt-3 text-xs font-medium text-slate-500 hover:text-gdut-700">
          号码认错了？逐格修改
        </button>
      </div>
    );
  }

  function focusAfter(key: string) {
    const next = ordered[ordered.findIndex((cell) => cellKey(cell) === key) + 1];
    if (next) inputs.current[cellKey(next)]?.focus();
  }

  function setJersey(key: string, value: string, advance = false) {
    setJerseys((current) => ({ ...current, [key]: value }));
    if (advance) focusAfter(key);
  }

  async function save() {
    if (!homeSide) {
      setError('请先选择主队是 A 队还是 B 队');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{ match: Match; warnings: string[]; samples: number }>(
        `${apiBase}/${matchId}/stat-sheet/review`,
        { method: 'PUT', body: JSON.stringify({ homeSide, jerseys }) },
      );
      setMessage(`已写入个人得分和比分，并存下 ${result.samples} 个号码样本。`);
      onSaved(result.match);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const finalCheck = (side: SheetSide, value: string) =>
    value.trim() !== '' && Number(value) !== tally.totals[side];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-950">逐格确认得分号码</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            下面是累积分区写了字的格子。看图填上球衣号，没写号码的格子点「空」。每次得分 = 这格累计分减去本队上一格累计分。
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {links}
          <span className="text-slate-500">
            已看 {reviewed} / {ordered.length} 格
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">表上 A 队是</span>
        {(['A', 'B'] as const).map((side) => {
          const team = side === 'A' ? home : away;
          return (
            <button
              key={side}
              type="button"
              onClick={() => setHomeSide(side)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                homeSide === side ? 'border-gdut-600 bg-gdut-600 text-white' : 'border-slate-300 text-slate-600 hover:border-gdut-500'
              }`}
            >
              {team?.name ?? (side === 'A' ? '主队' : '客队')}
            </button>
          );
        })}
        {!homeSide && <span className="text-xs text-amber-700">先选这一项，号码按钮才会对上名单</span>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(['A', 'B'] as const).map((side) => (
          <div key={side} className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-semibold text-navy-950">
                {side} 队{teams[side] ? ` · ${teams[side]!.name}` : ''}
              </span>
              <span className="text-xs text-slate-500">合计 {tally.totals[side]} 分</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {cells
                .filter((cell) => cell.side === side)
                .map((cell) => {
                  const key = cellKey(cell);
                  const value = jerseys[key];
                  const known = value === undefined || value === '' || rosterNumbers(side).map(normalizeJersey).includes(normalizeJersey(value));
                  return (
                    <li key={key} className={`flex items-center gap-3 px-3 py-2 ${value === undefined ? 'bg-amber-50/60' : ''}`}>
                      <div className="relative shrink-0">
                        <img src={cell.imageUrl} alt={`累计分 ${cell.total}`} className="h-24 w-auto rounded border border-slate-200" />
                        {/* 切图上下各多留 0.55 行，中间这一行才是要填的格子 */}
                        <div className="pointer-events-none absolute inset-x-0 top-[26%] bottom-[26%] rounded-sm ring-2 ring-sky-500/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-xs text-slate-500">累计 {cell.total}</span>
                          <input
                            ref={(node) => {
                              inputs.current[key] = node;
                            }}
                            value={value ?? ''}
                            onChange={(event) => setJersey(key, event.target.value.replace(/\D/g, '').slice(0, 3))}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                setJersey(key, (event.currentTarget.value || '').trim(), true);
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                setJersey(key, '', true);
                              }
                            }}
                            inputMode="numeric"
                            placeholder="号码"
                            className={`field w-16 py-1 text-center ${known ? '' : 'border-red-400 text-red-700'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setJersey(key, '', true)}
                            className={`rounded border px-2 py-1 text-xs ${
                              value === '' ? 'border-slate-500 bg-slate-500 text-white' : 'border-slate-300 text-slate-500'
                            }`}
                          >
                            空
                          </button>
                        </div>
                        {homeSide && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {(teams[side]?.players ?? []).map((player) => (
                              <button
                                key={player.id}
                                type="button"
                                title={player.name}
                                onClick={() => setJersey(key, normalizeJersey(player.number), true)}
                                className={`min-w-7 rounded border px-1.5 py-0.5 text-xs ${
                                  value !== undefined && normalizeJersey(value) === normalizeJersey(player.number)
                                    ? 'border-gdut-600 bg-gdut-600 text-white'
                                    : 'border-slate-200 text-slate-600 hover:border-gdut-500'
                                }`}
                              >
                                {player.number}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-navy-950">个人得分</p>
          {(['A', 'B'] as const).map((side) => (
            <div key={side} className="mt-2">
              <p className="text-xs text-slate-500">{teams[side]?.name ?? `${side} 队`}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(teams[side]?.players ?? [])
                  .filter((player) => tally.points[pointsKey(side, player.number)])
                  .map((player) => (
                    <span key={player.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      #{player.number} {player.name} {tally.points[pointsKey(side, player.number)]} 分
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium text-navy-950">和表底最后比分对账</p>
          <img src={sheet.finalUrl} alt="表底比分" className="mt-2 max-h-40 w-full rounded border border-slate-200 object-contain" />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            {(['A', 'B'] as const).map((side) => {
              const value = side === 'A' ? finalA : finalB;
              const setValue = side === 'A' ? setFinalA : setFinalB;
              return (
                <label key={side} className="flex items-center gap-2">
                  表底 {side} 队
                  <input
                    value={value}
                    onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    className={`field w-16 py-1 text-center ${finalCheck(side, value) ? 'border-red-400 text-red-700' : ''}`}
                  />
                  <span className={finalCheck(side, value) ? 'text-red-700' : 'text-slate-400'}>算出 {tally.totals[side]}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {tally.warnings.length > 0 && (
        <ul className="mt-3 list-disc rounded-lg border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-xs leading-5 text-amber-900">
          {tally.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary">
          {saving ? '正在写入…' : '确认写入得分'}
        </button>
        {reviewed < ordered.length && <span className="text-xs text-slate-500">还有 {ordered.length - reviewed} 格没看，没看的格子不计分</span>}
      </div>
    </div>
  );
}

function CornerPicker({
  matchId,
  apiBase,
  statSheet,
  onSheet,
  onSaved,
  onCancel,
}: {
  matchId: string;
  apiBase: string;
  statSheet: MatchStatSheet;
  onSheet: (statSheet: MatchStatSheet) => void;
  onSaved: (match: Match) => void;
  onCancel?: () => void;
}) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [shown, setShown] = useState<[number, number][]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const image = useRef<HTMLImageElement>(null);

  function pick(event: MouseEvent<HTMLDivElement>) {
    if (points.length >= 4 || !image.current) return;
    const frame = event.currentTarget.getBoundingClientRect();
    const rect = image.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setPoints((current) => [
      ...current,
      [(x * image.current!.naturalWidth) / rect.width, (y * image.current!.naturalHeight) / rect.height],
    ]);
    setShown((current) => [...current, [event.clientX - frame.left, event.clientY - frame.top]]);
  }

  async function align(withCorners: boolean) {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ statSheet: MatchStatSheet; match: Match }>(`${apiBase}/${matchId}/stat-sheet/align`, {
        method: 'POST',
        body: JSON.stringify(withCorners ? { corners: points.flat() } : {}),
      });
      if (result.statSheet.scoresheet?.autoReadAt) onSaved(result.match);
      else onSheet(result.statSheet);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '切格失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-sm font-semibold text-navy-950">表格还没切好格</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        先试「自动切格」。不行的话，在照片上依次点表格外框的四个角（大框最外圈，不是纸张边缘），再点「按四个角切格」。角被拍到照片外面时，就点在照片外灰色区域里估计的位置。
      </p>
      <div
        onClick={pick}
        className="relative mt-3 inline-block max-w-full cursor-crosshair rounded-lg bg-slate-200/70 p-10"
      >
        <img
          ref={image}
          src={statSheet.imageUrl}
          alt="技术统计表原图"
          className="block max-h-[32rem] max-w-full rounded border border-slate-200 bg-white"
        />
        {shown.map(([x, y], index) => (
          <span
            key={index}
            style={{ left: x, top: y }}
            className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gdut-600 text-[10px] font-bold text-white"
          >
            {index + 1}
          </span>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void align(false)} disabled={busy} className="btn-secondary">
          {busy ? '正在切格、认号码…' : '自动切格'}
        </button>
        <button type="button" onClick={() => void align(true)} disabled={busy || points.length !== 4} className="btn-primary">
          按四个角切格（{points.length}/4）
        </button>
        {points.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPoints([]);
              setShown([]);
            }}
            className="btn-secondary"
          >
            重新点
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
            取消
          </button>
        )}
      </div>
    </div>
  );
}
