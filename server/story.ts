// The daily puzzle as an Instagram story (server/story-image.ts):
//   GET /og/daily-story.png   today's story picture (kept in the edge cache for the day)
// and, from the cron, the picture sent to the owner on Telegram once a day at 12:00 (Turkey),
// to be saved and posted.

import { createGame, findMove, getVariant, makeMove, parseSquare } from '../src/engine/index.ts';
import type { PieceType } from '../src/engine/index.ts';
import { dailyDay, dailyNumber } from '../src/online/daily.ts';
import type { PuzzleData } from '../src/online/puzzle.ts';
import { puzzleOf, toData } from './daily.ts';
import type { Env } from './game-room.ts';
import { STORY_BANNERS, STORY_FRAME, STORY_GLYPHS, STORY_PIECES } from './story-assets.ts';
import { encodeStory, unpackStory } from './story-image.ts';
import type { StoryAssets, StoryPuzzle } from './story-image.ts';

let assets: Promise<StoryAssets> | null = null;
const loadAssets = () =>
  (assets ??= unpackStory({ frame: STORY_FRAME, pieces: STORY_PIECES, glyphs: STORY_GLYPHS, banners: STORY_BANNERS }));

/** The hour (Turkey) the story goes out on Telegram. */
export const STORY_HOUR = 12;
const TURKEY_MS = 3 * 3_600_000;
/** A try that did not end is tried again this much later. */
const RETRY_MS = 15 * 60_000;

/** The puzzle's position as the player sees it: after the opponent's first move, which is marked. */
export function storyPuzzle(p: PuzzleData, number: number): StoryPuzzle | null {
  try {
    const v = getVariant(p.variantId);
    const start = createGame(v, p.fen);
    const uci = p.moves[0];
    if (!uci) return { board: start.position.board, lastMove: null, toMove: start.position.turn, number };
    const promotion = uci.length > 4 ? (uci[4] as PieceType) : undefined;
    const move = findMove(v, start, parseSquare(uci.slice(0, 2)), parseSquare(uci.slice(2, 4)), promotion);
    if (!move) return null;
    const after = makeMove(v, start, move);
    return {
      board: after.position.board,
      lastMove: { from: move.from, to: move.to },
      toMove: after.position.turn,
      number,
    };
  } catch {
    return null;
  }
}

/** Today's story picture, or null when there is no puzzle. */
async function todaysStory(env: Env, now: number): Promise<{ png: Uint8Array; day: string; number: number } | null> {
  if (!env.DB) return null;
  const day = dailyDay(now);
  const row = await puzzleOf(env.DB, day);
  if (!row) return null;
  const number = dailyNumber(day);
  const puzzle = storyPuzzle(toData(row), number);
  if (!puzzle) return null;
  return { png: await encodeStory(await loadAssets(), puzzle), day, number };
}

/** GET /og/daily-story.png */
export async function storyResponse(env: Env, url: URL): Promise<Response> {
  const now = Date.now();
  const key = new Request(`${url.origin}/og/daily-story.png?day=${dailyDay(now)}`);
  const cached = await caches.default.match(key).catch(() => undefined);
  if (cached) return cached;
  const story = await todaysStory(env, now);
  if (!story) return new Response('no puzzle', { status: 404 });
  const res = new Response(story.png, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=600',
      'content-disposition': `inline; filename="punkchess-sabotaj-${story.number}.png"`,
    },
  });
  await caches.default.put(key, res.clone()).catch(() => undefined);
  return res;
}

/** From the cron: at 12:00 (Turkey) and after, once a day, the story to the owner on Telegram. */
export async function sendDailyStory(env: Env, now: number): Promise<void> {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  if (new Date(now + TURKEY_MS).getUTCHours() < STORY_HOUR) return;
  const kind = `story:${dailyDay(now)}`;
  // Claimed first: two cron runs at once send one picture. A claim marks the try (its time); a
  // sent picture is marked with 0. A try that did not end (failed, or the Worker stopped
  // half-way) is tried again RETRY_MS later, so a lasting failure is not retried every run.
  const claimed = await env.DB.prepare(
    `INSERT INTO alerts_sent (kind, at) VALUES (?1, ?2)
     ON CONFLICT(kind) DO UPDATE SET at = excluded.at WHERE alerts_sent.at > 0 AND alerts_sent.at <= ?2 - ?3`,
  )
    .bind(kind, now, RETRY_MS)
    .run();
  if (!claimed.meta.changes) return;
  const story = await todaysStory(env, now).catch(() => null);
  if (!story) return console.error('daily story: no picture (no puzzle, or it could not be drawn)');
  const form = new FormData();
  form.set('chat_id', env.TELEGRAM_CHAT_ID);
  form.set(
    'caption',
    `Günün sabotajı #${story.number} · hikaye görseli
Link etiketi: https://punkchess.com/daily`,
  );
  form.set('photo', new Blob([story.png], { type: 'image/png' }), `punkchess-sabotaj-${story.number}.png`);
  const ok = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form,
  })
    .then((r) => r.ok)
    .catch(() => false);
  if (!ok) return console.error('daily story: Telegram did not take it');
  await env.DB.prepare('UPDATE alerts_sent SET at = 0 WHERE kind = ?1').bind(kind).run();
}
