import { describe, expect, it } from 'vitest';
import type { MatchStatSheetTemplate, Team } from '../src/types';
import { analyzeTemplateOcrText, parseBasketballStatSheet, parseTemplateStatSheet } from './statSheet';

const teams: Team[] = [
  {
    id: 'home',
    leagueId: 'league',
    name: '计算机学院',
    short: '计算机',
    color: '#000',
    players: [
      { id: 'h10', teamId: 'home', className: '1班', name: '张三', number: '10', position: '', gender: '', height: '', weight: '' },
      { id: 'h11', teamId: 'home', className: '1班', name: '李四', number: '11', position: '', gender: '', height: '', weight: '' },
    ],
  },
  {
    id: 'away',
    leagueId: 'league',
    name: '机电工程学院',
    short: '机电',
    color: '#fff',
    players: [
      { id: 'a10', teamId: 'away', className: '2班', name: '王五', number: '10', position: '', gender: '', height: '', weight: '' },
      { id: 'a12', teamId: 'away', className: '2班', name: '赵六', number: '12', position: '', gender: '', height: '', weight: '' },
    ],
  },
];

describe('parseBasketballStatSheet', () => {
  it('maps PaddleOCR HTML and Markdown tables to rosters', () => {
    const source = `
      <h2>计算机学院技术统计</h2>
      <table>
        <tr><th>号码</th><th>姓名</th><th>2分</th><th>3分</th><th>罚球</th><th>前板</th><th>后板</th><th>篮板</th><th>助攻</th><th>抢断</th><th>盖帽</th><th>失误</th><th>犯规</th><th>得分</th></tr>
        <tr><td>10</td><td>张三</td><td>4/8</td><td>1/3</td><td>3/4</td><td>2</td><td>3</td><td>5</td><td>4</td><td>2</td><td>1</td><td>3</td><td>2</td><td>14</td></tr>
      </table>

      ## 机电工程学院
      | 号码 | 姓名 | 2分 | 3分 | 罚球 | 前板 | 后板 | 篮板 | 助攻 | 抢断 | 盖帽 | 失误 | 犯规 | 得分 |
      | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
      | 10 | 王五 | 2/5 | 1/2 | 1/2 | 1 | 2 | 3 | 1 | 1 | 0 | 2 | 3 | 8 |
    `;

    const parsed = parseBasketballStatSheet(source, teams, { home: 14, away: 8 });
    expect(parsed.unmatchedRows).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      playerId: 'h10',
      stats: {
        points: 14,
        twoPointsMade: 4,
        twoPointsAttempted: 8,
        fouls: 2,
      },
    });
    expect(parsed.rows[1]).toMatchObject({
      playerId: 'a10',
      stats: {
        points: 8,
        rebounds: 3,
        assists: 1,
      },
    });
    expect(parsed.warnings).toEqual([]);
  });

  it('uses table order to disambiguate duplicate jersey numbers and derives totals', () => {
    const source = `
      <table>
        <tr><th rowspan="2">号码</th><th rowspan="2">姓名</th><th colspan="2">2分</th><th colspan="2">3分</th><th colspan="2">罚球</th><th rowspan="2">前板</th><th rowspan="2">后板</th><th rowspan="2">犯规</th></tr>
        <tr><th>中</th><th>投</th><th>中</th><th>投</th><th>中</th><th>投</th></tr>
        <tr><td>10</td><td></td><td>2</td><td>4</td><td>1</td><td>2</td><td>3</td><td>4</td><td>1</td><td>2</td><td>4</td></tr>
      </table>
      <table>
        <tr><th>号码</th><th>姓名</th><th>得分</th><th>犯规</th></tr>
        <tr><td>10</td><td></td><td>7</td><td>1</td></tr>
      </table>
    `;

    const parsed = parseBasketballStatSheet(source, teams);
    expect(parsed.rows.map((row) => row.playerId)).toEqual(['h10', 'a10']);
    expect(parsed.rows[0].stats).toMatchObject({ points: 10, rebounds: 3 });
    expect(parsed.warnings).toContain('第 1 个表格未识别出队名，已按主队、客队顺序匹配。');
    expect(parsed.warnings).toContain('第 2 个表格未识别出队名，已按主队、客队顺序匹配。');
  });

  it('keeps unknown players out of the draft and reports them', () => {
    const source = `
      | 球队 | 号码 | 姓名 | 得分 | 犯规 |
      | --- | --- | --- | --- | --- |
      | 计算机学院 | 99 | 未报名 | 12 | 2 |
    `;
    const parsed = parseBasketballStatSheet(source, teams);
    expect(parsed.rows).toEqual([]);
    expect(parsed.unmatchedRows).toHaveLength(1);
    expect(parsed.warnings).toContain('有 1 行未能匹配球员，请检查号码、姓名和队员名单。');
  });

  it('discovers the semantics of a FIBA-style blank template', () => {
    const source = `
      # 国际篮联联合会记录表
      A队 B队
      <table>
        <tr><th>号码</th><th>姓名</th><th colspan="5">犯规</th></tr>
        <tr><th></th><th></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
      </table>
      全队犯规 累积分 每节得分 最后比分
    `;
    const analysis = analyzeTemplateOcrText(source, 'basketball');
    expect(analysis.kind).toBe('fiba-scoresheet');
    expect(analysis.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(['playerNumber', 'playerName', 'fouls', 'teamFouls', 'runningScore', 'points', 'periodScore', 'finalScore']),
    );
  });

  it('limits filled values to fields discovered from the selected template', () => {
    const template: MatchStatSheetTemplate = {
      imageUrl: '/uploads/matches/m-template.jpg',
      uploadedAt: '2026-11-06T00:00:00.000Z',
      kind: 'box-score',
      warnings: [],
      fields: [
        { key: 'playerNumber', label: '号码' },
        { key: 'points', label: '进球' },
      ],
    };
    const source = `
      | 球队 | 号码 | 姓名 | 进球 | 助攻 |
      | --- | --- | --- | --- | --- |
      | 计算机学院 | 10 | 张三 | 2 | 1 |
    `;
    const parsed = parseTemplateStatSheet(source, teams, template);
    expect(parsed.rows[0].stats).toEqual({ points: 2 });
  });
});
