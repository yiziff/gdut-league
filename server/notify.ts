import { createHmac, randomUUID } from 'node:crypto';
import { maskPhone } from '../src/lib/phone.ts';
import type { ClubBrief } from '../src/types.ts';
import { db } from './db.ts';
import { nowLocal } from './clubStore.ts';

db.exec(`
  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    seen_at TEXT NOT NULL DEFAULT '',
    sms_status TEXT NOT NULL DEFAULT '',
    UNIQUE (user_id, kind, ref_id)
  );
  CREATE INDEX IF NOT EXISTS idx_notices_user ON notices(user_id, seen_at);
`);

const KIND = 'challenge_response';

export interface ChallengeNotice {
  id: string;
  challengeId: string;
  time: string;
  venue: string;
  club: ClubBrief;
}

export function challengeReminderText(club: string, when: string, venue: string): string {
  return `${club}来迎战你${when}在${venue}的约球，请到约球大厅确认。`;
}

function whenText(time: string): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const day = new Date(`${time.slice(0, 10)}T00:00`);
  return `${day.getMonth() + 1}月${day.getDate()}日 周${weekdays[day.getDay()]} ${time.slice(11, 16)}`;
}

function wechatTime(time: string): string {
  const [year, month, day] = time.slice(0, 10).split('-');
  return `${year}年${Number(month)}月${Number(day)}日 ${time.slice(11, 16)}`;
}

function clip(value: string, max: number): string {
  const text = value.trim() || '待定';
  return [...text].slice(0, max).join('');
}

interface ManagerContact {
  userId: string;
  phone: string;
  openid: string;
}

function contactsOfClub(clubId: string): ManagerContact[] {
  return db
    .prepare(
      `SELECT club_managers.user_id AS userId, COALESCE(users.phone, '') AS phone, COALESCE(users.wx_openid, '') AS openid
       FROM club_managers JOIN users ON users.id = club_managers.user_id
       WHERE club_managers.club_id = ?`,
    )
    .all(clubId) as unknown as ManagerContact[];
}

/** 已有的待确认迎战补一条站内提醒，不补发短信。 */
export function backfillChallengeNotices(): void {
  const rows = db
    .prepare(
      `SELECT challenge_responses.id AS responseId, challenges.id AS challengeId, challenges.club_id AS posterClubId
       FROM challenge_responses JOIN challenges ON challenges.id = challenge_responses.challenge_id
       WHERE challenge_responses.status = 'pending' AND challenges.status = 'open' AND challenges.time >= ?`,
    )
    .all(nowLocal()) as unknown as { responseId: string; challengeId: string; posterClubId: string }[];
  const insert = db.prepare(
    `INSERT INTO notices (id, user_id, kind, ref_id, challenge_id, created_at, seen_at, sms_status)
     VALUES (?, ?, ?, ?, ?, ?, '', 'skipped')
     ON CONFLICT(user_id, kind, ref_id) DO NOTHING`,
  );
  const now = new Date().toISOString();
  for (const row of rows) {
    for (const manager of contactsOfClub(row.posterClubId)) {
      insert.run(randomUUID(), manager.userId, KIND, row.responseId, row.challengeId, now);
    }
  }
}

export function remindChallengeResponse(input: {
  responseId: string;
  challengeId: string;
  posterClubId: string;
  challengerName: string;
  time: string;
  venue: string;
}): void {
  const when = whenText(input.time);
  const text = challengeReminderText(input.challengerName, when, input.venue);
  const fields = { club: clip(input.challengerName, 20), time: wechatTime(input.time), venue: clip(input.venue, 20), when };
  const open = db.prepare(
    `INSERT INTO notices (id, user_id, kind, ref_id, challenge_id, created_at, seen_at, sms_status)
     VALUES (?, ?, ?, ?, ?, ?, '', '')
     ON CONFLICT(user_id, kind, ref_id) DO UPDATE SET seen_at = '', sms_status = '', created_at = excluded.created_at
     RETURNING id`,
  );
  const claim = db.prepare(`UPDATE notices SET sms_status = 'sending' WHERE id = ? AND sms_status = ''`);
  const now = new Date().toISOString();
  for (const manager of contactsOfClub(input.posterClubId)) {
    const row = open.get(randomUUID(), manager.userId, KIND, input.responseId, input.challengeId, now) as { id: string };
    if (Number(claim.run(row.id).changes) !== 1) continue;
    void deliver(row.id, manager, text, fields);
  }
}

export function forgetChallengeResponse(responseId: string): void {
  db.prepare(`DELETE FROM notices WHERE kind = ? AND ref_id = ?`).run(KIND, responseId);
}

export function unseenChallengeNotices(userId: string): ChallengeNotice[] {
  const rows = db
    .prepare(
      `SELECT notices.id AS id, notices.challenge_id AS challengeId, challenges.time AS time, challenges.venue AS venue,
              clubs.id AS clubId, clubs.name AS name, clubs.short AS short, clubs.color AS color, clubs.logo AS logo
       FROM notices
       JOIN challenge_responses ON challenge_responses.id = notices.ref_id
       JOIN challenges ON challenges.id = notices.challenge_id
       JOIN clubs ON clubs.id = challenge_responses.club_id
       WHERE notices.user_id = ? AND notices.kind = ? AND notices.seen_at = ''
         AND challenge_responses.status = 'pending' AND challenges.status = 'open'
       ORDER BY notices.created_at DESC`,
    )
    .all(userId, KIND) as unknown as {
    id: string;
    challengeId: string;
    time: string;
    venue: string;
    clubId: string;
    name: string;
    short: string;
    color: string;
    logo: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    challengeId: row.challengeId,
    time: row.time,
    venue: row.venue,
    club: { id: row.clubId, name: row.name, short: row.short, color: row.color, logo: row.logo ?? '' },
  }));
}

export function markNoticesSeen(userId: string, ids: string[]): void {
  const clean = ids.filter((id) => /^[a-zA-Z0-9-]+$/.test(id)).slice(0, 20);
  if (clean.length === 0) return;
  const marks = clean.map(() => '?').join(', ');
  db.prepare(`UPDATE notices SET seen_at = ? WHERE user_id = ? AND id IN (${marks})`).run(new Date().toISOString(), userId, ...clean);
}

async function deliver(
  noticeId: string,
  manager: ManagerContact,
  text: string,
  fields: { club: string; time: string; venue: string; when: string },
): Promise<void> {
  const sms = await sendSms(manager.phone, text, fields);
  await sendWechat(manager.openid, fields);
  db.prepare(`UPDATE notices SET sms_status = ? WHERE id = ?`).run(sms, noticeId);
}

async function sendSms(phone: string, text: string, fields: { club: string; time: string; venue: string }): Promise<string> {
  if (!phone) return 'no-phone';
  const keyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID ?? '';
  const secret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET ?? '';
  const sign = process.env.ALIYUN_SMS_SIGN_NAME ?? '';
  const template = process.env.ALIYUN_SMS_TEMPLATE_CODE ?? '';
  if (keyId && secret && sign && template) {
    try {
      await sendAliyunSms(phone, sign, template, fields, keyId, secret);
      return 'sent';
    } catch (error) {
      console.error('[sms]', error instanceof Error ? error.message : error);
      return 'failed';
    }
  }
  const url = process.env.SMS_HTTP_URL ?? '';
  if (url) {
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (process.env.SMS_HTTP_TOKEN) headers.authorization = `Bearer ${process.env.SMS_HTTP_TOKEN}`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, text }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`短信网关返回 ${response.status}`);
      return 'sent';
    } catch (error) {
      console.error('[sms]', error instanceof Error ? error.message : error);
      return 'failed';
    }
  }
  console.info(`[sms] 还没配置短信网关，未发给 ${maskPhone(phone)}：${text}`);
  return 'unconfigured';
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~');
}

async function sendAliyunSms(
  phone: string,
  sign: string,
  template: string,
  fields: { club: string; time: string; venue: string },
  keyId: string,
  secret: string,
): Promise<void> {
  const params: Record<string, string> = {
    AccessKeyId: keyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: 'cn-hangzhou',
    SignName: sign,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: template,
    TemplateParam: JSON.stringify({ club: fields.club, time: fields.time, venue: fields.venue }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');
  const signature = createHmac('sha1', `${secret}&`).update(`POST&${percentEncode('/')}&${percentEncode(canonical)}`).digest('base64');
  const body = `${canonical}&Signature=${percentEncode(signature)}`;
  const response = await fetch('https://dysmsapi.aliyuncs.com/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(8000),
  });
  const data = (await response.json()) as { Code?: string; Message?: string };
  if (data.Code !== 'OK') throw new Error(data.Message || '短信发送失败');
}

let wxTokenCache: { token: string; until: number } | undefined;

/** 小程序订阅消息。配好 WX_CHALLENGE_TEMPLATE（thing1 球队、time2 时间、thing3 球场）才会发。 */
async function sendWechat(openid: string, fields: { club: string; time: string; venue: string }): Promise<void> {
  const template = process.env.WX_CHALLENGE_TEMPLATE ?? '';
  const appid = process.env.WX_APPID ?? '';
  const secret = process.env.WX_SECRET ?? '';
  if (!template || !appid || !secret || !openid) return;
  try {
    const token = await wechatAccessToken(appid, secret);
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        touser: openid,
        template_id: template,
        data: {
          thing1: { value: fields.club },
          time2: { value: fields.time },
          thing3: { value: fields.venue },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode) throw new Error(data.errmsg || '微信提醒失败');
  } catch (error) {
    console.error('[wechat]', error instanceof Error ? error.message : error);
  }
}

async function wechatAccessToken(appid: string, secret: string): Promise<string> {
  if (wxTokenCache && wxTokenCache.until > Date.now()) return wxTokenCache.token;
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appid);
  url.searchParams.set('secret', secret);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = (await response.json()) as { access_token?: string; expires_in?: number; errmsg?: string };
  if (!data.access_token) throw new Error(data.errmsg || '拿不到微信 access_token');
  wxTokenCache = { token: data.access_token, until: Date.now() + Math.max(60, (data.expires_in ?? 7200) - 120) * 1000 };
  return data.access_token;
}
