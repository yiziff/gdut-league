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
  onResult,
}: {
  matchId?: string;
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

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true);
    setWarnings([]);
    setUnmatched([]);
    setNotice('');
    try {
      setImage(await readStatSheetFile(file));
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : '图片无法读取']);
    } finally {
      setReading(false);
    }
  }

  async function recognize() {
    if (!matchId || !template || !image) return;
    if (hasExistingStats && !window.confirm('识别结果会覆盖已识别到的同名字段，仍要继续吗？')) return;
    setRecognizing(true);
    setWarnings([]);
    setUnmatched([]);
    setNotice('');
    try {
      const result = await api<RecognitionResponse>(`/api/admin/matches/${matchId}/stat-sheet/recognize`, {
        method: 'POST',
        body: JSON.stringify({ image, score }),
      });
      setWarnings(result.warnings);
      setUnmatched(result.unmatchedRows);
      setNotice(
        result.recognized
          ? `已匹配 ${result.rows.length} 名球员。请逐项核对，再点击“保存修改”。`
          : '照片已留档，但没有自动填入数据；可对照照片人工录入。',
      );
      onResult({ statSheet: result.statSheet, rows: result.rows, score: result.score });
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : '识别失败']);
    } finally {
      setRecognizing(false);
    }
  }

  const preview = image || statSheet?.imageUrl || '';

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-950">拍照识别技术统计表</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            使用与上方空白模板相同的表格，正对整张表拍摄。后台会结合模板识别；结果不会自动生效，必须核对后保存。
          </p>
        </div>
        {statSheet?.imageUrl && (
          <a href={statSheet.imageUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-gdut-700 hover:text-gdut-900">
            查看已留档原图
          </a>
        )}
      </div>

      {!matchId ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">请先保存这场比赛，再回来上传统计表。</p>
      ) : !template ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">请先上传空白技术统计表模板并保存比赛。</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="btn-secondary cursor-pointer">
            {reading ? '正在处理图片…' : image ? '重拍 / 换图' : '拍照或选择图片'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              capture="environment"
              onChange={(event) => void chooseImage(event)}
              disabled={reading || recognizing}
              className="sr-only"
            />
          </label>
          <button type="button" className="btn-primary" disabled={!image || reading || recognizing} onClick={() => void recognize()}>
            {recognizing ? '正在识别，可能需要几分钟…' : '识别并填入'}
          </button>
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
