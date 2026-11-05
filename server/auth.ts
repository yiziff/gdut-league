import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { db } from './db.ts';

const COOKIE = 'gdut_session';
const WEEK = 7 * 24 * 3600;
const SALT = 'gdut-league';

export function passwordOk(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || 'admin';
  const a = scryptSync(input, SALT, 32);
  const b = scryptSync(expected, SALT, 32);
  return timingSafeEqual(a, b);
}

export function createSession(): string {
  const token = randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + WEEK;
  db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, expires);
  return token;
}

export function destroySession(token: string | undefined): void {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function readCookie(req: Request): string | undefined {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function sessionValid(req: Request): boolean {
  const token = readCookie(req);
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token) as { expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now() / 1000) {
    destroySession(token);
    return false;
  }
  return true;
}

export function setSessionCookie(res: Response, token: string): void {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${WEEK}`);
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export { readCookie };
