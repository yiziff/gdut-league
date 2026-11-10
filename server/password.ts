import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ApiError } from './http.ts';

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 8;
const failures = new Map<string, { count: number; since: number }>();

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function passwordFrom(value: unknown): string {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 6) throw new ApiError(400, '密码至少 6 位');
  if (password.length > 64) throw new ApiError(400, '密码最多 64 位');
  return password;
}

/** scrypt 哈希，只存盐和哈希，格式是「盐.哈希」。 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString('hex')}.${hash.toString('hex')}`;
}

export function passwordMatches(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split('.');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function loginBlocked(phone: string): boolean {
  const row = failures.get(phone);
  if (!row) return false;
  if (now() - row.since >= WINDOW_SECONDS) {
    failures.delete(phone);
    return false;
  }
  return row.count >= MAX_FAILURES;
}

export function recordLoginFailure(phone: string): void {
  const row = failures.get(phone);
  if (!row || now() - row.since >= WINDOW_SECONDS) failures.set(phone, { count: 1, since: now() });
  else row.count += 1;
}

export function clearLoginFailure(phone: string): void {
  failures.delete(phone);
}
