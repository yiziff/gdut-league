import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve('data/uploads/leagues');
const avatarDir = resolve('data/uploads/players');

export function clearLeagueLogo(id: string): void {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return;
  for (const ext of ['jpg', 'png', 'webp']) {
    const file = resolve(dir, `${id}.${ext}`);
    if (existsSync(file)) rmSync(file);
  }
}

/** 接收前端压好的 data URL，存成 jpg，返回可访问路径。 */
export function saveLeagueLogo(id: string, dataUrl: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Logo 无法保存');
  const match = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new Error('Logo 需要是 jpg、png 或 webp');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length < 32 || bytes.length > 1_200_000) throw new Error('Logo 大小不合适');
  mkdirSync(dir, { recursive: true });
  clearLeagueLogo(id);
  writeFileSync(resolve(dir, `${id}.jpg`), bytes);
  return `/uploads/leagues/${id}.jpg?v=${Date.now()}`;
}

export function clearPlayerAvatar(id: string): void {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return;
  for (const ext of ['jpg', 'png', 'webp']) {
    const file = resolve(avatarDir, `${id}.${ext}`);
    if (existsSync(file)) rmSync(file);
  }
}

export function savePlayerAvatar(id: string, dataUrl: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('头像无法保存');
  const match = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new Error('头像需要是 jpg、png 或 webp');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length < 32 || bytes.length > 1_200_000) throw new Error('头像大小不合适');
  mkdirSync(avatarDir, { recursive: true });
  clearPlayerAvatar(id);
  writeFileSync(resolve(avatarDir, `${id}.jpg`), bytes);
  return `/uploads/players/${id}.jpg?v=${Date.now()}`;
}
