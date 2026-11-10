import { normalizePhone } from './phone';

export interface ImportedPlayer {
  className: string;
  name: string;
  number: string;
  /** 名单里填了手机号才有 */
  phone?: string;
}

export interface ImportedTeam {
  name: string;
  short: string;
  players: ImportedPlayer[];
}

const HEADER_WORDS = new Set([
  '队伍',
  '队名',
  '学院',
  '队伍名称',
  '班级',
  '姓名',
  '名字',
  '号码',
  '球衣',
  '球衣号码',
  '简称',
  '编号',
  '手机',
  '手机号',
  '手机号码',
  '电话',
  '联系电话',
]);

/** 手机号可以放在任意一列（队伍名那列除外），拿出来后剩下的列按原来的格式解析。 */
function takePhone(fields: string[], line: number): { fields: string[]; phone?: string } {
  const at = fields.findIndex((field, index) => index > 0 && /^\+?[\d\s-]{7,}$/.test(field) && field.replace(/\D/g, '').length >= 7);
  if (at < 0) return { fields };
  const phone = normalizePhone(fields[at]);
  if (!phone) throw new Error(`第 ${line} 行的手机号 ${fields[at]} 不对`);
  return { fields: fields.filter((_, index) => index !== at), phone };
}

function splitFields(line: string): string[] {
  const sep = line.includes('\t') ? '\t' : line.includes(',') ? ',' : line.includes('，') ? '，' : null;
  if (!sep) return [line.trim()].filter(Boolean);
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && ch === sep) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  while (fields.length > 1 && fields[fields.length - 1] === '') fields.pop();
  return fields;
}

function isHeader(fields: string[]): boolean {
  if (fields.length < 2) return false;
  const keys = fields.map((field) => field.replace(/\s/g, ''));
  return keys.every((key) => HEADER_WORDS.has(key));
}

function shortOf(name: string, given?: string): string {
  const short = given?.trim();
  if (short) return short;
  return name.slice(0, 4);
}

/** 把粘贴的表格或文本解析成队伍和队员。四列是「队伍,班级,姓名,号码」，也可以先写队伍名，再写三列队员。 */
export function parseRoster(text: string): ImportedTeam[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const rows: { line: number; fields: string[]; phone?: string }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index].trim();
    if (!raw) continue;
    const split = splitFields(raw);
    if (split.length === 0 || isHeader(split)) continue;
    rows.push({ line: index + 1, ...takePhone(split, index + 1) });
  }
  if (rows.length === 0) throw new Error('名单是空的');

  const columnMode = rows.some((row) => row.fields.length >= 4);
  const teams: ImportedTeam[] = [];
  const byName = new Map<string, ImportedTeam>();
  const numbers = new Map<string, Map<string, number>>();

  function teamFor(name: string, short: string | undefined, line: number): ImportedTeam {
    const existing = byName.get(name);
    if (existing) {
      if (short?.trim() && existing.short === existing.name.slice(0, 4)) existing.short = short.trim();
      return existing;
    }
    if (!name) throw new Error(`第 ${line} 行缺少队伍名称`);
    const team: ImportedTeam = { name, short: shortOf(name, short), players: [] };
    teams.push(team);
    byName.set(name, team);
    numbers.set(name, new Map());
    return team;
  }

  function addPlayer(team: ImportedTeam, player: ImportedPlayer, line: number): void {
    if (!player.className || !player.name || !player.number) {
      throw new Error(`第 ${line} 行要写齐班级、姓名和号码`);
    }
    const used = numbers.get(team.name)!;
    const previous = used.get(player.number);
    if (previous) throw new Error(`第 ${line} 行的号码 ${player.number} 和第 ${previous} 行在「${team.name}」里重复`);
    if (player.phone) {
      const twin = team.players.find((item) => item.phone === player.phone);
      if (twin) throw new Error(`第 ${line} 行的手机号和「${team.name}」里的 ${twin.name} 重复`);
    }
    used.set(player.number, line);
    team.players.push(player);
  }

  let current: ImportedTeam | null = null;
  for (const row of rows) {
    const { line, fields } = row;
    const phone = row.phone ? { phone: row.phone } : {};
    if (columnMode) {
      if (fields.length < 4 || fields.length > 5) {
        throw new Error(`第 ${line} 行应为「队伍,班级,姓名,号码」`);
      }
      const [name, className, playerName, number, short] = fields;
      const team = teamFor(name, short, line);
      addPlayer(team, { className, name: playerName, number, ...phone }, line);
      continue;
    }
    if (fields.length === 1) {
      current = teamFor(fields[0], undefined, line);
      continue;
    }
    if (fields.length === 2) {
      current = teamFor(fields[0], fields[1], line);
      continue;
    }
    if (fields.length === 3) {
      if (!current) throw new Error(`第 ${line} 行前面要先写队伍名称，或改成四列：队伍,班级,姓名,号码`);
      addPlayer(current, { className: fields[0], name: fields[1], number: fields[2], ...phone }, line);
      continue;
    }
    throw new Error(`第 ${line} 行格式不对`);
  }

  if (teams.length === 0) throw new Error('没有识别到队伍');
  return teams;
}
