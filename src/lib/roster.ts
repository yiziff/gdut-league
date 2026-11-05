export interface RosterLine {
  name: string;
  players: string[];
}

/** 把「张三、李四 王五」拆成队员姓名，重复的名字只保留一次。 */
export function parsePlayerList(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of text.split(/[、,，;；\s]+/)) {
    const name = part.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

/**
 * 每行一支队伍。冒号后面是队员，没有冒号就只报名队伍。
 * 空行忽略，队员可以留空，以后再补。
 */
export function parseRoster(text: string): RosterLine[] {
  const lines: RosterLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const splitAt = line.search(/[:：]/);
    const name = (splitAt === -1 ? line : line.slice(0, splitAt)).trim();
    if (!name) continue;
    const players = splitAt === -1 ? [] : parsePlayerList(line.slice(splitAt + 1));
    lines.push({ name, players });
  }
  return lines;
}

export function shortName(name: string): string {
  return name.length <= 6 ? name : name.slice(0, 4);
}
