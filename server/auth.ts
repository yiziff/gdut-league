import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { db } from './db.ts';

const COOKIE = 'gdut_session';
const PLAYER_COOKIE = 'gdut_player';
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

function readNamedCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function readCookie(req: Request): string | undefined {
  return readNamedCookie(req, COOKIE);
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

export function createPlayerSession(playerId: string): string {
  const token = randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + WEEK;
  db.prepare('INSERT INTO player_sessions (token, player_id, expires_at) VALUES (?, ?, ?)').run(token, playerId, expires);
  return token;
}

export function destroyPlayerSession(token: string | undefined): void {
  if (token) db.prepare('DELETE FROM player_sessions WHERE token = ?').run(token);
}

export function readPlayerToken(req: Request): string | undefined {
  return readNamedCookie(req, PLAYER_COOKIE);
}

export function playerIdFromRequest(req: Request): string | undefined {
  const token = readPlayerToken(req);
  if (!token) return undefined;
  const row = db.prepare('SELECT player_id, expires_at FROM player_sessions WHERE token = ?').get(token) as
    | { player_id: string; expires_at: number }
    | undefined;
  if (!row || row.expires_at < Date.now() / 1000) {
    destroyPlayerSession(token);
    return undefined;
  }
  return row.player_id;
}

export function setPlayerCookie(res: Response, token: string): void {
  res.append('Set-Cookie', `${PLAYER_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${WEEK}`);
}

export function clearPlayerCookie(res: Response): void {
  res.append('Set-Cookie', `${PLAYER_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export { readCookie };
