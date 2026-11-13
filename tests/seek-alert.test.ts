import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUICK_VARIANT, makeSeek } from '../src/online/lobby.ts';
import type { LobbyPlayer, Seek } from '../src/online/lobby.ts';
import {
  SEEK_ALERT_COOLDOWN_MS,
  SEEK_ALERT_MAX,
  seekAlertDue,
  seekAlertText,
  sendSeekAlert,
} from '../server/seek-alert.ts';

const guest: LobbyPlayer = { id: 'guest-0001', name: 'Punk#1234', rating: null };
const member: LobbyPlayer = { id: 'user-00001', name: 'Ali<b>', rating: 1512.4, provisional: true, account: true };
const quick = (p: LobbyPlayer, rated = false): Seek =>
  makeSeek('s1', p, { variantId: QUICK_VARIANT(), timeControlId: '3+2', color: 'random', rated }, true, 0)!;

describe('lobi bildirimi (Telegram)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mesaj: kim, ne, bağlantı; misafir ayrı yazılır, isim kaçışlanır', () => {
    expect(seekAlertText(quick(guest), false)).toBe(
      '♟ Hızlı oyun arıyor: <b>Punk#1234</b> (misafir)\nStandart · 3+2 · puansız\nhttps://punkchess.com/online',
    );
    const own = makeSeek(
      's2',
      member,
      { variantId: 'jester', timeControlId: '5+3', color: 'w', rated: true },
      false,
      0,
    )!;
    expect(seekAlertText(own, true)).toBe(
      '♟ Oyun açtı: <b>Ali&lt;b&gt;</b> (1512?)\nJester · 5+3 · puanlı\nhttps://punkchess.com/online',
    );
  });

  it('aynı oyuncu için 5 dakikada en fazla bir bildirim', () => {
    const last = new Map<string, number>();
    expect(seekAlertDue(last, 'a', 1000)).toBe(true);
    expect(seekAlertDue(last, 'a', 1000 + SEEK_ALERT_COOLDOWN_MS - 1)).toBe(false);
    expect(seekAlertDue(last, 'b', 2000)).toBe(true);
    expect(seekAlertDue(last, 'a', 1000 + SEEK_ALERT_COOLDOWN_MS)).toBe(true);
    // b's old entry is cleared once its time is up
    seekAlertDue(last, 'c', 2000 + SEEK_ALERT_COOLDOWN_MS);
    expect(last.has('b')).toBe(false);
  });

  it('tüm lobide 5 dakikada en fazla SEEK_ALERT_MAX bildirim (yeni kimliklerle sel olmaz)', () => {
    const last = new Map<string, number>();
    for (let i = 0; i < SEEK_ALERT_MAX; i++) expect(seekAlertDue(last, `g${i}`, 1000 + i)).toBe(true);
    expect(seekAlertDue(last, 'fresh', 2000)).toBe(false);
    expect(last.size).toBe(SEEK_ALERT_MAX);
    expect(seekAlertDue(last, 'fresh', 1000 + SEEK_ALERT_COOLDOWN_MS)).toBe(true);
  });

  it('gönderir; yöneticinin kendi ilanını ve ayarsız ortamı göndermez', async () => {
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const db = (role: string | null) =>
      ({ prepare: () => ({ bind: () => ({ first: async () => ({ role }) }) }) }) as never;
    const env = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' };

    await sendSeekAlert({ ...env, DB: db(null) }, quick(guest), null);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ chat_id: '1', parse_mode: 'HTML' });

    await sendSeekAlert({ ...env, DB: db('admin') }, quick(member, true), member.id);
    await sendSeekAlert({ ...env, DB: db('moderator') }, quick(member, true), member.id);
    await sendSeekAlert({ DB: db(null) }, quick(guest), null);
    expect(fetch).toHaveBeenCalledTimes(1);

    await sendSeekAlert({ ...env, DB: db('user') }, quick(member, true), member.id);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
