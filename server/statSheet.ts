import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAYER_STAT_KEYS } from '../src/lib/playerStats.ts';
import {
  isPlayerStatKey,
  STAT_SHEET_TEMPLATE_FIELD_KEYS,
  STAT_SHEET_TEMPLATE_FIELD_LABELS,
} from '../src/lib/statSheetTemplate.ts';
import type {
  MatchStatSheet,
  MatchStatSheetTemplate,
  PlayerStatKey,
  Score,
  Sport,
  StatSheetTemplateField,
  StatSheetTemplateFieldKey,
  Team,
} from '../src/types.ts';

type StatValues = Partial<Record<PlayerStatKey, number>>;

export interface RecognizedPlayerStats {
  playerId: string;
  teamId: string;
  number: string;
  name: string;
  stats: StatValues;
}

export interface UnmatchedStatRow {
  table: number;
  team?: string;
  number: string;
  name: string;
  raw: string[];
}

export interface ParsedStatSheet {
  rows: RecognizedPlayerStats[];
  unmatchedRows: UnmatchedStatRow[];
  warnings: string[];
  score?: Score;
  engine?: string;
}

export interface TemplateAnalysis {
  kind: MatchStatSheetTemplate['kind'];
  fields: StatSheetTemplateField[];
  warnings: string[];
}

interface ParsedTable {
  context: string;
  rows: string[][];
}

type HeaderDescriptor =
  | { kind: 'number' }
  | { kind: 'name' }
  | { kind: 'team' }
  | { kind: 'stat'; key: PlayerStatKey }
  | { kind: 'pair'; made: PlayerStatKey; attempted: PlayerStatKey };

interface HeaderChoice {
  dataStart: number;
  descriptors: Array<HeaderDescriptor | undefined>;
  score: number;
}

interface RawStatRow {
  number: string;
  name: string;
  team: string;
  stats: StatValues;
  raw: string[];
}

const uploadDir = resolve('data/uploads/matches');

function safeMatchId(id: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('比赛编号无法用于保存图片');
  return id;
}

function imageBytes(dataUrl: string): Buffer {
  const matched = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!matched) throw new Error('技术统计表需要是 JPG、PNG 或 WebP 图片');
  const bytes = Buffer.from(matched[1], 'base64');
  if (bytes.length < 1_024 || bytes.length > 3_200_000) throw new Error('技术统计表图片大小不合适');
  return bytes;
}

/** 保存浏览器压缩后的统计表照片，并返回可随比赛一起持久化的元数据。 */
export function saveStatSheetImage(matchId: string, dataUrl: string): MatchStatSheet {
  const bytes = imageBytes(dataUrl);
  const id = safeMatchId(matchId);
  mkdirSync(uploadDir, { recursive: true });
  writeFileSync(resolve(uploadDir, `${id}-stats.jpg`), bytes);
  const uploadedAt = new Date().toISOString();
  return {
    imageUrl: `/uploads/matches/${id}-stats.jpg?v=${Date.now()}`,
    uploadedAt,
  };
}

export function saveStatSheetTemplateImage(matchId: string, dataUrl: string): MatchStatSheetTemplate {
  const bytes = imageBytes(dataUrl);
  const id = safeMatchId(matchId);
  mkdirSync(uploadDir, { recursive: true });
  writeFileSync(resolve(uploadDir, `${id}-template.jpg`), bytes);
  return {
    imageUrl: `/uploads/matches/${id}-template.jpg?v=${Date.now()}`,
    uploadedAt: new Date().toISOString(),
    kind: 'generic',
    fields: [],
    warnings: [],
  };
}

function savedTemplateDataUrl(matchId: string): string {
  const id = safeMatchId(matchId);
  return `data:image/jpeg;base64,${readFileSync(resolve(uploadDir, `${id}-template.jpg`)).toString('base64')}`;
}

function ocrEndpoint(): string | undefined {
  const configured = process.env.OCR_SERVICE_URL?.trim();
  if (!configured) return undefined;
  return configured.endsWith('/layout-parsing') ? configured : `${configured.replace(/\/$/, '')}/layout-parsing`;
}

export function ocrEngineName(): string {
  return process.env.OCR_ENGINE_NAME?.trim() || 'PaddleOCR-VL';
}

export function ocrIsConfigured(): boolean {
  return Boolean(ocrEndpoint());
}

function authorizationHeader(): string | undefined {
  const token = process.env.OCR_SERVICE_TOKEN?.trim();
  if (!token) return undefined;
  return /^(?:token|bearer)\s/i.test(token) ? token : `token ${token}`;
}

function markdownFromResponse(body: unknown): string {
  if (!body || typeof body !== 'object') throw new Error('OCR 服务返回了无法解析的内容');
  const root = body as Record<string, unknown>;
  if (typeof root.errorCode === 'number' && root.errorCode !== 0) {
    throw new Error(typeof root.errorMsg === 'string' ? root.errorMsg : 'OCR 服务识别失败');
  }
  const result = root.result;
  if (!result || typeof result !== 'object') throw new Error('OCR 服务没有返回识别结果');
  const pages = (result as Record<string, unknown>).layoutParsingResults;
  if (!Array.isArray(pages)) throw new Error('OCR 服务没有返回版面解析结果');
  const texts = pages.flatMap((page) => {
    if (!page || typeof page !== 'object') return [];
    const markdown = (page as Record<string, unknown>).markdown;
    if (!markdown || typeof markdown !== 'object') return [];
    const value = (markdown as Record<string, unknown>).text;
    return typeof value === 'string' && value.trim() ? [value] : [];
  });
  if (texts.length === 0) throw new Error('OCR 没有识别出可用文字');
  return texts.join('\n\n');
}

/** 调用 PaddleOCR / PaddleX 的 POST /layout-parsing 服务。 */
export async function recognizeStatSheet(dataUrl: string, teams: Team[] = []): Promise<string> {
  const endpoint = ocrEndpoint();
  if (!endpoint) throw new Error('尚未配置 OCR_SERVICE_URL');
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const timeout = Number(process.env.OCR_TIMEOUT_MS || 180_000);
  const authorization = authorizationHeader();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      file: base64,
      fileType: 1,
      useDocOrientationClassify: false,
      useDocUnwarping: false,
      useTextlineOrientation: false,
      useChartRecognition: false,
      visualize: false,
      teams: teams.slice(0, 2).map((team) => ({
        name: team.name,
        short: team.short,
        numbers: (team.players ?? []).map((player) => player.number),
      })),
    }),
    signal: AbortSignal.timeout(Number.isFinite(timeout) && timeout > 0 ? timeout : 180_000),
  });
  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && typeof (body as Record<string, unknown>).errorMsg === 'string'
        ? String((body as Record<string, unknown>).errorMsg)
        : `OCR 服务请求失败（${response.status}）`;
    throw new Error(message);
  }
  return markdownFromResponse(body);
}

function semanticEndpoint(): string | undefined {
  const configured = process.env.FORM_VLM_API_URL?.trim();
  if (!configured) return undefined;
  const base = configured.replace(/\/$/, '');
  if (base.endsWith('/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

export function semanticOcrIsConfigured(): boolean {
  return Boolean(semanticEndpoint());
}

export function formRecognitionIsConfigured(): boolean {
  return semanticOcrIsConfigured() || ocrIsConfigured();
}

function semanticEngineName(): string {
  return process.env.FORM_VLM_MODEL?.trim() || 'OpenAI-compatible Vision Model';
}

export async function callSemanticVision(prompt: string, images: string[]): Promise<string> {
  const endpoint = semanticEndpoint();
  if (!endpoint) throw new Error('尚未配置 FORM_VLM_API_URL');
  const model = process.env.FORM_VLM_MODEL?.trim();
  if (!model) throw new Error('尚未配置 FORM_VLM_MODEL');
  const timeout = Number(process.env.OCR_TIMEOUT_MS || 180_000);
  const key = process.env.FORM_VLM_API_KEY?.trim();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      // 百炼的千问默认先思考，读表格既慢又多耗 token；其他接口不认这个参数，不发
      ...(endpoint.includes('aliyuncs.com') ? { enable_thinking: false } : {}),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(Number.isFinite(timeout) && timeout > 0 ? timeout : 180_000),
  });
  const body = (await response.json().catch(() => undefined)) as
    | { error?: { message?: string }; choices?: Array<{ message?: { content?: unknown } }> }
    | undefined;
  if (!response.ok) throw new Error(body?.error?.message || `表单视觉模型请求失败（${response.status}）`);
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content
      .flatMap((item) =>
        item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
          ? [String((item as { text: string }).text)]
          : [],
      )
      .join('\n');
    if (joined.trim()) return joined;
  }
  throw new Error('表单视觉模型没有返回内容');
}

export function jsonObject(text: string): Record<string, unknown> {
  const unfenced = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('视觉模型没有返回 JSON');
  const value = JSON.parse(unfenced.slice(start, end + 1)) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('视觉模型返回的 JSON 格式不正确');
  return value as Record<string, unknown>;
}

function templateFields(value: unknown): StatSheetTemplateField[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(STAT_SHEET_TEMPLATE_FIELD_KEYS);
  const seen = new Set<StatSheetTemplateFieldKey>();
  const result: StatSheetTemplateField[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const key = typeof raw.key === 'string' && allowed.has(raw.key) ? (raw.key as StatSheetTemplateFieldKey) : undefined;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      key,
      label:
        typeof raw.label === 'string' && raw.label.trim()
          ? raw.label.trim().slice(0, 40)
          : STAT_SHEET_TEMPLATE_FIELD_LABELS[key],
      sourceLabel:
        typeof raw.sourceLabel === 'string' && raw.sourceLabel.trim()
          ? raw.sourceLabel.trim().slice(0, 80)
          : undefined,
    });
  }
  return result;
}

function warningsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim().slice(0, 200)).slice(0, 20)
    : [];
}

function normalizeTemplateAnalysis(value: Record<string, unknown>): TemplateAnalysis {
  const kind =
    value.kind === 'box-score' || value.kind === 'fiba-scoresheet' || value.kind === 'generic'
      ? value.kind
      : 'generic';
  const fields = templateFields(value.fields);
  if (fields.some((field) => field.key === 'runningScore') && !fields.some((field) => field.key === 'points')) {
    fields.push({ key: 'points', label: STAT_SHEET_TEMPLATE_FIELD_LABELS.points, sourceLabel: '由累积分栏计算' });
  }
  return { kind, fields, warnings: warningsOf(value.warnings) };
}

async function semanticTemplateAnalysis(image: string, sport: Sport): Promise<TemplateAnalysis> {
  const keys = STAT_SHEET_TEMPLATE_FIELD_KEYS.join(', ');
  const response = await callSemanticVision(
    `你正在分析一张尚未填写的${sport}比赛技术统计表模板。识别表格的结构和字段语义，不要把印刷的示例数字当作比赛数据。
只返回 JSON，不要 Markdown：
{"kind":"box-score|fiba-scoresheet|generic","fields":[{"key":"字段键","label":"中文显示名","sourceLabel":"模板原文"}],"warnings":["需要管理员注意的编码规则"]}
字段键只能取：${keys}。
如果是 FIBA 记录表，要识别 runningScore（累积分/跑分栏）、playerNumber、playerName、fouls、teamFouls、periodScore、finalScore；runningScore 最终会换算为 points。
无法确定的字段不要猜测。`,
    [image],
  );
  return normalizeTemplateAnalysis(jsonObject(response));
}

export async function analyzeStatSheetTemplateImage(
  image: string,
  sport: Sport,
): Promise<TemplateAnalysis & { engine?: string }> {
  const failures: string[] = [];
  if (semanticOcrIsConfigured()) {
    try {
      const analysis = await semanticTemplateAnalysis(image, sport);
      if (analysis.fields.length > 0) return { ...analysis, engine: semanticEngineName() };
      failures.push('视觉模型没有识别出模板字段。');
    } catch (error) {
      failures.push(`视觉模型分析失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  if (ocrIsConfigured()) {
    try {
      const source = await recognizeStatSheet(image);
      const analysis = analyzeTemplateOcrText(source, sport);
      return { ...analysis, warnings: [...failures, ...analysis.warnings], engine: ocrEngineName() };
    } catch (error) {
      failures.push(`${ocrEngineName()} 模板分析失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  return {
    kind: 'generic',
    fields: [],
    warnings: failures.length
      ? failures
      : ['模板已保存，但没有可用的模板识别服务。配置 FORM_VLM_API_URL 或 OCR_SERVICE_URL 后重新上传即可分析字段。'],
  };
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return value
    .replace(/&#(\d+);/g, (_all, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_all, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (all, name: string) => named[name.toLowerCase()] ?? all);
}

function plainText(value: string): string {
  return decodeHtml(
    value
      .replace(/<(?:br|\/p|\/div|\/li)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[*_`]+/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function positiveSpan(attributes: string, name: 'rowspan' | 'colspan'): number {
  const matched = new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, 'i').exec(attributes);
  const value = matched ? Number(matched[1]) : 1;
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : 1;
}

function parseHtmlRows(table: string): string[][] {
  const result: string[][] = [];
  const spans = new Map<number, { text: string; remaining: number }>();
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row: string[] = [];
    for (const [column, span] of [...spans]) {
      row[column] = span.text;
      span.remaining -= 1;
      if (span.remaining <= 0) spans.delete(column);
    }
    let column = 0;
    for (const cellMatch of rowMatch[1].matchAll(/<t[hd]\b([^>]*)>([\s\S]*?)<\/t[hd]>/gi)) {
      while (row[column] !== undefined) column += 1;
      const attributes = cellMatch[1];
      const text = plainText(cellMatch[2]);
      const colspan = positiveSpan(attributes, 'colspan');
      const rowspan = positiveSpan(attributes, 'rowspan');
      for (let offset = 0; offset < colspan; offset += 1) {
        row[column + offset] = text;
        if (rowspan > 1) spans.set(column + offset, { text, remaining: rowspan - 1 });
      }
      column += colspan;
    }
    while (row.at(-1) === '') row.pop();
    if (row.some((cell) => cell?.trim())) result.push(row.map((cell) => cell ?? ''));
  }
  return result;
}

function parseHtmlTables(source: string): ParsedTable[] {
  const result: ParsedTable[] = [];
  for (const matched of source.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const rows = parseHtmlRows(matched[0]);
    if (rows.length < 2) continue;
    const before = source.slice(Math.max(0, (matched.index ?? 0) - 500), matched.index ?? 0);
    result.push({ context: plainText(before).slice(-240), rows });
  }
  return result;
}

function markdownCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map((cell) => plainText(cell.replace(/\\\|/g, '|')));
}

function isMarkdownSeparator(row: string[]): boolean {
  return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

function parseMarkdownTables(source: string): ParsedTable[] {
  const withoutHtml = source.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, '\n');
  const lines = withoutHtml.split(/\r?\n/);
  const result: ParsedTable[] = [];
  let index = 0;
  while (index < lines.length) {
    if ((lines[index].match(/\|/g)?.length ?? 0) < 2) {
      index += 1;
      continue;
    }
    const start = index;
    const block: string[] = [];
    while (index < lines.length && (lines[index].match(/\|/g)?.length ?? 0) >= 2) {
      block.push(lines[index]);
      index += 1;
    }
    const rows = block.map(markdownCells).filter((row) => !isMarkdownSeparator(row));
    if (rows.length < 2) continue;
    const context = plainText(lines.slice(Math.max(0, start - 4), start).join(' ')).slice(-240);
    result.push({ context, rows });
  }
  return result;
}

function extractTables(source: string): ParsedTable[] {
  return [...parseHtmlTables(source), ...parseMarkdownTables(source)];
}

function normalized(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[（）()[\]【】{}"'`.,，。:：;；·\s_%％]/g, '');
}

function descriptorForHeader(value: string): HeaderDescriptor | undefined {
  const text = normalized(value);
  if (!text) return undefined;
  if (/^(号码|号|球衣号码|队员号码|球员号码|运动员号码|no|no\.?|num|number|#)$/.test(text)) return { kind: 'number' };
  if (/^(姓名|队员姓名|球员姓名|队员|球员|运动员|player|playername|name)$/.test(text)) return { kind: 'name' };
  if (/^(球队|队伍|队名|team|teamname)$/.test(text)) return { kind: 'team' };

  const pair = (made: PlayerStatKey, attempted: PlayerStatKey): HeaderDescriptor => ({ kind: 'pair', made, attempted });
  const stat = (key: PlayerStatKey): HeaderDescriptor => ({ kind: 'stat', key });
  const made = /命中|投中|命中数|made|fgm|[23]pm|ftm/.test(text) || text.endsWith('中');
  const attempted =
    /出手|试投|投篮|出手数|attempt|fga|[23]pa|fta|[23]pm\/a|ftm\/a/.test(text) || text.endsWith('投');

  if (/2分|两分|2pt|2fg/.test(text)) {
    if (made && !attempted) return stat('twoPointsMade');
    if (attempted && !made) return stat('twoPointsAttempted');
    return pair('twoPointsMade', 'twoPointsAttempted');
  }
  if (/3分|三分|3pt|3fg/.test(text)) {
    if (made && !attempted) return stat('threePointsMade');
    if (attempted && !made) return stat('threePointsAttempted');
    return pair('threePointsMade', 'threePointsAttempted');
  }
  if (/罚球|freethrow|^ft/.test(text)) {
    if (made && !attempted) return stat('freeThrowsMade');
    if (attempted && !made) return stat('freeThrowsAttempted');
    return pair('freeThrowsMade', 'freeThrowsAttempted');
  }
  if (/前场篮板|进攻篮板|前板|offensiverebound|^oreb$|^orb$/.test(text)) return stat('offensiveRebounds');
  if (/后场篮板|防守篮板|后板|defensiverebound|^dreb$|^drb$/.test(text)) return stat('defensiveRebounds');
  if (/总篮板|篮板球|篮板|totalrebound|^reb$|^trb$/.test(text)) return stat('rebounds');
  if (/助攻|assist|^ast$/.test(text)) return stat('assists');
  if (/抢断|steal|^stl$/.test(text)) return stat('steals');
  if (/盖帽|封盖|block|^blk$/.test(text)) return stat('blocks');
  if (/失误|turnover|^tov?$/.test(text)) return stat('turnovers');
  if (/犯规|foul|^pf$/.test(text)) return stat('fouls');
  if (/^(得分|总得分|分数|进球|胜场|points?|pts|score|goals?|wins?)$/.test(text)) return stat('points');
  return undefined;
}

export function analyzeTemplateOcrText(source: string, sport: Sport): TemplateAnalysis {
  const keys = new Set<StatSheetTemplateFieldKey>();
  const sourceLabels = new Map<StatSheetTemplateFieldKey, string>();
  const add = (key: StatSheetTemplateFieldKey, label?: string) => {
    keys.add(key);
    if (label && !sourceLabels.has(key)) sourceLabels.set(key, label);
  };
  const tables = extractTables(source);
  for (const cell of tables.flatMap((table) => table.rows.flat())) {
    const descriptor = descriptorForHeader(cell);
    if (!descriptor) continue;
    if (descriptor.kind === 'number') add('playerNumber', cell);
    else if (descriptor.kind === 'name') add('playerName', cell);
    else if (descriptor.kind === 'team') add('teamName', cell);
    else if (descriptor.kind === 'stat') add(descriptor.key, cell);
    else {
      add(descriptor.made, cell);
      add(descriptor.attempted, cell);
    }
  }

  const text = normalized(plainText(source));
  if (/队名|球队|a队|b队|teama|teamb/.test(text)) add('teamName', '队名');
  if (/累积分|累积得分|跑分|runningscore/.test(text)) {
    add('runningScore', '累积分');
    add('points', '由累积分计算');
  }
  if (/最后比分|最终比分|finalscore/.test(text)) add('finalScore', '最后比分');
  if (/每节得分|分节得分|节得分|periodscore/.test(text)) add('periodScore', '每节得分');
  if (/全队犯规|teamfouls?/.test(text)) add('teamFouls', '全队犯规');
  if (/犯规|fouls?/.test(text)) add('fouls', '犯规');

  const fiba =
    sport === 'basketball' &&
    keys.has('runningScore') &&
    (keys.has('teamFouls') || keys.has('fouls'));
  const boxScore = (keys.has('playerNumber') || keys.has('playerName')) && [...keys].some(isPlayerStatKey);
  const fields = STAT_SHEET_TEMPLATE_FIELD_KEYS.filter((key) => keys.has(key)).map((key) => ({
    key,
    label: STAT_SHEET_TEMPLATE_FIELD_LABELS[key],
    sourceLabel: sourceLabels.get(key),
  }));
  const warnings: string[] = [];
  if (!keys.has('playerNumber') && !keys.has('playerName')) warnings.push('没有识别到球员号码或姓名字段，赛后可能无法自动匹配名单。');
  if (![...keys].some(isPlayerStatKey) && !keys.has('runningScore')) warnings.push('没有识别到可写入球员技术统计的字段。');
  if (fiba) warnings.push('该模板包含跑分栏和格内犯规符号；赛后必须保留整张表，并重点人工复核球员得分与犯规。');
  return {
    kind: fiba ? 'fiba-scoresheet' : boxScore ? 'box-score' : 'generic',
    fields,
    warnings,
  };
}

function descriptorId(value: HeaderDescriptor): string {
  if (value.kind === 'stat') return `stat:${value.key}`;
  if (value.kind === 'pair') return `pair:${value.made}:${value.attempted}`;
  return value.kind;
}

function chooseHeaders(rows: string[][]): HeaderChoice | undefined {
  let best: HeaderChoice | undefined;
  const maxStart = Math.min(4, rows.length - 1);
  for (let start = 0; start < maxStart; start += 1) {
    for (let end = start + 1; end <= Math.min(rows.length - 1, start + 3); end += 1) {
      const width = Math.max(...rows.slice(start, end).map((row) => row.length));
      const descriptors: Array<HeaderDescriptor | undefined> = [];
      for (let column = 0; column < width; column += 1) {
        const labels = [...new Set(rows.slice(start, end).map((row) => row[column] ?? '').filter(Boolean))];
        descriptors[column] = descriptorForHeader(labels.join('/'));
      }
      const found = descriptors.filter((item): item is HeaderDescriptor => Boolean(item));
      const identity = found.filter((item) => item.kind === 'number' || item.kind === 'name').length;
      const stats = new Set(
        found.filter((item) => item.kind === 'stat' || item.kind === 'pair').map(descriptorId),
      ).size;
      if (identity === 0 || stats === 0) continue;
      const score = identity * 5 + stats * 2 + (found.some((item) => item.kind === 'team') ? 1 : 0) - start * 0.05;
      if (!best || score > best.score) best = { dataStart: end, descriptors, score };
    }
  }
  return best;
}

function statNumber(value: string): number | undefined {
  const text = value.normalize('NFKC').trim();
  if (!text) return undefined;
  if (/^[-—–]+$/.test(text)) return 0;
  const matched = text.replace(/[oO]/g, '0').match(/\d{1,3}/);
  if (!matched) return undefined;
  const number = Number(matched[0]);
  return Number.isFinite(number) ? number : undefined;
}

function statPair(value: string): [number, number] | undefined {
  const numbers = value
    .normalize('NFKC')
    .replace(/[oO]/g, '0')
    .match(/\d{1,3}/g)
    ?.map(Number);
  if (!numbers || numbers.length < 2) return undefined;
  return [numbers[0], numbers[1]];
}

function rawRows(table: ParsedTable, header: HeaderChoice): RawStatRow[] {
  const result: RawStatRow[] = [];
  const foulColumns = header.descriptors.flatMap((descriptor, index) =>
    descriptor?.kind === 'stat' && descriptor.key === 'fouls' ? [index] : [],
  );
  for (const row of table.rows.slice(header.dataStart)) {
    let number = '';
    let name = '';
    let team = '';
    const stats: StatValues = {};
    for (let column = 0; column < header.descriptors.length; column += 1) {
      const descriptor = header.descriptors[column];
      const value = row[column] ?? '';
      if (!descriptor) continue;
      if (descriptor.kind === 'number') number = value.trim();
      else if (descriptor.kind === 'name') name = value.trim();
      else if (descriptor.kind === 'team') team = value.trim();
      else if (descriptor.kind === 'stat') {
        if (descriptor.key === 'fouls' && foulColumns.length > 1) continue;
        const parsed = statNumber(value);
        if (parsed !== undefined) stats[descriptor.key] = parsed;
      } else {
        const parsed = statPair(value);
        if (parsed) {
          stats[descriptor.made] = parsed[0];
          stats[descriptor.attempted] = parsed[1];
        }
      }
    }
    if (foulColumns.length > 1) {
      const foulCount = foulColumns.filter((column) => {
        const value = (row[column] ?? '').normalize('NFKC').trim();
        return Boolean(value) && !/^[-—–0]+$/.test(value);
      }).length;
      if (foulCount > 0) stats.fouls = foulCount;
    }
    const identity = normalized(`${number}${name}`);
    if (!identity || /合计|总计|全队|total|teamtotal/.test(identity)) continue;
    if (Object.keys(stats).length === 0) continue;
    if (
      stats.points === undefined &&
      stats.twoPointsMade !== undefined &&
      stats.threePointsMade !== undefined &&
      stats.freeThrowsMade !== undefined
    ) {
      stats.points = stats.twoPointsMade * 2 + stats.threePointsMade * 3 + stats.freeThrowsMade;
    }
    if (
      stats.rebounds === undefined &&
      stats.offensiveRebounds !== undefined &&
      stats.defensiveRebounds !== undefined
    ) {
      stats.rebounds = stats.offensiveRebounds + stats.defensiveRebounds;
    }
    result.push({ number, name, team, stats, raw: row });
  }
  return result;
}

function normalizedNumber(value: string): string {
  const matched = value
    .normalize('NFKC')
    .replace(/[oO]/g, '0')
    .match(/\d{1,3}/);
  if (!matched) return normalized(value);
  return String(Number(matched[0]));
}

function normalizedName(value: string): string {
  return normalized(value).replace(/[-—–]/g, '');
}

function teamFromText(value: string, teams: Team[]): Team | undefined {
  const text = normalized(value);
  if (!text) return undefined;
  const matched = teams.filter((team) =>
    [team.name, team.short]
      .map(normalized)
      .filter((name) => name.length >= 2)
      .some((name) => text.includes(name)),
  );
  return matched.length === 1 ? matched[0] : undefined;
}

function sharedCharacters(left: string, right: string): number {
  const pool = new Map<string, number>();
  for (const char of right) pool.set(char, (pool.get(char) ?? 0) + 1);
  let count = 0;
  for (const char of left) {
    const remaining = pool.get(char) ?? 0;
    if (remaining <= 0) continue;
    pool.set(char, remaining - 1);
    count += 1;
  }
  return count;
}

function nameDistance(left: string, right: string): number {
  const a = [...left];
  const b = [...right];
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = a[i - 1] === b[j - 1] ? previous : Math.min(previous, row[j], row[j - 1]) + 1;
      previous = current;
    }
  }
  return row[b.length];
}

function closeName(rowName: string, playerName: string): boolean {
  if (rowName.length < 2 || playerName.length < 2) return false;
  return sharedCharacters(rowName, playerName) >= 2 && nameDistance(rowName, playerName) <= 1;
}

function playerMatches(row: RawStatRow, teams: Team[], teamHint?: Team) {
  const candidates = (teamHint ? [teamHint] : teams).flatMap((team) =>
    (team.players ?? []).map((player) => ({ team, player })),
  );
  const number = normalizedNumber(row.number);
  const name = normalizedName(row.name);
  const byNumber = number
    ? candidates.filter(({ player }) => normalizedNumber(player.number) === number)
    : [];
  if (name) {
    const exactFromNumber = byNumber.filter(({ player }) => normalizedName(player.name) === name);
    if (exactFromNumber.length === 1) return exactFromNumber[0];
    const closeFromNumber = byNumber.filter(({ player }) => closeName(name, normalizedName(player.name)));
    if (closeFromNumber.length === 1) return closeFromNumber[0];
  }
  if (byNumber.length === 1) return byNumber[0];
  if (name) {
    const byName = candidates.filter(({ player }) => normalizedName(player.name) === name);
    if (byName.length === 1) return byName[0];
    const byCloseName = candidates.filter(({ player }) => closeName(name, normalizedName(player.name)));
    if (byCloseName.length === 1) return byCloseName[0];
  }
  return undefined;
}

function inferredTableTeam(table: ParsedTable, rows: RawStatRow[], teams: Team[]): Team | undefined {
  const fromContext = teamFromText(
    `${table.context} ${table.rows.slice(0, 4).flat().join(' ')}`,
    teams,
  );
  if (fromContext) return fromContext;
  const scores = teams.map((team) => ({
    team,
    score: rows.filter((row) => Boolean(playerMatches(row, [team], team))).length,
  }));
  scores.sort((a, b) => b.score - a.score);
  if (scores[0]?.score && scores[0].score > (scores[1]?.score ?? 0)) return scores[0].team;
  return undefined;
}

function rowWarnings(row: RecognizedPlayerStats): string[] {
  const prefix = `${row.name}（#${row.number || '—'}）`;
  const warnings: string[] = [];
  const pairs: Array<[PlayerStatKey, PlayerStatKey, string]> = [
    ['twoPointsMade', 'twoPointsAttempted', '2 分球'],
    ['threePointsMade', 'threePointsAttempted', '3 分球'],
    ['freeThrowsMade', 'freeThrowsAttempted', '罚球'],
  ];
  for (const [made, attempted, label] of pairs) {
    const madeValue = row.stats[made];
    const attemptedValue = row.stats[attempted];
    if (madeValue !== undefined && attemptedValue !== undefined && madeValue > attemptedValue) {
      warnings.push(`${prefix}的${label}命中数大于出手数`);
    }
  }
  const {
    points,
    twoPointsMade,
    threePointsMade,
    freeThrowsMade,
    rebounds,
    offensiveRebounds,
    defensiveRebounds,
  } = row.stats;
  if (
    points !== undefined &&
    twoPointsMade !== undefined &&
    threePointsMade !== undefined &&
    freeThrowsMade !== undefined &&
    points !== twoPointsMade * 2 + threePointsMade * 3 + freeThrowsMade
  ) {
    warnings.push(`${prefix}的得分与投篮、罚球命中数不一致`);
  }
  if (
    rebounds !== undefined &&
    offensiveRebounds !== undefined &&
    defensiveRebounds !== undefined &&
    rebounds !== offensiveRebounds + defensiveRebounds
  ) {
    warnings.push(`${prefix}的总篮板与前、后场篮板之和不一致`);
  }
  return warnings;
}

/**
 * 把 PaddleOCR 输出的 HTML/Markdown 表格映射到本场两队名单。
 * 号码是首要匹配键；两队号码冲突时要求队名上下文或姓名能消歧。
 */
export function parseBasketballStatSheet(
  source: string,
  teams: Team[],
  score?: Score,
): ParsedStatSheet {
  const tables = extractTables(source);
  const result: RecognizedPlayerStats[] = [];
  const unmatchedRows: UnmatchedStatRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  if (tables.length === 0) {
    const text = plainText(source);
    const warning =
      /累积分|国际篮球联合会记录表|跑分/.test(text)
        ? '这是 FIBA 跑分记录表。格子里的红笔号码无法可靠换算成个人得分，没有自动写入，请在技术统计里按名单手工填写。'
        : '没有从图片中解析出表格，请手工录入或重新拍摄。';
    return { rows: [], unmatchedRows: [], warnings: [warning] };
  }

  tables.forEach((table, tableIndex) => {
    const header = chooseHeaders(table.rows);
    if (!header) return;
    const rows = rawRows(table, header);
    let tableTeam = inferredTableTeam(table, rows, teams);
    if (!tableTeam && tables.length === teams.length && teams[tableIndex]) {
      tableTeam = teams[tableIndex];
      warnings.push(`第 ${tableIndex + 1} 个表格未识别出队名，已按主队、客队顺序匹配。`);
    }
    for (const row of rows) {
      const rowTeam = teamFromText(row.team, teams) ?? tableTeam;
      const matched = playerMatches(row, teams, rowTeam);
      if (!matched) {
        unmatchedRows.push({
          table: tableIndex + 1,
          team: rowTeam?.name,
          number: row.number,
          name: row.name,
          raw: row.raw.slice(0, 20),
        });
        continue;
      }
      if (seen.has(matched.player.id)) {
        warnings.push(`${matched.player.name}（#${matched.player.number}）被识别了多次，只保留第一行。`);
        continue;
      }
      seen.add(matched.player.id);
      result.push({
        playerId: matched.player.id,
        teamId: matched.team.id,
        number: matched.player.number,
        name: matched.player.name,
        stats: row.stats,
      });
    }
  });

  if (result.length === 0) warnings.push('识别到了表格，但没有任何行能与本场球员名单匹配。');
  if (unmatchedRows.length > 0) warnings.push(`有 ${unmatchedRows.length} 行未能匹配球员，请检查号码、姓名和队员名单。`);
  for (const row of result) warnings.push(...rowWarnings(row));
  const scoreFromSheet = finalScoreFromSource(source, teams);

  const compared = scoreFromSheet ?? score;
  if (compared) {
    teams.slice(0, 2).forEach((team, index) => {
      const rows = result.filter((row) => row.teamId === team.id && row.stats.points !== undefined);
      if (rows.length === 0) return;
      const sum = rows.reduce((total, row) => total + (row.stats.points ?? 0), 0);
      const expected = index === 0 ? compared.home : compared.away;
      if (sum !== expected) warnings.push(`${team.name}已识别球员得分合计 ${sum}，与比赛比分 ${expected} 不一致。`);
    });
  }

  return {
    rows: result,
    unmatchedRows: unmatchedRows.slice(0, 40),
    warnings: [...new Set(warnings)].slice(0, 40),
    score: scoreFromSheet,
  };
}

function finalScoreFromSource(source: string, teams: Team[]): Score | undefined {
  const matched = /最后比分\s+(\S+?)=(\d{1,3})\s+(\S+?)=(\d{1,3})/.exec(plainText(source));
  if (!matched || teams.length < 2) return undefined;
  const pairs = [
    { team: teamFromText(matched[1], teams), points: Number(matched[2]) },
    { team: teamFromText(matched[3], teams), points: Number(matched[4]) },
  ];
  if (!pairs[0].team || !pairs[1].team || pairs[0].team.id === pairs[1].team.id) return undefined;
  const home = pairs.find((pair) => pair.team?.id === teams[0].id);
  const away = pairs.find((pair) => pair.team?.id === teams[1].id);
  if (!home || !away) return undefined;
  return { home: home.points, away: away.points };
}

export function parseTemplateStatSheet(
  source: string,
  teams: Team[],
  template: MatchStatSheetTemplate,
  score?: Score,
): ParsedStatSheet {
  const parsed = parseBasketballStatSheet(source, teams, score);
  const allowed = new Set(
    template.fields.flatMap((field) => (isPlayerStatKey(field.key) ? [field.key] : [])),
  );
  const rows =
    allowed.size === 0
      ? parsed.rows
      : parsed.rows.map((row) => ({
          ...row,
          stats: Object.fromEntries(
            Object.entries(row.stats).filter(([key]) => allowed.has(key as PlayerStatKey)),
          ) as StatValues,
        }));
  const warnings = [...parsed.warnings];
  if (template.kind === 'fiba-scoresheet') {
    warnings.push('当前使用表格 OCR 回退识别 FIBA 记录表；跑分符号和格内犯规请逐项人工复核。');
  }
  return { ...parsed, rows, warnings: [...new Set(warnings)].slice(0, 40) };
}

function parsedScore(value: unknown): Score | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const home = Number(raw.home);
  const away = Number(raw.away);
  if (!Number.isFinite(home) || home < 0 || !Number.isFinite(away) || away < 0) return undefined;
  return { home, away };
}

async function semanticFilledRecognition(
  templateImage: string,
  filledImage: string,
  template: MatchStatSheetTemplate,
  sport: Sport,
  teams: Team[],
  score?: Score,
): Promise<ParsedStatSheet> {
  const roster = teams.map((team, index) => ({
    side: index === 0 ? 'home' : 'away',
    team: team.name,
    players: (team.players ?? []).map((player) => ({ number: player.number, name: player.name })),
  }));
  const allowedStats = template.fields.flatMap((field) => (isPlayerStatKey(field.key) ? [field.key] : []));
  const response = await callSemanticVision(
    `第一张图片是空白的${sport}技术统计表模板，第二张图片是同一模板填写后的赛后记录。模板类型和已识别字段如下：
${JSON.stringify({ kind: template.kind, fields: template.fields })}
本场名单：${JSON.stringify(roster)}
已有比赛比分（可能为空）：${JSON.stringify(score ?? null)}
请根据空白模板定位填写区域，读取第二张图。FIBA 跑分栏要按每次标记旁的球员号码计算个人得分；犯规格按已填写格数统计，不要把罚球次数当犯规次数。
只返回 JSON，不要 Markdown：
{"score":{"home":0,"away":0},"rows":[{"side":"home|away","team":"队名","number":"号码","name":"姓名","stats":{"字段键":0}}],"warnings":["不确定或需要复核的内容"]}
stats 只能包含这些键：${allowedStats.length ? allowedStats.join(', ') : PLAYER_STAT_KEYS.join(', ')}。看不清的值不要猜，省略该字段。`,
    [templateImage, filledImage],
  );
  const value = jsonObject(response);
  const allowed = new Set<PlayerStatKey>(
    allowedStats.length ? allowedStats : [...PLAYER_STAT_KEYS],
  );
  const rows: RecognizedPlayerStats[] = [];
  const unmatchedRows: UnmatchedStatRow[] = [];
  const seen = new Set<string>();
  const inputRows = Array.isArray(value.rows) ? value.rows : [];

  inputRows.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const raw = item as Record<string, unknown>;
    const side = raw.side === 'home' || raw.side === 'away' ? raw.side : undefined;
    const teamText = typeof raw.team === 'string' ? raw.team : '';
    const number = typeof raw.number === 'string' || typeof raw.number === 'number' ? String(raw.number) : '';
    const name = typeof raw.name === 'string' ? raw.name : '';
    const stats: StatValues = {};
    if (raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats)) {
      for (const [key, rawValue] of Object.entries(raw.stats as Record<string, unknown>)) {
        if (!isPlayerStatKey(key) || !allowed.has(key)) continue;
        const numberValue = Number(rawValue);
        if (Number.isFinite(numberValue) && numberValue >= 0) stats[key] = numberValue;
      }
    }
    if (Object.keys(stats).length === 0) return;
    const teamHint = side ? teams[side === 'home' ? 0 : 1] : teamFromText(teamText, teams);
    const matched = playerMatches({ number, name, team: teamText, stats, raw: [] }, teams, teamHint);
    if (!matched) {
      unmatchedRows.push({ table: 1, team: teamHint?.name || teamText || undefined, number, name, raw: [`视觉模型第 ${index + 1} 行`] });
      return;
    }
    if (seen.has(matched.player.id)) return;
    seen.add(matched.player.id);
    rows.push({
      playerId: matched.player.id,
      teamId: matched.team.id,
      number: matched.player.number,
      name: matched.player.name,
      stats,
    });
  });

  const warnings = warningsOf(value.warnings);
  if (unmatchedRows.length) warnings.push(`有 ${unmatchedRows.length} 行未能匹配球员，请检查号码、姓名和队员名单。`);
  for (const row of rows) warnings.push(...rowWarnings(row));
  return {
    rows,
    unmatchedRows: unmatchedRows.slice(0, 40),
    warnings: [...new Set(warnings)].slice(0, 40),
    score: parsedScore(value.score),
    engine: semanticEngineName(),
  };
}

export async function recognizeFilledStatSheet(
  matchId: string,
  filledImage: string,
  template: MatchStatSheetTemplate,
  sport: Sport,
  teams: Team[],
  score?: Score,
): Promise<ParsedStatSheet> {
  const failures: string[] = [];
  if (semanticOcrIsConfigured()) {
    try {
      const parsed = await semanticFilledRecognition(
        savedTemplateDataUrl(matchId),
        filledImage,
        template,
        sport,
        teams,
        score,
      );
      if (parsed.rows.length > 0) return parsed;
      failures.push('模板视觉模型没有识别出可匹配的球员记录。');
    } catch (error) {
      failures.push(`模板视觉识别失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  if (ocrIsConfigured()) {
    try {
      const source = await recognizeStatSheet(filledImage, teams);
      const parsed = parseTemplateStatSheet(source, teams, template, score);
      return { ...parsed, warnings: [...failures, ...parsed.warnings], engine: ocrEngineName() };
    } catch (error) {
      failures.push(`${ocrEngineName()} 识别失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  return {
    rows: [],
    unmatchedRows: [],
    warnings: failures.length
      ? failures
      : ['赛后照片已留档，但没有可用的识别服务。配置 FORM_VLM_API_URL 或 OCR_SERVICE_URL 后重新识别。'],
  };
}
