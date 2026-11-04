// Alerts to the owner on Telegram, from the Worker's cron (every 5 minutes), without waiting for
// the nightly report: for now, a spike of error reports from browsers. Each kind of alert is sent
// at most once an hour (migrations/0026_suggestions_alerts.sql). Needs TELEGRAM_BOT_TOKEN
// (wrangler secret put TELEGRAM_BOT_TOKEN) and TELEGRAM_CHAT_ID; without them nothing is sent.

import { ALERT_COOLDOWN_MS, ERROR_SPIKE, ERROR_WINDOW_MS, alertAllowed } from '../src/online/report.ts';
import type { Env } from './game-room.ts';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Sends `kind` once per cooldown: true when it was sent. */
async function send(env: Env, kind: string, html: string, now: number): Promise<boolean> {
  const db = env.DB;
  const last = await db.prepare('SELECT at FROM alerts_sent WHERE kind = ?1').bind(kind).first<{ at: number }>();
  if (!alertAllowed(last?.at ?? null, now)) return false;
  // Claimed before sending: two cron runs at once send one message.
  const claimed = await db
    .prepare(
      `INSERT INTO alerts_sent (kind, at) VALUES (?1, ?2)
       ON CONFLICT(kind) DO UPDATE SET at = excluded.at WHERE alerts_sent.at <= ?2 - ?3`,
    )
    .bind(kind, now, ALERT_COOLDOWN_MS)
    .run();
  if (!claimed.meta.changes) return false;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: html, parse_mode: 'HTML' }),
  });
  if (!res.ok) console.error('alert not sent', kind, res.status);
  return res.ok;
}

/** From the cron: looks for a problem worth telling the owner about now. */
export async function checkAlerts(env: Env, now = Date.now()): Promise<void> {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const errors = await env.DB.prepare(
    `SELECT substr(json_extract(report, '$.message'), 1, 160) AS message, count(*) AS n
     FROM error_reports WHERE at >= ?1 GROUP BY message ORDER BY n DESC`,
  )
    .bind(now - ERROR_WINDOW_MS)
    .all<{ message: string | null; n: number }>();
  const total = errors.results.reduce((sum, e) => sum + e.n, 0);
  if (total < ERROR_SPIKE) return;
  const top = errors.results
    .slice(0, 3)
    .map((e) => `• <code>${escape(e.message ?? '?')}</code> ×${e.n}`)
    .join('\n');
  await send(
    env,
    'error-spike',
    `🚨 <b>Punkchess: hata artışı</b>\nSon ${ERROR_WINDOW_MS / 60_000} dakikada ${total} hata bildirimi geldi.\n${top}\n<i>Bir saat içinde aynı uyarı tekrar gönderilmez.</i>`,
    now,
  );
}
