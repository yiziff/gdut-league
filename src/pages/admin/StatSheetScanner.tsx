import { useEffect, useState, type ChangeEvent } from 'react';
import { readStatSheetFile } from '../../lib/statSheetImage';
import type { MatchStatSheet, MatchStatSheetTemplate, PlayerStatKey, Score } from '../../types';
import { api } from './api';

export interface RecognizedStatRow {
  playerId: string;
  teamId: string;
  number: string;
  name: string;
  stats: Partial<Record<PlayerStatKey, number>>;
}

interface UnmatchedStatRow {
  table: number;
  team?: string;
  number: string;
  name: string;
  raw: string[];
}

interface RecognitionResponse {
  recognized: boolean;
  statSheet: MatchStatSheet;
  rows: RecognizedStatRow[];
  unmatchedRows: UnmatchedStatRow[];
  warnings: string[];
  score?: Score;
  alignError?: string;
}

export interface StatSheetRecognition {
  statSheet: MatchStatSheet;
  rows: RecognizedStatRow[];
  score?: Score;
}

export default function StatSheetScanner({
  matchId,
  template,
  statSheet,
  score,
  hasExistingStats,
  fiba = false,
  onResult,
  apiBase = '/api/admin/matches',
}: {
  matchId?: string;
  /** 约战比赛的负责人走 /api/clubs/matches */
  apiBase?: string;
  fiba?: boolean;
  template?: MatchStatSheetTemplate;
  statSheet?: MatchStatSheet;
  score?: Score;
  hasExistingStats: boolean;
  onResult: (result: StatSheetRecognition) => void;
}) {
  const [image, setImage] = useState('');
  const [reading, setReading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedStatRow[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setImage('');
    setWarnings([]);
    setUnmatched([]);
    setNotice('');
  }, [matchId]);

  async function upload(dataUrl: string) {
    if (!matchId) return;
    if (hasExistingStats && !window.confirm('重新上传会覆盖已经填入的技术统计，仍要继续吗？')) return;
    setRecognizing(true);
    setWarnings([]);
    setUnmatched([]);
    setNotice('');
    try {
      const result = await api<RecognitionResponse>(`${apiBase}/${matchId}/stat-sheet/recognize`, {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl, score }),
      });
      const autoRead = Boolean(result.statSheet.scoresheet?.autoReadAt);
      // 自动认号的提醒在下面的识别结果里显示
      const shown = autoRead ? [] : result.warnings;
      setWarnings(result.alignError ? [...shown, result.alignError] : shown);
      setUnmatched(result.unmatchedRows);
      setNotice(
        autoRead
          ? `已上传，比赛已记为结束。自动认出号码，写入了 ${result.rows.length} 名球员的得分和比分。`
          : result.recognized
            ? `已上传，比赛已记为结束，并匹配 ${result.rows.length} 名球员。`
            : result.statSheet.scoresheet
              ? `已上传，比赛已记为结束。切出 ${result.statSheet.scoresheet.cells.length} 个写了字的格子。`
              : '已上传，比赛已记为结束。',
      );
      onResult({ statSheet: result.statSheet, rows: result.rows, score: result.score });
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : '上传失败']);
    } finally {
      setRecognizing(false);
    }
  }

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true);
    setWarnings([]);
    setUnmatched([]);
    setNotice('');
    try {
      const dataUrl = await readStatSheetFile(file);
      setImage(dataUrl);
      await upload(dataUrl);
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : '图片无法读取']);
    } finally {
      setReading(false);
    }
  }

  const preview = image || statSheet?.imageUrl || '';

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-950">技术统计表</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            上传填好的技术统计表。上传成功后，这场比赛会自动记为已结束。
          </p>
        </div>
        {statSheet?.imageUrl && (
          <a href={statSheet.imageUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-gdut-700 hover:text-gdut-900">
            查看已留档原图
          </a>
        )}
      </div>

      {!matchId ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">请先保存这场比赛，再上传技术统计。</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="btn-primary cursor-pointer">
            {reading || recognizing
              ? fiba
                ? '正在切格、认号码…'
                : '正在上传…'
              : image || statSheet?.imageUrl
                ? '重新上传技术统计'
                : '上传技术统计'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              capture="environment"
              onChange={(event) => void chooseImage(event)}
              disabled={reading || recognizing}
              className="sr-only"
            />
          </label>
          {!template && !fiba && <span className="text-xs text-slate-400">没有空白模板时只留档，不自动填表。</span>}
          {fiba && (
            <span className="text-xs text-slate-400">
              {recognizing ? '正在认号码，请别关页面。' : 'FIBA 标准记录表：上传后自动认号码，按累积分算个人得分和比分。'}
            </span>
          )}
        </div>
      )}

      {preview && (
        <img
          src={preview}
          alt="技术统计表预览"
          className="mt-3 max-h-72 max-w-full rounded-lg border border-slate-200 bg-white object-contain"
        />
      )}
      {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}
      {warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <p className="font-semibold">请重点核对</p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {unmatched.length > 0 && (
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">查看未匹配的 {unmatched.length} 行</summary>
          <ul className="mt-2 space-y-1">
            {unmatched.map((row, index) => (
              <li key={`${row.table}-${row.number}-${row.name}-${index}`}>
                表 {row.table} · {row.team ? `${row.team} · ` : ''}#{row.number || '—'} {row.name || '姓名未识别'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
