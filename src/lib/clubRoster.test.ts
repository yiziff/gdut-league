import { describe, expect, it } from 'vitest';
import { parseClubRoster } from './clubRoster';

describe('parseClubRoster', () => {
  it('reads name, number and an optional phone in any order', () => {
    expect(parseClubRoster('姓名,号码,手机号\n张三,10,13800138000\n23 李四\n王五\t7\t139 0013 9000')).toEqual([
      { name: '张三', number: '10', phone: '13800138000' },
      { name: '李四', number: '23', phone: '' },
      { name: '王五', number: '7', phone: '13900139000' },
    ]);
  });

  it('rejects repeated numbers, bad phones and missing fields', () => {
    expect(() => parseClubRoster('张三 10\n李四 10')).toThrow(/号码 10/);
    expect(() => parseClubRoster('张三 10 1380013800')).toThrow(/手机号/);
    expect(() => parseClubRoster('张三')).toThrow(/姓名和号码/);
  });
});
