// 生成 src/data/<sport>.json 示例数据。只用于初始化演示数据，正式赛事请直接编辑 JSON。
// 用法：node scripts/gen-sample-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../src/data');
const teams = JSON.parse(readFileSync(join(dataDir, 'teams.json'), 'utf8'));
const NOW = new Date('2026-11-03T15:00');

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONFIG = {
  basketball: {
    prefix: 'bb',
    seed: 11,
    venues: ['大学城校区体育馆', '东区风雨球场', '西区篮球场'],
    divisions: [
      { division: 'men', groups: 4, start: '2026-10-10', ko: { QF: ['2026-11-01', '2026-11-02'], SF: '2026-11-03', F: '2026-11-08' } },
      { division: 'women', groups: 2, start: '2026-10-14', ko: { SF: '2026-11-04', F: '2026-11-09' } },
    ],
  },
  football: {
    prefix: 'fb',
    seed: 22,
    venues: ['东区足球场', '西区足球场', '龙洞校区足球场'],
    divisions: [
      { division: 'men', groups: 4, start: '2026-10-08', ko: { QF: ['2026-10-31', '2026-11-01'], SF: '2026-11-07', F: '2026-11-14' } },
    ],
  },
  volleyball: {
    prefix: 'vb',
    seed: 33,
    venues: ['排球馆', '东区排球场'],
    divisions: [
      { division: 'men', groups: 2, start: '2026-10-12', ko: { SF: '2026-11-03', F: '2026-11-10' } },
      { division: 'women', groups: 2, start: '2026-10-13', ko: { SF: '2026-11-05', F: '2026-11-10' } },
    ],
  },
  badminton: {
    prefix: 'bd',
    seed: 44,
    venues: ['羽毛球馆'],
    divisions: [{ division: 'mixed', groups: 2, start: '2026-10-11', ko: { SF: '2026-11-01', F: '2026-11-02' } }],
  },
  tabletennis: {
    prefix: 'tt',
    seed: 55,
    venues: ['乒乓球馆', '龙洞校区乒乓球室'],
    divisions: [{ division: 'mixed', groups: 2, start: '2026-10-20', ko: { SF: '2026-11-12', F: '2026-11-15' } }],
  },
};

const ROUND_ROBIN_4 = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

function addDays(date, days) {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function statusOf(time) {
  const t = new Date(time);
  const hours = (NOW - t) / 36e5;
  if (hours >= 2) return 'finished';
  if (hours >= 0) return 'live';
  return 'scheduled';
}

function makeSimulator(sport, rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

  const playSets = (edge, best, live) => {
    const need = Math.ceil(best / 2);
    const sets = [];
    let h = 0;
    let a = 0;
    while (h < need && a < need) {
      const isLast = sets.length === best - 1;
      const target = sport === 'volleyball' && isLast ? 15 : 25;
      const homeWins = rand() < 0.5 + edge;
      const loser = rand() < 0.15 ? target - 1 : int(Math.round(target * 0.55), target - 3);
      const win = loser === target - 1 ? target + 1 : target;
      sets.push(homeWins ? [win, loser] : [loser, win]);
      homeWins ? h++ : a++;
      if (live && sets.length === 2) {
        sets.push([int(8, 18), int(8, 18)]);
        return { score: { home: h, away: a }, sets };
      }
    }
    return { score: { home: h, away: a }, sets };
  };

  return (sh, sa, knockout, live) => {
    const edge = (sh - sa) * 0.35;
    switch (sport) {
      case 'basketball': {
        const scale = live ? 0.5 : 1;
        let home = Math.round((52 + sh * 25 + rand() * 18) * scale);
        let away = Math.round((52 + sa * 25 + rand() * 18) * scale);
        if (home === away && !live) home += 2;
        return { score: { home, away } };
      }
      case 'football': {
        const goals = (s) => Math.floor(rand() * 2.2 + s * 2 * rand());
        const result = { score: { home: goals(sh), away: goals(sa) } };
        if (live) return { score: { home: Math.min(result.score.home, 1), away: Math.min(result.score.away, 1) } };
        if (knockout && result.score.home === result.score.away) {
          const homeWins = rand() < 0.5;
          const loser = int(2, 4);
          result.penalties = homeWins ? { home: loser + 1, away: loser } : { home: loser, away: loser + 1 };
        }
        return result;
      }
      case 'volleyball':
        return playSets(edge, 5, live);
      default: {
        if (live) return { score: { home: 1, away: 1 } };
        let home = 0;
        let away = 0;
        while (home < 3 && away < 3) rand() < 0.5 + edge ? home++ : away++;
        return { score: { home, away } };
      }
    }
  };
}

function generate(sport) {
  const cfg = CONFIG[sport];
  const rand = mulberry32(cfg.seed);
  const simulate = makeSimulator(sport, rand);
  const strength = Object.fromEntries(teams.map((t) => [t.id, rand()]));
  const matches = [];

  for (const div of cfg.divisions) {
    const tag = `${cfg.prefix}-${div.division[0]}`;
    const pool = [...teams].sort(() => rand() - 0.5).slice(0, div.groups * 4);
    let seq = 0;
    let forfeitDone = sport !== 'basketball' || div.division !== 'women';

    for (let g = 0; g < div.groups; g++) {
      const group = String.fromCharCode(65 + g);
      const members = pool.slice(g * 4, g * 4 + 4).map((t) => t.id);
      ROUND_ROBIN_4.forEach((round, r) => {
        const date = addDays(div.start, r * 7 + g);
        round.forEach(([i, j], k) => {
          const time = `${date}T${k === 0 ? '14:00' : '16:00'}`;
          const status = statusOf(time);
          const m = {
            id: `${tag}-g${String(++seq).padStart(2, '0')}`,
            sport,
            division: div.division,
            stage: 'group',
            group,
            home: members[i],
            away: members[j],
            time,
            venue: cfg.venues[(g + k) % cfg.venues.length],
            status,
          };
          if (status !== 'scheduled') {
            if (!forfeitDone && status === 'finished' && r === 1) {
              Object.assign(m, { score: { home: 20, away: 0 }, forfeit: 'away' });
              forfeitDone = true;
            } else {
              Object.assign(m, simulate(strength[m.home], strength[m.away], false, status === 'live'));
            }
          }
          matches.push(m);
        });
      });
    }

    const ko = [];
    const push = (id, stage, time, extra) => ko.push({ id: `${tag}-${id}`, stage, time, ...extra });
    const link = (next, slot) => ({ nextMatchId: `${tag}-${next}`, nextSlot: slot });
    const loserLink = (slot) => ({ loserNextMatchId: `${tag}-3rd`, loserNextSlot: slot });

    if (div.ko.QF) {
      const [d1, d2] = div.ko.QF;
      push('qf1', 'QF', `${d1}T14:00`, { homeSeed: 'A1', awaySeed: 'B2', ...link('sf1', 'home') });
      push('qf2', 'QF', `${d1}T16:00`, { homeSeed: 'C1', awaySeed: 'D2', ...link('sf1', 'away') });
      push('qf3', 'QF', `${d2}T14:00`, { homeSeed: 'B1', awaySeed: 'A2', ...link('sf2', 'home') });
      push('qf4', 'QF', `${d2}T16:00`, { homeSeed: 'D1', awaySeed: 'C2', ...link('sf2', 'away') });
      push('sf1', 'SF', `${div.ko.SF}T14:00`, { ...link('f', 'home'), ...loserLink('home') });
      push('sf2', 'SF', `${div.ko.SF}T16:00`, { ...link('f', 'away'), ...loserLink('away') });
    } else {
      push('sf1', 'SF', `${div.ko.SF}T14:00`, { homeSeed: 'A1', awaySeed: 'B2', ...link('f', 'home'), ...loserLink('home') });
      push('sf2', 'SF', `${div.ko.SF}T16:00`, { homeSeed: 'B1', awaySeed: 'A2', ...link('f', 'away'), ...loserLink('away') });
    }
    push('3rd', '3rd', `${div.ko.F}T14:00`, {});
    push('f', 'F', `${div.ko.F}T16:00`, {});

    ko.forEach((k, idx) => {
      const status = statusOf(k.time);
      const m = {
        id: k.id,
        sport,
        division: div.division,
        stage: k.stage,
        home: null,
        away: null,
        homeSeed: k.homeSeed,
        awaySeed: k.awaySeed,
        time: k.time,
        venue: cfg.venues[idx % cfg.venues.length],
        status,
        nextMatchId: k.nextMatchId,
        nextSlot: k.nextSlot,
        loserNextMatchId: k.loserNextMatchId,
        loserNextSlot: k.loserNextSlot,
      };
      if (status !== 'scheduled') Object.assign(m, simulate(0.5, 0.5, true, status === 'live'));
      matches.push(m);
    });
  }

  matches.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  writeFileSync(join(dataDir, `${sport}.json`), JSON.stringify({ sport, matches }, null, 2) + '\n');
  console.log(`${sport}: ${matches.length} matches`);
}

Object.keys(CONFIG).forEach(generate);
