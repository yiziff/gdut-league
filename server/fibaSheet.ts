import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { NO_NUMBER, normalizeJersey } from '../src/lib/fibaScore.ts';
import type { FibaScoresheet, Team } from '../src/types.ts';
import { replaceDigitSamples, type DigitSample } from './db.ts';
import { callSemanticVision, jsonObject, semanticOcrIsConfigured } from './statSheet.ts';

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

/** 一张拼好的号码格大图：同一队的若干格，图上编号从 1 开始，对应 totals 的顺序。 */
export interface TileSheet {
  image: string;
  side: 'A' | 'B';
  totals: number[];
}

interface ExtractOutput {
  ok: boolean;
  reason?: string;
  message?: string;
  aligned?: string;
  final?: string;
  readError?: string;
  tiles?: TileSheet[];
  score?: { side: 'A' | 'B'; total: number; image: string; reads?: [string, number][] }[];
}

function safeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new FibaSheetError('id', '比赛编号无法用于保存切图');
  return id;
}

function pythonPath(): string {
  return process.env.FIBA_PYTHON?.trim() || resolve('.venv-ocr/bin/python');
}

/**
 * 拉正一张 FIBA 记录表照片，切出写了字的累积分号码格。
 * 配了看图大模型时只拼号码大图，交给大模型认号；没配时用本地 PaddleOCR 逐格认号。
 */
export async function extractFibaSheet(
  matchId: string,
  imagePath: string,
  corners?: number[],
): Promise<{ sheet: FibaScoresheet; tiles: TileSheet[] }> {
  const id = safeId(matchId);
  const output = resolve(sheetRoot, id);
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const useModel = semanticOcrIsConfigured();
  const args = [script, 'extract', imagePath, output, useModel ? '--tiles' : '--read'];
  if (corners) args.push('--corners', corners.map((value) => value.toFixed(1)).join(','));

  let stdout: string;
  try {
    // 本地 OCR 首次加载模型加上逐格识别，一张表要一到三分钟
    ({ stdout } = await run(pythonPath(), args, { timeout: 300_000, maxBuffer: 16 * 1024 * 1024 }));
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
  if (parsed.readError) console.warn(`FIBA 号码识别失败：${parsed.readError}`);

  const version = Date.now();
  const url = (name: string) => `/uploads/stat-sheets/${id}/${name}?v=${version}`;
  return {
    sheet: {
      alignedUrl: url(parsed.aligned ?? 'aligned.jpg'),
      finalUrl: url(parsed.final ?? 'final.jpg'),
      cells: (parsed.score ?? []).map((cell) => ({
        side: cell.side,
        total: cell.total,
        imageUrl: url(cell.image),
        ...(cell.reads ? { reads: cell.reads } : {}),
      })),
    },
    tiles: parsed.tiles ?? [],
  };
}

function rosterText(team: Team): string {
  return (team.players ?? []).map((player) => normalizeJersey(player.number)).join(',');
}

/**
 * 把号码大图交给看图大模型认号。还不知道表上 A 队是哪一队，所以两份名单都给，
 * 要求同一张图里的号码来自同一份名单。返回 key 为 `${side}:${total}` 的答案。
 */
export async function readJerseysWithModel(
  matchId: string,
  tiles: TileSheet[],
  home: Team,
  away: Team,
): Promise<Record<string, string | null>> {
  const id = safeId(matchId);
  const prompt = [
    '这是篮球 FIBA 记录表累积分区里同一支球队的号码格。每张小图左上角是编号，蓝框里是记录员手写的球衣号，号码可能写出框或压到相邻行。',
    `这支球队是下面两份名单之一。名单一：${rosterText(home)}。名单二：${rosterText(away)}。`,
    '同一张图里的号码都来自同一份名单，请只从名单号码里选。',
    `蓝框里只有斜线、划线或圆圈，没有写号码时填 "${NO_NUMBER}"；写了号码但看不清时填 null。`,
    '只输出 JSON，键是编号，例如 {"1":"7","2":"23","3":"空"}，不要解释。',
  ].join('\n');

  const answers: Record<string, string | null> = {};
  await Promise.all(
    tiles.map(async (tile) => {
      const image = readFileSync(resolve(sheetRoot, id, tile.image)).toString('base64');
      const result = jsonObject(await callSemanticVision(prompt, [`data:image/jpeg;base64,${image}`]));
      tile.totals.forEach((total, index) => {
        const value = result[String(index + 1)];
        answers[`${tile.side}:${total}`] =
          typeof value === 'string' || typeof value === 'number' ? String(value).trim() || null : null;
      });
    }),
  );
  return answers;
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
