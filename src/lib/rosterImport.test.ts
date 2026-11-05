import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { documentXmlToText, unzipEntry } from './docxRoster';
import { parseRoster } from './rosterImport';

describe('parseRoster', () => {
  it('reads a team heading followed by players', () => {
    const teams = parseRoster(`计算机学院,计算机
软件工程1班,张三,10
软件工程1班,李四,11

机电工程学院
机械1班,王五,7`);
    expect(teams).toEqual([
      {
        name: '计算机学院',
        short: '计算机',
        players: [
          { className: '软件工程1班', name: '张三', number: '10' },
          { className: '软件工程1班', name: '李四', number: '11' },
        ],
      },
      {
        name: '机电工程学院',
        short: '机电工程',
        players: [{ className: '机械1班', name: '王五', number: '7' }],
      },
    ]);
  });

  it('reads a four-column table and skips the header', () => {
    const teams = parseRoster('队伍\t班级\t姓名\t号码\n计算机学院\t软件工程 1 班\t张三\t10\n计算机学院\t软件工程 1 班\t李四\t11');
    expect(teams).toHaveLength(1);
    expect(teams[0].players.map((player) => player.number)).toEqual(['10', '11']);
    expect(teams[0].players[0].className).toBe('软件工程 1 班');
  });

  it('rejects a repeated number in the same team', () => {
    expect(() => parseRoster('计算机学院\n一班,张三,10\n一班,李四,10')).toThrow(/号码 10/);
  });

  it('asks for a team name before player rows', () => {
    expect(() => parseRoster('一班,张三,10')).toThrow(/队伍名称/);
  });
});

describe('docx text', () => {
  it('turns a Word table into tab-separated lines', () => {
    const xml = `<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:tbl>
          <w:tr><w:tc><w:p><w:r><w:t>队伍</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>班级</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>姓名</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>号码</w:t></w:r></w:p></w:tc></w:tr>
          <w:tr><w:tc><w:p><w:r><w:t>计算机学院</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>软件1班</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>张三</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>
      </w:document>`;
    const text = documentXmlToText(xml);
    expect(parseRoster(text)[0].players[0]).toEqual({ className: '软件1班', name: '张三', number: '10' });

    const payload = Buffer.from(xml);
    const compressed = deflateRawSync(payload);
    const name = Buffer.from('word/document.xml');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(payload.length, 22);
    header.writeUInt16LE(name.length, 26);
    const zip = Buffer.concat([header, name, compressed]);
    expect(unzipEntry(zip, 'word/document.xml').toString('utf8')).toBe(xml);
  });
});
