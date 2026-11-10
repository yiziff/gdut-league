import { normalizePhone } from './phone';

export interface ClubRosterEntry {
  name: string;
  number: string;
  phone: string;
}

const HEADER = /^(姓名|名字|号码|球衣号码|手机|手机号|手机号码|电话)$/;

/** 球队常备名单：每行「姓名 号码 手机号」，用逗号、制表符或空格隔开，手机号可以不填，列顺序不限。 */
export function parseClubRoster(text: string): ClubRosterEntry[] {
  const entries: ClubRosterEntry[] = [];
  const numbers = new Map<string, number>();
  const phones = new Map<string, number>();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = index + 1;
    const fields = raw
      // 「139 0013 9000」「139-0013-9000」先拼回一个字段，免得被当成号码和名字
      .replace(/(?<!\d)(1\d{2})[ -](\d{4})[ -](\d{4})(?!\d)/g, '$1$2$3')
      .split(/[\t,，]|\s+/)
      .map((field) => field.trim())
      .filter(Boolean);
    if (fields.length === 0 || fields.every((field) => HEADER.test(field))) return;
    let phone = '';
    let number = '';
    const rest: string[] = [];
    for (const field of fields) {
      const digits = field.replace(/[\s-]/g, '');
      if (/^\+?\d{7,}$/.test(digits)) {
        phone = normalizePhone(digits);
        if (!phone) throw new Error(`第 ${line} 行的手机号 ${field} 不对`);
      } else if (/^\d{1,3}$/.test(field) && !number) {
        number = field;
      } else {
        rest.push(field);
      }
    }
    const name = rest.join('');
    if (!name || !number) throw new Error(`第 ${line} 行要写姓名和号码`);
    if (numbers.has(number)) throw new Error(`第 ${line} 行的号码 ${number} 和第 ${numbers.get(number)} 行重复`);
    if (phone && phones.has(phone)) throw new Error(`第 ${line} 行的手机号和第 ${phones.get(phone)} 行重复`);
    numbers.set(number, line);
    if (phone) phones.set(phone, line);
    entries.push({ name, number, phone });
  });
  if (entries.length === 0) throw new Error('名单是空的');
  return entries;
}
