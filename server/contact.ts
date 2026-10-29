// POST /api/contact: a message from the contact page (src/ui/ContactPage.tsx),
// kept for staff to read on the admin page (server/admin.ts).
//
// Against spam: a hidden field only bots fill in (they are told it worked), at most
// CONTACT_PER_HOUR messages an hour from one sender (by a hash of the IP address,
// never the address itself) and the site's request limits (server/limits.ts).

import { CONTACT_KEEP_DAYS, CONTACT_PER_HOUR, cleanContact } from '../src/online/contact.ts';
import { currentUser, sameOrigin } from './auth.ts';
import type { Env } from './game-room.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** All senders together: more than this in a day is a flood, not mail. */
const PER_DAY = 300;

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleContact(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/contact') return null;
  if (request.method !== 'POST') return json({ error: 'not-found' }, 404);
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  // The hidden field: a person never sees it, a bot fills it in.
  if (body && typeof body.website === 'string' && body.website.trim()) return json({ ok: true });
  const input = cleanContact(body);
  if ('problem' in input) return json({ error: input.problem }, 400);

  const db = env.DB;
  const now = Date.now();
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const ipHash = ip ? await sha256(`punkchess-contact:${ip}`) : null;
  const [mine, all] = await Promise.all([
    ipHash
      ? db
          .prepare('SELECT count(*) AS n FROM contact_messages WHERE ip_hash = ?1 AND at >= ?2')
          .bind(ipHash, now - HOUR)
          .first<{ n: number }>()
      : null,
    db
      .prepare('SELECT count(*) AS n FROM contact_messages WHERE at >= ?1')
      .bind(now - DAY)
      .first<{ n: number }>(),
  ]);
  if ((mine?.n ?? 0) >= CONTACT_PER_HOUR || (all?.n ?? 0) >= PER_DAY) return json({ error: 'too-many' }, 429);

  const user = await currentUser(request, env).catch(() => null);
  await db
    .prepare(
      `INSERT INTO contact_messages (at, topic, name, email, username, message, ip_hash)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(now, input.topic, input.name, input.email, user?.username ?? null, input.message, ipHash)
    .run();
  if (Math.random() < 0.05) {
    await db
      .prepare('DELETE FROM contact_messages WHERE at < ?1')
      .bind(now - CONTACT_KEEP_DAYS * DAY)
      .run();
  }
  return json({ ok: true });
}
