export interface RoundRobinPairing {
  round: number;
  home: string;
  away: string;
}

/** 单循环对阵。队伍数为奇数时，每轮有一支轮空。 */
export function roundRobinPairings(teamIds: string[]): RoundRobinPairing[] {
  const list = [...teamIds];
  if (list.length < 2) return [];
  if (list.length % 2 === 1) list.push('');
  const count = list.length;
  const half = count / 2;
  let rotation = list.slice();
  const matches: RoundRobinPairing[] = [];

  for (let round = 0; round < count - 1; round++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i];
      const b = rotation[count - 1 - i];
      if (!a || !b) continue;
      const swap = round % 2 === 1;
      matches.push({ round, home: swap ? b : a, away: swap ? a : b });
    }
    const rest = rotation.slice(1);
    const moved = rest.pop()!;
    rest.unshift(moved);
    rotation = [rotation[0], ...rest];
  }
  return matches;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
