import { describe, expect, it } from 'vitest';
import { keyMatches } from '../server/auth-util.ts';
import {
  ALERT_COOLDOWN_MS,
  MAX_HISTORY_DAYS,
  MAX_SUGGESTIONS,
  alertAllowed,
  cleanSuggestions,
  historyDays,
  reportDue,
} from '../src/online/report.ts';

describe('günlük rapor anahtarı', () => {
  it('doğru anahtar kabul edilir', async () => {
    expect(await keyMatches('Bearer gizli', 'gizli')).toBe(true);
  });

  it('yanlış, eksik ya da tanımsız anahtar reddedilir', async () => {
    expect(await keyMatches('Bearer yanlis', 'gizli')).toBe(false);
    expect(await keyMatches('gizli', 'gizli')).toBe(false);
    expect(await keyMatches(null, 'gizli')).toBe(false);
    expect(await keyMatches('Bearer ', '')).toBe(false);
    expect(await keyMatches('Bearer x', undefined)).toBe(false);
  });
});

describe('günlük raporun saklanması', () => {
  // 2026-11-04 in UTC; Turkey is UTC+3.
  const at = (utcHour: number, min = 0) => Date.UTC(2026, 10, 4, utcHour, min);

  it('Türkiye saatiyle 23:00 ile gece yarısı arasında saklanır', () => {
    expect(reportDue(at(19, 55))).toBe(false);
    expect(reportDue(at(20, 0))).toBe(true);
    expect(reportDue(at(20, 55))).toBe(true);
    expect(reportDue(at(21, 0))).toBe(false);
  });

  it('geçmiş gün sayısı 1 ile üst sınır arasında kalır', () => {
    expect(historyDays(null)).toBe(7);
    expect(historyDays('30')).toBe(30);
    expect(historyDays('0')).toBe(1);
    expect(historyDays('9999')).toBe(MAX_HISTORY_DAYS);
    expect(historyDays('abc')).toBe(7);
  });
});

describe('haftalık öneriler', () => {
  it('sırayla numaralanır, boşlar atılır, metinler kırpılır', () => {
    const r = cleanSuggestions({
      week: '2026-11-08',
      items: [
        { title: ' Coin dengesi ', body: 'Neden', size: 'orta', risk: 'orta' },
        { title: '', body: 'başlıksız' },
        { title: 'Uzun', body: 'x'.repeat(5000) },
      ],
    });
    expect(r?.items.map((i) => [i.n, i.title])).toEqual([
      [1, 'Coin dengesi'],
      [2, 'Uzun'],
    ]);
    expect(r?.items[1].body.length).toBe(2000);
    expect(r?.items[1].size).toBeNull();
  });

  it('bozuk gövde, yanlış hafta ya da fazla öneri', () => {
    expect(cleanSuggestions(null)).toBeNull();
    expect(cleanSuggestions({ week: 'pazar', items: [{ title: 'a', body: 'b' }] })).toBeNull();
    expect(cleanSuggestions({ week: '2026-11-08', items: [] })).toBeNull();
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `t${i}`, body: 'b' }));
    expect(cleanSuggestions({ week: '2026-11-08', items: many })?.items.length).toBe(MAX_SUGGESTIONS);
  });
});

describe('uyarılar', () => {
  it('aynı uyarı bir saatte bir gönderilir', () => {
    expect(alertAllowed(null, 1000)).toBe(true);
    expect(alertAllowed(0, ALERT_COOLDOWN_MS - 1)).toBe(false);
    expect(alertAllowed(0, ALERT_COOLDOWN_MS)).toBe(true);
  });
});
