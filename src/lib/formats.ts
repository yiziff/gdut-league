import type { Division, Side, Stage } from '../types';
import { addDays, roundRobinPairings } from './roundRobin';

export type FormatPreset = 'round_robin' | 'double_round_robin' | 'groups_knockout' | 'single_elim';

export interface PlannedMatch {
  id: string;
  division: Division;
  stage: Stage;
  group?: string;
  home: string | null;
  away: string | null;
  homeSeed?: string;
  awaySeed?: string;
  time: string;
  venue: string;
  nextMatchId?: string;
  nextSlot?: Side;
  loserNextMatchId?: string;
  loserNextSlot?: Side;
}

export interface FormatPlanInput {
  preset: FormatPreset;
  division: Division;
  startDate: string;
  venue: string;
  teamIds: string[];
  groupCount: number;
  qualifiers: number;
  bracketSize: number;
  thirdPlace: boolean;
}

interface Slot {
  team: string | null;
  seed?: string;
}

interface Clock {
  next(round: number): { time: string; venue: string };
}

function clock(startDate: string, venue: string): Clock {
  const used = new Map<number, number>();
  return {
    next(round: number) {
      const slot = used.get(round) ?? 0;
      used.set(round, slot + 1);
      const hour = 14 + (slot % 4) * 2;
      return {
        time: `${addDays(startDate, round * 7)}T${String(hour).padStart(2, '0')}:00`,
        venue,
      };
    },
  };
}

/** 1 号种子对阵末号。4 签得到 [1,4,2,3]，8 签得到 [1,8,4,5,2,7,3,6]。 */
export function seedOrder(size: number): number[] {
  if (size === 2) return [1, 2];
  const previous = seedOrder(size / 2);
  return previous.flatMap((seed) => [seed, size + 1 - seed]);
}

function stageFor(matchCount: number): Stage {
  if (matchCount >= 8) return 'R16';
  if (matchCount >= 4) return 'QF';
  if (matchCount >= 2) return 'SF';
  return 'F';
}

function assertPowerOfTwo(size: number, label: string): void {
  if (![2, 4, 8, 16].includes(size)) throw new Error(`${label}只支持 2、4、8、16 个签位`);
}

function buildElim(
  slots: Slot[],
  division: Division,
  thirdPlace: boolean,
  roundOffset: number,
  timer: Clock,
  createId: () => string,
): PlannedMatch[] {
  assertPowerOfTwo(slots.length, '淘汰赛');
  const order = seedOrder(slots.length);
  let roundSlots: { id: string; home: Slot; away: Slot }[] = [];
  for (let i = 0; i < order.length; i += 2) {
    roundSlots.push({ id: createId(), home: slots[order[i] - 1], away: slots[order[i + 1] - 1] });
  }
  const rounds = [roundSlots];
  while (roundSlots.length > 1) {
    const next = Array.from({ length: roundSlots.length / 2 }, () => ({
      id: createId(),
      home: { team: null } as Slot,
      away: { team: null } as Slot,
    }));
    rounds.push(next);
    roundSlots = next;
  }

  const matches: PlannedMatch[] = [];
  rounds.forEach((round, roundIndex) => {
    round.forEach((slot, index) => {
      const next = rounds[roundIndex + 1]?.[Math.floor(index / 2)];
      const when = timer.next(roundOffset + roundIndex);
      matches.push({
        id: slot.id,
        division,
        stage: stageFor(round.length),
        home: slot.home.team,
        away: slot.away.team,
        homeSeed: slot.home.seed,
        awaySeed: slot.away.seed,
        ...when,
        nextMatchId: next?.id,
        nextSlot: next ? (index % 2 === 0 ? 'home' : 'away') : undefined,
      });
    });
  });

  const semis = rounds.length >= 2 ? rounds[rounds.length - 2] : undefined;
  if (thirdPlace && semis?.length === 2) {
    const thirdId = createId();
    matches.push({
      id: thirdId,
      division,
      stage: '3rd',
      home: null,
      away: null,
      ...timer.next(roundOffset + rounds.length - 1),
    });
    semis.forEach((semi, index) => {
      const match = matches.find((item) => item.id === semi.id);
      if (!match) return;
      match.loserNextMatchId = thirdId;
      match.loserNextSlot = index === 0 ? 'home' : 'away';
    });
  }
  return matches;
}

function roundRobinPlan(input: FormatPlanInput, timer: Clock, createId: () => string, double: boolean): PlannedMatch[] {
  if (input.teamIds.length < 2) throw new Error('循环赛至少需要两支队伍，可以等报名后再生成');
  const pairings = roundRobinPairings(input.teamIds);
  const span = Math.max(...pairings.map((pairing) => pairing.round)) + 1;
  const legs = double
    ? [...pairings, ...pairings.map((pairing) => ({ round: pairing.round + span, home: pairing.away, away: pairing.home }))]
    : pairings;
  return legs.map((pairing) => ({
    id: createId(),
    division: input.division,
    stage: 'group',
    group: 'A',
    home: pairing.home,
    away: pairing.away,
    ...timer.next(pairing.round),
  }));
}

function groupsPlan(input: FormatPlanInput, timer: Clock, createId: () => string): PlannedMatch[] {
  if (![2, 4, 8].includes(input.groupCount)) throw new Error('小组数量只支持 2、4、8');
  if (![1, 2].includes(input.qualifiers)) throw new Error('每组出线名额只支持 1 或 2');
  const letters = Array.from({ length: input.groupCount }, (_, index) => String.fromCharCode(65 + index));
  const buckets = letters.map(() => [] as string[]);
  input.teamIds.forEach((id, index) => buckets[index % input.groupCount].push(id));

  const matches: PlannedMatch[] = [];
  let maxRound = -1;
  letters.forEach((letter, index) => {
    for (const pairing of roundRobinPairings(buckets[index])) {
      maxRound = Math.max(maxRound, pairing.round);
      matches.push({
        id: createId(),
        division: input.division,
        stage: 'group',
        group: letter,
        home: pairing.home,
        away: pairing.away,
        ...timer.next(pairing.round),
      });
    }
  });

  const slots: Slot[] = Array.from({ length: input.groupCount * input.qualifiers }, (_, index) => ({
    team: null,
    seed: `${letters[index % input.groupCount]}${Math.floor(index / input.groupCount) + 1}`,
  }));
  matches.push(...buildElim(slots, input.division, input.thirdPlace, maxRound + 1, timer, createId));
  return matches;
}

function singleElimPlan(input: FormatPlanInput, timer: Clock, createId: () => string): PlannedMatch[] {
  if (![4, 8, 16].includes(input.bracketSize)) throw new Error('单败淘汰签位只支持 4、8、16');
  const slots: Slot[] = Array.from({ length: input.bracketSize }, (_, index) => ({
    team: input.teamIds[index] ?? null,
  }));
  return buildElim(slots, input.division, input.thirdPlace, 0, timer, createId);
}

/** 按赛制生成对阵。队伍可以比签位少，空位留待以后补上。 */
export function planFormat(input: FormatPlanInput, createId: () => string): PlannedMatch[] {
  const venue = input.venue.trim() || '待定';
  const timer = clock(input.startDate, venue);
  if (input.preset === 'round_robin') return roundRobinPlan(input, timer, createId, false);
  if (input.preset === 'double_round_robin') return roundRobinPlan(input, timer, createId, true);
  if (input.preset === 'groups_knockout') return groupsPlan(input, timer, createId);
  return singleElimPlan(input, timer, createId);
}
