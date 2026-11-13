// A Telegram message to the owner when someone opens a game in the lobby (quick pairing or a
// game of their own), signed in or not, so the owner can come and play them while the site is
// still quiet. Staff's own seeks are not sent, and one player's seeks at most once in
// SEEK_ALERT_COOLDOWN_MS. Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (as server/alerts.ts);
// without them nothing is sent.

import { timeControl } from '../src/clock/clock.ts';
import { getVariant } from '../src/engine/index.ts';
import type { Seek } from '../src/online/lobby.ts';
import { isStaffRole } from '../src/online/admin.ts';

/** One player's seeks are told about at most once in this long. */
export const SEEK_ALERT_COOLDOWN_MS = 5 * 60_000;
/**
 * And at most this many messages in that time across the whole lobby: a guest's id is the
 * browser's own, so a script with fresh ids cannot flood the chat (or the map).
 */
export const SEEK_ALERT_MAX = 10;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The message: who, what, and the link to the lobby. */
export function seekAlertText(seek: Seek, signedIn: boolean, origin = 'https://punkchess.com'): string {
  let variant = seek.variantId;
  try {
    variant = getVariant(seek.variantId).name;
  } catch {
    // an unknown id: shown as it is
  }
  const who = signedIn
    ? `<b>${escape(seek.player.name)}</b>${seek.player.rating !== null ? ` (${Math.round(seek.player.rating)}${seek.player.provisional ? '?' : ''})` : ''}`
    : `<b>${escape(seek.player.name)}</b> (misafir)`;
  const kind = seek.quick ? 'Hızlı oyun arıyor' : 'Oyun açtı';
  const rated = seek.rated ? 'puanlı' : 'puansız';
  return `♟ ${kind}: ${who}\n${escape(variant)} · ${escape(timeControl(seek.timeControlId).label)} · ${rated}\n${origin}/online`;
}

/** Whether a seek by `playerId` may be told about at `now` (and notes it when so). */
export function seekAlertDue(last: Map<string, number>, playerId: string, now: number): boolean {
  const at = last.get(playerId);
  if (at !== undefined && now - at < SEEK_ALERT_COOLDOWN_MS) return false;
  // Old entries go: what is left are the messages of the last SEEK_ALERT_COOLDOWN_MS.
  for (const [id, t] of last) if (now - t >= SEEK_ALERT_COOLDOWN_MS) last.delete(id);
  if (last.size >= SEEK_ALERT_MAX) return false;
  last.set(playerId, now);
  return true;
}

/** The bit of D1 used here (a D1Database fits). */
interface RoleDb {
  prepare(query: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null> } };
}

interface AlertEnv {
  readonly DB?: RoleDb;
  readonly TELEGRAM_BOT_TOKEN?: string;
  readonly TELEGRAM_CHAT_ID?: string;
}

/** Sends the message, unless the seek is a staff member's own; never throws. */
export async function sendSeekAlert(env: AlertEnv, seek: Seek, accountId: string | null): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    if (accountId && env.DB) {
      const row = await env.DB.prepare('SELECT role FROM users WHERE id = ?1')
        .bind(accountId)
        .first<{ role: string | null }>();
      if (isStaffRole(row?.role ?? null)) return;
    }
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: seekAlertText(seek, !!accountId),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error('seek alert not sent', res.status);
  } catch (e) {
    console.error('seek alert failed', e);
  }
}
