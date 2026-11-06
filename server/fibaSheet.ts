import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { normalizeJersey } from '../src/lib/fibaScore.ts';
import type { FibaScoresheet } from '../src/types.ts';
import { replaceDigitSamples, type DigitSample } from './db.ts';

const run = promisify(execFile);
const script = resolve('scripts/fiba_sheet.py');
const sheetRoot = resolve('data/uploads/stat-sheets');
const sampleRoot = resolve('data/digit-samples');

export class FibaSheetError extends Error {
  constructor(
    public reason: string,
    message: string,
  ) {
    super(message);
  }
}

interface ExtractOutput {
  ok: boolean;
  reason?: string;
  message?: string;
  aligned?: string;
  final?: string;
  score?: { side: 'A' | 'B'; total: number; image: string }[];
}

function safeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new FibaSheetError('id', '比赛编号无法用于保存切图');
  return id;
}

function pythonPath(): string {
  return process.env.FIBA_PYTHON?.trim() || resolve('.venv-ocr/bin/python');
}

/** 拉正一张 FIBA 记录表照片并切出写了字的累积分号码格。 */
export async function extractFibaSheet(matchId: string, imagePath: string, corners?: number[]): Promise<FibaScoresheet> {
  const id = safeId(matchId);
  const output = resolve(sheetRoot, id);
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const args = [script, 'extract', imagePath, output];
  if (corners) args.push('--corners', corners.map((value) => value.toFixed(1)).join(','));

  let stdout: string;
  try {
    ({ stdout } = await run(pythonPath(), args, { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 }));
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : '';
    throw new FibaSheetError('runtime', `切格程序没能运行，请检查 FIBA_PYTHON 和 OpenCV。${detail}`);
  }
  let parsed: ExtractOutput;
  try {
    parsed = JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as ExtractOutput;
  } catch {
    throw new FibaSheetError('runtime', '切格程序返回的结果无法解析');
  }
  if (!parsed.ok) throw new FibaSheetError(parsed.reason ?? 'align', parsed.message ?? '表格没对齐');

  const version = Date.now();
  const url = (name: string) => `/uploads/stat-sheets/${id}/${name}?v=${version}`;
  return {
    alignedUrl: url(parsed.aligned ?? 'aligned.jpg'),
    finalUrl: url(parsed.final ?? 'final.jpg'),
    cells: (parsed.score ?? []).map((cell) => ({ side: cell.side, total: cell.total, imageUrl: url(cell.image) })),
  };
}

/** 把管理员确认过的格子存成手写号码样本，同一场比赛重复保存时覆盖旧样本。 */
export function saveDigitSamples(matchId: string, sheet: FibaScoresheet): number {
  const id = safeId(matchId);
  const samples: (DigitSample & { source: string })[] = [];
  for (const cell of sheet.cells) {
    const key = `${cell.side}:${cell.total}`;
    if (!sheet.jerseys || !(key in sheet.jerseys)) continue;
    const label = normalizeJersey(sheet.jerseys[key]) || 'empty';
    if (!/^(\d{1,3}|empty)$/.test(label)) continue;
    const source = resolve(sheetRoot, id, cell.imageUrl.split('/').at(-1)!.split('?')[0]);
    if (!existsSync(source)) continue;
    const sampleId = randomUUID();
    samples.push({ id: sampleId, label, imagePath: `${label}/${sampleId}.jpg`, source });
  }
  for (const sample of samples) {
    mkdirSync(resolve(sampleRoot, sample.label), { recursive: true });
    copyFileSync(sample.source, resolve(sampleRoot, sample.imagePath));
  }
  const old = replaceDigitSamples(
    id,
    samples.map(({ id: sampleId, label, imagePath }) => ({ id: sampleId, label, imagePath })),
  );
  for (const path of old) rmSync(resolve(sampleRoot, path), { force: true });
  return samples.length;
}
